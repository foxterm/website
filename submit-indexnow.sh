#!/bin/bash
# IndexNow 一键提交脚本 - foxterm.app
# 自动从 sitemap.xml 提取所有 URL，同时通知: Bing / Yandex / Naver / Seznam / Yep / Brave 等
#
# 用法:
#   ./submit-indexnow.sh          # 提交全部 URL
#   ./submit-indexnow.sh --new    # 仅提交最近 7 天内修改的 URL

set -euo pipefail

KEY="eb06668f88f4a52451a8076a0b0b1110"
HOST="foxterm.app"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SITEMAP="${SCRIPT_DIR}/src/sitemap.xml"
PAYLOAD="/tmp/indexnow_payload.json"

if [ ! -f "$SITEMAP" ]; then
  echo "❌ 找不到 sitemap.xml: $SITEMAP"
  exit 1
fi

MODE="${1:-all}"

if [ "$MODE" = "--new" ]; then
  CUTOFF=$(date -v-7d +%Y-%m-%d 2>/dev/null || date -d '7 days ago' +%Y-%m-%d)
  echo "=== 筛选 ${CUTOFF} 以来修改的 URL ==="
  URLS=$(awk '
    /<loc>/{ url=$0; gsub(/.*<loc>|<\/loc>.*/, "", url) }
    /<lastmod>/{
      date=$0; gsub(/.*<lastmod>|<\/lastmod>.*/, "", date)
      if (date >= "'"$CUTOFF"'") print url
    }
  ' "$SITEMAP")
else
  URLS=$(grep -o '<loc>[^<]*</loc>' "$SITEMAP" | sed 's/<loc>//;s/<\/loc>//')
fi

if [ -z "$URLS" ]; then
  echo "没有需要提交的 URL"
  exit 0
fi

COUNT=$(echo "$URLS" | wc -l | tr -d ' ')
echo "共 ${COUNT} 个 URL"

echo ""
echo "=== 验证 key 文件 ==="
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "https://${HOST}/${KEY}.txt")
echo "https://${HOST}/${KEY}.txt -> HTTP ${HTTP}"
if [ "$HTTP" != "200" ]; then
  echo "❌ key 文件还没部署，请先部署再运行此脚本"
  exit 1
fi

echo ""
echo "=== 构造 IndexNow payload ==="

JSON="{\"host\":\"${HOST}\",\"key\":\"${KEY}\",\"keyLocation\":\"https://${HOST}/${KEY}.txt\",\"urlList\":["
FIRST=true
while IFS= read -r url; do
  if [ "$FIRST" = true ]; then
    FIRST=false
  else
    JSON+=","
  fi
  JSON+="\"${url}\""
done <<< "$URLS"
JSON+="]}"

echo "$JSON" | python3 -m json.tool > "$PAYLOAD" 2>/dev/null || echo "$JSON" > "$PAYLOAD"
echo "已写入 ${PAYLOAD} (${COUNT} URLs)"

echo ""
echo "=== 提交到 IndexNow ==="
RESP=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "https://api.indexnow.org/indexnow" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d @"$PAYLOAD")

HTTP_CODE=$(echo "$RESP" | grep "HTTP_CODE:" | sed 's/HTTP_CODE://')
BODY=$(echo "$RESP" | grep -v "HTTP_CODE:")

echo "响应: HTTP ${HTTP_CODE}"
if [ -n "$BODY" ]; then
  echo "内容: ${BODY}"
fi

echo ""
case "$HTTP_CODE" in
  200|202) echo "✅ 成功提交 ${COUNT} 个 URL" ;;
  204)     echo "✅ 已收到，无需更新" ;;
  400)     echo "❌ 请求格式错误（检查 JSON）" ;;
  403)     echo "❌ key 验证失败" ;;
  422)     echo "❌ URL 格式错误或不属于该 host" ;;
  429)     echo "⚠️  提交过于频繁，请稍后重试" ;;
  *)       echo "⚠️  未知状态码: ${HTTP_CODE}" ;;
esac
