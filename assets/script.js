(function () {
  const hostname = window.location.hostname;
  const isCnDomain = hostname.endsWith('.cn');
  var root = document.documentElement;
   root.classList.add(isCnDomain ? 'is-cn' : 'is-intl');
})();
