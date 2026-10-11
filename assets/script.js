
(function () {
  var root = document.documentElement;
  var hostname = window.location.hostname;
  var isCnDomain = /\.cn$/i.test(window.location.hostname);
  document.documentElement.classList.add(isCnDomain ? 'is-cn' : 'is-intl');

  var isZhPage = (root.getAttribute('lang') || 'en').toLowerCase().indexOf('zh') === 0;
  var params = new URLSearchParams(window.location.search);
  var forcedLang = params.get('lang');            // ?lang=en / ?lang=zh 显式指定
  var savedLang = null;
  try { savedLang = localStorage.getItem('foxterm_lang'); } catch (e) { }

  function remember(lang) { try { localStorage.setItem('foxterm_lang', lang); } catch (e) { } }

  // 1) .cn 域名：英文页面默认跳转到对应中文页面；用户显式选择英文时不跳转
  if (isCnDomain && !isZhPage) {
    if (forcedLang === 'en' || savedLang === 'en') {
      remember('en');
    } else {
      var path = window.location.pathname;
      var zhPath = (path === '/' || path === '/index.html') ? '/zh/' : '/zh' + path;
      window.location.replace(zhPath + window.location.hash);
      return;
    }
  }

  // 2) 非 .cn 域名：清掉多余的 ?lang 参数，保持 URL 干净
  if (!isCnDomain && forcedLang) {
    try {
      var u = new URL(window.location.href);
      u.searchParams.delete('lang');
      window.history.replaceState({}, '', u.pathname + u.search + u.hash);
    } catch (e) { }
  }

  // 3) 手动切换语言：记住用户选择，避免下次访问被自动跳转覆盖
  function bindSwitch() {
    var items = document.querySelectorAll('.lang-switch');
    for (var i = 0; i < items.length; i++) {
      items[i].addEventListener('click', function () {
        var lang = this.getAttribute('data-lang');
        if (lang) remember(lang);
      });
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindSwitch);
  } else {
    bindSwitch();
  }
})();
