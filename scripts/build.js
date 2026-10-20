// build.js：编译 语言×页面 → out/（HTML minify、内联 JS terser、CSS clean-css），
// 复制 public/ 素材（favicon/appcast/txt/mmdb/assets）进 out/，压缩 assets 内 JS/CSS，
// 编译 Tailwind（input.css → assets/tailwind.min.css），生成 sitemap.xml / robots.txt
// 完全独立运行：只读 sitegen 内部（config/templates/i18n/public），不访问上级目录
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const ejs = require("ejs");
const { minify } = require("html-minifier-terser");
const { minify: terserMinify } = require("terser");
const CleanCSS = require("clean-css");
const { ROOT, readConfig } = require("./lib");

const CFG = readConfig();
const LANGS = Object.entries(CFG.langs); // [code, {dir,label,...}]
const PAGES = Object.entries(CFG.pages); // [name, cfg]
const OUT = path.join(ROOT, CFG.site.outputDir || "out"); // 编译产物目录
const PUB = path.join(ROOT, CFG.site.staticRoot || "public"); // 静态素材目录
const TPL = path.join(ROOT, "templates");

const PARTIALS = {
  head: fs.readFileSync(path.join(TPL, "partials", "head.ejs"), "utf8"),
  nav: fs.readFileSync(path.join(TPL, "partials", "nav.ejs"), "utf8"),
  footer: fs.readFileSync(path.join(TPL, "partials", "footer.ejs"), "utf8"),
  langSwitcher: fs.readFileSync(
    path.join(TPL, "partials", "langSwitcher.ejs"),
    "utf8",
  ),
};

const packs = {};
for (const [code] of LANGS)
  packs[code] = JSON.parse(
    fs.readFileSync(path.join(ROOT, "i18n", code + ".json"), "utf8"),
  );

const LAST_MOD =
  CFG.site.lastmod === "auto"
    ? new Date().toISOString().slice(0, 10)
    : CFG.site.lastmod;

function flatten(obj, prefix = "", out = {}) {
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => {
      if (v !== null && v !== undefined) flatten(v, `${prefix}.${i}`, out);
    });
    return out;
  }
  if (obj && typeof obj === "object") {
    for (const k of Object.keys(obj))
      flatten(obj[k], prefix ? `${prefix}.${k}` : k, out);
    return out;
  }
  if (prefix) out[prefix] = obj;
  return out;
}

// URL 路径：语言目录 + 页面路径，杜绝 "//" 双斜杠
function urlPath(langDir, pageRel) {
  const base = langDir === "/" ? "" : langDir.replace(/\/+$/, "");
  let p = base + (pageRel || "");
  if (!pageRel) p += "/";
  return p || "/";
}

// 渲染 语言×页面 → 返回 HTML 字符串
function renderPage(langCode, pageName) {
  const lang = CFG.langs[langCode];
  const cfg = CFG.pages[pageName];
  const pack = packs[langCode];
  const enPack = packs[CFG.site.defaultLang];

  const enFlat = flatten(enPack[pageName] || {});
  const flat = flatten(pack[pageName] || {});
  const t = {};
  for (const k of Object.keys(enFlat))
    t[k] = flat[k] !== undefined ? flat[k] : enFlat[k];
  // 语言独有的扩展 key（如正文多余片段的 hero.title.2）也要可渲染
  for (const k of Object.keys(flat)) if (!(k in t)) t[k] = flat[k];

  const langsList = LANGS.map(([code, l]) => ({ code, ...l }));
  const pageRel = pageName === "index" ? "" : cfg.path;
  const baseUrl = CFG.site.baseUrl.replace(/\/$/, "");
  const canonicalUrl = baseUrl + urlPath(lang.dir, pageRel);
  const ogLocales = LANGS.filter(([c]) => c !== langCode)
    .map(([, l]) => l.locale)
    .join(", ");

  // 站内链接语言化：/about → /zh-hans/about，/ → /zh-hans/；外链/锚点/协议相对链接不变
  const localizeHref = (h) => {
    if (!h || h.startsWith("#") || h.startsWith("//") || /^https?:/i.test(h))
      return h;
    return urlPath(lang.dir, h === "/" ? "" : h);
  };
  const navCfg = {
    ...(pageName === "index" ? CFG.nav.index : CFG.nav.legal),
    type: pageName === "index" ? "index" : "legal",
  };
  navCfg.cta = { ...navCfg.cta, href: localizeHref(navCfg.cta.href) };
  navCfg.logoHref = urlPath(lang.dir, "");
  const footerLinks = (
    CFG.footer.links[pageName] || CFG.footer.links.index
  ).map((l) => ({
    ...l,
    href: localizeHref(l.href),
  }));

  const locals = {
    t,
    lang,
    langs: langsList,
    baseUrl,
    pageRel,
    urlPath,
    canonicalUrl,
    ogLocales,
    seo: pack._seo[pageName] || {},
    meta: CFG.meta,
    navCfg,
    footerLinks,
    defaultDir: CFG.langs[CFG.site.defaultLang].dir,
    htmlLang: lang.htmlLang,
  };

  locals.langSwitcher = ejs.render(PARTIALS.langSwitcher, locals);
  locals.nav = ejs.render(PARTIALS.nav, locals);
  locals.footer = ejs.render(PARTIALS.footer, locals);
  if (cfg.localized) locals.head = ejs.render(PARTIALS.head, locals);

  const tpl = fs.readFileSync(path.join(TPL, pageName + ".ejs"), "utf8");
  return ejs.render(tpl, locals);
}

// ---- 压缩三件套 ----

// 1) HTML minify（html-minifier-terser）；\u00A0 先占位再还原，防止被当空白折叠
async function minifyHtml(raw) {
  const guarded = raw.replace(/\u00A0/g, "\uE000");
  const out = await minify(guarded, {
    collapseWhitespace: true,
    removeComments: true,
    removeRedundantAttributes: true,
    collapseBooleanAttributes: true,
    removeEmptyAttributes: true,
    sortAttributes: false,
    keepClosingSlash: false,
  });
  return out.replace(/\uE000/g, "\u00A0");
}

// 2) 内联 <script>（无 src、非 ld+json）用 terser 压缩
async function minifyInlineJs(html) {
  const re = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi;
  const blocks = [];
  html = html.replace(re, (m, attrs, code, off) => {
    blocks.push({ attrs, code, off });
    return m;
  });
  for (const b of blocks) {
    const typeAttr = /\btype\s*=\s*"([^"]*)"/.exec(b.attrs);
    if (
      typeAttr &&
      typeAttr[1] !== "text/javascript" &&
      typeAttr[1] !== "application/javascript"
    )
      continue; // ld+json 等原样
    const { code } = await terserMinify(b.code, {
      compress: { defaults: true },
    });
    html = html.replace(
      `<script${b.attrs}>${b.code}</script>`,
      `<script${b.attrs}>${code}</script>`,
    );
  }
  return html;
}

// 3) 压缩 assets 中的 JS / CSS 文件
function minifyAssetJs(file) {
  const raw = fs.readFileSync(file, "utf8");
  terserMinify(raw, { compress: { defaults: true } }).then(({ code }) => {
    fs.writeFileSync(file, code);
  });
}
function minifyAssetCss(file) {
  const raw = fs.readFileSync(file, "utf8");
  fs.writeFileSync(file, new CleanCSS({ level: 1 }).minify(raw).styles);
}

// 清理并重建输出目录
function cleanOut() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
}

// 复制 public/ 素材（favicon.ico、appcast.xml、eb06*.txt、GeoLite2-Country.mmdb、assets/）
function copyStatic() {
  for (const f of CFG.site.copyFiles) {
    let src = path.join(PUB, f);
    if (!fs.existsSync(src) && fs.existsSync(path.join(PUB, "assets", f)))
      src = path.join(PUB, "assets", f);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(OUT, f));
    else console.warn(`  [skip] 素材不存在: ${f}`);
  }
  for (const d of CFG.site.copyDirs) {
    const src = path.join(PUB, d);
    if (fs.existsSync(src))
      fs.cpSync(src, path.join(OUT, d), { recursive: true });
    else console.warn(`  [skip] 素材目录不存在: ${d}`);
  }
}

// Tailwind v4：sitegen/input.css → out/assets/tailwind.min.css（@source 指向 templates/**/*.ejs）
function buildTailwind() {
  if (!CFG.site.tailwind || !CFG.site.tailwind.input) return false;
  const inCss = path.join(ROOT, CFG.site.tailwind.input);
  if (!fs.existsSync(inCss)) {
    console.warn("  [skip] input.css 不存在");
    return false;
  }
  const outCss = path.join(OUT, CFG.site.tailwind.output);
  fs.mkdirSync(path.dirname(outCss), { recursive: true });
  try {
    execSync(`npx @tailwindcss/cli -i "${inCss}" -o "${outCss}" --minify`, {
      stdio: "pipe",
      cwd: ROOT,
    });
    console.log(
      `- tailwind: ${CFG.site.tailwind.input} → ${CFG.site.tailwind.output} (${Math.round(fs.statSync(outCss).size / 1024)} KB)`,
    );
    return true;
  } catch (e) {
    console.warn(
      "  [skip] tailwind 编译失败（保留素材内旧产物）:",
      e.message.split("\n")[0],
    );
    return false;
  }
}

// sitemap.xml（clean URL；每页每语言一条，含全部语言 alternate + x-default）
function buildSitemap() {
  const urls = [];
  for (const [pageName, cfg] of PAGES) {
    if (!cfg.sitemap) continue;
    for (const [code, lang] of LANGS) {
      const pageRel = pageName === "index" ? "" : cfg.path;
      const loc =
        CFG.site.baseUrl.replace(/\/$/, "") + urlPath(lang.dir, pageRel);
      const alternates = LANGS.map(
        ([, l]) =>
          `      <xhtml:link rel="alternate" hreflang="${l.hreflang}" href="${CFG.site.baseUrl.replace(/\/$/, "") + urlPath(l.dir, pageRel)}" />`,
      );
      alternates.push(
        `      <xhtml:link rel="alternate" hreflang="x-default" href="${CFG.site.baseUrl.replace(/\/$/, "") + urlPath(CFG.langs[CFG.site.defaultLang].dir, pageRel)}" />`,
      );
      urls.push(`  <url>
    <loc>${loc}</loc>
    <lastmod>${LAST_MOD}</lastmod>
    <changefreq>${cfg.changefreq}</changefreq>
    <priority>${(code === CFG.site.defaultLang && cfg.enPriority) || cfg.priority}</priority>
${alternates.join("\n")}
  </url>`);
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join("\n")}
</urlset>
`;
}

// robots.txt
function buildRobots() {
  return `User-agent: *
Allow: /

Sitemap: ${CFG.site.baseUrl.replace(/\/$/, "")}/sitemap.xml
`;
}

// 主流程（异步：terser 压缩内联 JS）
async function main() {
  cleanOut();

  // 1) 编译全部页面并 minify
  const jobs = [];
  let count = 0;
  for (const [pageName, cfg] of PAGES) {
    for (const [code] of LANGS) {
      if (code !== CFG.site.defaultLang && !cfg.localized) continue; // 404 仅英文
      const dir = path.join(
        OUT,
        CFG.langs[code].dir === "/" ? "" : CFG.langs[code].dir,
      );
      fs.mkdirSync(dir, { recursive: true });
      const outFile =
        pageName === "index"
          ? path.join(dir, "index.html")
          : path.join(dir, pageName + ".html");
      jobs.push(
        (async () => {
          const html = await minifyHtml(renderPage(code, pageName));
          fs.writeFileSync(outFile, await minifyInlineJs(html));
          count++;
        })(),
      );
    }
  }
  await Promise.all(jobs);

  // 2) 素材 + tailwind + SEO
  copyStatic();
  buildTailwind();
  fs.writeFileSync(path.join(OUT, "sitemap.xml"), buildSitemap());
  fs.writeFileSync(path.join(OUT, "robots.txt"), buildRobots());

  // 3) 压缩 out 内的 JS / CSS（script.js 等素材；tailwind 产物已 minified，跳过）
  for (const f of CFG.site.minifyJs || [
    "assets/script.js",
    "assets/tailwind.min.js",
  ]) {
    const file = path.join(OUT, f);
    if (fs.existsSync(file)) minifyAssetJs(file);
  }
  for (const f of CFG.site.minifyCss || ["assets/style.css"]) {
    const file = path.join(OUT, f);
    if (fs.existsSync(file)) minifyAssetCss(file);
  }

  console.log(
    `build 完成: ${count} 个 HTML 页面（已 minify + 内联 JS terser）→ ${CFG.site.outputDir || "out"}/`,
  );
  console.log(
    `- 素材复制: ${CFG.site.copyFiles.join(", ")} + ${CFG.site.copyDirs.join(", ")} → out/`,
  );
  console.log(
    `- sitemap.xml（${LANGS.length * PAGES.filter(([, c]) => c.sitemap).length} 条 URL）、robots.txt`,
  );
  console.log(`- lastmod: ${LAST_MOD}`);
}

main().catch((e) => {
  console.error("build 失败:", e);
  process.exit(1);
});
