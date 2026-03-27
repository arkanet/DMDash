#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
EXTERNAL_SOURCES_DIR="${ROOT_DIR}/external-sources"

list_upstreams() {
  cat <<'EOF'
meshtastic-web|upstream-web|https://github.com/meshtastic/web.git|main|external-sources/meshtastic-web|6535c96e|Base web client
meshtastic-protobufs|upstream-protobufs|https://github.com/meshtastic/protobufs.git|master|external-sources/meshtastic-protobufs|cb1f893|Official protocol contract
darkmesh-android|upstream-darkmesh-android|https://github.com/emp3r0r7/DarkMesh.git|main|external-sources/darkmesh-android|346eedd7|DarkMesh feature reference
darkmesh-firmware|upstream-darkmesh-firmware|https://github.com/emp3r0r7/DarkMesh-Firmware.git|2.7.15-ghost|external-sources/darkmesh-firmware|49af1adf|Firmware behavior reference
EOF
}

log_upstream() {
  printf '[upstream] %s\n' "$*"
}

ensure_root_git_repo() {
  if ! git -C "${ROOT_DIR}" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    printf 'This command must be run from inside the DMDash git repository.\n' >&2
    exit 1
  fi
}

ensure_remote() {
  local remote_name="$1"
  local remote_url="$2"

  if git -C "${ROOT_DIR}" remote get-url "${remote_name}" >/dev/null 2>&1; then
    local current_url
    current_url="$(git -C "${ROOT_DIR}" remote get-url "${remote_name}")"

    if [ "${current_url}" != "${remote_url}" ]; then
      log_upstream "Updating remote ${remote_name} -> ${remote_url}"
      git -C "${ROOT_DIR}" remote set-url "${remote_name}" "${remote_url}"
    fi
  else
    log_upstream "Adding remote ${remote_name} -> ${remote_url}"
    git -C "${ROOT_DIR}" remote add "${remote_name}" "${remote_url}"
  fi
}

clone_or_fetch_external_repo() {
  local repo_dir="$1"
  local remote_url="$2"
  local branch_name="$3"
  local update_working_tree="$4"

  if [ -d "${repo_dir}/.git" ]; then
    log_upstream "Fetching external source ${repo_dir}"
    git -C "${repo_dir}" remote set-url origin "${remote_url}"
    git -C "${repo_dir}" fetch origin --prune --tags

    if [ "${update_working_tree}" = "1" ]; then
      if ! git -C "${repo_dir}" diff --quiet --ignore-submodules HEAD -- || \
        ! git -C "${repo_dir}" diff --cached --quiet --ignore-submodules --; then
        log_upstream "Skipping working tree update for ${repo_dir} because it has local changes"
        return
      fi

      if ! git -C "${repo_dir}" checkout "${branch_name}" >/dev/null 2>&1; then
        git -C "${repo_dir}" checkout -B "${branch_name}" "origin/${branch_name}"
      fi

      log_upstream "Fast-forwarding ${repo_dir} on ${branch_name}"
      git -C "${repo_dir}" pull --ff-only origin "${branch_name}"
    fi

    return
  fi

  log_upstream "Cloning ${remote_url} into ${repo_dir}"
  git clone --branch "${branch_name}" --single-branch "${remote_url}" "${repo_dir}"
}

short_head_or_missing() {
  local repo_dir="$1"

  if [ ! -d "${repo_dir}/.git" ]; then
    printf 'missing'
    return
  fi

  git -C "${repo_dir}" rev-parse --short HEAD
}

branch_or_missing() {
  local repo_dir="$1"

  if [ ! -d "${repo_dir}/.git" ]; then
    printf 'missing'
    return
  fi

  local branch_name
  branch_name="$(git -C "${repo_dir}" branch --show-current 2>/dev/null || true)"
  printf '%s' "${branch_name:-detached}"
}

baseline_matches() {
  local full_commit="$1"
  local baseline_commit="$2"

  case "${full_commit}" in
    "${baseline_commit}"*) return 0 ;;
    *) return 1 ;;
  esac
}
