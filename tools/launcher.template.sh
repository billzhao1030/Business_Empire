#!/bin/bash
# Business Empire launcher —— 没启动就启动，已启动就直接打开网页
PROJ="__GAME_DIR__"
PORT="${BE_PORT:-8020}"
URL="http://127.0.0.1:$PORT/"
LOG="$HOME/Library/Logs/BusinessEmpire.log"      # 放在 TCC 保护目录之外

/bin/mkdir -p "$(/usr/bin/dirname "$LOG")" 2>/dev/null
alert() { /usr/bin/osascript -e "display alert \"Business Empire\" message \"$1\"" >/dev/null 2>&1; }

# 项目可能被挪走：按候选路径找回来
if [ ! -f "$PROJ/server.js" ]; then
  for cand in "__GAME_DIR__" "$HOME/Desktop/Business Empire" "$HOME/business-empire" \
              "$HOME/Documents/Business Empire" "$HOME/Downloads/Business Empire"; do
    if [ -f "$cand/server.js" ]; then PROJ="$cand"; break; fi
  done
fi
if [ ! -f "$PROJ/server.js" ]; then
  alert "找不到游戏文件夹 Business Empire。请把它放回桌面，或重新运行 tools/make-desktop-icon.sh。"
  exit 1
fi

running() { /usr/bin/curl -fsS -m 1 "${URL}api/health" 2>/dev/null | /usr/bin/grep -q '"ok":true'; }

# 已经在跑 → 直接开网页
if running; then /usr/bin/open "$URL"; exit 0; fi

NODE=""
for p in "__NODE__" /opt/homebrew/bin/node /usr/local/bin/node /usr/bin/node "$HOME/.volta/bin/node"; do
  if [ -x "$p" ]; then NODE="$p"; break; fi
done
if [ -z "$NODE" ]; then NODE="$(/bin/bash -lc 'command -v node' 2>/dev/null)"; fi
if [ -z "$NODE" ]; then
  alert "没有找到 Node.js。请先从 nodejs.org 安装（建议 v24 LTS 或更新版本）。"
  /usr/bin/open "https://nodejs.org"
  exit 1
fi

# 桌面是 TCC 保护目录，先探测写权限，避免服务起来后才失败
/bin/mkdir -p "$PROJ/data" 2>/dev/null
if ! /usr/bin/touch "$PROJ/data/.probe" 2>/dev/null; then
  alert "无法写入 $PROJ/data（存档目录）。
如果系统弹出过权限询问请选择「允许」；也可以把项目移到 ~/business-empire 后重试。"
  exit 1
fi
/bin/rm -f "$PROJ/data/.probe" 2>/dev/null

cd "$PROJ" || exit 1
echo "=== $(/bin/date) starting ===" >> "$LOG"
PORT="$PORT" nohup "$NODE" server.js >> "$LOG" 2>&1 &
disown 2>/dev/null

for i in $(/usr/bin/seq 1 40); do
  if running; then /usr/bin/open "$URL"; exit 0; fi
  /bin/sleep 0.25
done

alert "服务启动失败。日志：~/Library/Logs/BusinessEmpire.log"
/usr/bin/open -a Console "$LOG" 2>/dev/null
exit 1
