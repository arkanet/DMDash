#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

REFRESH_UPSTREAMS=1
STRICT=0

usage() {
  cat <<'EOF'
Usage: scripts/sync-pictures.sh [--no-upstreams] [--strict]

Refreshes hardware image metadata inputs and regenerates the Pictures Sync report.

Options:
  --no-upstreams  reuse already-fetched external sources
  --strict        fail when required DeviceImage mappings/assets are missing
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --no-upstreams)
      REFRESH_UPSTREAMS=0
      ;;
    --strict)
      STRICT=1
      ;;
    --help | -h)
      usage
      exit 0
      ;;
    *)
      printf 'Unknown argument: %s\n' "$1" >&2
      usage >&2
      exit 1
      ;;
  esac
  shift
done

if [ "${REFRESH_UPSTREAMS}" = "1" ]; then
  bash "${SCRIPT_DIR}/sync-upstreams.sh"
fi

if [ "${STRICT}" = "1" ]; then
  node "${ROOT_DIR}/scripts/check-device-images.mjs" --write --strict
else
  node "${ROOT_DIR}/scripts/check-device-images.mjs" --write
fi
