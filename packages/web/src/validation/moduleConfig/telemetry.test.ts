import { describe, expect, it } from "vitest";
import { TelemetryValidationSchema } from "./telemetry.ts";

const validTelemetryPayload = {
  deviceTelemetryEnabled: false,
  deviceUpdateInterval: "300",
  environmentUpdateInterval: "600",
  environmentMeasurementEnabled: false,
  environmentScreenEnabled: false,
  environmentDisplayFahrenheit: false,
  airQualityEnabled: false,
  airQualityInterval: "900",
  powerMeasurementEnabled: false,
  powerUpdateInterval: "1200",
  powerScreenEnabled: false,
};

describe("TelemetryValidationSchema", () => {
  it("preserves the deviceTelemetryEnabled master toggle in parsed output", () => {
    const parsed = TelemetryValidationSchema.parse(validTelemetryPayload);

    expect(parsed.deviceTelemetryEnabled).toBe(false);
  });

  it("rejects telemetry payloads that omit the deviceTelemetryEnabled master toggle", () => {
    const { deviceTelemetryEnabled: _deviceTelemetryEnabled, ...payloadWithoutMasterToggle } =
      validTelemetryPayload;

    const result = TelemetryValidationSchema.safeParse(payloadWithoutMasterToggle);

    expect(result.success).toBe(false);
  });
});
