# Pictures Sync

`Pictures Sync` is the hardware image workflow for DMDash.

It is intentionally separate from `System Sync`:

- `System Sync` refreshes upstream references and validates DMDash/DarkMesh/Meshtastic compatibility.
- `Pictures Sync` tracks hardware image coverage for firmware-declared boards and prepares image acquisition/update work.

## Scope

Pictures Sync owns:

- hardware discovery from DarkMesh and Meshtastic firmware
- `HW_VENDOR` declarations
- `custom_meshtastic_hw_model`
- `custom_meshtastic_hw_model_slug`
- `custom_meshtastic_images`
- local `DeviceImage` mapping coverage
- local asset coverage under `packages/web/public/devices`
- producer image research queue
- later conversion of approved producer images into local SVG assets

## Current Implementation

The current command is:

```bash
pnpm sync:pictures
```

It refreshes the configured upstream mirrors and regenerates:

```text
docs/device-image-coverage.md
```

The report includes:

- firmware-declared hardware models
- missing `DeviceImage` mappings
- firmware-declared image filenames from `custom_meshtastic_images`
- firmware image metadata gaps
- local asset gaps
- producer/source hints for follow-up research

For a blocking guardrail, run:

```bash
pnpm sync:pictures:strict
```

or:

```bash
pnpm check:device-images
```

## Acquisition Policy

Automatic online search and conversion must stay outside `System Sync`.

When adding image acquisition to Pictures Sync, the flow should be:

1. Prefer image filenames explicitly declared by firmware metadata.
2. Check local assets and Meshtastic Web assets first.
3. Search the producer site when the declared image file is absent.
4. Prefer an official SVG.
5. If only raster images are available, choose a front/top board view and convert or wrap it as a local SVG asset.
6. Update `DeviceImage.tsx` only after the image source is verified.
7. Regenerate `docs/device-image-coverage.md`.
8. Keep source URLs in the report or follow-up notes.

Do not map a hardware model to an approximate image just to reduce missing coverage.
