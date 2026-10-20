// serve.js：本地预览构建产物（默认 public/，多语言目录 + 静态资源）
// 用法：node scripts/serve.js [port]   （默认 8080）
const fs = require("fs");
const path = require("path");
const http = require("http");
const { ROOT, readConfig } = require("./lib");

const PORT = Number(process.argv[2]) || 8080;
const OUT = path.join(ROOT, readConfig().site.outputDir || "out");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".mmdb": "application/octet-stream",
  ".xml.gz": "application/gzip",
};

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/") p = "/index.html";
  let file = path.join(OUT, p);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    // 目录请求 → 该目录的 index.html；无扩展名路径 → 补 .html（clean URL 如 /zh-hans/about）
    const dir = fs.existsSync(file) && fs.statSync(file).isDirectory();
    if (dir) file = path.join(file, "index.html");
    else if (!path.extname(p) && fs.existsSync(file + ".html"))
      file = file + ".html";
    if (!fs.existsSync(file)) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 Not Found");
      return;
    }
  }
  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, {
    "Content-Type": MIME[ext] || "application/octet-stream",
  });
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, () => {
  console.log(
    `预览: http://localhost:${PORT}/ （${OUT.split(path.sep).pop()}/ 目录）`,
  );
  console.log(
    `  英文: http://localhost:${PORT}/  | 中文: http://localhost:${PORT}/zh-hans/`,
  );
});
