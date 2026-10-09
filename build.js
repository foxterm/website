const fs = require('fs');
const path = require('path');
const { minify } = require('html-minifier-terser');
const CleanCSS = require('clean-css');

// inline: false 保留 @import url(...)
const cleanCssInstance = new CleanCSS({ level: 2, inline: false });

const IGNORE_LIST = [
  'node_modules',
  '.git',
  '.github',
  '.gitignore',
  'dist',
  'build.js',
  'package.json',
  'yarn.lock',
  'package-lock.json',
  'README.md',
  'LICENSE',
  'GeoLite2-Country.mmdb'
];

async function processDir(srcDir, destDir) {
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    if (IGNORE_LIST.includes(entry.name)) continue;

    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      await processDir(srcPath, destPath);
    }
    // 1. 处理 HTML（包含内联 CSS、JS 和 application/ld+json 压缩）
    else if (entry.isFile() && entry.name.endsWith('.html')) {
      const content = fs.readFileSync(srcPath, 'utf8');
      const minified = await minify(content, {
        collapseWhitespace: true,
        removeComments: true,
        minifyCSS: true,
        minifyJS: true,
        processScripts: ['application/ld+json']
      });
      fs.writeFileSync(destPath, minified, 'utf8');
      console.log(`[HTML 压缩] ${srcPath} -> ${destPath}`);
    }
    // 2. 处理独立 CSS
    else if (entry.isFile() && entry.name.endsWith('.css')) {
      const content = fs.readFileSync(srcPath, 'utf8');
      const minified = cleanCssInstance.minify(content).styles;
      fs.writeFileSync(destPath, minified, 'utf8');
      console.log(`[CSS  压缩] ${srcPath} -> ${destPath}`);
    }
    // 3. 复制静态资源
    else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
      console.log(`[静态复制] ${srcPath} -> ${destPath}`);
    }
  }
}

if (fs.existsSync('./dist')) {
  fs.rmSync('./dist', { recursive: true, force: true });
}

console.log('开始打包压缩...');
processDir('.', './dist')
  .then(() => console.log('🎉 构建完成！LD+JSON 已成功压缩为单行。'))
  .catch((err) => console.error('构建失败:', err));
