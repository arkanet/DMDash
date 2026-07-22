# Compatibility Report

Generated at 2026-07-22 10:30:40Z from the local DMDash workspace.

## Upstream Snapshot

| Source | Remote | Target branch | Baseline import | Fetched target ref | External clone HEAD | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| meshtastic-web | `upstream-web` | `main` | `6535c96e` | `1eeabeaa` | `1eeabeaa (main)` | drifted | Base web client; remote configured |
| meshtastic-protobufs | `upstream-protobufs` | `master` | `cb1f893` | `b73e5ad` | `b73e5ad (master)` | drifted | Official protocol contract; remote configured |
| meshtastic-firmware | `upstream-firmware` | `master` | `40adf3a` | `3c275de06` | `3c275de06 (master)` | drifted | Official firmware hardware declarations; remote configured |
| darkmesh-android | `upstream-darkmesh-android` | `main` | `346eedd7` | `0a48c469` | `0a48c469 (main)` | drifted | DarkMesh feature reference; remote configured |
| darkmesh-firmware | `upstream-darkmesh-firmware` | `2.7.15-ghost` | `49af1adf` | `18385416` | `2a1f3196 (2.7.21-ghost)` | drifted | Firmware behavior reference; remote configured; branch 2.7.21-ghost |
| darkmesh-firmware-2.7.21 | `upstream-darkmesh-firmware` | `2.7.21-ghost` | `6e4cf387` | `2a1f3196` | `2a1f3196 (2.7.21-ghost)` | drifted | Firmware behavior reference; remote configured |

## Protocol Guardrails

- DarkMesh firmware protobuf submodule: `https://github.com/meshtastic/protobufs.git`
- Protocol status: compatible with official Meshtastic protobufs.
- Merge policy: only `upstream-web` is a code-merge source for the dashboard tree.
- Reference policy: `upstream-protobufs`, `upstream-darkmesh-android`, and `upstream-darkmesh-firmware` are tracked for compatibility analysis and feature porting, not for direct merges into the dashboard code tree.
- Workflow:
  - Run `pnpm sync:upstreams` to refresh remotes and local mirrors.
  - Run `pnpm sync:system` to refresh upstreams and regenerate this compatibility report.
  - Run `pnpm sync:pictures` to refresh hardware image coverage from firmware declarations and image metadata.
  - Run `pnpm report:compatibility` to regenerate this report after upstream changes.
  - Run `pnpm report:device-images` to compare DeviceImage coverage against DarkMesh and Meshtastic firmware hardware declarations.
  - Run `pnpm check:device-images` when image coverage should be enforced as a blocking guardrail.
  - Review `docs/compatibility-matrix.md` before porting new DarkMesh features.
