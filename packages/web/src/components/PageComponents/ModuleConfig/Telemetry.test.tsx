import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConfigTarget } from "@core/hooks/useConfigTarget.tsx";
import { useConfigTarget } from "@core/hooks/useConfigTarget.tsx";
import { useWaitForConfig } from "@app/core/hooks/useWaitForConfig";
import { Telemetry } from "./Telemetry.tsx";

vi.mock("@core/hooks/useConfigTarget.tsx", () => ({
  useConfigTarget: vi.fn(),
}));

vi.mock("@app/core/hooks/useWaitForConfig", () => ({
  useWaitForConfig: vi.fn(),
}));

const mockedUseConfigTarget = vi.mocked(useConfigTarget);
const mockedUseWaitForConfig = vi.mocked(useWaitForConfig);

const baseTelemetryValues = {
  deviceTelemetryEnabled: false,
  deviceUpdateInterval: 300,
  environmentUpdateInterval: 600,
  environmentMeasurementEnabled: false,
  environmentScreenEnabled: false,
  environmentDisplayFahrenheit: false,
  airQualityEnabled: false,
  airQualityInterval: 900,
  powerMeasurementEnabled: false,
  powerUpdateInterval: 1200,
  powerScreenEnabled: false,
};

const buildConfigTarget = (overrides?: Partial<typeof baseTelemetryValues>): ConfigTarget => {
  const telemetry = { ...baseTelemetryValues, ...overrides };

  return {
    moduleConfig: { telemetry },
    setChange: vi.fn(),
    removeChange: vi.fn(),
    getEffectiveModuleConfig: vi.fn(() => telemetry),
  } as unknown as ConfigTarget;
};

describe("Telemetry", () => {
  beforeEach(() => {
    mockedUseWaitForConfig.mockImplementation(() => undefined);
  });

  it("keeps dependent telemetry controls disabled until the master toggle is enabled", async () => {
    mockedUseConfigTarget.mockReturnValue(buildConfigTarget());

    render(<Telemetry onFormInit={vi.fn()} />);

    const user = userEvent.setup();
    const masterToggle = screen.getByRole("switch", { name: "Send Device Telemetry" });
    const deviceMetricsInput = screen.getByLabelText("Device Metrics");
    const environmentToggle = screen.getByRole("switch", { name: "Module Enabled" });

    expect(masterToggle).toBeEnabled();
    expect(deviceMetricsInput).toBeDisabled();
    expect(environmentToggle).toBeDisabled();

    await user.click(masterToggle);

    await waitFor(() => {
      expect(deviceMetricsInput).toBeEnabled();
      expect(environmentToggle).toBeEnabled();
    });
  });
});
