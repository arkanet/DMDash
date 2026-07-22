interface LoraAirtimePreset {
  spreadingFactor: number;
  bandwidthHz: number;
  codingRate: number;
}

export interface LoraAirtimeSaving {
  originalAirtimeMs: number;
  compressedAirtimeMs: number;
  savedAirtimeMs: number;
  airtimeReductionPercent: number;
}

const DEFAULT_PRESET: LoraAirtimePreset = {
  spreadingFactor: 9,
  bandwidthHz: 250_000,
  codingRate: 1,
};

const PRESET_BY_SPREADING_FACTOR = new Map<number, LoraAirtimePreset>([
  [7, { spreadingFactor: 7, bandwidthHz: 250_000, codingRate: 1 }],
  [8, { spreadingFactor: 8, bandwidthHz: 250_000, codingRate: 1 }],
  [9, { spreadingFactor: 9, bandwidthHz: 250_000, codingRate: 1 }],
  [10, { spreadingFactor: 10, bandwidthHz: 250_000, codingRate: 1 }],
  [11, { spreadingFactor: 11, bandwidthHz: 250_000, codingRate: 1 }],
  [12, { spreadingFactor: 12, bandwidthHz: 125_000, codingRate: 4 }],
]);

function shouldEnableLowDataRateOptimization(spreadingFactor: number, bandwidthHz: number) {
  return (2 ** spreadingFactor / bandwidthHz) * 1000 >= 16;
}

function calculateAirtimeMs(payloadBytes: number, preset: LoraAirtimePreset) {
  const lowDataRateOptimization = shouldEnableLowDataRateOptimization(
    preset.spreadingFactor,
    preset.bandwidthHz,
  )
    ? 1
    : 0;
  const crc = 1;
  const implicitHeader = 0;
  const preambleSymbols = 8;
  const symbolTimeSeconds = 2 ** preset.spreadingFactor / preset.bandwidthHz;
  const preambleTimeSeconds = (preambleSymbols + 4.25) * symbolTimeSeconds;
  const numerator =
    8 * payloadBytes - 4 * preset.spreadingFactor + 28 + 16 * crc - 20 * implicitHeader;
  const denominator = 4 * (preset.spreadingFactor - 2 * lowDataRateOptimization);
  const payloadSymbolBlocks = Math.max(Math.ceil(numerator / denominator), 0);
  const payloadSymbols = 8 + payloadSymbolBlocks * (preset.codingRate + 4);

  return (preambleTimeSeconds + payloadSymbols * symbolTimeSeconds) * 1000;
}

export function estimateLoraAirtimeSaving(
  originalBytes: number,
  compressedBytes: number,
  spreadingFactor?: number,
): LoraAirtimeSaving {
  const preset = PRESET_BY_SPREADING_FACTOR.get(spreadingFactor ?? 0) ?? DEFAULT_PRESET;
  const originalAirtimeMs = calculateAirtimeMs(originalBytes, preset);
  const compressedAirtimeMs = calculateAirtimeMs(compressedBytes, preset);
  const savedAirtimeMs = originalAirtimeMs - compressedAirtimeMs;

  return {
    originalAirtimeMs,
    compressedAirtimeMs,
    savedAirtimeMs,
    airtimeReductionPercent: originalAirtimeMs > 0 ? (savedAirtimeMs / originalAirtimeMs) * 100 : 0,
  };
}
