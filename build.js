const fs = require('fs');
const path = require('path');
const { minify } = require('html-minifier-terser');
const CleanCSS = require('clean-css');

const cleanCssInstance = new CleanCSS({ level: 2 });

// 排除项黑名单（完全忽略，不处理也不复制）
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
  'LICENSE'
];

async function processDir(srcDir, destDir) {
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    // 命中黑名单直接跳过
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
      });
      fs.writeFileSync(destPath, minified, 'utf8');
      console.log(`[HTML] ${srcPath} -> ${destPath}`);
    }
    // 2. 处理 CSS
    else if (entry.isFile() && entry.name.endsWith('.css')) {
      const content = fs.readFileSync(srcPath, 'utf8');
      const minified = cleanCssInstance.minify(content).styles;
      fs.writeFileSync(destPath, minified, 'utf8');
      console.log(`[CSS]  ${srcPath} -> ${destPath}`);
    }
    // 3. 其他上线用的静态文件直接复制
    else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
      console.log(`[COPY] ${srcPath} -> ${destPath}`);
    }
  }
}

// 每次构建前先清空旧的 dist 目录
if (fs.existsSync('./dist')) {
  fs.rmSync('./dist', { recursive: true, force: true });
}

console.log('开始打包压缩...');
processDir('.', './dist')
  .then(() => console.log('🎉 打包完成！dist 目录已清理干净。'))
  .catch((err) => console.error('构建失败:', err));
