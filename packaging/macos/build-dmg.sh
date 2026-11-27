#!/usr/bin/env bash
# Build a macOS DMG for AegisAi Harness (requires create-dmg).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VERSION=$(node -p "require('$ROOT/package.json').version")
OUT="$ROOT/dist"
STAGE="$OUT/aegisai-harness-$VERSION"
mkdir -p "$OUT"
rm -rf "$STAGE"
rm -f "$OUT/aegisai-harness-$VERSION.dmg"
mkdir -p "$STAGE"
cp -R "$ROOT/src" "$STAGE/"
cp -R "$ROOT/public" "$STAGE/"
cp -R "$ROOT/scripts" "$STAGE/"
cp "$ROOT/package.json" "$ROOT/README.md" "$STAGE/"
cat > "$STAGE/aegisai-harness.command" <<'EOF'
#!/bin/bash
cd "$(dirname "$0")"
node src/index.js --web
EOF
chmod +x "$STAGE/aegisai-harness.command"
create-dmg --volname "AegisAi Harness $VERSION" --window-pos 200 120 --window-size 600 400 "$OUT/aegisai-harness-$VERSION.dmg" "$STAGE"
echo "Built $OUT/aegisai-harness-$VERSION.dmg"
