// keygen.js：为英文母版的每个可翻译槽位生成语义化点路径 key（如 faq.items.3.answer.1、pricing.free.items.2）。
// 遍历顺序与 collectSlots 完全一致（同跳过区域、属性先于子节点文本），返回与槽位一一对应的 key 列表。
//
// 模型：块级元素（h1/h2/h3/p/li/th/td 及语义化 span/a/div）拥有自己的 base key；
// 其内部的内联 span/strong 文本作为该块的“片段”参与编号（fragIdx 从 0 起，仅计可翻译文本）。
const { getAttr, hasClass, isTranslatableText, INLINE_TAGS } = require("./lib");

/**
 * @param {string} page 页面名（index / about / contact / terms / privacy / 404）
 * @param {object} doc parse5 文档
 * @returns {string[]} 与 collectSlots 输出顺序一致的 key 列表
 */
function keygen(page, doc) {
  const keys = [];
  const legal = page !== "index";

  const ctx = {
    nav: false,
    footer: false,
    inMain: false,
    legal,
    section: null,
    pricingSub: null, // "cards" | "options"
    inCard: false,
    cardIdx: -1,
    faqIdx: -1,
    itemIdx: -1,
    navLinkIdx: -1,
    footerLinkIdx: -1,
    legalLinkIdx: -1,
    btnIdx: -1,
    reqIdx: -1,
    rowIdx: -1,
    colIdx: -1,
    secCount: 0,       // main 内 section 序号（无名 section 映射 hero/trust/comparison）
    legalSecIdx: -1,  // legal 页 section 序号
    legalSubIdx: -1,
    specIdx: -1,      // legal 页 specs（label/value 对）序号
    preHeading: null,  // legal 页 h1/commitment 之后的状态
    mirrorFrag: 0,
    badgeIdx: -1,
    tagIdx: -1,
    heroCta: false,
    baseStack: [],     // 当前块级 base 栈
    fragCount: {},      // base -> 已用片段数（全局编号）
  };

  const isInMirror = (node) => {
    const own = getAttr(node, "class") || "";
    if (own.includes("text-[11px]") && own.includes("text-zinc-600")) return true;
    let p = node.parentNode;
    while (p && p.tagName) {
      const c = getAttr(p, "class") || "";
      if (c.includes("text-[11px]") && c.includes("text-zinc-600")) return true;
      p = p.parentNode;
    }
    return false;
  };

  const isBadges = (node) => {
    let p = node.parentNode;
    while (p && p.tagName) {
      const c = getAttr(p, "class") || "";
      if (c.includes("pt-2") && c.includes("border-t")) return true;
      p = p.parentNode;
    }
    return false;
  };

  const isCardContainer = (node) => {
    const c = getAttr(node, "class") || "";
    return c.includes("grid") || c.includes("space-y-4");
  };

  const isLogoA = (node) => {
    const href = getAttr(node, "href") || "";
    const cls = getAttr(node, "class") || "";
    return href === "/" && !cls.includes("bg-fox-500");
  };

  // ---------- 元素 base key ----------
  function baseOf(node) {
    const tag = node.tagName;
    if (ctx.nav) return navKey(node, tag);
    if (ctx.footer) return footerKey(node, tag);
    if (ctx.inMain && !ctx.legal) return indexMainKey(node, tag);
    if (ctx.legal) return legalKey(node, tag);
    return null;
  }

  function navKey(node, tag) {
    if (tag === "span") {
      const cls = getAttr(node, "class") || "";
      if (cls.includes("lang-dd-current")) return "nav.langCurrent";
      const parent = node.parentNode;
      if (parent && parent.tagName === "a" && isLogoA(parent)) return "nav.logo";
      return null; // CTA 按钮内的 span 归入按钮 base
    }
    if (tag === "a") {
      const href = getAttr(node, "href") || "";
      const cls = getAttr(node, "class") || "";
      if (cls.includes("bg-fox-500") && !cls.includes("px-7")) {
        return href === "#download" ? "nav.getApp" : "nav.backToHome";
      }
      if (href.startsWith("#")) { ctx.navLinkIdx++; return "nav.links." + ctx.navLinkIdx; }
      return null;
    }
    return null;
  }

  function footerKey(node, tag) {
    if (tag === "p") return "footer.copyright";
    if (tag === "a") {
      if (isInMirror(node)) return null;
      ctx.footerLinkIdx++;
      return "footer.links." + ctx.footerLinkIdx;
    }
    if (tag === "span") {
      if (isInMirror(node)) return "footer.mirror";
      const parent = node.parentNode;
      if (parent && parent.tagName === "a" && (getAttr(parent, "href") || "").includes("beian.miit.gov.cn")) return "footer.icp";
      return null;
    }
    return null;
  }

  function indexMainKey(node, tag) {
    const sec = ctx.section;
    if (sec === "hero") return heroKey(node, tag);
    if (sec === "trust") return trustKey(node, tag);
    if (sec === "comparison") return comparisonKey(node, tag);
    if (sec === "pricing") return pricingKey(node, tag);
    if (sec === "faq") return faqKey(node, tag);
    if (sec === "download") return downloadKey(node, tag);
    if (["architecture", "security", "features", "useCases"].includes(sec)) return cardSectionKey(node, tag, sec);
    return null;
  }

  function heroKey(node, tag) {
    if (tag === "div") {
      const cls = getAttr(node, "class") || "";
      if (cls.includes("rounded-full") && cls.includes("font-mono")) return "hero.badge";
      if (ctx.heroCta && cls.includes("uppercase") && cls.includes("text-[10px]")) return "hero.cta.0.caption";
      if (ctx.heroCta && cls.includes("font-bold")) return "hero.cta.0.label";
      return null;
    }
    if (tag === "h1") return "hero.title";
    if (tag === "p") {
      const cls = getAttr(node, "class") || "";
      if (cls.includes("text-zinc-300") && cls.includes("max-w-2xl")) return "hero.subtitle";
      return null;
    }
    if (tag === "span") {
      const cls = getAttr(node, "class") || "";
      if (cls.includes("px-2.5") && cls.includes("text-fox-400")) { ctx.tagIdx++; return "hero.tags." + ctx.tagIdx; }
      return null;
    }
    return null;
  }

  function trustKey(node, tag) {
    if (tag !== "div") return null;
    const cls = getAttr(node, "class") || "";
    if (cls.includes("mt-1.5")) return "trust.items." + ctx.cardIdx + ".body";
    if (cls.includes("font-extrabold") && cls.includes("font-mono") && cls.includes("orange-gradient-text")) {
      return "trust.items." + ctx.cardIdx + ".value";
    }
    return null;
  }

  function cardSectionKey(node, tag, sec) {
    if (tag === "div") {
      const cls = getAttr(node, "class") || "";
      if (cls.includes("rounded-full") && cls.includes("font-mono")) return sec + ".badge";
      if (ctx.inCard && cls.includes("font-mono")) return sec + ".cards." + ctx.cardIdx + ".badge";
      if (ctx.inCard && cls.includes("text-xs") && cls.includes("text-zinc-400")) return sec + ".cards." + ctx.cardIdx + ".body";
      return null;
    }
    if (tag === "h2") return sec + ".title";
    if (tag === "p") return ctx.inCard ? sec + ".cards." + ctx.cardIdx + ".body" : sec + ".lede";
    if (tag === "h3" || tag === "h4") return sec + ".cards." + ctx.cardIdx + ".title";
    return null;
  }

  function comparisonKey(node, tag) {
    if (tag === "h2") return "comparison.title";
    if (tag === "p") return "comparison.lede";
    if (tag === "th") { ctx.colIdx++; return "comparison.table.head." + ctx.colIdx; }
    if (tag === "td") { ctx.colIdx++; return "comparison.table.rows." + ctx.rowIdx + "." + ctx.colIdx; }
    return null;
  }

  function pricingKey(node, tag) {
    if (ctx.pricingSub === "options") {
      if (tag === "h3") return "pricing.options.title";
      if (tag === "p") {
        const parent = node.parentNode;
        if (parent && getAttr(parent, "id") === "pricing-options") return "pricing.options.footnote";
        return "pricing.options.subtitle";
      }
      if (tag === "div") {
        const cls = getAttr(node, "class") || "";
        if (cls.includes("uppercase") && cls.includes("tracking-widest")) return "pricing.options." + ctx.cardIdx + ".label";
        return null;
      }
      if (tag === "h4") return "pricing.options." + ctx.cardIdx + ".title";
      if (tag === "li") { ctx.itemIdx++; return "pricing.options." + ctx.cardIdx + ".items." + ctx.itemIdx; }
      if (tag === "a") return "pricing.options." + ctx.cardIdx + ".button";
      return null;
    }
    if (tag === "div") {
      const cls = getAttr(node, "class") || "";
      if (cls.includes("rounded-full") && cls.includes("font-mono")) return "pricing.badge";
      return null;
    }
    if (tag === "h2") return "pricing.title";
    if (tag === "h3") return ctx.cardIdx === 0 ? "pricing.free.title" : "pricing.pro.title";
    if (tag === "p") {
      if (ctx.inCard) return ctx.cardIdx === 0 ? "pricing.free.lede" : "pricing.pro.lede";
      return "pricing.lede";
    }
    if (tag === "span") {
      const cls = getAttr(node, "class") || "";
      if (ctx.cardIdx === 0) {
        if (cls.includes("text-4xl")) return null; // $0
        return cls.includes("rounded-full") ? "pricing.free.tag" : null;
      }
      if (cls.includes("orange-gradient-text")) return "pricing.pro.price.0";
      if (cls.includes("text-sm") && cls.includes("text-zinc-400")) return "pricing.pro.price.1";
      return cls.includes("rounded-full") ? "pricing.pro.tag" : null;
    }
    if (tag === "li") {
      ctx.itemIdx++;
      return ctx.cardIdx === 0 ? "pricing.free.items." + ctx.itemIdx : "pricing.pro.items." + ctx.itemIdx;
    }
    if (tag === "a") return ctx.cardIdx === 0 ? "pricing.free.button" : "pricing.pro.button";
    return null;
  }

  function faqKey(node, tag) {
    if (tag === "div") {
      const cls = getAttr(node, "class") || "";
      if (cls.includes("rounded-full") && cls.includes("font-mono")) return "faq.badge";
      return null;
    }
    if (tag === "h2") return "faq.title";
    if (tag === "span") {
      const cls = getAttr(node, "class") || "";
      if (cls.includes("font-mono") && cls.includes("flex-shrink-0")) return "faq.qPrefix";
      return null;
    }
    if (tag === "h3") return "faq.items." + ctx.faqIdx + ".q";
    if (tag === "p") return ctx.inCard ? "faq.items." + ctx.faqIdx + ".answer" : "faq.lede";
    return null;
  }

  function downloadKey(node, tag) {
    if (tag === "h2") return "download.title";
    if (tag === "p") {
      const cls = getAttr(node, "class") || "";
      return cls.includes("text-[11px]") ? "download.note" : "download.subtitle";
    }
    if (tag === "span") return "download.buttons." + ctx.btnIdx + ".label";
    if (tag === "div") {
      const cls = getAttr(node, "class") || "";
      if (cls.includes("font-mono") && cls.includes("uppercase")) { ctx.reqIdx++; return "download.reqs." + ctx.reqIdx + ".label"; }
      if (cls.includes("text-zinc-300") && cls.includes("font-medium")) return "download.reqs." + ctx.reqIdx + ".value";
      return null;
    }
    return null;
  }

  function legalKey(node, tag) {
    if (tag === "div") {
      const cls = getAttr(node, "class") || "";
      if (cls.includes("rounded-full") && cls.includes("font-mono")) {
        return ctx.legalSecIdx < 0 ? "content.badge" : "content.sections." + ctx.legalSecIdx + ".badge";
      }
      if (cls.includes("text-fox-500") && cls.includes("font-mono") && cls.includes("font-bold")) {
        if (ctx.legalSecIdx < 0 && ctx.cardIdx >= 0) return "content.cards." + ctx.cardIdx + ".title";
        return "content.sections." + ctx.legalSecIdx + ".label";
      }
      if (cls.includes("text-[10px]") && cls.includes("tracking-widest")) {
        ctx.specIdx++;
        return "content.sections." + ctx.legalSecIdx + ".specs." + ctx.specIdx + ".label";
      }
      if (cls.includes("text-sm") && cls.includes("text-white")) {
        return "content.sections." + ctx.legalSecIdx + ".specs." + ctx.specIdx + ".value";
      }
      return null;
    }
    if (tag === "span") {
      const cls = getAttr(node, "class") || "";
      if (cls.includes("text-[11px]") && cls.includes("tracking-widest")) {
        ctx.specIdx++;
        if (ctx.legalSecIdx < 0 && ctx.cardIdx >= 0) return "content.cards." + ctx.cardIdx + ".label";
        return "content.sections." + ctx.legalSecIdx + ".specs." + ctx.specIdx + ".label";
      }
      return null;
    }
    if (tag === "h1") { ctx.preHeading = "h1"; return "content.title"; }
    if (tag === "h2") {
      if (ctx.legalSecIdx < 0) { ctx.preHeading = "commitment"; return "content.commitment.title"; }
      return "content.sections." + ctx.legalSecIdx + ".title";
    }
    if (tag === "h3" || tag === "h4") {
      ctx.legalSubIdx++;
      return "content.sections." + ctx.legalSecIdx + ".subsections." + ctx.legalSubIdx + ".title";
    }
    if (tag === "p") {
      if (ctx.legalSecIdx < 0 && ctx.inCard) return "content.cards." + ctx.cardIdx + ".body";
      if (ctx.legalSecIdx >= 0) return "content.sections." + ctx.legalSecIdx + ".body";
      if (ctx.preHeading === "commitment") return "content.commitment.body";
      return "content.lede";
    }
    if (tag === "li") { ctx.itemIdx++; return "content.sections." + ctx.legalSecIdx + ".items." + ctx.itemIdx; }
    if (tag === "a") {
      ctx.legalLinkIdx++;
      return ctx.legalSecIdx >= 0 ? "content.sections." + ctx.legalSecIdx + ".links." + ctx.legalLinkIdx : "content.links." + ctx.legalLinkIdx;
    }
    if (tag === "input" || tag === "textarea") {
      ctx.itemIdx++;
      return "content.fields." + ctx.itemIdx + ".placeholder";
    }
    return null;
  }

  // ---------- 属性 key ----------
  function attrBaseKey(node, attr) {
    const tag = node.tagName;
    if (ctx.nav) {
      if (tag === "summary" && attr === "aria-label") return "nav.langAria";
      return null;
    }
    if (ctx.footer) {
      if (tag === "img" && attr === "alt" && isBadges(node)) { ctx.badgeIdx++; return "footer.badges." + ctx.badgeIdx + ".alt"; }
      return null;
    }
    if (ctx.inMain && !ctx.legal) {
      if (ctx.section === "hero" && tag === "img" && attr === "alt") return "hero.cta.0.alt";
      if (ctx.section === "download" && tag === "img" && attr === "alt") return "download.buttons." + ctx.btnIdx + ".alt";
      return null;
    }
    if (ctx.legal) {
      if (tag === "input" || tag === "textarea") { ctx.itemIdx++; return "content.fields." + ctx.itemIdx + ".placeholder"; }
      return null;
    }
    return null;
  }

  // ---------- 计数器更新（进入元素时） ----------
  function updateCounters(node, tag) {
    const cls = getAttr(node, "class") || "";
    if (tag === "div") {
      if (getAttr(node, "id") === "pricing-options") { ctx.pricingSub = "options"; ctx.cardIdx = -1; ctx.itemIdx = -1; return; }
      if (isCardContainer(node)) { ctx.cardIdx = -1; ctx.itemIdx = -1; ctx.inCard = false; return; }
      if (ctx.inMain && node.parentNode && isCardContainer(node.parentNode)) {
        const sibs = node.parentNode.childNodes.filter((c) => c.tagName === "div");
        if (sibs.includes(node)) {
          ctx.cardIdx++;
          ctx.inCard = true;
          ctx.itemIdx = -1;
          ctx.btnIdx = -1;
          if (ctx.section === "faq") ctx.faqIdx++;
          return;
        }
      }
      return;
    }
    if (tag === "table") { ctx.rowIdx = -1; ctx.colIdx = -1; return; }
    if (tag === "tbody") { ctx.rowIdx = -1; return; }
    if (tag === "tr") { ctx.rowIdx++; ctx.colIdx = -1; return; }
    if (tag === "a") {
      if (ctx.section === "hero") { ctx.heroCta = true; return; }
      if (ctx.section === "download") { ctx.btnIdx++; return; }
      return;
    }
    if (tag === "section") {
      if (ctx.inMain && !ctx.legal) {
        ctx.secCount++;
        const id = getAttr(node, "id");
        if (id) ctx.section = id === "use-cases" ? "useCases" : id;
        else ctx.section = ctx.secCount === 1 ? "hero" : ctx.secCount === 2 ? "trust" : ctx.secCount === 7 ? "comparison" : "unknown";
        ctx.cardIdx = -1; ctx.faqIdx = -1; ctx.itemIdx = -1; ctx.btnIdx = -1;
        ctx.reqIdx = -1; ctx.pricingSub = null; ctx.heroCta = false; ctx.tagIdx = -1; ctx.mirrorFrag = 0;
        ctx.inCard = false;
        return;
      }
      if (ctx.legal && ctx.inMain) {
        ctx.legalSecIdx++; ctx.legalSubIdx = -1; ctx.itemIdx = -1; ctx.legalLinkIdx = -1; ctx.specIdx = -1; ctx.preHeading = null;
        return;
      }
    }
  }

  // ---------- 主遍历 ----------
  function walk(node, ancestors) {
    if (!node || !node.tagName) return;
    const tag = node.tagName;
    const inHead = ancestors.some((a) => a.tagName === "head");
    if (tag === "script" || tag === "style") return;
    if (inHead) return;
    if (hasClass(node, "lang-dd-menu")) return;
    if (getAttr(node, "id") === "ft-mockup") return;

    if (tag === "header") ctx.nav = true;
    if (tag === "footer") ctx.footer = true;
    if (tag === "main") ctx.inMain = true;

    updateCounters(node, tag);

    // 本元素是否拥有自己的 base
    const ownBase = baseOf(node);
    if (ownBase) ctx.baseStack.push(ownBase);

    // 属性槽位
    if (node.attrs) {
      node.attrs.forEach((a) => {
        if (!["alt", "title", "aria-label", "placeholder"].includes(a.name)) return;
        if (!isTranslatableText(a.value)) return;
        const k = attrBaseKey(node, a.name);
        if (k) keys.push(k);
      });
    }

    // 文本槽位（统一带片段序号：base.0 / base.1，按 base 全局递增，保证嵌套 pack 中数组语义一致）
    if (node.childNodes) {
      const textChildren = node.childNodes.filter((c) => c.nodeName === "#text");
      for (const c of node.childNodes) {
        if (c.nodeName !== "#text") continue;
        // 与 collectSlots 同规则：可翻译文本，或"纯标点提升"（父元素最后一个文本子节点 / 紧跟内联元素的标点）
        const v = c.value;
        const pureSentencePunct = /^[\s\u00A0，。、．,.;:!?；：！？]+$/.test(v) && !/^\s*$/.test(v);
        const isLastText = textChildren[textChildren.length - 1] === c;
        let prevIsInline = false;
        const ci = textChildren.indexOf(c);
        for (let k = ci - 1; k >= 0; k--) {
          const p = node.childNodes[k];
          if (p.nodeName === "#text") { if (p.value.trim()) prevIsInline = true; break; }
          if (p.tagName && INLINE_TAGS.includes(p.tagName)) { prevIsInline = true; break; }
          break;
        }
        if (!isTranslatableText(v) && !(pureSentencePunct && (isLastText || prevIsInline))) continue;
        if (!ctx.baseStack.length) { keys.push(null); continue; }
        const base = ctx.baseStack[ctx.baseStack.length - 1];
        const n = ctx.fragCount[base] || 0;
        ctx.fragCount[base] = n + 1;
        keys.push(`${base}.${n}`);
      }
    }

    for (const c of node.childNodes || []) {
      if (c.tagName) walk(c, [...ancestors, node]);
    }

    if (ownBase) ctx.baseStack.pop();
    if (tag === "header") ctx.nav = false;
    if (tag === "footer") ctx.footer = false;
    if (tag === "main") ctx.inMain = false;
  }

  // 从 html 元素开始遍历（document 节点无 tagName）
  const htmlNode = (doc.childNodes || []).find((n) => n.tagName === "html") || doc;
  walk(htmlNode, []);
  return keys;
}

module.exports = { keygen };
