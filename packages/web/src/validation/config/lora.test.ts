import { Protobuf } from "@meshtastic/core";
import { describe, expect, it } from "vitest";

describe("LoRa modem presets", () => {
  it("includes SHORT_TURBO modem preset", () => {
    expect(
      Object.prototype.hasOwnProperty.call(
        Protobuf.Config.Config_LoRaConfig_ModemPreset,
        "SHORT_TURBO",
      ),
    ).toBe(true);
  });
});
