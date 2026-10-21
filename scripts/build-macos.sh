#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if ! xcode-select -p >/dev/null 2>&1; then
  echo "缺少 Xcode Command Line Tools，请先运行：xcode-select --install" >&2
  exit 1
fi
if ! command -v cargo >/dev/null 2>&1; then
  echo "缺少 Rust，请先安装：https://rustup.rs" >&2
  exit 1
fi

npm ci
npm run tauri build

echo
echo "构建完成，产物在 src-tauri/target/release/bundle/ 下。"
