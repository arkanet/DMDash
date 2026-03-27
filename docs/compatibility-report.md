# Compatibility Report

Generated at 2026-03-27 10:34:39Z from the local DMDash workspace.

## Upstream Snapshot

| Source | Remote | Target branch | Baseline import | External clone HEAD | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| meshtastic-web | `upstream-web` | `main` | `6535c96e` | `6535c96e (main)` | aligned | Base web client; remote configured |
| meshtastic-protobufs | `upstream-protobufs` | `master` | `cb1f893` | `cb1f893 (master)` | aligned | Official protocol contract; remote configured |
| darkmesh-android | `upstream-darkmesh-android` | `main` | `346eedd7` | `346eedd7 (main)` | aligned | DarkMesh feature reference; remote configured |
| darkmesh-firmware | `upstream-darkmesh-firmware` | `2.7.15-ghost` | `49af1adf` | `49af1adf (2.7.15-ghost)` | aligned | Firmware behavior reference; remote configured |

## Protocol Guardrails

- DarkMesh firmware protobuf submodule: `https://github.com/meshtastic/protobufs.git`
- Protocol status: compatible with official Meshtastic protobufs.
- Merge policy: only `upstream-web` is a code-merge source for the dashboard tree.
- Reference policy: `upstream-protobufs`, `upstream-darkmesh-android`, and `upstream-darkmesh-firmware` are tracked for compatibility analysis and feature porting, not for direct merges into the dashboard code tree.
- Workflow:
  - Run `pnpm sync:upstreams` to refresh remotes and local mirrors.
  - Run `pnpm report:compatibility` to regenerate this report after upstream changes.
  - Review `docs/compatibility-matrix.md` before porting new DarkMesh features.
