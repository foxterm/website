const fs = require('fs');
const path = require('path');
const { minify } = require('html-minifier-terser');
const CleanCSS = require('clean-css');
const { minify: terserMinify } = require('terser');

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
  'input.css'
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
    // 1. 处理 HTML
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
    // 3. 处理独立 JS 文件
    else if (entry.isFile() && entry.name.endsWith('.js')) {
      const content = fs.readFileSync(srcPath, 'utf8');
      const minifiedResult = await terserMinify(content);
      if (minifiedResult.error) {
        throw minifiedResult.error;
      }
      fs.writeFileSync(destPath, minifiedResult.code, 'utf8');
      console.log(`[JS   压缩] ${srcPath} -> ${destPath}`);
    }
    // 4. 复制其他静态资源
    else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
      console.log(`[静态复制] ${srcPath} -> ${destPath}`);
    }
  }
}

async function build() {
  if (fs.existsSync('./dist')) {
    fs.rmSync('./dist', { recursive: true, force: true });
  }

  console.log('开始打包压缩...');

  // 1. 处理 ./src 目录
  await processDir('./src', './dist');

  // 2. 处理 ./assets 目录（自动压缩 CSS/JS）
  if (fs.existsSync('./assets')) {
    await processDir('./assets', './dist/assets');
    console.log('[目录处理] ./assets -> ./dist/assets (已包含 CSS/JS 压缩)');
  }

  // 3. 复制根目录下的 GeoLite2-Country.mmdb 到 ./dist 根目录
  const mmdbSource = './GeoLite2-Country.mmdb';
  const mmdbDest = './dist/GeoLite2-Country.mmdb';
  if (fs.existsSync(mmdbSource)) {
    fs.copyFileSync(mmdbSource, mmdbDest);
    console.log(`[文件复制] ${mmdbSource} -> ${mmdbDest}`);
  }

  console.log('🎉 构建完成！所有资源已成功处理。');
}

build().catch((err) => {
  console.error('构建失败:', err);
  process.exit(1);
});
