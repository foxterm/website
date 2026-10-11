(function () {
  const hostname = window.location.hostname;
  const isCnDomain = hostname.endsWith('.cn');
  const elements = document.querySelectorAll(isCnDomain ? '.is-cn' : '.is-intl');
  elements.forEach(el => el.style.display = 'inline-block');
})();
