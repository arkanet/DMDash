import { Protobuf } from "@meshtastic/core";

type RegionPlan = {
  freqStart: number;
  freqEnd: number;
};

type LoraConfigLike = Pick<
  Protobuf.Config.Config_LoRaConfig,
  | "usePreset"
  | "modemPreset"
  | "bandwidth"
  | "frequencyOffset"
  | "region"
  | "channelNum"
  | "overrideFrequency"
>;

type DirtyDerivedFields = {
  channelNum: boolean;
  overrideFrequency: boolean;
};

type LoraConfigDraftLike = {
  usePreset?: boolean;
  modemPreset?: number | string;
  bandwidth?: number | string;
  frequencyOffset?: number | string;
  region?: number | string;
  channelNum?: number | string;
  overrideFrequency?: number | string;
};

const PRESET_BANDWIDTH_MHZ: Record<number, number> = {
  [Protobuf.Config.Config_LoRaConfig_ModemPreset.SHORT_TURBO]: 0.5,
  [Protobuf.Config.Config_LoRaConfig_ModemPreset.SHORT_FAST]: 0.25,
  [Protobuf.Config.Config_LoRaConfig_ModemPreset.SHORT_SLOW]: 0.25,
  [Protobuf.Config.Config_LoRaConfig_ModemPreset.MEDIUM_FAST]: 0.25,
  [Protobuf.Config.Config_LoRaConfig_ModemPreset.MEDIUM_SLOW]: 0.25,
  [Protobuf.Config.Config_LoRaConfig_ModemPreset.LONG_FAST]: 0.25,
  [Protobuf.Config.Config_LoRaConfig_ModemPreset.LONG_MODERATE]: 0.125,
  [Protobuf.Config.Config_LoRaConfig_ModemPreset.LONG_SLOW]: 0.125,
  [Protobuf.Config.Config_LoRaConfig_ModemPreset.VERY_LONG_SLOW]: 0.0625,
};

const REGION_PLANS: Partial<Record<number, RegionPlan>> = {
  [Protobuf.Config.Config_LoRaConfig_RegionCode.UNSET]: { freqStart: 902.0, freqEnd: 928.0 },
  [Protobuf.Config.Config_LoRaConfig_RegionCode.US]: { freqStart: 902.0, freqEnd: 928.0 },
  [Protobuf.Config.Config_LoRaConfig_RegionCode.EU_433]: { freqStart: 433.0, freqEnd: 434.0 },
  [Protobuf.Config.Config_LoRaConfig_RegionCode.EU_868]: { freqStart: 869.4, freqEnd: 869.65 },
  [Protobuf.Config.Config_LoRaConfig_RegionCode.CN]: { freqStart: 470.0, freqEnd: 510.0 },
  [Protobuf.Config.Config_LoRaConfig_RegionCode.JP]: { freqStart: 920.5, freqEnd: 923.5 },
  [Protobuf.Config.Config_LoRaConfig_RegionCode.ANZ]: { freqStart: 915.0, freqEnd: 928.0 },
  [Protobuf.Config.Config_LoRaConfig_RegionCode.KR]: { freqStart: 920.0, freqEnd: 923.0 },
  [Protobuf.Config.Config_LoRaConfig_RegionCode.TW]: { freqStart: 920.0, freqEnd: 925.0 },
  [Protobuf.Config.Config_LoRaConfig_RegionCode.RU]: { freqStart: 868.7, freqEnd: 869.2 },
  [Protobuf.Config.Config_LoRaConfig_RegionCode.IN]: { freqStart: 865.0, freqEnd: 867.0 },
  [Protobuf.Config.Config_LoRaConfig_RegionCode.NZ_865]: { freqStart: 864.0, freqEnd: 868.0 },
  [Protobuf.Config.Config_LoRaConfig_RegionCode.TH]: { freqStart: 920.0, freqEnd: 925.0 },
  [Protobuf.Config.Config_LoRaConfig_RegionCode.LORA_24]: {
    freqStart: 2400.0,
    freqEnd: 2483.5,
  },
  [Protobuf.Config.Config_LoRaConfig_RegionCode.UA_433]: { freqStart: 433.0, freqEnd: 434.7 },
  [Protobuf.Config.Config_LoRaConfig_RegionCode.UA_868]: { freqStart: 868.0, freqEnd: 868.6 },
  [Protobuf.Config.Config_LoRaConfig_RegionCode.MY_433]: { freqStart: 433.0, freqEnd: 435.0 },
  [Protobuf.Config.Config_LoRaConfig_RegionCode.MY_919]: { freqStart: 919.0, freqEnd: 924.0 },
  [Protobuf.Config.Config_LoRaConfig_RegionCode.SG_923]: { freqStart: 917.0, freqEnd: 925.0 },
  [Protobuf.Config.Config_LoRaConfig_RegionCode.PH_433]: { freqStart: 433.0, freqEnd: 434.7 },
  [Protobuf.Config.Config_LoRaConfig_RegionCode.PH_868]: { freqStart: 868.0, freqEnd: 869.4 },
  [Protobuf.Config.Config_LoRaConfig_RegionCode.PH_915]: { freqStart: 915.0, freqEnd: 918.0 },
};

function roundFrequency(value: number): number {
  return Number(value.toFixed(3));
}

function djb2Hash(input: string): number {
  let hash = 5381;

  for (const character of input) {
    hash = ((hash << 5) + hash + character.charCodeAt(0)) >>> 0;
  }

  return hash >>> 0;
}

function coerceLoraNumber(value: number | string | undefined, fallback: number): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }

  if (typeof value === "string") {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return fallback;
    }

    const parsedValue = Number(trimmedValue);
    return Number.isFinite(parsedValue) ? parsedValue : fallback;
  }

  return fallback;
}

export function getLoraPresetName(preset: Protobuf.Config.Config_LoRaConfig_ModemPreset): string {
  switch (preset) {
    case Protobuf.Config.Config_LoRaConfig_ModemPreset.SHORT_TURBO:
      return "ShortTurbo";
    case Protobuf.Config.Config_LoRaConfig_ModemPreset.SHORT_FAST:
      return "ShortFast";
    case Protobuf.Config.Config_LoRaConfig_ModemPreset.SHORT_SLOW:
      return "ShortSlow";
    case Protobuf.Config.Config_LoRaConfig_ModemPreset.MEDIUM_FAST:
      return "MediumFast";
    case Protobuf.Config.Config_LoRaConfig_ModemPreset.MEDIUM_SLOW:
      return "MediumSlow";
    case Protobuf.Config.Config_LoRaConfig_ModemPreset.LONG_SLOW:
      return "LongSlow";
    case Protobuf.Config.Config_LoRaConfig_ModemPreset.LONG_MODERATE:
      return "LongMod";
    case Protobuf.Config.Config_LoRaConfig_ModemPreset.VERY_LONG_SLOW:
      return "VLongSlow";
    case Protobuf.Config.Config_LoRaConfig_ModemPreset.LONG_FAST:
    default:
      return "LongFast";
  }
}

export function getLoraPrimaryChannelName(
  config: LoraConfigLike,
  primaryChannelName?: string,
): string {
  const trimmedName = primaryChannelName?.trim();

  if (trimmedName) {
    return trimmedName;
  }

  return config.usePreset ? getLoraPresetName(config.modemPreset) : "Custom";
}

export function getLoraRegionPlan(
  region: Protobuf.Config.Config_LoRaConfig_RegionCode,
): RegionPlan | undefined {
  return REGION_PLANS[region];
}

export function getLoraBandwidthMHz(config: LoraConfigLike): number {
  if (config.usePreset) {
    const presetBandwidth = PRESET_BANDWIDTH_MHZ[config.modemPreset] ?? 0.25;

    return config.region === Protobuf.Config.Config_LoRaConfig_RegionCode.LORA_24
      ? presetBandwidth * 3.25
      : presetBandwidth;
  }

  switch (config.bandwidth) {
    case 31:
      return 0.03125;
    case 62:
      return 0.0625;
    case 200:
      return 0.203125;
    case 400:
      return 0.40625;
    case 800:
      return 0.8125;
    case 1600:
      return 1.625;
    default:
      return config.bandwidth / 1000;
  }
}

export function getLoraNumChannels(config: LoraConfigLike): number {
  const regionPlan = getLoraRegionPlan(config.region);
  const bandwidthMHz = getLoraBandwidthMHz(config);

  if (!regionPlan || bandwidthMHz <= 0) {
    return 0;
  }

  return Math.floor((regionPlan.freqEnd - regionPlan.freqStart) / bandwidthMHz);
}

export function getLoraChannelNumOptions(config: LoraConfigLike): Record<string, number> {
  const numChannels = getLoraNumChannels(config);

  if (numChannels <= 0) {
    return {};
  }

  return Object.fromEntries(
    Array.from({ length: numChannels }, (_value, index) => {
      const slot = index + 1;
      return [slot.toString(), slot];
    }),
  );
}

export function getDisplayedLoraChannelNum(
  config: LoraConfigLike,
  primaryChannelName?: string,
): number {
  if (config.channelNum > 0) {
    return config.channelNum;
  }

  const numChannels = getLoraNumChannels(config);
  if (numChannels === 0) {
    return 0;
  }

  const resolvedPrimaryChannelName = getLoraPrimaryChannelName(config, primaryChannelName);
  return (djb2Hash(resolvedPrimaryChannelName) % numChannels) + 1;
}

export function getDisplayedLoraOverrideFrequency(
  config: LoraConfigLike,
  primaryChannelName?: string,
): number {
  if (config.overrideFrequency !== 0) {
    return roundFrequency(config.overrideFrequency + config.frequencyOffset);
  }

  const regionPlan = getLoraRegionPlan(config.region);
  const bandwidthMHz = getLoraBandwidthMHz(config);
  const channelNum = getDisplayedLoraChannelNum(config, primaryChannelName);

  if (!regionPlan || bandwidthMHz <= 0 || channelNum <= 0) {
    return 0;
  }

  return roundFrequency(
    regionPlan.freqStart +
      bandwidthMHz / 2 +
      (channelNum - 1) * bandwidthMHz +
      config.frequencyOffset,
  );
}

export function normalizeLoRaConfigForPreview(
  draft: LoraConfigDraftLike,
  original: LoraConfigLike,
  dirtyFields: DirtyDerivedFields,
): LoraConfigLike {
  const normalized: LoraConfigLike = {
    usePreset: draft.usePreset ?? original.usePreset,
    modemPreset: coerceLoraNumber(
      draft.modemPreset,
      original.modemPreset,
    ) as Protobuf.Config.Config_LoRaConfig_ModemPreset,
    bandwidth: coerceLoraNumber(draft.bandwidth, original.bandwidth),
    frequencyOffset: coerceLoraNumber(draft.frequencyOffset, original.frequencyOffset),
    region: coerceLoraNumber(
      draft.region,
      original.region,
    ) as Protobuf.Config.Config_LoRaConfig_RegionCode,
    channelNum: coerceLoraNumber(draft.channelNum, original.channelNum),
    overrideFrequency: coerceLoraNumber(draft.overrideFrequency, original.overrideFrequency),
  };

  if (!dirtyFields.channelNum && original.channelNum === 0) {
    normalized.channelNum = 0;
  }

  if (!dirtyFields.overrideFrequency && original.overrideFrequency === 0) {
    normalized.overrideFrequency = 0;
  }

  return normalized;
}

export function normalizeLoRaConfigForSubmit<T extends LoraConfigLike>(
  draft: T,
  original: LoraConfigLike,
  dirtyFields: DirtyDerivedFields,
): T {
  const normalized = { ...draft };

  if (!dirtyFields.channelNum) {
    normalized.channelNum = original.channelNum;
  }

  if (!dirtyFields.overrideFrequency) {
    normalized.overrideFrequency = original.overrideFrequency;
  } else if (normalized.overrideFrequency !== 0) {
    normalized.overrideFrequency = roundFrequency(
      Math.max(0, normalized.overrideFrequency - normalized.frequencyOffset),
    );
  }

  return normalized;
}
