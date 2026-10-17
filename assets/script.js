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

/* ===== Language / Domain Detection Banner (JS-injected) ===== */
(function () {
  const LS_KEY = "foxterm.langPrompt.dismissed";
  const SS_KEY = "foxterm.langPrompt.session";
  const CN_DOMAIN = "https://foxterm.cn";
  const INTL_DOMAIN = "https://foxterm.app";

  let dismissed = false;
  try {
    dismissed =
      !!sessionStorage.getItem(SS_KEY) || !!localStorage.getItem(LS_KEY);
  } catch (e) { /* storage unavailable */ }
  if (dismissed) return;

  const hostname = window.location.hostname;
  const isCnDomain = hostname.endsWith(".cn");

  const LANG_PATHS = [
    "/", "/zh-hans/", "/zh-hant/", "/ja/", "/de/",
    "/ru/", "/es/", "/fr/", "/ko/", "/pt-br/",
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
    US: "/", GB: "/", AU: "/", CA: "/", NZ: "/", IE: "/",
  };

  const CN_PROMPT = {
    msg: "检测到您来自中国大陆，是否访问中国大陆域名以获得更好体验？",
    go: "前往 foxterm.cn",
    dismiss: "不再提示",
    close: "关闭",
  };

  const INTL_PROMPT = {
    msg: "You are currently on the China domain. Switch to the international site for a better experience?",
    go: "Go to foxterm.app",
    dismiss: "Don't show again",
    close: "Close",
  };

  const EN_PROMPT = {
    msg: "Your region recommends the English version. Would you like to switch?",
    go: "Go to English version",
    dismiss: "Don't show again",
    close: "Close",
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
    var box = document.createElement("div");
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

  function findTargetByCountry(cc) {
    var path = COUNTRY_LANG[cc];
    if (!path) return null;
    for (var i = 0; i < LANG_PATHS.length; i++) {
      if (LANG_PATHS[i] === path) return path;
    }
    return null;
  }

  function isOnPath(path) {
    if (path === "/") {
      return window.location.pathname === "/" ||
        window.location.pathname === "/index.html" ||
        !/^\/[a-z]{2}(?:-[a-z]{2,})?\//.test(window.location.pathname);
    }
    return window.location.pathname.startsWith(path);
  }

  function buildTargetUrl(targetPath) {
    var pathname = window.location.pathname;
    var search = window.location.search;
    var match = pathname.match(/^\/([a-z]{2}(?:-[a-z]{2,})?)\//);
    var rest;
    if (match) {
      rest = pathname.slice(match[0].length);
    } else if (pathname === "/" || pathname === "/index.html") {
      rest = "";
    } else {
      rest = pathname.slice(1);
    }
    return targetPath + rest + search;
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
        var raw = data && data.geo && data.geo.countryCodeAlpha2;
        cc = raw ? String(raw).toUpperCase() : null;
      }
    } catch (e) { /* geo failed */ }

    if (!cc) return;

    var box = createBanner();

    if (cc === "CN" && !isCnDomain) {
      var c = CN_PROMPT;
      showBanner(box, c.msg, c.go, CN_DOMAIN + window.location.pathname + window.location.search, c.dismiss, c.close);
      return;
    }

    if (cc !== "CN" && isCnDomain) {
      var d = INTL_PROMPT;
      showBanner(box, d.msg, d.go, INTL_DOMAIN + window.location.pathname + window.location.search, d.dismiss, d.close);
      return;
    }

    var targetPath = findTargetByCountry(cc);
    if (!targetPath || isOnPath(targetPath)) return;

    var url = buildTargetUrl(targetPath);

    if (targetPath === "/") {
      var e = EN_PROMPT;
      showBanner(box, e.msg, e.go, url, e.dismiss, e.close);
    } else {
      var key = targetPath.slice(1, -1);
      var t = COPY[key];
      if (!t) return;
      showBanner(box, t.msg.replace(/\{lang\}/g, t.name), t.go, url, t.dismiss, t.close);
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
