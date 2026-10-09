const fs = require('fs');
const path = require('path');
const { minify } = require('html-minifier-terser');
const CleanCSS = require('clean-css');

const cleanCssInstance = new CleanCSS({ level: 2 });

// 排除开发源码、配置文件和私有数据库，只将公开网页资源打包至 dist
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
    if (IGNORE_LIST.includes(entry.name)) continue;

    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      await processDir(srcPath, destPath);
    }
    // 1. 压缩 HTML（压成单行，清除注释）
    else if (entry.isFile() && entry.name.endsWith('.html')) {
      const content = fs.readFileSync(srcPath, 'utf8');
      const minified = await minify(content, {
        collapseWhitespace: true,
        removeComments: true,
        minifyCSS: true,
        minifyJS: true,
      });
      fs.writeFileSync(destPath, minified, 'utf8');
      console.log(`[HTML 压缩] ${srcPath} -> ${destPath}`);
    }
    // 2. 压缩独立的 .css 文件
    else if (entry.isFile() && entry.name.endsWith('.css')) {
      const content = fs.readFileSync(srcPath, 'utf8');
      const minified = cleanCssInstance.minify(content).styles;
      fs.writeFileSync(destPath, minified, 'utf8');
      console.log(`[CSS  压缩] ${srcPath} -> ${destPath}`);
    }
    // 3. 复制静态资源（assets、images、robots.txt、sitemap.xml、favicon.ico 等）
    else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
      console.log(`[静态复制] ${srcPath} -> ${destPath}`);
    }
  }
}

// 每次构建前先清空旧的 dist
if (fs.existsSync('./dist')) {
  fs.rmSync('./dist', { recursive: true, force: true });
}

console.log('开始打包压缩...');
processDir('.', './dist')
  .then(() => console.log('🎉 构建完成！精简版网页产物已生成至 dist 目录。'))
  .catch((err) => console.error('构建失败:', err));
