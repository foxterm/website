(function () {
  const hostname = window.location.hostname;
  const isCnDomain = hostname.endsWith(".cn");
  const elements = document.querySelectorAll(
    isCnDomain ? ".is-cn" : ".is-intl",
  );
  elements.forEach((el) =>
    el.style.setProperty("display", "inline-flex", "important"),
  );
})();

/* ===== Language Detection Banner (English root page only) ===== */
(function () {
  const pathname = window.location.pathname.replace(/\/+$/, "") || "/";
  if (pathname !== "/" && pathname !== "/index.html") return;

  const LS_KEY = "foxterm.langPrompt.dismissed";
  const SS_KEY = "foxterm.langPrompt.session";

  let dismissed = false;
  try {
    dismissed =
      !!sessionStorage.getItem(SS_KEY) || !!localStorage.getItem(LS_KEY);
  } catch (e) {
    /* storage unavailable — still show the banner */
  }
  if (dismissed) return;

  const TARGETS = [
    { path: "/zh-hant/", langs: ["zh-hant", "zh-tw", "zh-hk", "zh-mo"] },
    { path: "/zh-hans/", langs: ["zh-hans", "zh-cn", "zh-sg", "zh-my", "zh"] },
    { path: "/ja/", langs: ["ja"] },
    { path: "/de/", langs: ["de"] },
    { path: "/ru/", langs: ["ru"] },
    { path: "/es/", langs: ["es"] },
    { path: "/fr/", langs: ["fr"] },
    { path: "/ko/", langs: ["ko"] },
    { path: "/pt-br/", langs: ["pt", "pt-br", "pt-pt"] },
  ];

  const COUNTRY_LANG = {
    CN: "/zh-hans/", TW: "/zh-hant/", HK: "/zh-hant/", MO: "/zh-hant/",
    SG: "/zh-hans/", MY: "/zh-hans/",
    JP: "/ja/",
    DE: "/de/", AT: "/de/", CH: "/de/",
    RU: "/ru/", BY: "/ru/",
    ES: "/es/",
    FR: "/fr/",
    KR: "/ko/",
    BR: "/pt-br/", PT: "/pt-br/",
  };

  function pickTargetByBrowser() {
    const locales = (navigator.languages && navigator.languages.length
      ? navigator.languages
      : [navigator.language]) || ["en"];
    for (let i = 0; i < locales.length; i++) {
      const raw = String(locales[i] || "").toLowerCase().replace(/_/g, "-");
      for (let j = 0; j < TARGETS.length; j++) {
        const t = TARGETS[j];
        for (let k = 0; k < t.langs.length; k++) {
          const code = t.langs[k];
          if (raw === code || raw.indexOf(code + "-") === 0) return t;
        }
      }
    }
    return null;
  }

  function findTargetByCountry(cc) {
    const path = COUNTRY_LANG[cc];
    if (!path) return null;
    for (let i = 0; i < TARGETS.length; i++) {
      if (TARGETS[i].path === path) return TARGETS[i];
    }
    return null;
  }

  function showBanner(target) {
    const box = document.getElementById("lang-prompt");
    if (!box) return;

    const key = target.path.slice(1, -1);
    const copy = COPY[key];
    if (!copy) return;

    const msgEl = document.getElementById("lang-prompt-msg");
    const goEl = document.getElementById("lang-prompt-go");
    const dismissEl = document.getElementById("lang-prompt-dismiss");
    const closeEl = document.getElementById("lang-prompt-close");
    if (!msgEl || !goEl || !dismissEl || !closeEl) return;

    msgEl.textContent = copy.msg.replace(/\{lang\}/g, copy.name);
    goEl.textContent = copy.go;
    goEl.href = target.path;
    dismissEl.textContent = copy.dismiss;
    closeEl.setAttribute("aria-label", copy.close);

    dismissEl.addEventListener("click", () => {
      try { localStorage.setItem(LS_KEY, "1"); } catch (e) { /* ignore */ }
      box.hidden = true;
    });

    closeEl.addEventListener("click", () => {
      try { sessionStorage.setItem(SS_KEY, "1"); } catch (e) { /* ignore */ }
      box.hidden = true;
    });

    box.hidden = false;
  }

  const COPY = {
    "zh-hans": {
      name: "简体中文",
      msg: "检测到您当前所在地区推荐使用{lang}版本，是否切换？",
      go: "前往简体中文版",
      dismiss: "不再提示",
      close: "关闭",
    },
    "zh-hant": {
      name: "繁體中文",
      msg: "偵測到您目前所在地區推薦使用{lang}版本，是否切換？",
      go: "前往繁體中文版",
      dismiss: "不再提示",
      close: "關閉",
    },
    ja: {
      name: "日本語",
      msg: "お住まいの地域では{lang}版が推奨されています。切り替えますか？",
      go: "日本語版へ",
      dismiss: "今後表示しない",
      close: "閉じる",
    },
    de: {
      name: "Deutsch",
      msg: "Für Ihren Standort wird die {lang}-Version empfohlen. Möchten Sie wechseln?",
      go: "Zur deutschen Version",
      dismiss: "Nicht mehr anzeigen",
      close: "Schließen",
    },
    ru: {
      name: "Русский",
      msg: "Для вашего региона рекомендуется {lang}-версия. Переключить?",
      go: "Перейти на русскую версию",
      dismiss: "Больше не показывать",
      close: "Закрыть",
    },
    es: {
      name: "Español",
      msg: "Para tu región recomendamos la versión en {lang}. ¿Deseas cambiar?",
      go: "Ir a la versión en español",
      dismiss: "No volver a mostrar",
      close: "Cerrar",
    },
    fr: {
      name: "Français",
      msg: "Pour votre région, la version en {lang} est recommandée. Voulez-vous changer ?",
      go: "Passer à la version française",
      dismiss: "Ne plus afficher",
      close: "Fermer",
    },
    ko: {
      name: "한국어",
      msg: "현재 지역에서는 {lang} 버전이 권장됩니다. 전환하시겠습니까?",
      go: "한국어 버전으로",
      dismiss: "다시 표시하지 않음",
      close: "닫기",
    },
    "pt-br": {
      name: "Português",
      msg: "Para sua região, recomendamos a versão em {lang}. Deseja mudar?",
      go: "Ir para a versão em português",
      dismiss: "Não mostrar novamente",
      close: "Fechar",
    },
  };

  async function init() {
    let target = null;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 3000);
      const res = await fetch("/geo", { signal: ctrl.signal });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        const raw = data && data.eo && data.eo.geo && data.eo.geo.countryCodeAlpha2;
        const cc = raw ? String(raw).toUpperCase() : null;
        if (cc) target = findTargetByCountry(cc);
      }
    } catch (e) {
      /* geo failed — fall through to browser language */
    }
    if (!target) target = pickTargetByBrowser();
    if (target) showBanner(target);
  }

  init();
})();

/* FoxTerm terminal window mockup — 4-tab switching */
(function () {
  const root = document.getElementById("ft-mockup");
  if (!root) return;
  const tabs = root.querySelectorAll("[data-ft-tab]");
  const panels = root.querySelectorAll("[data-ft-panel]");
  const bars = root.querySelectorAll("[data-ft-bar]");
  const titleEl = document.getElementById("ft-win-title");
  function activate(name) {
    tabs.forEach(function (t) {
      const on = t.getAttribute("data-ft-tab") === name;
      t.classList.toggle("ft-tab-active", on);
      t.classList.toggle("ft-tab-idle", !on);
    });
    panels.forEach(function (p) {
      p.classList.toggle(
        "ft-panel-active",
        p.getAttribute("data-ft-panel") === name,
      );
    });
    bars.forEach(function (b) {
      b.classList.toggle(
        "ft-bar-active",
        b.getAttribute("data-ft-bar") === name,
      );
    });
    if (titleEl) {
      tabs.forEach(function (t) {
        if (t.getAttribute("data-ft-tab") === name) {
          titleEl.textContent = t.getAttribute("data-ft-title");
        }
      });
    }
  }
  tabs.forEach(function (t) {
    t.addEventListener("click", function () {
      activate(t.getAttribute("data-ft-tab"));
    });
  });
  activate("ssh");
})();
