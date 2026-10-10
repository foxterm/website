(function () {
  const hostname = window.location.hostname;
  const isCnDomain = hostname.endsWith('.cn');

  // 1. 动态判断托管平台与 ICP 备案信息
  // const hostInfoElem = document.getElementById('host-info');
  // if (hostInfoElem) {
  //   hostInfoElem.textContent = isCnDomain ? 'Hosted on Tencent Makers.' : 'Hosted on Cloudflare Workers.';
  // }

  const beianInfo = document.getElementById('beian-info');
  if (!isCnDomain && beianInfo) {
    beianInfo.style.display = 'none';
  }

  // 2. 语言切换与 URL/SEO 匹配逻辑
  const btn = document.getElementById('langToggle');

  // 优先读取 URL 参数 ?lang=zh / ?lang=en，其次读取本地缓存，最后按域名/浏览器默认判断
  const urlParams = new URLSearchParams(window.location.search);
  const urlLang = urlParams.get('lang');

  let currentLang = urlLang || localStorage.getItem('foxterm_lang') || (isCnDomain ? 'zh' : 'en');

  function updateLanguage(lang, updateUrl = false) {
    currentLang = lang;
    if (currentLang === 'en') {
      document.documentElement.setAttribute('data-lang', 'en');
      document.documentElement.setAttribute('lang', 'en');
    } else {
      document.documentElement.removeAttribute('data-lang');
      document.documentElement.setAttribute('lang', 'zh-CN');
    }

    localStorage.setItem('foxterm_lang', currentLang);

    // 如果是用户点击切换，更新 URL 参数，便于分享与 Google 检索
    if (updateUrl) {
      const newUrl = new URL(window.location.href);
      if (currentLang === 'zh') {
        newUrl.searchParams.set('lang', 'zh');
      } else {
        newUrl.searchParams.delete('lang');
      }
      window.history.pushState({}, '', newUrl);
    }
  }

  // 初始化设置语言
  updateLanguage(currentLang, false);

  if (btn) {
    btn.addEventListener('click', () => {
      const nextLang = currentLang === 'zh' ? 'en' : 'zh';
      updateLanguage(nextLang, true);
    });
  }
})();
