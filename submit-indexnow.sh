#!/bin/bash
# IndexNow 一键提交脚本 - foxterm.app
# 一次推送同时通知: Bing / Yandex / Naver / Seznam / Yep / Brave 等

KEY="eb06668f88f4a52451a8076a0b0b1110"
HOST="foxterm.app"

# 所有 URL（来自 sitemap.xml）
URLS=(
  "https://foxterm.app/"
  "https://foxterm.app/zh-hans/"
  "https://foxterm.app/zh-hant/"
  "https://foxterm.app/ja/"
  "https://foxterm.app/de/"
  "https://foxterm.app/ru/"
  "https://foxterm.app/es/"
  "https://foxterm.app/fr/"
  "https://foxterm.app/ko/"
  "https://foxterm.app/pt-br/"
  "https://foxterm.app/privacy"
  "https://foxterm.app/terms"
  "https://foxterm.app/contact"
  "https://foxterm.app/zh-hans/privacy"
  "https://foxterm.app/zh-hans/terms"
  "https://foxterm.app/zh-hans/contact"
  "https://foxterm.app/zh-hant/privacy"
  "https://foxterm.app/zh-hant/terms"
  "https://foxterm.app/zh-hant/contact"
  "https://foxterm.app/ja/privacy"
  "https://foxterm.app/ja/terms"
  "https://foxterm.app/ja/contact"
  "https://foxterm.app/de/privacy"
  "https://foxterm.app/de/terms"
  "https://foxterm.app/de/contact"
  "https://foxterm.app/ru/privacy"
  "https://foxterm.app/ru/terms"
  "https://foxterm.app/ru/contact"
  "https://foxterm.app/es/privacy"
  "https://foxterm.app/es/terms"
  "https://foxterm.app/es/contact"
  "https://foxterm.app/fr/privacy"
  "https://foxterm.app/fr/terms"
  "https://foxterm.app/fr/contact"
  "https://foxterm.app/ko/privacy"
  "https://foxterm.app/ko/terms"
  "https://foxterm.app/ko/contact"
  "https://foxterm.app/pt-br/privacy"
  "https://foxterm.app/pt-br/terms"
  "https://foxterm.app/pt-br/contact"
)

echo "=== 第一步: 验证 key 文件是否可访问 ==="
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "https://${HOST}/${KEY}.txt")
echo "https://${HOST}/${KEY}.txt -> HTTP ${HTTP}"
if [ "$HTTP" != "200" ]; then
  echo "❌ key 文件还没部署，请先部署再运行此脚本"
  exit 1
fi

echo ""
echo "=== 第二步: 推送全部 URL 到 IndexNow ==="
# 构造 JSON
JSON="{\"host\":\"${HOST}\",\"key\":\"${KEY}\",\"keyLocation\":\"https://${HOST}/${KEY}.txt\",\"urlList\":["
for i in "${!URLS[@]}"; do
  JSON+="\"${URLS[$i]}\""
  if [ $i -lt $((${#URLS[@]}-1)) ]; then JSON+=","; fi
done
JSON+="]}"

echo "$JSON" > /tmp/indexnow_payload.json

RESP=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "https://api.indexnow.org/indexnow" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d @/tmp/indexnow_payload.json)

echo "$RESP"
echo ""
echo "=== 完成 ==="
echo "HTTP 200/202 = 成功提交"
echo "HTTP 403 = key 验证失败"
echo "HTTP 422 = URL 格式错误"
