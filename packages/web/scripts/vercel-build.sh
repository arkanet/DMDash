#!/usr/bin/env bash
set -euo pipefail

PACKAGE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT_DIR="$(cd "$PACKAGE_DIR/../.." && pwd)"

DMDASH_VERCEL_EXTRA_OUTPUT_DIR="$PACKAGE_DIR/dist" \
  exec node "$ROOT_DIR/scripts/vercel-build.mjs"
