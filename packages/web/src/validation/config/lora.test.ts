import {
  getLoraChannelNumOptions,
  getDisplayedLoraChannelNum,
  getDisplayedLoraOverrideFrequency,
  getLoraPrimaryChannelName,
  normalizeLoRaConfigForPreview,
  normalizeLoRaConfigForSubmit,
} from "@core/utils/loraConfig.ts";
import { LoRaValidationSchema } from "./lora.ts";
import { Protobuf } from "@meshtastic/core";
import { describe, expect, it } from "vitest";

describe("LoRa modem presets", () => {
  const createLoRaConfig = (
    overrides: Partial<Protobuf.Config.Config_LoRaConfig> = {},
  ): Protobuf.Config.Config_LoRaConfig => ({
    usePreset: true,
    modemPreset: Protobuf.Config.Config_LoRaConfig_ModemPreset.LONG_FAST,
    bandwidth: 0,
    spreadFactor: 0,
    codingRate: 0,
    frequencyOffset: 0,
    region: Protobuf.Config.Config_LoRaConfig_RegionCode.US,
    hopLimit: 3,
    txEnabled: true,
    txPower: 0,
    channelNum: 0,
    overrideDutyCycle: false,
    sx126xRxBoostedGain: false,
    overrideFrequency: 0,
    ignoreIncoming: [],
    ignoreMqtt: false,
    configOkToMqtt: false,
    ...overrides,
  });

  it("includes SHORT_TURBO modem preset", () => {
    expect(
      Object.prototype.hasOwnProperty.call(
        Protobuf.Config.Config_LoRaConfig_ModemPreset,
        "SHORT_TURBO",
      ),
    ).toBe(true);
  });

  it("matches the Android-derived default slot and radio frequency", () => {
    const loraConfig = createLoRaConfig();
    const primaryChannelName = getLoraPrimaryChannelName(loraConfig, undefined);

    expect(getDisplayedLoraChannelNum(loraConfig, primaryChannelName)).toBe(20);
    expect(getDisplayedLoraOverrideFrequency(loraConfig, primaryChannelName)).toBe(906.875);
  });

  it("builds frequency slot dropdown options from the firmware-derived US LONG_FAST channel count", () => {
    const options = getLoraChannelNumOptions(createLoRaConfig());

    expect(Object.keys(options)).toHaveLength(104);
    expect(options["1"]).toBe(1);
    expect(options["104"]).toBe(104);
  });

  it("changes frequency slot dropdown options when modem preset or region changes", () => {
    const longModerateOptions = getLoraChannelNumOptions(
      createLoRaConfig({
        modemPreset: Protobuf.Config.Config_LoRaConfig_ModemPreset.LONG_MODERATE,
      }),
    );
    const wideLoraOptions = getLoraChannelNumOptions(
      createLoRaConfig({
        region: Protobuf.Config.Config_LoRaConfig_RegionCode.LORA_24,
      }),
    );

    expect(Object.keys(longModerateOptions)).toHaveLength(208);
    expect(Object.keys(wideLoraOptions)).toHaveLength(102);
  });

  it("accepts an explicit frequency slot within the computed regional range", () => {
    const parsed = LoRaValidationSchema.safeParse(
      createLoRaConfig({
        channelNum: 20,
      }),
    );

    expect(parsed.success).toBe(true);
  });

  it("rejects an explicit frequency slot above the computed regional range", () => {
    const parsed = LoRaValidationSchema.safeParse(
      createLoRaConfig({
        channelNum: 105,
      }),
    );

    expect(parsed.success).toBe(false);
  });

  it("accepts 2.4GHz override frequencies", () => {
    const parsed = LoRaValidationSchema.safeParse(
      createLoRaConfig({
        region: Protobuf.Config.Config_LoRaConfig_RegionCode.LORA_24,
        overrideFrequency: 2440.5,
      }),
    );

    expect(parsed.success).toBe(true);
  });

  it("accepts override frequency 0", () => {
    const parsed = LoRaValidationSchema.safeParse(
      Object.assign({}, createLoRaConfig(), {
        overrideFrequency: "0",
      }),
    );

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.overrideFrequency).toBe(0);
    }
  });

  it("rejects override frequency with comma decimal separator", () => {
    const parsed = LoRaValidationSchema.safeParse(
      Object.assign({}, createLoRaConfig(), {
        overrideFrequency: "906,875",
      }),
    );

    expect(parsed.success).toBe(false);
  });

  it("rejects override frequency with more than three decimal digits", () => {
    const parsed = LoRaValidationSchema.safeParse(
      Object.assign({}, createLoRaConfig(), {
        overrideFrequency: "906.8751",
      }),
    );

    expect(parsed.success).toBe(false);
  });

  it("keeps derived slot and frequency as raw zero when untouched", () => {
    const original = createLoRaConfig();
    const normalized = normalizeLoRaConfigForSubmit(
      {
        ...original,
        channelNum: 20,
        overrideFrequency: 906.875,
      },
      original,
      {
        channelNum: false,
        overrideFrequency: false,
      },
    );

    expect(normalized.channelNum).toBe(0);
    expect(normalized.overrideFrequency).toBe(0);
  });

  it("keeps preview slot and override frequency in derived mode when the form shows computed values", () => {
    const original = createLoRaConfig();
    const normalized = normalizeLoRaConfigForPreview(
      {
        ...original,
        channelNum: 20,
        overrideFrequency: 906.875,
      },
      original,
      {
        channelNum: false,
        overrideFrequency: false,
      },
    );

    expect(normalized.channelNum).toBe(0);
    expect(normalized.overrideFrequency).toBe(0);
  });

  it("returns preview override frequency to derived mode when the user types 0", () => {
    const original = createLoRaConfig({
      overrideFrequency: 906.5,
      frequencyOffset: 0.125,
    });
    const normalized = normalizeLoRaConfigForPreview(
      {
        ...original,
        overrideFrequency: "0",
      },
      original,
      {
        channelNum: false,
        overrideFrequency: true,
      },
    );

    expect(normalized.overrideFrequency).toBe(0);
    expect(getDisplayedLoraOverrideFrequency(normalized, undefined)).toBe(907);
  });

  it("shows effective override frequency and restores the raw stored value when untouched", () => {
    const original = createLoRaConfig({
      overrideFrequency: 906.5,
      frequencyOffset: 0.125,
    });

    expect(getDisplayedLoraOverrideFrequency(original, undefined)).toBe(906.625);

    const normalized = normalizeLoRaConfigForSubmit(
      {
        ...original,
        overrideFrequency: 906.625,
      },
      original,
      {
        channelNum: false,
        overrideFrequency: false,
      },
    );

    expect(normalized.overrideFrequency).toBe(906.5);
  });

  it("converts an edited effective override frequency back to the raw stored value", () => {
    const original = createLoRaConfig({
      overrideFrequency: 906.5,
      frequencyOffset: 0.125,
    });

    const normalized = normalizeLoRaConfigForSubmit(
      {
        ...original,
        overrideFrequency: 907,
      },
      original,
      {
        channelNum: false,
        overrideFrequency: true,
      },
    );

    expect(normalized.overrideFrequency).toBe(906.875);
  });
});
