// check.js：校验 out/ 构建产物（完全独立，不访问上级 src）
// - i18n 覆盖：语言包每个值必须渲染进对应 out 页面
// - 泄漏检查：无未渲染 EJS 标签 / undefined
// - sitemap 条数、URL 无双斜杠、robots、静态资源、tailwind 产物
// - minify 断言：HTML 无注释残留、无空白行；语言包值无 \n、无连续空格
// 用法：node scripts/check.js   （退出码 0=通过，1=有差异）
const fs = require("fs");
const path = require("path");
const { ROOT, readConfig, parseHtml, collapse } = require("./lib");

const CFG = readConfig();
const LANGS = Object.entries(CFG.langs);
const PAGES = Object.entries(CFG.pages);
const OUT = path.join(ROOT, CFG.site.outputDir || "out");

function outPath(code, pageName) {
  const dir = CFG.langs[code].dir === "/" ? "" : CFG.langs[code].dir;
  return path.join(OUT, dir, pageName === "index" ? "index.html" : pageName + ".html");
}

const packs = {};
for (const [code] of LANGS) packs[code] = JSON.parse(fs.readFileSync(path.join(ROOT, "i18n", code + ".json"), "utf8"));

function flatten(obj, prefix = "", out = {}) {
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => { if (v !== null && v !== undefined) flatten(v, `${prefix}.${i}`, out); });
    return out;
  }
  if (obj && typeof obj === "object") {
    for (const k of Object.keys(obj)) flatten(obj[k], prefix ? `${prefix}.${k}` : k, out);
    return out;
  }
  if (prefix) out[prefix] = obj;
  return out;
}

const issues = [];
let htmlCount = 0;

// 1) i18n 覆盖 + 泄漏 + lang + title
for (const [pageName, cfg] of PAGES) {
  for (const [code] of LANGS) {
    if (code !== CFG.site.defaultLang && !cfg.localized) continue;
    htmlCount++;
    const out = outPath(code, pageName);
    if (!fs.existsSync(out)) {
      issues.push(`[缺失] ${code}/${pageName} 生成文件不存在`);
      continue;
    }
    const raw = fs.readFileSync(out, "utf8");

    // 泄漏检查
    if (/<%=|<%[-=]?/.test(raw)) issues.push(`[泄漏] ${code}/${pageName} 存在未渲染的 EJS 标签`);
    if (/undefined/.test(raw)) issues.push(`[泄漏] ${code}/${pageName} 存在 undefined 值`);

    // i18n 覆盖：每个语义化 key 的值必须出现在 out 中（先做 HTML 实体解码再匹配）
    const htmlText = raw
      .replace(/&#34;/g, '"').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, "\u00A0");
    const flat = flatten(packs[code][pageName] || {});
    for (const [key, val] of Object.entries(flat)) {
      if (typeof val !== "string" || !val.trim()) continue;
      const v = collapse(val);
      if (!htmlText.includes(v)) issues.push(`[覆盖] ${code}/${pageName} ${key} 未渲染进产物："${v.slice(0, 50)}"`);
    }

    // html lang
    const oHtml = parseHtml(raw).childNodes.find((n) => n.tagName === "html");
    const oLang = oHtml && oHtml.attrs.find((a) => a.name === "lang");
    if ((oLang && oLang.value) !== CFG.langs[code].htmlLang) {
      issues.push(`[lang] ${code}/${pageName} out="${oLang && oLang.value}" 期望 "${CFG.langs[code].htmlLang}"`);
    }

    // title（对照语言包 _seo，实体解码后比较）
    if (cfg.localized && packs[code]._seo && packs[code]._seo[pageName]) {
      const expected = packs[code]._seo[pageName].title;
      const m = /<title>([\s\S]*?)<\/title>/.exec(raw);
      const outTitle = m
        ? m[1].replace(/&#34;/g, '"').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
             .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        : "";
      if (expected && collapse(outTitle) !== collapse(expected)) {
        issues.push(`[title] ${code}/${pageName} out="${outTitle}" vs 语言包="${expected}"`);
      }
    }
  }
}

// 2) sitemap 与 robots
const sitemapPages = PAGES.filter(([, c]) => c.sitemap).length;
const sitemapExpected = LANGS.length * sitemapPages;
if (!fs.existsSync(path.join(OUT, "sitemap.xml"))) issues.push("[缺失] sitemap.xml");
else {
  const sm = fs.readFileSync(path.join(OUT, "sitemap.xml"), "utf8");
  const urlCount = (sm.match(/<url>/g) || []).length;
  if (urlCount !== sitemapExpected) issues.push(`[sitemap] 期望 ${sitemapExpected} 条 URL，实际 ${urlCount}`);
  if (!sm.includes(CFG.site.baseUrl)) issues.push("[sitemap] 缺少站点域名");
  if (/https?:\/\/[^/]+\/\//.test(sm)) issues.push("[sitemap] 存在双斜杠 URL");
  for (const [pageName, cfg] of PAGES) {
    if (!cfg.sitemap) continue;
    for (const [code] of LANGS) {
      const pageRel = pageName === "index" ? "" : cfg.path;
      const base = CFG.langs[code].dir === "/" ? "" : CFG.langs[code].dir.replace(/\/+$/, "");
      const expect = CFG.site.baseUrl.replace(/\/$/, "") + base + pageRel + (pageRel ? "" : "/");
      if (!sm.includes(`>${expect}</loc>`)) issues.push(`[sitemap] 缺少 ${code} ${pageName}: ${expect}`);
    }
  }
}
if (!fs.existsSync(path.join(OUT, "robots.txt"))) issues.push("[缺失] robots.txt");

// 3) 静态资源
for (const f of CFG.site.copyFiles) if (!fs.existsSync(path.join(OUT, f))) issues.push(`[静态] 缺失 ${f}`);
for (const d of CFG.site.copyDirs) if (!fs.existsSync(path.join(OUT, d))) issues.push(`[静态] 缺失目录 ${d}`);

// 4) minify 断言
{
  const tw = path.join(OUT, CFG.site.tailwind.output);
  if (!fs.existsSync(tw)) issues.push("[静态] 缺失 tailwind 编译产物 " + CFG.site.tailwind.output);
  else if (!fs.readFileSync(tw, "utf8").includes("--tw")) issues.push("[静态] tailwind.min.css 内容异常（非编译产物）");
  const probe = fs.readFileSync(outPath("en", "index"), "utf8");
  if (/<!--/.test(probe)) issues.push("[minify] HTML 残留注释");
  if (/^\s*$/m.test(probe)) issues.push("[minify] HTML 残留空白行");
}

// 5) 语言包值压缩断言
{
  const bad = [];
  for (const [code] of LANGS) {
    (function walk(o, kp) {
      if (typeof o === "string") {
        if (/\n/.test(o)) bad.push(`${code} ${kp} 含换行`);
        else if (/ {2,}/.test(o)) bad.push(`${code} ${kp} 含连续空格`);
      } else if (Array.isArray(o)) o.forEach((v, i) => walk(v, kp + "[" + i + "]"));
      else if (o && typeof o === "object") for (const k of Object.keys(o)) walk(o[k], kp ? kp + "." + k : k);
    })(packs[code], "");
  }
  if (bad.length) issues.push("[i18n] 语言包值未压缩: " + bad.slice(0, 5).join("; ") + (bad.length > 5 ? " …共 " + bad.length + " 处" : ""));
}

// 6) 品牌抽查
const zh = fs.readFileSync(outPath("zh-hans", "index"), "utf8");
if (!zh.includes("橙狐")) issues.push("[品牌] zh-hans 未包含“橙狐终端”");
const en = fs.readFileSync(outPath("en", "index"), "utf8");
if (en.includes("橙狐")) issues.push("[品牌] 英文版意外包含“橙狐终端”");

if (issues.length) {
  console.log(`check 未通过：${issues.length} 处差异`);
  issues.forEach((i) => console.log("  " + i));
  process.exit(1);
} else {
  console.log(`check 通过：${htmlCount} 个页面内容完整（${LANGS.length} 语言 × ${sitemapPages} 页 sitemap、静态资源、minify、语言包压缩），无泄漏/缺失`);
  process.exit(0);
}
