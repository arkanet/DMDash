# Compatibility Report

Generated at 2026-06-17 09:53:11Z from the local DMDash workspace.

## Upstream Snapshot

| Source | Remote | Target branch | Baseline import | External clone HEAD | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| meshtastic-web | `upstream-web` | `main` | `6535c96e` | `251c073a (main)` | drifted | Base web client; remote configured |
| meshtastic-protobufs | `upstream-protobufs` | `master` | `cb1f893` | `6ae4479 (master)` | drifted | Official protocol contract; remote configured |
| meshtastic-firmware | `upstream-firmware` | `master` | `40adf3a` | `40adf3a0d (master)` | aligned | Official firmware hardware declarations; remote configured |
| darkmesh-android | `upstream-darkmesh-android` | `main` | `346eedd7` | `027b59fa (main)` | drifted | DarkMesh feature reference; remote configured |
| darkmesh-firmware | `upstream-darkmesh-firmware` | `2.7.15-ghost` | `49af1adf` | `fd3755f7 (2.7.15-ghost)` | drifted | Firmware behavior reference; remote configured |

## Protocol Guardrails

- DarkMesh firmware protobuf submodule: `https://github.com/meshtastic/protobufs.git`
- Protocol status: compatible with official Meshtastic protobufs.
- Merge policy: only `upstream-web` is a code-merge source for the dashboard tree.
- Reference policy: `upstream-protobufs`, `upstream-darkmesh-android`, and `upstream-darkmesh-firmware` are tracked for compatibility analysis and feature porting, not for direct merges into the dashboard code tree.
- Workflow:
  - Run `pnpm sync:upstreams` to refresh remotes and local mirrors.
  - Run `pnpm report:compatibility` to regenerate this report after upstream changes.
  - Run `pnpm report:device-images` to compare DeviceImage coverage against DarkMesh and Meshtastic firmware hardware declarations.
  - Run `pnpm check:device-images` when image coverage should be enforced as a blocking guardrail.
  - Review `docs/compatibility-matrix.md` before porting new DarkMesh features.
