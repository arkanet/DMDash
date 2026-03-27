# Compatibility Matrix

This matrix defines how `DMDash` follows each upstream without collapsing unrelated histories into the same code tree.

| Source repo | Remote name | Tracked branch | Baseline imported in DMDash | Integration level | What must remain aligned | Update rule |
| --- | --- | --- | --- | --- | --- | --- |
| Meshtastic Web | `upstream-web` | `main` | `6535c96e` | Source base | Routing, stores, transport, page structure, shared UI behavior | May be merged or rebased into the dashboard tree after review |
| Meshtastic Protobufs | `upstream-protobufs` | `master` | `cb1f893` | Protocol contract | `Admin`, `Mesh`, `PortNum`, shared contact schema, message metadata semantics | Never port blindly into UI; validate compatibility first |
| DarkMesh Android | `upstream-darkmesh-android` | `main` | `346eedd7` | Feature reference | Scheduling UX, distress workflow, hunt forwarding, `.dmdb` behavior, reply semantics | Port intentionally into the DarkMesh web layer, not by merge |
| DarkMesh Firmware | `upstream-darkmesh-firmware` | `2.7.15-ghost` | `49af1adf` | Runtime reference | Radio-side behavior, traceroute expectations, relay/gateway heuristics, protobuf usage | Review branch and protobuf submodule before porting firmware-driven features |

## Current Guardrails

- The firmware reference currently points its `protobufs/` submodule to the official Meshtastic protobuf repository.
- `DMDash` keeps protobuf compatibility as a blocker requirement.
- DarkMesh-specific features must sit on top of the Meshtastic web runtime rather than replacing Meshtastic protocol behavior.

## Operational Meaning

- If `upstream-web` changes, the dashboard base may need code sync work.
- If `upstream-protobufs` changes, compatibility must be reviewed before feature work continues.
- If `upstream-darkmesh-android` changes, the DarkMesh layer may need behavior parity updates.
- If `upstream-darkmesh-firmware` changes, web assumptions about routing, gateway detection, or feature semantics may need adjustment.

## Automation

- GitHub Actions runs `Upstream Compatibility Watch` on a schedule to refresh upstream mirrors and regenerate `docs/compatibility-report.md`.
- The workflow fails when any tracked source drifts away from the imported baseline so maintainers can review upstream changes intentionally.
