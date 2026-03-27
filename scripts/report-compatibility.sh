#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/upstream-lib.sh"

OUTPUT_FILE="${ROOT_DIR}/docs/compatibility-report.md"
WRITE_MODE=0

if [ "${1:-}" = "--write" ]; then
  WRITE_MODE=1
elif [ "$#" -gt 0 ]; then
  printf 'Usage: %s [--write]\n' "$0" >&2
  exit 1
fi

ensure_root_git_repo

generate_report() {
  local generated_at
  generated_at="$(date -u '+%Y-%m-%d %H:%M:%SZ')"

  cat <<EOF
# Compatibility Report

Generated at ${generated_at} from the local DMDash workspace.

## Upstream Snapshot

| Source | Remote | Target branch | Baseline import | External clone HEAD | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
EOF

  while IFS='|' read -r source_id remote_name remote_url branch_name repo_dir baseline_commit role; do
    local remote_status
    local repo_path
    local current_branch
    local current_short
    local current_full
    local status
    local notes

    repo_path="${ROOT_DIR}/${repo_dir}"
    remote_status='missing'
    if git -C "${ROOT_DIR}" remote get-url "${remote_name}" >/dev/null 2>&1; then
      remote_status='configured'
    fi

    if [ -d "${repo_path}/.git" ]; then
      current_branch="$(branch_or_missing "${repo_path}")"
      current_short="$(short_head_or_missing "${repo_path}")"
      current_full="$(git -C "${repo_path}" rev-parse HEAD)"
      notes="${role}; remote ${remote_status}"

      if baseline_matches "${current_full}" "${baseline_commit}"; then
        status='aligned'
      else
        status='drifted'
      fi

      if [ "${current_branch}" != "${branch_name}" ]; then
        notes="${notes}; branch ${current_branch}"
      fi

      printf '| %s | `%s` | `%s` | `%s` | `%s (%s)` | %s | %s |\n' \
        "${source_id}" \
        "${remote_name}" \
        "${branch_name}" \
        "${baseline_commit}" \
        "${current_short}" \
        "${current_branch}" \
        "${status}" \
        "${notes}"
    else
      printf '| %s | `%s` | `%s` | `%s` | missing | missing clone | %s; remote %s |\n' \
        "${source_id}" \
        "${remote_name}" \
        "${branch_name}" \
        "${baseline_commit}" \
        "${role}" \
        "${remote_status}"
    fi
  done < <(list_upstreams)

  cat <<'EOF'

## Protocol Guardrails

EOF

  local firmware_gitmodules
  local protobuf_url
  firmware_gitmodules="${ROOT_DIR}/external-sources/darkmesh-firmware/.gitmodules"
  protobuf_url='unavailable'

  if [ -f "${firmware_gitmodules}" ]; then
    protobuf_url="$(
      awk '
        $0 ~ /^\[submodule "protobufs"\]$/ { in_block=1; next }
        in_block && $1 == "url" { print $3; exit }
        in_block && /^\[/ { in_block=0 }
      ' "${firmware_gitmodules}"
    )"
  fi

  printf -- '- DarkMesh firmware protobuf submodule: `%s`\n' "${protobuf_url}"

  if [ "${protobuf_url}" = 'https://github.com/meshtastic/protobufs.git' ]; then
    printf -- '- Protocol status: compatible with official Meshtastic protobufs.\n'
  else
    printf -- '- Protocol status: review required before merging protocol-sensitive changes.\n'
  fi

  cat <<'EOF'
- Merge policy: only `upstream-web` is a code-merge source for the dashboard tree.
- Reference policy: `upstream-protobufs`, `upstream-darkmesh-android`, and `upstream-darkmesh-firmware` are tracked for compatibility analysis and feature porting, not for direct merges into the dashboard code tree.
- Workflow:
  - Run `pnpm sync:upstreams` to refresh remotes and local mirrors.
  - Run `pnpm report:compatibility` to regenerate this report after upstream changes.
  - Review `docs/compatibility-matrix.md` before porting new DarkMesh features.
EOF
}

if [ "${WRITE_MODE}" = "1" ]; then
  generate_report > "${OUTPUT_FILE}"
  log_upstream "Compatibility report written to ${OUTPUT_FILE}"
else
  generate_report
fi
