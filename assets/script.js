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
  // Only run on the default (English) homepage — never on localized pages
  const pathname = window.location.pathname.replace(/\/+$/, "") || "/";
  if (pathname !== "/" && pathname !== "/index.html") {
    return;
  }

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

  const COPY = {
    "zh-hans": {
      name: "简体中文",
      msg: "检测到您的浏览器语言为{lang}，是否切换至{lang}版本？",
      go: "前往简体中文版",
      dismiss: "不再提示",
      close: "关闭",
    },
    "zh-hant": {
      name: "繁體中文",
      msg: "偵測到您的瀏覽器語言為{lang}，是否切換至{lang}版本？",
      go: "前往繁體中文版",
      dismiss: "不再提示",
      close: "關閉",
    },
    ja: {
      name: "日本語",
      msg: "お使いのブラウザの言語は{lang}です。{lang}版に切り替えますか？",
      go: "日本語版へ",
      dismiss: "今後表示しない",
      close: "閉じる",
    },
    de: {
      name: "Deutsch",
      msg: "Ihre Browsersprache ist {lang}. Möchten Sie zur {lang}-Version dieser Website wechseln?",
      go: "Zur deutschen Version",
      dismiss: "Nicht mehr anzeigen",
      close: "Schließen",
    },
    ru: {
      name: "Русский",
      msg: "Язык вашего браузера — {lang}. Перейти на {lang}-версию сайта?",
      go: "Перейти на русскую версию",
      dismiss: "Больше не показывать",
      close: "Закрыть",
    },
    es: {
      name: "Español",
      msg: "Hemos detectado que su navegador está en {lang}. ¿Desea cambiar a la versión en {lang}?",
      go: "Ir a la versión en español",
      dismiss: "No volver a mostrar",
      close: "Cerrar",
    },
    fr: {
      name: "Français",
      msg: "Nous avons détecté que votre navigateur est en {lang}. Voulez-vous passer à la version en {lang} ?",
      go: "Passer à la version française",
      dismiss: "Ne plus afficher",
      close: "Fermer",
    },
    ko: {
      name: "한국어",
      msg: "브라우저 언어가 {lang}(으)로 감지되었습니다. {lang} 버전으로 이동하시겠습니까?",
      go: "한국어 버전으로",
      dismiss: "다시 표시하지 않음",
      close: "닫기",
    },
    "pt-br": {
      name: "Português",
      msg: "Detectamos que o idioma do seu navegador é {lang}. Deseja acessar a versão em {lang}?",
      go: "Ir para a versão em português",
      dismiss: "Não mostrar novamente",
      close: "Fechar",
    },
  };

  function pickTarget(locales) {
    for (let i = 0; i < locales.length; i++) {
      const raw = String(locales[i] || "")
        .toLowerCase()
        .replace(/_/g, "-");
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

  const navigatorLangs = (navigator.languages && navigator.languages.length
    ? navigator.languages
    : [navigator.language]) || ["en"];
  const target = pickTarget(navigatorLangs);
  if (!target) return;

  const box = document.getElementById("lang-prompt");
  if (!box) return;

  const key = target.path.slice(1, -1); // e.g. "/zh-hans/" -> "zh-hans"
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
    try {
      localStorage.setItem(LS_KEY, "1");
    } catch (e) {
      /* ignore */
    }
    box.hidden = true;
  });

  closeEl.addEventListener("click", () => {
    try {
      sessionStorage.setItem(SS_KEY, "1");
    } catch (e) {
      /* ignore */
    }
    box.hidden = true;
  });

  box.hidden = false;
})();
