// add-lang.js：新增语言一步到位 —— 更新 config/site.json 的语言表 + 创建 i18n/<code>.json 语言包（以英文为底稿，便于人工翻译）
// 用法：node scripts/add-lang.js <code> <dir> <label> <locale> <hreflang> [htmlLang]
// 示例：node scripts/add-lang.js it /it/ Italiano it_IT it
const fs = require("fs");
const path = require("path");
const { ROOT, readConfig } = require("./lib");

const args = process.argv.slice(2);
if (args.length < 5) {
  console.log(
    "用法: node scripts/add-lang.js <code> <dir> <label> <locale> <hreflang> [htmlLang]",
  );
  console.log("示例: node scripts/add-lang.js it /it/ Italiano it_IT it");
  process.exit(1);
}
const [code, dir, label, locale, hreflang] = args;
const htmlLang = args[6] || hreflang;

// 1) 更新配置
const cfgPath = path.join(ROOT, "config", "site.json");
const cfg = readConfig();
if (cfg.langs[code]) {
  console.error(`语言 ${code} 已存在，请勿重复添加`);
  process.exit(1);
}
cfg.langs[code] = { dir, label, locale, hreflang, htmlLang };
fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + "\n");
console.log(`✓ config/site.json 已加入 ${code} (${label}, ${dir})`);

// 2) 以英文语言包为底稿创建新语言包（_meta 更新；值可逐条翻译，未翻译的槽位构建时自动回退英文）
const en = JSON.parse(
  fs.readFileSync(path.join(ROOT, "i18n", "en.json"), "utf8"),
);
en._meta = {
  lang: code,
  label,
  updated: new Date().toISOString().slice(0, 10),
};
fs.writeFileSync(
  path.join(ROOT, "i18n", code + ".json"),
  JSON.stringify(en, null, 2) + "\n",
);
console.log(`✓ i18n/${code}.json 已创建（英文底稿，可直接编辑翻译）`);

console.log("\n下一步：");
console.log(
  `  1. 翻译 i18n/${code}.json 中的值（key 为语义化层级，纯数字段自动转数组）`,
);
console.log(
  `  2. 若站点需要该语言的 src/ 源页面，可放入 src/${code}/ 后用 npm run extract 提取，也可直接编辑语言包`,
);
console.log(`  3. npm run build 生成 out/${code}/ 页面与 sitemap`);
