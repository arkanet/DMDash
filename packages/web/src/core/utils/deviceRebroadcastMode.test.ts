import { Protobuf } from "@meshtastic/core";
import {
  getEffectiveRebroadcastModeForRole,
  getRoleAwareRebroadcastModeOptions,
  getRoleDefaultRebroadcastMode,
  normalizeDeviceConfigForRole,
} from "./deviceRebroadcastMode.ts";

describe("deviceRebroadcastMode", () => {
  it("returns firmware-aligned defaults when the role changes", () => {
    expect(getRoleDefaultRebroadcastMode(Protobuf.Config.Config_DeviceConfig_Role.ROUTER)).toBe(
      Protobuf.Config.Config_DeviceConfig_RebroadcastMode.CORE_PORTNUMS_ONLY,
    );
    expect(
      getRoleDefaultRebroadcastMode(Protobuf.Config.Config_DeviceConfig_Role.CLIENT_HIDDEN),
    ).toBe(Protobuf.Config.Config_DeviceConfig_RebroadcastMode.LOCAL_ONLY);
    expect(
      getRoleDefaultRebroadcastMode(Protobuf.Config.Config_DeviceConfig_Role.CLIENT_MUTE),
    ).toBe(Protobuf.Config.Config_DeviceConfig_RebroadcastMode.NONE);
    expect(getRoleDefaultRebroadcastMode(Protobuf.Config.Config_DeviceConfig_Role.CLIENT)).toBe(
      Protobuf.Config.Config_DeviceConfig_RebroadcastMode.ALL,
    );
  });

  it("normalizes raw rebroadcast values to the effective firmware behavior", () => {
    expect(
      getEffectiveRebroadcastModeForRole(
        Protobuf.Config.Config_DeviceConfig_Role.CLIENT_MUTE,
        Protobuf.Config.Config_DeviceConfig_RebroadcastMode.ALL,
      ),
    ).toBe(Protobuf.Config.Config_DeviceConfig_RebroadcastMode.NONE);

    expect(
      getEffectiveRebroadcastModeForRole(
        Protobuf.Config.Config_DeviceConfig_Role.CLIENT,
        Protobuf.Config.Config_DeviceConfig_RebroadcastMode.ALL_SKIP_DECODING,
      ),
    ).toBe(Protobuf.Config.Config_DeviceConfig_RebroadcastMode.ALL);

    expect(
      getEffectiveRebroadcastModeForRole(
        Protobuf.Config.Config_DeviceConfig_Role.ROUTER_LATE,
        Protobuf.Config.Config_DeviceConfig_RebroadcastMode.NONE,
      ),
    ).toBe(Protobuf.Config.Config_DeviceConfig_RebroadcastMode.ALL);
  });

  it("keeps valid role-specific modes unchanged", () => {
    expect(
      getEffectiveRebroadcastModeForRole(
        Protobuf.Config.Config_DeviceConfig_Role.REPEATER,
        Protobuf.Config.Config_DeviceConfig_RebroadcastMode.ALL_SKIP_DECODING,
      ),
    ).toBe(Protobuf.Config.Config_DeviceConfig_RebroadcastMode.ALL_SKIP_DECODING);

    expect(
      normalizeDeviceConfigForRole({
        role: Protobuf.Config.Config_DeviceConfig_Role.TRACKER,
        rebroadcastMode: Protobuf.Config.Config_DeviceConfig_RebroadcastMode.NONE,
      }).rebroadcastMode,
    ).toBe(Protobuf.Config.Config_DeviceConfig_RebroadcastMode.NONE);
  });

  it("filters rebroadcast mode options according to the role", () => {
    const routerOptions = getRoleAwareRebroadcastModeOptions(
      Protobuf.Config.Config_DeviceConfig_Role.ROUTER,
    );
    const sensorOptions = getRoleAwareRebroadcastModeOptions(
      Protobuf.Config.Config_DeviceConfig_Role.SENSOR,
    );
    const repeaterOptions = getRoleAwareRebroadcastModeOptions(
      Protobuf.Config.Config_DeviceConfig_Role.REPEATER,
    );
    const clientMuteOptions = getRoleAwareRebroadcastModeOptions(
      Protobuf.Config.Config_DeviceConfig_Role.CLIENT_MUTE,
    );

    expect(routerOptions.NONE).toBeUndefined();
    expect(routerOptions.ALL_SKIP_DECODING).toBeUndefined();
    expect(sensorOptions.NONE).toBe(Protobuf.Config.Config_DeviceConfig_RebroadcastMode.NONE);
    expect(repeaterOptions.ALL_SKIP_DECODING).toBe(
      Protobuf.Config.Config_DeviceConfig_RebroadcastMode.ALL_SKIP_DECODING,
    );
    expect(clientMuteOptions.NONE).toBe(Protobuf.Config.Config_DeviceConfig_RebroadcastMode.NONE);
    expect(Object.keys(clientMuteOptions)).toEqual(["NONE"]);
  });
});
