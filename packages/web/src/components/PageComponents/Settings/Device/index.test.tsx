import { useWaitForConfig } from "@app/core/hooks/useWaitForConfig";
import { useUnsafeRolesDialog } from "@components/Dialog/UnsafeRolesDialog/useUnsafeRolesDialog.ts";
import type { ConfigTarget } from "@core/hooks/useConfigTarget.tsx";
import { useConfigTarget } from "@core/hooks/useConfigTarget.tsx";
import { Protobuf } from "@meshtastic/core";
import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UseFormReturn } from "react-hook-form";
import type { DeviceValidation } from "@app/validation/config/device.ts";
import { Device } from "./index.tsx";

vi.mock("@core/hooks/useConfigTarget.tsx", () => ({
  useConfigTarget: vi.fn(),
}));

vi.mock("@app/core/hooks/useWaitForConfig", () => ({
  useWaitForConfig: vi.fn(),
}));

vi.mock("@components/Dialog/UnsafeRolesDialog/useUnsafeRolesDialog.ts", () => ({
  useUnsafeRolesDialog: vi.fn(),
}));

const mockedUseConfigTarget = vi.mocked(useConfigTarget);
const mockedUseWaitForConfig = vi.mocked(useWaitForConfig);
const mockedUseUnsafeRolesDialog = vi.mocked(useUnsafeRolesDialog);

const baseDeviceValues: DeviceValidation = {
  role: Protobuf.Config.Config_DeviceConfig_Role.CLIENT,
  serialEnabled: false,
  buttonGpio: 0,
  buzzerGpio: 0,
  rebroadcastMode: Protobuf.Config.Config_DeviceConfig_RebroadcastMode.ALL,
  nodeInfoBroadcastSecs: 900,
  doubleTapAsButtonPress: false,
  isManaged: false,
  disableTripleClick: false,
  ledHeartbeatDisabled: false,
  tzdef: "",
};

const buildConfigTarget = (
  overrides?: Partial<DeviceValidation>,
  options?: { unstableEffectiveConfig?: boolean },
): ConfigTarget => {
  const device = { ...baseDeviceValues, ...overrides };

  return {
    config: { device },
    setChange: vi.fn(),
    removeChange: vi.fn(),
    getEffectiveConfig: vi.fn(() => (options?.unstableEffectiveConfig ? { ...device } : device)),
  } as unknown as ConfigTarget;
};

describe("Device", () => {
  beforeEach(() => {
    mockedUseWaitForConfig.mockImplementation(() => undefined);
    mockedUseUnsafeRolesDialog.mockReturnValue({
      validateRoleSelection: vi.fn().mockResolvedValue(true),
    } as ReturnType<typeof useUnsafeRolesDialog>);
  });

  it("normalizes the loaded rebroadcast mode to the effective firmware behavior", async () => {
    mockedUseConfigTarget.mockReturnValue(
      buildConfigTarget({
        role: Protobuf.Config.Config_DeviceConfig_Role.CLIENT_MUTE,
        rebroadcastMode: Protobuf.Config.Config_DeviceConfig_RebroadcastMode.ALL,
      }),
    );

    let methods: UseFormReturn<DeviceValidation> | null = null;
    render(
      <Device
        onFormInit={(formMethods) => {
          methods = formMethods;
        }}
      />,
    );

    await waitFor(() => {
      expect(methods).not.toBeNull();
      expect(methods?.getValues("rebroadcastMode")).toBe(
        Protobuf.Config.Config_DeviceConfig_RebroadcastMode.NONE,
      );
    });
  });

  it("updates rebroadcast mode when the role changes", async () => {
    mockedUseConfigTarget.mockReturnValue(buildConfigTarget());

    let methods: UseFormReturn<DeviceValidation> | null = null;
    render(
      <Device
        onFormInit={(formMethods) => {
          methods = formMethods;
        }}
      />,
    );

    await waitFor(() => {
      expect(methods).not.toBeNull();
    });

    await act(async () => {
      methods?.setValue("role", Protobuf.Config.Config_DeviceConfig_Role.ROUTER, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
    });

    await waitFor(() => {
      expect(methods?.getValues("rebroadcastMode")).toBe(
        Protobuf.Config.Config_DeviceConfig_RebroadcastMode.CORE_PORTNUMS_ONLY,
      );
    });
  });

  it("does not loop when getEffectiveConfig returns a fresh object", async () => {
    mockedUseConfigTarget.mockReturnValue(
      buildConfigTarget(undefined, { unstableEffectiveConfig: true }),
    );

    let methods: UseFormReturn<DeviceValidation> | null = null;
    render(
      <Device
        onFormInit={(formMethods) => {
          methods = formMethods;
        }}
      />,
    );

    await waitFor(() => {
      expect(methods).not.toBeNull();
      expect(methods?.getValues("role")).toBe(Protobuf.Config.Config_DeviceConfig_Role.CLIENT);
    });
  });
});
