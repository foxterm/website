(function () {
  const hostname = window.location.hostname;
  const isCnDomain = hostname.endsWith('.cn');
  // 1. 动态判断托管平台
  const hostInfoElem = document.getElementById('host-info');
  if (hostInfoElem) {
    hostInfoElem.textContent = isCnDomain ? 'Hosted on Tencent COS.' : 'Hosted on Cloudflare Pages.';
  }

  // 2. 动态控制 ICP 备案号的显示
  const beianInfo = document.getElementById('beian-info');

  if (!isCnDomain) {
    if (beianInfo) beianInfo.style.display = 'none';
  }

  // 3. 语言切换逻辑
  const btn = document.getElementById('langToggle');

  let currentLang = isCnDomain ? 'zh' : 'en';

  function updateLanguage(lang) {
    currentLang = lang;
    if (currentLang === 'en') {
      document.documentElement.setAttribute('data-lang', 'en');
      document.documentElement.setAttribute('lang', 'en');
    } else {
      document.documentElement.removeAttribute('data-lang');
      document.documentElement.setAttribute('lang', 'zh-CN');
    }
  }

  updateLanguage(currentLang);

  if (btn) {
    btn.addEventListener('click', () => {
      const nextLang = currentLang === 'zh' ? 'en' : 'zh';
      updateLanguage(nextLang);
    });
  }
})();
