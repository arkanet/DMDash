#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/upstream-lib.sh"

UPDATE_WORKING_TREES=0

if [ "${1:-}" = "--update-working-trees" ]; then
  UPDATE_WORKING_TREES=1
elif [ "$#" -gt 0 ]; then
  printf 'Usage: %s [--update-working-trees]\n' "$0" >&2
  exit 1
fi

ensure_root_git_repo
mkdir -p "${EXTERNAL_SOURCES_DIR}"

while IFS='|' read -r source_id remote_name remote_url branch_name repo_dir baseline_commit role; do
  log_upstream "Synchronizing ${source_id} (${role})"
  ensure_remote "${remote_name}" "${remote_url}"
  git -C "${ROOT_DIR}" fetch "${remote_name}" --prune --no-tags
  clone_or_fetch_external_repo "${ROOT_DIR}/${repo_dir}" "${remote_url}" "${branch_name}" "${UPDATE_WORKING_TREES}"
done < <(list_upstreams)

log_upstream "Upstream synchronization completed"
