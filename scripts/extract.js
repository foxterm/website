// extract.js：从 src/ 英文母版提取模板（templates/<page>.ejs）与语言包（i18n/<lang>.json）
// 语义化 key 由 keygen.js 生成；head / header / footer 整块替换为 partial 调用；文本/属性槽位替换为 EJS 占位符。
// 用法：
//   node scripts/extract.js            # 全量提取（重写模板与语言包）
//   node scripts/extract.js --sync     # 保留语言包中人工修改的值，仅补新 key
const fs = require("fs");
const path = require("path");
const {
  ROOT, SRC, readConfig, parseHtml, getAttr, collapse, collectSlots, align, extractSeo,
  slice, elementRegion, htmlLangRange,
} = require("./lib");
const { keygen } = require("./keygen");

const CFG = readConfig();
const PAGES = Object.keys(CFG.pages); // index/about/contact/terms/privacy/404
const LANGS = Object.keys(CFG.langs);
const TEMPLATES_DIR = path.join(ROOT, "templates");
const I18N_DIR = path.join(ROOT, "i18n");
const REPORT = path.join(ROOT, "extract-report.md");
const SYNC = process.argv.includes("--sync");

function ensureDir(d) { fs.mkdirSync(d, { recursive: true }); }

// 语言包值统一压缩：折叠连续空格（保留单空格 / \u00A0 / 内联元素后的前导单空格）
function normalizeValues(obj) {
  if (typeof obj === "string") return obj.replace(/ {2,}/g, " ");
  if (Array.isArray(obj)) return obj.map(normalizeValues);
  if (obj && typeof obj === "object") {
    const o = {};
    for (const k of Object.keys(obj)) o[k] = normalizeValues(obj[k]);
    return o;
  }
  return obj;
}

// 扩展 key：锚点 key 的最后一个数组段 +1（hero.title.1 → hero.title.2）
function nextArrayKey(key) {
  const m = /^(.*\.)(\d+)$/.exec(key);
  return m ? m[1] + (parseInt(m[2], 10) + 1) : key + ".1";
}

// dotted key -> 嵌套对象（纯数字段转为数组）
function buildNested(entries) {  const root = {};
  for (const [p, v] of entries) {
    if (!p) continue;
    const segs = p.split(".");
    let cur = root;
    for (let i = 0; i < segs.length - 1; i++) {
      const s = segs[i];
      if (cur[s] == null || typeof cur[s] !== "object") cur[s] = {};
      cur = cur[s];
    }
    cur[segs[segs.length - 1]] = v;
  }
  function norm(n) {
    if (n && typeof n === "object" && !Array.isArray(n)) {
      const keys = Object.keys(n);
      const allNum = keys.length > 0 && keys.every((k) => /^\d+$/.test(k));
      if (allNum) {
        const arr = [];
        for (const k of keys) arr[parseInt(k, 10)] = norm(n[k]);
        for (let i = 0; i < arr.length; i++) if (arr[i] === undefined) arr[i] = null;
        return arr;
      }
      for (const k of keys) n[k] = norm(n[k]);
    }
    return n;
  }
  return norm(root);
}

function replaceLangAttr(raw, seg) {
  const tag = raw.slice(seg.start, seg.end);
  const m = tag.match(/lang="[^"]*"/);
  if (!m) return tag.replace(/(<html\b[^>]*)(\/?>)/, '$1 lang="<%- htmlLang %>"$2');
  const idx = tag.indexOf(m[0]);
  return tag.slice(0, idx) + 'lang="<%- htmlLang %>"' + tag.slice(idx + m[0].length);
}

// 生成页面模板：区域替换（head/header/footer/html-lang）+ 槽位替换（从后往前，槽位跳过被区域覆盖者）
function buildTemplate(raw, doc, slots, opts) {
  const ops = [];
  const regions = [];
  if (opts.htmlLang) {
    const seg = htmlLangRange(doc);
    if (seg) ops.push({ start: seg.start, end: seg.end, text: replaceLangAttr(raw, seg) });
  }
  if (opts.localized) {
    const hr = elementRegion(doc, "head");
    if (hr) { ops.push({ start: hr.start, end: hr.end, text: "<%- head %>" }); regions.push(hr); }
  }
  const her = elementRegion(doc, "header");
  if (her) { ops.push({ start: her.start, end: her.end, text: "<%- nav %>" }); regions.push(her); }
  const fr = elementRegion(doc, "footer");
  if (fr) { ops.push({ start: fr.start, end: fr.end, text: "<%- footer %>" }); regions.push(fr); }
  for (const s of slots) {
    if (regions.some((r) => s.span.start >= r.start && s.span.end <= r.end)) continue;
    ops.push({ start: s.span.start, end: s.span.end, text: s.key ? `<%= t["${s.key}"] %>` : slice(raw, s.span) });
  }
  ops.sort((a, b) => b.start - a.start);
  let out = raw;
  for (const op of ops) out = out.slice(0, op.start) + op.text + out.slice(op.end);
  return out;
}

function readPage(lang, page) {
  const p = lang === "en" ? path.join(SRC, page + ".html") : path.join(SRC, lang, page + ".html");
  return fs.readFileSync(p, "utf8");
}

const report = [];
const reportAll = [];
const counts = {};
const extByLang = {}; // [lang][page:anchorKey] = 合并的多余片段
const extMeta = {};   // page:anchorKey → {anchorKey, extKey}（模板插入用）

ensureDir(TEMPLATES_DIR);
ensureDir(I18N_DIR);

// ---- 英文母版：槽位 + key ----
const master = {};
for (const page of PAGES) {
  const raw = readPage("en", page);
  const doc = parseHtml(raw);
  const slots = collectSlots(doc, raw, { skipHead: true });
  const keys = keygen(page, doc);
  if (keys.length !== slots.length) {
    reportAll.push(`- [${page}] keygen 数量(${keys.length}) != 槽位数量(${slots.length})，以较短者为准`);
  }
  const n = Math.min(keys.length, slots.length);
  const merged = [];
  for (let i = 0; i < slots.length; i++) {
    const key = i < n ? keys[i] : null;
    if (i < n && key === null) reportAll.push(`- [${page}] 槽位 #${i} (${slots[i].val.slice(0, 40)}) 未获得语义化 key，已降级为原文`);
    merged.push({ ...slots[i], key });
  }
  master[page] = { raw, doc, slots: merged };
}

// ---- 语言包 ----
const packs = {};
for (const lang of LANGS) {
  const pack = { _meta: { lang, label: CFG.langs[lang].label, updated: new Date().toISOString().slice(0, 10) }, _seo: {} };
  const existing = SYNC && fs.existsSync(path.join(I18N_DIR, lang + ".json"))
    ? JSON.parse(fs.readFileSync(path.join(I18N_DIR, lang + ".json"), "utf8"))
    : null;

  for (const page of PAGES) {
    if (lang !== "en" && !CFG.pages[page].localized) continue; // 404 仅英文
    const m = master[page];
    const langRaw = readPage(lang, page);
    const langDoc = parseHtml(langRaw);
    const langSlots = collectSlots(langDoc, langRaw, { skipHead: true });
    const { values, skipped, warns } = align(m.slots, langSlots);

    // 语言端多余文本片段（如 zh 把句号/句尾放在品牌 span 之后）并入其前一个成功匹配的 en 槽位
    // 归属判断依据"文档源码偏移"，不依赖数组顺序（文本收集顺序可能把 span 后文本排在 span 前）
    const matchedLang = new Set();
    for (const v of values) if (v) matchedLang.add(langSlots.indexOf(v));
    const merged = values.map((v) => (v ? v.val : null));
    const extras = [];
    for (let li = 0; li < langSlots.length; li++) {
      if (matchedLang.has(li)) continue;
      let best = -1;
      let bestOff = -1;
      for (let ei = 0; ei < values.length; ei++) {
        const v = values[ei];
        if (v && v.span.start > bestOff && v.span.start < langSlots[li].span.start) {
          bestOff = v.span.start;
          best = ei;
        }
      }
      if (best >= 0) extras.push({ enIdx: best, frag: langSlots[li].val, off: langSlots[li].span.start });
      else reportAll.push(`- [${lang}/${page}] 语言端多余片段无归属槽位，已丢弃："${langSlots[li].val.slice(0, 40)}"`);
    }
    extras.sort((a, b) => a.off - b.off);
    for (const ex of extras) {
      const anchorKey = m.slots[ex.enIdx].key;
      if (!anchorKey || /^(nav|footer)\./.test(anchorKey)) {
        // nav/footer 无渐变等视觉范围问题：保持并入前槽
        const cur = merged[ex.enIdx] !== null ? merged[ex.enIdx] : m.slots[ex.enIdx].val;
        merged[ex.enIdx] = /^[，。、？！；：,.;:]/.test(ex.frag) ? cur + ex.frag : cur + " " + ex.frag;
        reportAll.push(`- [${lang}/${page}] 多余片段并入 ${anchorKey}："${ex.frag.slice(0, 40)}"`);
      } else {
        // 正文区：多余片段用独立扩展 key（保持元素边界，避免渐变/样式范围被扩大）
        const extKey = nextArrayKey(anchorKey);
        const pk = page + ":" + anchorKey;
        extMeta[pk] = { anchorKey, extKey };
        const lk = (extByLang[lang] ||= {});
        lk[pk] = (lk[pk] || "") + (/^[，。、？！；：,.;:]/.test(ex.frag) ? ex.frag : (lk[pk] ? " " : "") + ex.frag);
        reportAll.push(`- [${lang}/${page}] 多余片段 → 扩展 key ${extKey}（保持元素边界）："${ex.frag.slice(0, 40)}"`);
      }
    }

    const entries = [];
    m.slots.forEach((slot, i) => {
      if (!slot.key) return;
      const value = merged[i] !== null && merged[i] !== undefined ? merged[i] : slot.val; // 对齐失败回退英文原文
      const manual = existing && existing[page] ? pickDeep(existing[page], slot.key) : undefined;
      entries.push([slot.key, manual !== undefined ? manual : value]);
      if (merged[i] === null && lang !== "en") reportAll.push(`- [${lang}/${page}] ${slot.key} 未匹配到语言文本，已回退英文："${slot.val.slice(0, 50)}"`);
    });
    // 正文区扩展 key：把多余片段的独立值写入语言包
    if (extByLang[lang]) {
      for (const [pk, frag] of Object.entries(extByLang[lang])) {
        const [p] = pk.split(":");
        if (p === page) entries.push([extMeta[pk].extKey, frag]);
      }
    }
    pack[page] = buildNested(entries);

    const seo = extractSeo(langDoc, langRaw);
    if (seo.title) pack._seo[page] = seo;
    for (const w of warns) {
      report.push({ lang, page, ...w });
      reportAll.push(`- [${lang}/${page}] ${w.type}: 英文"${w.enKey.slice(0, 40)}"${w.langKey ? " 对 " + w.langKey.slice(0, 40) : ""}`);
    }
    if (skipped > 0) reportAll.push(`- [${lang}/${page}] 语言端 ${skipped} 个额外槽位未消费`);
  }

  const out = {};
  for (const k of Object.keys(pack)) out[k] = pack[k];
  // _meta 放最前、_seo 放最后
  packs[lang] = { _meta: pack._meta, ...pack, _seo: pack._seo };
  fs.writeFileSync(path.join(I18N_DIR, lang + ".json"), JSON.stringify(normalizeValues(packs[lang]), null, 2) + "\n");
  const keyCount = Object.keys(pack).filter((k) => !k.startsWith("_")).reduce((n, k) => n + countKeys(pack[k]), 0);
  counts[lang] = keyCount;
}

function countKeys(obj) {
  let n = 0;
  if (Array.isArray(obj)) return obj.reduce((s, v) => s + (v && typeof v === "object" ? countKeys(v) : 1), 0);
  if (obj && typeof obj === "object") { for (const k of Object.keys(obj)) n += countKeys(obj[k]); return n; }
  return 1;
}

function pickDeep(obj, dotted) {
  let cur = obj;
  for (const seg of dotted.split(".")) {
    if (cur == null) return undefined;
    cur = cur[/^\d+$/.test(seg) ? parseInt(seg, 10) : seg];
  }
  return cur;
}

// ---- 模板 ----
for (const page of PAGES) {
  const m = master[page];
  const cfg = CFG.pages[page];
  let tpl = buildTemplate(m.raw, m.doc, m.slots, { htmlLang: cfg.localized, localized: cfg.localized });
  // 在锚点槽占位后插入扩展槽：若占位后紧跟闭合标签（如 </span>），插到闭合标签之外，
  // 保持元素边界（渐变 span 只包品牌词，不包后续多余片段）；en 无此 key 时输出空
  for (const [pk, meta] of Object.entries(extMeta)) {
    const [p, anchorKey] = pk.split(":");
    if (p !== page) continue;
    const occ = `<%= t["${anchorKey}"] %>`;
    if (!tpl.includes(occ)) {
      reportAll.push(`- [${page}] 扩展槽 ${meta.extKey} 未找到锚点占位 ${occ}（跳过）`);
      continue;
    }
    const re = new RegExp(`<%= t\\["${anchorKey}"\\] %>(<\\/[a-z][a-z0-9-]*>)?`);
    tpl = tpl.replace(re, (m, close) => `${occ}${close || ""}<%= t["${meta.extKey}"] || "" %>`);
  }
  fs.writeFileSync(path.join(TEMPLATES_DIR, page + ".ejs"), tpl);
}

// ---- 报告 ----
const lines = [];
lines.push(`# 提取报告 (${new Date().toISOString().slice(0, 10)})`);
lines.push("");
lines.push(`- 模板: ${PAGES.length} 个 (templates/*.ejs)`);
lines.push(`- 语言包: ${LANGS.length} 个 (i18n/*.json)`);
lines.push(`- 模式: ${SYNC ? "sync（保留人工修改）" : "full（全量重写）"}`);
lines.push("");
lines.push("| 语言 | 页面 | 类型 | 英文原文 | 语言文本 | 链 |");
lines.push("| --- | --- | --- | --- | --- | --- |");
for (const r of report) {
  lines.push(`| ${r.lang} | ${r.page} | ${r.type} | ${(r.enKey || "").replace(/|/g, "\\|").slice(0, 60)} | ${(r.langKey || "").replace(/|/g, "\\|").slice(0, 60)} | ${r.chain || ""} |`);
}
lines.push("");
lines.push("## 其他警告");
lines.push("");
for (const l of reportAll) lines.push(l);
lines.push("");
lines.push("## key 数量");
lines.push("");
for (const lang of LANGS) lines.push(`- ${lang}: ${counts[lang]} 个可翻译 key`);
lines.push("");
lines.push("> 结构不对齐（de/fr/ko 的 FAQ 安全条、ko h2 等）已自动回退英文，可在 i18n/<lang>.json 中人工补值后执行 `npm run sync` 保留。");
fs.writeFileSync(REPORT, lines.join("\n"));

console.log(`extract ${SYNC ? "(sync)" : "(full)"} 完成`);
console.log(`- 模板: templates/*.ejs (${PAGES.length})`);
for (const lang of LANGS) console.log(`- i18n/${lang}.json: ${counts[lang]} key`);
console.log(`- 报告: extract-report.md (${report.length} 条对齐警告)`);
