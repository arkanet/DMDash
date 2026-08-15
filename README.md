# DMDash

`DMDash` is a DarkMesh-oriented web dashboard built on top of the Meshtastic web client.

This repository uses `meshtastic/web` as the technical base, applies DarkMesh branding and UX, and keeps compatibility with the official Meshtastic protobuf contract so the dashboard can remain interoperable with the wider Meshtastic ecosystem.

## Project Goal

The goal of `DMDash` is to provide a web-first DarkMesh dashboard that:

- preserves Meshtastic protocol compatibility
- reuses the Meshtastic web runtime, transports, and data model
- ports DarkMesh-specific user flows from the Android app into the browser
- stays aligned with DarkMesh firmware branches `2.7.15-ghost`, `2.7.21-ghost`, and `2.7.26-darkmesh`, while comparing against Meshtastic firmware hardware declarations

## What You Can Do Today

The current DMDash build exposes these user-facing capabilities on top of the Meshtastic web base:

- connection manager with `HTTP(S)`, Web Bluetooth, and Web Serial transports
- DarkMesh-branded dashboard with notifications, Mesh Stats, traceroute history, scheduled message rules, distress beacon controls, hunt forwarding, and NodeDB maintenance tools
- `.dmdb` import/export based on Meshtastic `SharedContact`
- direct and broadcast messaging with replies, mentions, reactions, emoji picker, app-side Unishox2 compression, legacy firmware compression fallback, compression indicators, and clickable avatars
- inline node `Status Message` display in chat plus avatar badges with unread/read visual state
- map view with live markers, node popups, details dialog, neighbor info, environment metrics, and traceroute overlays
- node list with filters, favorites, signal visibility, encryption status, quick detail access, and mobile long-press search handoff from the map and gateway widgets
- local `Radio`, `Device`, and `Module` settings with firmware-aware tab visibility
- Remote Admin for `Radio`, `Device`, and `Module` configuration on compatible remote nodes, including mobile parent navigation
- module settings coverage for features such as `Remote Hardware`, `Status Message`, and `Traffic Management` when supported by firmware
- DarkMesh white-on-black web app icons for favicon, Apple touch icon, and PWA install surfaces

Feature availability still depends on browser capabilities, transport type, node firmware, and device role.

## User Documentation

Non-technical, task-oriented documentation is served directly by the web app build. The guide landing page also acts as the lightweight demo entry point for the current UI/workflow coverage:

- in-app demo / guide route: `/guide`
- static landing page: [packages/web/public/guide/index.html](packages/web/public/guide/index.html)
- English guide: [packages/web/public/guide/en/index.html](packages/web/public/guide/en/index.html)
- Italian guide: [packages/web/public/guide/it/index.html](packages/web/public/guide/it/index.html)

When the web app is running locally, open `/guide` on the same host:

```text
http://localhost:3000/guide
```

The static-compatible paths `/guide/index.html`, `/guide/en/index.html`, and `/guide/it/index.html` are also routed by the app, so the demo can be linked from a deployed homepage without special server rules.

### Feature previews

Below are quick previews of selected DarkMesh dashboard features; click a thumbnail to view the full-size image.

- **Messages (chat / emoji picker)**  
  [![Messages](assets/screenshots/Chat-thumb.png)](assets/screenshots/Chat.png)
- **Map (overview + node popup)**  
  [![Map](assets/screenshots/EnvironmentalMetrics-thumb.png)](assets/screenshots/EnvironmentalMetrics.png)
- **Map filters (role/metrics UI)**  
  [![Filters](assets/screenshots/Filters-thumb.png)](assets/screenshots/Filters.png)
- **Node popup (neighbor list / metrics)**  
  [![Node popup](assets/screenshots/NeighborNodes-thumb.png)](assets/screenshots/NeighborNodes.png)
- **Traceroute overlay (traced route visual)**  
  [![Traceroute](assets/screenshots/VisualTraceroute-thumb.png)](assets/screenshots/VisualTraceroute.png)

## Protocol Compatibility

`DMDash` does not introduce a separate protobuf fork.

The compatibility model is:

- `DarkMesh-Firmware` branches `2.7.15-ghost`, `2.7.21-ghost`, and `2.7.26-darkmesh` are used as DarkMesh firmware references
- `meshtastic/firmware` `master` is used as the Meshtastic firmware hardware reference
- `DarkMesh-Firmware` currently points its `protobufs/` submodule to the official Meshtastic protobuf repository
- `DMDash` therefore keeps the official Meshtastic protobuf schema as the source of truth

### Compressed Message Compatibility

DarkMesh firmware `2.7.26-darkmesh` moves text compression to the application layer. DMDash now follows that model by default:

- outbound compressed text is compressed in the web client with Unishox2 and sent on `TEXT_MESSAGE_COMPRESSED_APP`
- incoming `TEXT_MESSAGE_COMPRESSED_APP` payloads are decoded in the web client when they contain app-compressed data
- legacy firmware compression remains available through the `remote` compression mode, which keeps sending clear text on the compressed port for older firmware that still handles compression itself
- plain-text payloads received on the compressed port remain readable for backward compatibility
- message metadata preserves `compressed`, `compressionMode`, `savedBytes`, and estimated saved airtime where available

The compatibility gate treats firmware `2.7.26+` as app-side compression capable. Older or unknown firmware can still expose the legacy firmware compression option.

For the analysis and current baseline, see:

- [docs/darkmesh-analysis.md](docs/darkmesh-analysis.md)
- [docs/compatibility-matrix.md](docs/compatibility-matrix.md)
- [docs/compatibility-report.md](docs/compatibility-report.md)
- [docs/device-image-coverage.md](docs/device-image-coverage.md)
- [docs/pictures-sync.md](docs/pictures-sync.md)
- [CHANGELOG.md](CHANGELOG.md)

## Upstream Strategy

This project tracks multiple upstream repositories, but they do not all have the same role:

- `upstream-web`
  - Meshtastic web base
  - the only upstream that is intended to be merged into the dashboard code tree
- `upstream-protobufs`
  - protocol compatibility reference
- `upstream-firmware`
  - Meshtastic firmware hardware declaration reference
- `upstream-darkmesh-android`
  - DarkMesh feature and UX reference
- `upstream-darkmesh-firmware`
  - firmware behavior reference

Policy details are documented in [docs/upstream-policy.md](docs/upstream-policy.md).

## Repository Layout

- `packages/web`
  - the actual web dashboard application
- `packages/core`
  - Meshtastic JS core logic used by the dashboard
- `docs`
  - DarkMesh analysis, compatibility, and upstream policy
- `scripts`
  - system sync, pictures sync, and compatibility reporting helpers
- `external-sources`
  - local clones of upstream repositories used for analysis and sync
  - intentionally excluded from git tracking in this repository

## Development

### Prerequisites

- `pnpm`
- Node.js compatible with the workspace dependencies

### Install

```bash
pnpm install
```

### Run the web dashboard

```bash
pnpm --filter meshtastic-web dev
```

### Typecheck

Runtime-focused typecheck:

```bash
pnpm --filter meshtastic-web typecheck
```

Full package typecheck, including tests and support files:

```bash
pnpm exec tsc --noEmit -p packages/web/tsconfig.json
```

### Build

```bash
pnpm --filter meshtastic-web build
```

## Useful scripts

The repository exposes several helpful workspace scripts through the top-level `package.json`. Useful commands include:

- **Install prerequisites**: `pnpm install`
- **Run dev server (web package)**: `pnpm --filter meshtastic-web dev`
- **Typecheck (runtime-focused)**: `pnpm --filter meshtastic-web typecheck`
- **Full package TypeScript check**: `pnpm exec tsc --noEmit -p packages/web/tsconfig.json`
- **Build all packages**: `pnpm run build:all` (runs `build` for all workspace packages)
- **Clean all packages**: `pnpm run clean:all`
- **System Sync (upstreams + compatibility report)**: `pnpm sync:system`
- **System Sync with external mirror fast-forward**: `pnpm sync:system:update`
- **Pictures Sync (hardware image coverage report)**: `pnpm sync:pictures`
- **Pictures Sync strict guardrail**: `pnpm sync:pictures:strict`
- **Sync upstream mirrors**: `pnpm sync:upstreams`
- **Update upstream mirrors (fast-forward when clean)**: `pnpm sync:upstreams:update`
- **Regenerate compatibility report**: `pnpm report:compatibility`
- **Regenerate device image coverage report**: `pnpm report:device-images`
- **Enforce device image coverage guardrail**: `pnpm check:device-images`
- **Lint**: `pnpm run lint` and `pnpm run lint:fix`
- **Format**: `pnpm run format` and `pnpm run format:fix`
- **Check (lint + format)**: `pnpm run check` and `pnpm run check:fix`
- **Run tests**: `pnpm run test`

These map to the scripts defined in the repository root `package.json` and are useful during development and CI.

## Sync Workflows

System Sync keeps DMDash/DarkMesh behavior primary while checking Meshtastic compatibility. It refreshes upstream references and regenerates the compatibility report:

```bash
pnpm sync:system
```

Fast-forward external mirror working trees when they are clean:

```bash
pnpm sync:system:update
```

Pictures Sync is separate and owns hardware image coverage from firmware declarations, including `platformio.ini` metadata such as `custom_meshtastic_images`:

```bash
pnpm sync:pictures
```

Run the blocking Pictures Sync guardrail:

```bash
pnpm sync:pictures:strict
```

See [docs/pictures-sync.md](docs/pictures-sync.md) for the acquisition/conversion policy.

### Low-level upstream commands

Refresh remotes and local mirrors:

```bash
pnpm sync:upstreams
```

Refresh remotes and fast-forward the local mirrors when clean:

```bash
pnpm sync:upstreams:update
```

Regenerate the compatibility snapshot:

```bash
pnpm report:compatibility
```

Regenerate the device image coverage report:

```bash
pnpm report:device-images
```

Run the blocking guardrail for DeviceImage coverage:

```bash
pnpm check:device-images
```

## Browser Runtime Notes

Some DarkMesh Android behaviors depend on long-running foreground services. In the web dashboard, these features operate while the browser tab is open and connected:

- scheduled messages and rule-based sends
- distress beacon loop
- hunting forwarding
- live notification polling tied to the active browser session

This is an intentional browser-side approximation, not a protocol break.

The web app is configured as a PWA with an iOS-friendly manifest, Apple touch icon metadata, a root Service Worker, offline runtime caching, and a custom install banner for iPhone/iPad users. Web Push support is present on the client and Service Worker side; configure these deployment variables to register subscriptions with your push backend:

- `VITE_WEB_PUSH_PUBLIC_KEY`
- `VITE_WEB_PUSH_SUBSCRIBE_URL`
- `VITE_WEB_PUSH_UNSUBSCRIBE_URL`

On iOS/iPadOS, Web Push requires the site to be installed from the Home Screen and opened as a standalone web app. iOS still does not expose Web Bluetooth to Safari or Home Screen PWAs, so Bluetooth connections require a browser/platform with Web Bluetooth support or a native wrapper/companion app using CoreBluetooth.

Some settings and Remote Admin subsections are also firmware-gated, so different nodes can expose different tabs.

Compression mode is also firmware-aware: DMDash prefers app-side compression for `2.7.26-darkmesh` and newer compatible firmware, while preserving the legacy firmware-side request mode for older DarkMesh nodes.

## Verified Status

At the current repository state:

- `packages/web` runtime typecheck passes
- full `packages/web` typecheck passes
- production build passes
- targeted tests for the recently adapted areas pass

## Upstream Repositories Referenced

- DarkMesh Android: `https://github.com/emp3r0r7/DarkMesh.git`
- DarkMesh Firmware: `https://github.com/emp3r0r7/DarkMesh-Firmware.git`
- Meshtastic Firmware: `https://github.com/meshtastic/firmware.git`
- Meshtastic Protobufs: `https://github.com/meshtastic/protobufs.git`
- Meshtastic Web: `https://github.com/meshtastic/web.git`

## Project Identity

`DMDash` is a DarkMesh dashboard project with a Meshtastic-compatible technical core.

It should be treated as:

- a DarkMesh web experience
- a Meshtastic-compatible dashboard
- a repository that follows upstreams intentionally rather than mixing all histories together

## Screenshot Assets

The images currently referenced by this README live under `assets/screenshots/`:

- `assets/screenshots/Chat.png` — messages / chat preview
- `assets/screenshots/EnvironmentalMetrics.png` — node popup / metrics
- `assets/screenshots/Filters.png` — map filters UI
- `assets/screenshots/NeighborNodes.png` — neighbor list in node popup
- `assets/screenshots/VisualTraceroute.png` — traceroute overlay on the map

## Recent UX Additions

Recent work added or stabilized the following areas:

- clickable message avatars that open node details
- reply previews that jump to the original message
- mention highlighting and improved reply UX
- status message rendering in popup, dialog, chat header, and node avatars
- unread/read status message badge behavior for avatars
- module coverage for `Status Message`, `Traffic Management`, and `Remote Hardware`
- battery and power notification workflows from the DarkMesh dashboard
- Mesh Stats in the mobile Extra menu, including traceroute and compression counters
- app-side Unishox2 compression with firmware-side legacy fallback
- guarded Unishox2 decompression so invalid compressed payloads do not render as unreadable text
- mobile long-press node search from Relay Confidence, map markers, node tabs, and node cards
- tighter mobile Extra menu layout without search/footer padding and with dark-mode black background
- DarkMesh favicon, Apple touch icon, and PWA icon assets

## Documentation Changelog

Recent README-visible changes:

- added [CHANGELOG.md](CHANGELOG.md) with the latest 7 commits on `fix-update`
- documented the in-app demo/guide route at `/guide`, with static-compatible `/guide/index.html` paths
- split `System Sync` and `Pictures Sync` responsibilities
- added the DeviceImage hardware coverage report and guardrail commands
- expanded upstream tracking to include Meshtastic firmware hardware declarations
- updated compatibility wording to cover DarkMesh `2.7.15-ghost`, DarkMesh `2.7.21-ghost`, DarkMesh `2.7.26-darkmesh`, and Meshtastic firmware
- added compression compatibility notes for app-side Unishox2 and legacy firmware-side compression mode
