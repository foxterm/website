(function () {
  const hostname = window.location.hostname;
  const isCnDomain = hostname.endsWith('.cn');
  const elements = document.querySelectorAll(isCnDomain ? '.is-cn' : '.is-intl');
  elements.forEach(el => el.style.setProperty('display', 'inline-flex', 'important'));
  const userLangMemory = localStorage.getItem('user-lang');
  if (!userLangMemory && isCnDomain && !window.location.pathname.startsWith('/zh')) {
    localStorage.setItem('user-lang', 'zh');
    window.location.href = '/zh/';
    return;
  } else {
    localStorage.setItem('user-lang', window.location.pathname.startsWith('/zh') ? "zh" : "en");
  }
})();
