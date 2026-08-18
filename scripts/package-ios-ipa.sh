#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IOS_DIR="$ROOT_DIR/packages/mobile/ios"
BUILD_DIR="$IOS_DIR/build"
WEB_DOWNLOADS_DIR="$ROOT_DIR/packages/web/public/downloads"
IPA_PATH="$BUILD_DIR/darkmesh.ipa"

APP_PATH="${DARKMESH_IOS_APP_PATH:-}"

if [[ -z "$APP_PATH" ]]; then
  APP_PATH="$IOS_DIR/DerivedData/Build/Products/Debug-iphoneos/App.app"
fi

if [[ ! -d "$APP_PATH" ]]; then
  FOUND_APP="$(find "$IOS_DIR/DerivedData/Build/Products" -path "*.app" -type d 2>/dev/null | head -n 1 || true)"
  if [[ -n "$FOUND_APP" ]]; then
    APP_PATH="$FOUND_APP"
  fi
fi

if [[ ! -d "$APP_PATH" ]]; then
  echo "Unable to find built iOS app bundle. Expected: $APP_PATH" >&2
  exit 1
fi

rm -rf "$BUILD_DIR/Payload"
mkdir -p "$BUILD_DIR/Payload" "$WEB_DOWNLOADS_DIR"
cp -R "$APP_PATH" "$BUILD_DIR/Payload/App.app"
node "$ROOT_DIR/scripts/prune-mobile-web-assets.mjs" "$BUILD_DIR/Payload/App.app/public"

rm -f "$IPA_PATH"
(cd "$BUILD_DIR" && zip -qry "$(basename "$IPA_PATH")" Payload)
rm -rf "$BUILD_DIR/Payload"

cp "$IPA_PATH" "$WEB_DOWNLOADS_DIR/darkmesh.ipa"
node "$ROOT_DIR/scripts/generate-altstore-source.mjs"

python3 - "$IPA_PATH" "$WEB_DOWNLOADS_DIR/darkmesh.ipa" <<'PY'
import sys
from pathlib import Path

for path_value in sys.argv[1:]:
    path = Path(path_value)
    with path.open("rb") as handle:
        signature = handle.read(2)
    if signature != b"PK":
        raise SystemExit(f"{path} is not a valid IPA/ZIP archive")
PY

echo "Packaged $IPA_PATH"
echo "Copied $WEB_DOWNLOADS_DIR/darkmesh.ipa"
