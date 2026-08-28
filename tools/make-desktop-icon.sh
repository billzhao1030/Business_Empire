#!/bin/bash
# 重新生成桌面启动图标（macOS）。移动过项目目录后请重新运行本脚本。
set -e
DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP="$HOME/Desktop/Business Empire.app"
NODEBIN="$(command -v node || true)"

cd "$DIR"
node tools/make-icon.mjs
rm -rf build/icon.iconset && mkdir -p build/icon.iconset
for sz in 16 32 64 128 256 512; do
  sips -z $sz $sz build/icon-1024.png --out "build/icon.iconset/icon_${sz}x${sz}.png" >/dev/null
  sips -z $((sz*2)) $((sz*2)) build/icon-1024.png --out "build/icon.iconset/icon_${sz}x${sz}@2x.png" >/dev/null
done
cp build/icon-1024.png build/icon.iconset/icon_512x512@2x.png
iconutil -c icns build/icon.iconset -o build/BusinessEmpire.icns

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp build/BusinessEmpire.icns "$APP/Contents/Resources/AppIcon.icns"
sed "s|__GAME_DIR__|$DIR|g; s|__NODE__|$NODEBIN|g" tools/launcher.template.sh > "$APP/Contents/MacOS/BusinessEmpire"
cp tools/Info.plist "$APP/Contents/Info.plist"
printf 'APPL????' > "$APP/Contents/PkgInfo"
chmod +x "$APP/Contents/MacOS/BusinessEmpire"

# ad-hoc 签名：让 Gatekeeper 与 TCC 有一个稳定的身份，避免修改后被拦
codesign --force --deep --sign - "$APP" 2>/dev/null && echo "✅ 已 ad-hoc 签名" || echo "⚠️  签名跳过（不影响使用）"
touch "$APP"
echo "✅ 已生成桌面图标：$APP"
