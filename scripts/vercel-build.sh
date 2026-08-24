#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_DIST_DIR="$ROOT_DIR/packages/web/dist"
ROOT_DIST_DIR="$ROOT_DIR/dist"

cd "$ROOT_DIR"

node scripts/generate-altstore-source.mjs
pnpm --filter meshtastic-web build

if [[ ! -f "$WEB_DIST_DIR/index.html" ]]; then
  echo "Missing web build output: $WEB_DIST_DIR/index.html" >&2
  exit 1
fi

rm -rf "$ROOT_DIST_DIR"
mkdir -p "$ROOT_DIST_DIR"
cp -R "$WEB_DIST_DIR/." "$ROOT_DIST_DIR/"

echo "Vercel web output ready:"
echo "- $WEB_DIST_DIR"
echo "- $ROOT_DIST_DIR"
