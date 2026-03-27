# DarkMesh Dashboard Analysis

## Repository baseline analyzed

- `meshtastic/web` at `main` commit `6535c96e`
- `meshtastic/protobufs` at `master` commit `cb1f893`
- `emp3r0r7/DarkMesh` at `main` commit `346eedd7`
- `emp3r0r7/DarkMesh-Firmware` at branch `2.7.15-ghost` commit `49af1adf`

## Key comparison findings

### Protobuf compatibility

- `DarkMesh-Firmware` keeps `protobufs/` as a submodule that points to the official Meshtastic protobuf repository.
- No DarkMesh-only protobuf fork was required to support the web dashboard features implemented here.
- The dashboard therefore stays aligned with Meshtastic packet structures and reuses the official:
  - `TEXT_MESSAGE_APP`
  - `ADMIN_APP`
  - `TRACEROUTE_APP`
  - `POSITION_APP`
  - `TELEMETRY_APP`
  - `SharedContact`

### DarkMesh Android feature mapping

DarkMesh Android adds or emphasizes these user-visible flows:

- Scheduled messaging via `PlanMsgService`
- Distress beaconing via `DistressService`
- Hunting forwarding and traceroute scan flows via `HuntHttpService` and `HuntScheduleService`
- Traceroute map rendering
- `.dmdb` import/export based on Meshtastic shared contact URLs
- Reply-aware message UX using `replyId`
- Relay / gateway heuristics derived from direct packets, traceroutes and relay suffix matching

### Firmware-side observations

- DarkMesh firmware includes additional modules such as `ConsoleModule`, `ZeroCostHopModule` and `ReplyModule`.
- These modules mostly reuse standard Meshtastic packet types and admin behavior instead of introducing a parallel protobuf contract.
- Some behavior remains radio-side by nature:
  - console workflows
  - auto-favorite or infrastructure heuristics
  - routing/trace behavior

## Dashboard implementation choices

The dashboard in this repository uses `meshtastic/web` as the base and layers DarkMesh behavior on top of it:

- Adds a DarkMesh dashboard route and styling
- Keeps Meshtastic connection and device management intact
- Extends packet metadata exposure so web UI can use:
  - `replyId`
  - `requestId`
  - `relayNode`
  - hop and RF metadata
- Adds DarkMesh runtime services in the browser for:
  - scheduled messages
  - distress beaconing
  - hunt forwarding
  - gateway detection
- Adds DarkMesh `.dmdb` import/export using Meshtastic `SharedContact`
- Adds traceroute overlay rendering to the map page
- Adds reply UX to the message composer and message list

## Practical limits

Some Android behaviors assume long-running foreground services. The web dashboard approximates them while the tab is open and connected:

- scheduled messages run while the dashboard is active
- beacon loops run while the dashboard is active
- hunt forwarding runs while the dashboard is active

This preserves protocol compatibility while staying honest about browser lifecycle limits.
