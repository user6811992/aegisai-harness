#!/usr/bin/env bash
# Build a Linux AppImage for AegisAi Harness (requires appimagetool).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VERSION=$(node -p "require('$ROOT/package.json').version")
OUT="$ROOT/dist"
APP="$OUT/AegisAiHarness.AppDir"
mkdir -p "$OUT"
rm -rf "$APP"
mkdir -p "$APP/usr/bin"
cp -R "$ROOT/src" "$APP/usr/bin/"
cp -R "$ROOT/public" "$APP/usr/bin/"
cp "$ROOT/package.json" "$ROOT/README.md" "$APP/usr/bin/"
cat > "$APP/AppRun" <<'EOF'
#!/bin/sh
cd "$(dirname "$0")/usr/bin"
node src/index.js --web
EOF
chmod +x "$APP/AppRun"
appimagetool "$APP" "$OUT/aegisai-harness-$VERSION.AppImage"
echo "Built $OUT/aegisai-harness-$VERSION.AppImage"
