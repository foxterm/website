(function () {
  const hostname = window.location.hostname;
  const isCnDomain = hostname.endsWith(".cn");
  const elements = document.querySelectorAll(
    isCnDomain ? ".is-cn" : ".is-intl",
  );
  elements.forEach((el) =>
    el.style.setProperty("display", "inline-flex", "important"),
  );

  if (!isCnDomain) {
    return;
  }
  const pathname = window.location.pathname;
  const userLangMemory = localStorage.getItem("user-lang");

  // 1. 【核心逻辑】如果用户已经有语言记忆，说明是用户自己选择/切换过语言的，直接退出！
  // 哪怕他此刻回到了根路径 /，也绝对不自动跳转，完全尊重用户意图。
  if (userLangMemory) {
    return;
  }

  // 2. 如果当前已经在多语言子目录下（比如通过搜索引擎直达 /ja/ 或 /zh-hant/），也直接退出
  const isLangPath = /^\/(zh-hans|zh-hant|ja|de|ru|es|fr|ko|pt-br)(\/|$)/i.test(
    pathname,
  );
  if (isLangPath) {
    return;
  }

  // 3. 只有在“完全没有记忆”且“处于根路径”的首次访问时，才根据浏览器首选语言自动跳转一次
  const navLang = (
    navigator.language ||
    navigator.userLanguage ||
    ""
  ).toLowerCase();

  let targetLang = "";
  let targetPath = "";

  if (
    navLang.startsWith("zh-tw") ||
    navLang.startsWith("zh-hk") ||
    navLang.startsWith("zh-mo") ||
    navLang === "zh-hant"
  ) {
    targetLang = "zh-Hant";
    targetPath = "/zh-hant/";
  } else if (navLang.startsWith("zh")) {
    targetLang = "zh-Hans";
    targetPath = "/zh-hans/";
  } else if (navLang.startsWith("ja")) {
    targetLang = "ja";
    targetPath = "/ja/";
  } else if (navLang.startsWith("de")) {
    targetLang = "de";
    targetPath = "/de/";
  } else if (navLang.startsWith("ru")) {
    targetLang = "ru";
    targetPath = "/ru/";
  } else if (navLang.startsWith("es")) {
    targetLang = "es";
    targetPath = "/es/";
  } else if (navLang.startsWith("fr")) {
    targetLang = "fr";
    targetPath = "/fr/";
  } else if (navLang.startsWith("ko")) {
    targetLang = "ko";
    targetPath = "/ko/";
  } else if (navLang.startsWith("pt")) {
    targetLang = "pt-BR";
    targetPath = "/pt-br/";
  }

  // 4. 执行首次跳转并种下记忆；若没有匹配的语种则默认记为英文
  if (targetPath) {
    localStorage.setItem("user-lang", targetLang);
    window.location.href = targetPath;
  } else {
    localStorage.setItem("user-lang", "en");
  }
})();
