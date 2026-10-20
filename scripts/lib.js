// 共享工具：配置加载、parse5 解析、可翻译槽位（文本/属性）提取与跨语言对齐
const fs = require("fs");
const path = require("path");
const parse5 = require("parse5");

const ROOT = path.join(__dirname, "..");
const SRC = path.resolve(process.env.SITEGEN_SRC || path.join(ROOT, "src"));

function readConfig() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "config", "site.json"), "utf8"));
}

function parseHtml(raw) {
  return parse5.parse(raw, { sourceCodeLocationInfo: true });
}

function getAttr(node, name) {
  if (!node || !node.attrs) return undefined;
  const a = node.attrs.find((x) => x.name === name);
  return a && a.value;
}

// 元素是否有某个 class
function hasClass(node, cls) {
  const c = getAttr(node, "class");
  return !!c && c.split(/\s+/).includes(cls);
}

function isWhitespace(s) {
  return /^\s*$/.test(s);
}

function collapse(s) {
  // 压缩内部空白为单空格（保留 &nbsp; 对应的 \u00A0，避免破坏排版意图），并去除首尾
  return s.replace(/[^\S\u00A0]+/g, " ").trim();
}

// 内联元素：其后紧跟的文本若原文带前导空白，应保留一个空格（否则 "pay.foxterm.app获取激活码" 会粘连）
const INLINE_TAGS = ["a", "span", "strong", "b", "em", "i", "code", "u", "small", "sub", "sup", "mark"];
function collapseAfterInline(s, prevIsInline) {
  const c = collapse(s);
  return prevIsInline && /^\s/.test(s) ? " " + c : c;
}

// 纯符号/数字文本（价格、对勾、分隔符、年份等）不参与翻译，模板中保持原文
const SYMBOL_ONLY = /^[\d$~✓✗•|+\-–—·:.\s%×/()@#©®\u3002\uFF0C\u3001\uFF1F\uFF01\uFF1B\uFF1A\uFF5E\u2026\u00B7\uFF08\uFF09\u300A\u300B\u300C\u300D]+$/;
function isTranslatableText(s) {
  return !isWhitespace(s) && !SYMBOL_ONLY.test(s);
}

// 可翻译属性白名单
const TRANS_ATTRS = ["alt", "title", "aria-label", "placeholder"];

/**
 * 提取一个文档的“可翻译槽位”列表。
 * 槽位结构：{ kind:'text'|'attr', chain, idx, key(由 keygen 赋值的语义化key), val(折叠后的译文), span, attr }
 * 跳过：head（仅当 skipHead）、lang-dd-menu 切换器、script/style 子树、终端 mockup(#ft-mockup)、纯符号/空白文本。
 */
function collectSlots(doc, raw, opts = {}) {
  const slots = [];
  const skipHead = opts.skipHead !== false;

  function walk(node, ancestors) {
    const tag = node.tagName;
    const inHead = ancestors.some((a) => a.tagName === "head");

    if (tag === "script" || tag === "style") return;
    if (skipHead && inHead) return;
    if (hasClass(node, "lang-dd-menu")) return;
    if (getAttr(node, "id") === "ft-mockup") return;

    // 可翻译属性
    if (node.attrs && !inHead) {
      node.attrs.forEach((a, ai) => {
        if (!TRANS_ATTRS.includes(a.name)) return;
        const loc = node.sourceCodeLocation && node.sourceCodeLocation.attrs[a.name];
        if (!loc) return;
        const value = a.value;
        if (!isTranslatableText(value)) return;
        // parse5 的 attr 区间覆盖整个 name="value"；这里收敛到引号内 value 的区间
        const s = loc.startOffset;
        const e = loc.endOffset;
        const valueStart = s + a.name.length + 2; // 跳过 name="
        const valueEnd = e - 1;                    // 去掉闭合引号
        const startTrim = value.length - value.trimStart().length;
        const endTrim = value.length - value.trimEnd().length;
        slots.push({
          kind: "attr",
          attr: a.name,
          chain: chainOf(ancestors, node),
          idx: ai,
          key: null,
          val: collapse(value),
          span: { start: valueStart + startTrim, end: valueEnd - endTrim },
        });
      });
    }

    // 文本子节点
    if (node.childNodes) {
      const textChildren = node.childNodes.filter((c) => c.nodeName === "#text");
      node.childNodes.forEach((c, ci) => {
        if (c.nodeName !== "#text") return;
        const v = c.value;
        const loc = c.sourceCodeLocation;
        if (!loc) return;
        const s = loc.startOffset;
        const e = loc.endOffset;
        const startTrim = v.length - v.trimStart().length;
        const endTrim = v.length - v.trimEnd().length;
        // 前一个兄弟为内联元素（a/span/strong…）时保留一个前导空格，避免"链接后文本"粘连
        let prevIsInline = false;
        for (let k = ci - 1; k >= 0; k--) {
          const p = node.childNodes[k];
          if (p.nodeName === "#text") { if (p.value.trim()) prevIsInline = true; break; }
          if (p.tagName && INLINE_TAGS.includes(p.tagName)) { prevIsInline = true; break; }
          break;
        }
        // 句末标点提升：内联元素之后、或为父元素最后一个文本子节点的纯标点文本（如 <a>…</a>. 的 "."、<strong>…</strong>, 的 ","）
        // 也作为槽位，便于与语言端的 "。"、"，" 等一一对齐（否则会被 symbol-only 过滤掉）
        const pureSentencePunct = /^[\s\u00A0，。、．,.;:!?；：！？]+$/.test(v) && !/^\s*$/.test(v);
        const isLastText = textChildren[textChildren.length - 1] === c;
        const promote = pureSentencePunct && (isLastText || prevIsInline);
        if (isTranslatableText(v) || promote) {
          slots.push({
            kind: "text",
            promoted: !isTranslatableText(v),
            chain: chainOf(ancestors, node),
            idx: textChildren.indexOf(c),
            key: null,
            val: collapseAfterInline(v, prevIsInline),
            span: { start: s + startTrim, end: e - endTrim },
          });
        }
      });
    }

    const nextAnc = [...ancestors, node];
    for (const c of node.childNodes || []) {
      if (c.nodeName !== "#text" && c.nodeName !== "#comment") walk(c, nextAnc);
    }
  }

  walk(doc, []);
  // 句末标点提升过滤：仅当父元素还有其他槽位时才保留（避免孤立 ".")
  const chainCounts = {};
  for (const s of slots) chainCounts[s.chain] = (chainCounts[s.chain] || 0) + 1;
  return slots.filter((s) => !s.promoted || chainCounts[s.chain] > 1);
}

function chainOf(ancestors, node) {
  // 带兄弟索引的链：区分重复结构（如多个 FAQ 条目），防止对齐跨条目错配
  const segs = [];
  const segOf = (n) => {
    if (!n.tagName) return null;
    const siblings = n.parentNode ? n.parentNode.childNodes.filter((x) => x.tagName === n.tagName) : [];
    return `${n.tagName}[${siblings.indexOf(n)}]`;
  };
  for (const a of ancestors) {
    const seg = segOf(a);
    if (seg) segs.push(seg);
  }
  const self = segOf(node);
  if (self) segs.push(self);
  return segs.join("/");
}

/**
 * 将 langSlots 与 enSlots 对齐（两指针 + 前视匹配）。
 * 返回 { values: enSlots 每个槽位对应的语言文本(无匹配则 null), skipped: 语言端多余槽位数, warns: [] }
 */
function align(enSlots, langSlots) {
  const values = new Array(enSlots.length).fill(null);
  const warns = [];
  let i = 0;
  let j = 0;

  const match = (a, b) => a.chain === b.chain && a.kind === b.kind && a.idx === b.idx;
  const chainMatch = (a, b) => a.chain === b.chain && a.kind === b.kind;

  while (i < enSlots.length) {
    if (j >= langSlots.length) {
      warns.push({ type: "missing-lang", index: i, enKey: enSlots[i].val, chain: enSlots[i].chain });
      i++;
      continue;
    }
    if (match(enSlots[i], langSlots[j])) {
      values[i] = langSlots[j];
      i++;
      j++;
      continue;
    }
    // 语言端有额外槽位：前视 en 侧
    let foundEn = -1;
    for (let k = 1; k <= 8 && i + k < enSlots.length; k++) {
      if (match(enSlots[i + k], langSlots[j])) { foundEn = i + k; break; }
    }
    if (foundEn > 0) {
      for (let t = i; t < foundEn; t++) {
        warns.push({ type: "missing-lang", index: t, enKey: enSlots[t].val, chain: enSlots[t].chain });
      }
      i = foundEn;
      continue;
    }
    // 语言端少了（en 侧有额外槽位）：前视 lang 侧
    let foundLang = -1;
    for (let k = 1; k <= 8 && j + k < langSlots.length; k++) {
      if (match(enSlots[i], langSlots[j + k])) { foundLang = j + k; break; }
    }
    if (foundLang > 0) {
      j = foundLang;
      values[i] = langSlots[j];
      i++;
      j++;
      continue;
    }
    // 结构一致但序号漂移（内联元素内文本分布不同）
    if (chainMatch(enSlots[i], langSlots[j])) {
      warns.push({ type: "idx-drift", index: i, enKey: enSlots[i].val, langKey: langSlots[j].val, chain: enSlots[i].chain });
      values[i] = langSlots[j];
      i++;
      j++;
      continue;
    }
    // 无法匹配
    warns.push({ type: "unmatched", index: i, enKey: enSlots[i].val, chain: enSlots[i].chain, langKey: langSlots[j].val, langChain: langSlots[j].chain });
    i++;
    j++;
  }
  const skipped = langSlots.length - j;
  return { values, skipped, warns };
}

// 从 head 中提取 SEO 字段（按语言）
function extractSeo(doc, raw) {
  const seo = {};
  let head = null;
  (function walk(n) {
    if (n.tagName === "head") { head = n; return; }
    for (const c of n.childNodes || []) if (c.nodeName !== "#text") walk(c);
  })(doc);
  if (!head) return seo;

  for (const n of head.childNodes || []) {
    if (n.tagName === "title") {
      const t = n.childNodes.filter((c) => c.nodeName === "#text").map((c) => c.value).join("");
      seo.title = collapse(t);
    } else if (n.tagName === "meta") {
      const name = getAttr(n, "name");
      const prop = getAttr(n, "property");
      const key = name || prop;
      if (key) seo[key] = getAttr(n, "content");
    } else if (n.tagName === "script") {
      const type = getAttr(n, "type");
      if (type === "application/ld+json") {
        const t = n.childNodes.filter((c) => c.nodeName === "#text").map((c) => c.value).join("");
        // 紧凑化 JSON-LD：语言包内不留长 \n / 缩进空格
        try {
          seo.jsonld = JSON.stringify(JSON.parse(t));
        } catch {
          seo.jsonld = collapse(t);
        }
      }
    }
  }
  return seo;
}

// 原始 HTML 中某区间
function slice(raw, span) {
  return raw.slice(span.start, span.end);
}

// 定位文档中首个 tagName 元素的完整源码区间（含开闭标签）
function elementRegion(doc, tagName) {
  let found = null;
  (function walk(n) {
    if (found) return;
    if (n.tagName === tagName) { found = n; return; }
    for (const c of n.childNodes || []) if (c.tagName) walk(c);
  })(doc);
  if (!found || !found.sourceCodeLocation) return null;
  const loc = found.sourceCodeLocation;
  return { start: loc.startOffset, end: loc.endOffset };
}

// 定位 <html> 开标签内 lang 属性的源码区间
function htmlLangRange(doc) {
  const htmlNode = doc.childNodes.find((n) => n.tagName === "html");
  if (!htmlNode || !htmlNode.sourceCodeLocation || !htmlNode.sourceCodeLocation.startTag) return null;
  const st = htmlNode.sourceCodeLocation.startTag;
  const seg = { start: st.startOffset, end: st.endOffset };
  return seg;
}

module.exports = { ROOT, SRC, readConfig, parseHtml, getAttr, hasClass, isWhitespace, collapse, isTranslatableText, collectSlots, align, extractSeo, slice, elementRegion, htmlLangRange, INLINE_TAGS };
