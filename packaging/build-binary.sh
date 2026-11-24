#!/usr/bin/env bash
# Build standalone binaries using @yao-pkg/pkg.
# Requires network access on first run (npx downloads the packager).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
VERSION=$(node -p "require('./package.json').version")
OUT="dist/aegisai-harness-$VERSION"
mkdir -p "$OUT"

# pkg 5 + node22 targets are known to emit broken binaries; pkg 6 + node24 is stable.
# --output is for a single target; multi-target builds must use --out-path.
npx --yes @yao-pkg/pkg@6 src/index.js \
  --targets node24-win-x64,node24-linux-x64,node24-macos-x64 \
  --out-path "$OUT"

echo "Built binaries in $OUT"
