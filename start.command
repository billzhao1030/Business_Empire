#!/bin/bash
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "未检测到 Node.js，请先安装：https://nodejs.org （建议 v24 LTS 及以上）"
  read -n 1 -s -r -p "按任意键退出..."
  exit 1
fi
echo "启动 Business Empire ... 浏览器打开 http://localhost:8020"
(sleep 2 && open http://localhost:8020) &
node server.js
