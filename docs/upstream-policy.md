# Upstream Policy

`DMDash` tracks four upstream repositories, but they do not all play the same role.

## Roles

- `upstream-web`
  - Source: `https://github.com/meshtastic/web.git`
  - Role: technical base of the dashboard
  - Allowed action: fetch, diff, merge, or rebase into the main code tree after review
- `upstream-protobufs`
  - Source: `https://github.com/meshtastic/protobufs.git`
  - Role: protocol contract and compatibility guardrail
  - Allowed action: inspect, compare, validate schema compatibility
- `upstream-darkmesh-android`
  - Source: `https://github.com/emp3r0r7/DarkMesh.git`
  - Role: feature and UX reference
  - Allowed action: inspect, port behavior intentionally into the web layer
- `upstream-darkmesh-firmware`
  - Source: `https://github.com/emp3r0r7/DarkMesh-Firmware.git`
  - Role: firmware behavior reference
  - Allowed action: inspect runtime behavior and protobuf alignment

## Golden Rules

- Only `upstream-web` is a code-merge source for the dashboard tree.
- `upstream-protobufs` is not merged directly into the dashboard UI layer; it is used to detect protocol drift.
- `upstream-darkmesh-android` and `upstream-darkmesh-firmware` are reference upstreams, not direct merge sources.
- `external-sources/` stays outside git tracking for `DMDash` and is only used for inspection, comparison, and local syncing.

## Local Commands

- Refresh upstream remotes and local mirrors:

```bash
pnpm sync:upstreams
```

- Refresh upstream remotes and fast-forward the local mirrors when they are clean:

```bash
pnpm sync:upstreams:update
```

- Regenerate the compatibility snapshot:

```bash
pnpm report:compatibility
```

## GitHub Automation

- `Upstream Compatibility Watch` runs on a schedule and on manual dispatch.
- The workflow refreshes the configured upstream mirrors, regenerates `docs/compatibility-report.md`, uploads the report as an artifact, and fails when drift is detected.
- This automation is a visibility tool, not an auto-merge mechanism. Any upstream sync into the dashboard tree still requires human review.

## Suggested Review Flow

1. Run `pnpm sync:upstreams`.
2. Regenerate `docs/compatibility-report.md`.
3. If `upstream-web` changed, review the delta first because it is the codebase base.
4. If DarkMesh Android or firmware changed, port only the intended behavior into the DarkMesh layer.
5. If protobuf compatibility changes, block feature merges until `docs/compatibility-matrix.md` has been updated.
