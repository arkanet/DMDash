import { Protobuf } from "@meshtastic/core";
import { z } from "zod/v4";

const validPinTypes = new Set(
  Object.values(Protobuf.ModuleConfig.RemoteHardwarePinType).filter(
    (value): value is number => typeof value === "number",
  ),
);

export const RemoteHardwareValidationSchema = z.object({
  enabled: z.boolean(),
  allowUndefinedPinAccess: z.boolean(),
  availablePins: z
    .array(
      z.object({
        gpioPin: z.coerce.number().int().min(0),
        name: z.string(),
        type: z.coerce
          .number()
          .int()
          .refine((value) => validPinTypes.has(value), "Invalid pin access type"),
      }),
    )
    .max(4),
});

export type RemoteHardwareValidation = z.infer<typeof RemoteHardwareValidationSchema>;
