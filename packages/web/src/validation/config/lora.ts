import {
  getLoraBandwidthMHz,
  getLoraNumChannels,
  getLoraRegionPlan,
} from "@core/utils/loraConfig.ts";
import { Protobuf } from "@meshtastic/core";
import { z } from "zod/v4";

const ModemPresetEnum = z.enum(Protobuf.Config.Config_LoRaConfig_ModemPreset);
const RegionCodeEnum = z.enum(Protobuf.Config.Config_LoRaConfig_RegionCode);

const OverrideFrequencySchema = z.union([z.number(), z.string()]).transform((value, context) => {
  const rawValue = typeof value === "number" ? value.toString() : value.trim();

  if (!/^\d+(\.\d{1,3})?$/.test(rawValue)) {
    context.addIssue({
      code: "custom",
      message: "formValidation.invalidOverrideFreq.number",
    });
    return z.NEVER;
  }

  const parsedValue = Number(rawValue);

  if (parsedValue !== 0 && (parsedValue < 410 || parsedValue > 2483.5)) {
    context.addIssue({
      code: "custom",
      message: "formValidation.invalidOverrideFreq.number",
    });
    return z.NEVER;
  }

  return parsedValue;
});

export const LoRaValidationSchema = z
  .object({
    usePreset: z.boolean(),
    modemPreset: ModemPresetEnum,
    bandwidth: z.coerce.number().int(),
    spreadFactor: z.coerce.number().int().max(12),
    codingRate: z.coerce.number().int().min(0).max(10),
    frequencyOffset: z.coerce.number().int(),
    region: RegionCodeEnum,
    hopLimit: z.coerce.number().int().min(0).max(7),
    txEnabled: z.boolean(),
    txPower: z.coerce.number().int().min(0),
    channelNum: z.coerce.number().int().min(0),
    overrideDutyCycle: z.boolean(),
    sx126xRxBoostedGain: z.boolean(),
    overrideFrequency: OverrideFrequencySchema,
    ignoreIncoming: z.coerce.number().array(),
    ignoreMqtt: z.boolean(),
    configOkToMqtt: z.boolean(),
  })
  .superRefine((value, context) => {
    const regionPlan = getLoraRegionPlan(value.region);
    const maxChannels = getLoraNumChannels(value);

    if (maxChannels > 0 && value.channelNum > maxChannels) {
      context.addIssue({
        code: "custom",
        path: ["channelNum"],
        message: `Frequency slot must be between 0 and ${maxChannels}`,
      });
    }

    if (!regionPlan) {
      return;
    }

    const bandwidthMHz = getLoraBandwidthMHz(value);
    if (bandwidthMHz > 0 && bandwidthMHz > regionPlan.freqEnd - regionPlan.freqStart) {
      context.addIssue({
        code: "custom",
        path: ["bandwidth"],
        message: "Bandwidth exceeds the regional frequency range",
      });
    }
  });

export type LoRaValidation = z.infer<typeof LoRaValidationSchema>;
