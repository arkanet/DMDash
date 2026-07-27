# Changelog

## 2026-07-27 - DarkMesh App and Firmware 2.7.26 Alignment

This changelog entry covers the latest 7 commits on `fix-update`, from `206ee38c4` through `7c457d2dc`.

### Added

- Ported DarkMesh Android app-side text compression into DMDash using Unishox2.
- Added the `app` compression mode for DarkMesh firmware `2.7.26-darkmesh` and compatible firmware, sending compressed payloads on `TEXT_MESSAGE_COMPRESSED_APP`.
- Preserved legacy `remote` compression mode for older DarkMesh firmware that still handles compression in firmware.
- Added compression metadata and counters: sent total, saved bytes, and estimated saved LoRa airtime.
- Added Mesh Stats to the mobile Extra menu, including traceroute totals, success rate, longest route, traveled distance, and compression stats.
- Added long-press mobile node search from Relay Confidence, node tabs, map markers, and node list cards, with map-to-node-list handoff when needed.
- Added DarkMesh white-on-black favicon, Apple touch icon, PWA icons, and Safari mask icon.

### Changed

- Default compressed sends now use app-side compression; legacy firmware-side compression remains an explicit compatibility path.
- `TEXT_MESSAGE_COMPRESSED_APP` receive handling now attempts guarded Unishox2 decompression and falls back to UTF-8 text for legacy payloads.
- Firmware capability gating now treats `2.7.26+` as app-side compression capable and keeps older/unknown firmware eligible for the legacy compression option.
- Display settings were aligned with the newer Device UI GPS format path used by the updated protobuf surface.
- Mobile Extra menu layout was tightened by removing the command search, footer, and excess bottom padding; dark mode now uses a black menu background.

### Fixed

- Fixed Unishox2 decompression fallback so invalid compressed candidates do not render unreadable ASCII in the interface.
- Kept plain-text payloads on `TEXT_MESSAGE_COMPRESSED_APP` readable for backward compatibility with older firmware behavior.
- Replaced remaining Meshtastic web icon fallbacks with DarkMesh-branded assets.

### Commits Included

- `7c457d2dc` - Update DarkMesh web app icons
- `ee6d99d1f` - Add mobile long press node search
- `4c953eb27` - Tighten mobile extra menu layout
- `186feba17` - Add Mesh Stats to mobile extra menu
- `8a41c6c73` - Fix Unishox2 web decompression fallback
- `f96d4ad91` - Align DarkMesh 2.7.26 app compression
- `206ee38c4` - Port DarkMesh app compression and mesh stats

### Validation Notes

- `pnpm --filter meshtastic-web build` passed after the icon update.
- Compression behavior is covered by focused tests in `packages/core/src/meshDevice.test.ts` and `packages/core/src/utils/messageCompression.ts`.
- Mesh Stats and Extra menu behavior are covered by focused command palette and store tests.
