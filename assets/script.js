(function () {
  const hostname = window.location.hostname;
  const isCnDomain = hostname.endsWith('.cn');
  const elements = document.querySelectorAll(isCnDomain ? '.is-cn' : '.is-intl');
  elements.forEach(el => el.style.setProperty('display', 'inline-flex', 'important'));
  // 如果是 .cn 域名，且当前路径不是以 /zh 开头，就自动跳转到 /zh/
  if (isCnDomain && !window.location.pathname.startsWith('/zh')) {
    window.location.href = '/zh/';
    return;
  }
})();
