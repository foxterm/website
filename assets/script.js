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

/* ===== Language Detection Banner (JS-injected) ===== */
(function () {
  const LS_KEY = "foxterm.langPrompt.dismissed";
  const SS_KEY = "foxterm.langPrompt.session";
  const CN_DOMAIN = "https://foxterm.cn";

  let dismissed = false;
  try {
    dismissed =
      !!sessionStorage.getItem(SS_KEY) || !!localStorage.getItem(LS_KEY);
  } catch (e) { /* storage unavailable */ }
  if (dismissed) return;

  const hostname = window.location.hostname;
  const isCnDomain = hostname.endsWith(".cn");

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

  const CN_PROMPT_COPY = {
    msg: "检测到您来自中国大陆，是否访问中国大陆域名以获得更好体验？",
    go: "前往 foxterm.cn",
    dismiss: "不再提示",
    close: "关闭",
  };

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

  function createBanner() {
    const box = document.createElement("div");
    box.id = "lang-prompt";
    box.className = "lang-prompt";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-live", "polite");
    box.setAttribute("aria-label", "Language suggestion");
    box.hidden = true;

    box.innerHTML =
      '<div class="lang-prompt-card">' +
        '<span class="fox-logo-icon lang-prompt-logo" aria-hidden="true"></span>' +
        '<p id="lang-prompt-msg" class="lang-prompt-msg"></p>' +
        '<div class="lang-prompt-actions">' +
          '<a id="lang-prompt-go" class="lang-prompt-btn lang-prompt-btn-primary" href="#"></a>' +
          '<button id="lang-prompt-dismiss" type="button" class="lang-prompt-btn lang-prompt-btn-ghost"></button>' +
        '</div>' +
        '<button id="lang-prompt-close" type="button" class="lang-prompt-close" aria-label="Close">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">' +
            '<path d="M6 6l12 12M18 6L6 18"></path>' +
          '</svg>' +
        '</button>' +
      '</div>';

    document.body.appendChild(box);
    return box;
  }

  function showBanner(box, msg, goText, goHref, dismissText, closeLabel) {
    var msgEl = document.getElementById("lang-prompt-msg");
    var goEl = document.getElementById("lang-prompt-go");
    var dismissEl = document.getElementById("lang-prompt-dismiss");
    var closeEl = document.getElementById("lang-prompt-close");
    if (!msgEl || !goEl || !dismissEl || !closeEl) return;

    msgEl.textContent = msg;
    goEl.textContent = goText;
    goEl.href = goHref;
    dismissEl.textContent = dismissText;
    closeEl.setAttribute("aria-label", closeLabel);

    dismissEl.addEventListener("click", function () {
      try { localStorage.setItem(LS_KEY, "1"); } catch (e) { /* ignore */ }
      box.hidden = true;
    });
    closeEl.addEventListener("click", function () {
      try { sessionStorage.setItem(SS_KEY, "1"); } catch (e) { /* ignore */ }
      box.hidden = true;
    });

    box.hidden = false;
  }

  function pickTargetByBrowser() {
    var locales = (navigator.languages && navigator.languages.length
      ? navigator.languages
      : [navigator.language]) || ["en"];
    for (var i = 0; i < locales.length; i++) {
      var raw = String(locales[i] || "").toLowerCase().replace(/_/g, "-");
      for (var j = 0; j < TARGETS.length; j++) {
        var t = TARGETS[j];
        for (var k = 0; k < t.langs.length; k++) {
          var code = t.langs[k];
          if (raw === code || raw.indexOf(code + "-") === 0) return t;
        }
      }
    }
    return null;
  }

  function findTargetByCountry(cc) {
    var path = COUNTRY_LANG[cc];
    if (!path) return null;
    for (var i = 0; i < TARGETS.length; i++) {
      if (TARGETS[i].path === path) return TARGETS[i];
    }
    return null;
  }

  function buildCnUrl() {
    return CN_DOMAIN + window.location.pathname + window.location.search;
  }

  function buildLangUrl(targetPath) {
    var pathname = window.location.pathname;
    var match = pathname.match(/^\/([a-z]{2}(?:-[a-z]{2,})?)\//);
    var rest;
    if (match) {
      rest = pathname.slice(match[0].length);
    } else if (pathname.charAt(0) === "/") {
      rest = pathname.slice(1);
    } else {
      rest = pathname;
    }
    return targetPath + rest + window.location.search;
  }

  function showCnPrompt(box, url) {
    var c = CN_PROMPT_COPY;
    showBanner(box, c.msg, c.go, url, c.dismiss, c.close);
  }

  function showLangPrompt(box, target, url) {
    var key = target.path.slice(1, -1);
    var c = COPY[key];
    if (!c) return;
    showBanner(box, c.msg.replace(/\{lang\}/g, c.name), c.go, url, c.dismiss, c.close);
  }

  async function init() {
    var cc = null;
    try {
      var ctrl = new AbortController();
      var timer = setTimeout(function () { ctrl.abort(); }, 3000);
      var res = await fetch("/geo", { signal: ctrl.signal });
      clearTimeout(timer);
      if (res.ok) {
        var data = await res.json();
        var raw = data && data.eo && data.eo.geo && data.eo.geo.countryCodeAlpha2;
        cc = raw ? String(raw).toUpperCase() : null;
      }
    } catch (e) { /* geo failed */ }

    var box = createBanner();

    if (cc === "CN" && !isCnDomain) {
      showCnPrompt(box, buildCnUrl());
      return;
    }

    var target = cc ? findTargetByCountry(cc) : null;
    if (!target) target = pickTargetByBrowser();
    if (target && !window.location.pathname.startsWith(target.path)) {
      showLangPrompt(box, target, buildLangUrl(target.path));
    }
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
