#!/usr/bin/env bash
# Build a single standalone binary using @yao-pkg/pkg.
# Requires network access on first run (npx downloads the packager).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
VERSION=$(node -p "require('./package.json').version")
mkdir -p dist
npx --yes @yao-pkg/pkg@5 src/index.js --targets node22-win-x64,node22-linux-x64,node22-macos-x64 --output dist/aegisai-harness-$VERSION
echo "Built dist/aegisai-harness-$VERSION"
