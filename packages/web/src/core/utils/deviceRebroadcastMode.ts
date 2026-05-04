import { Protobuf } from "@meshtastic/core";

type DeviceRole = Protobuf.Config.Config_DeviceConfig_Role;
type RebroadcastMode = Protobuf.Config.Config_DeviceConfig_RebroadcastMode;

type RoleAwareDeviceConfig = {
  role: DeviceRole;
  rebroadcastMode: RebroadcastMode;
};

const REBROADCAST_MODE_OPTIONS = Object.fromEntries(
  Object.entries(Protobuf.Config.Config_DeviceConfig_RebroadcastMode).filter(
    ([, value]) => typeof value === "number",
  ),
) as Record<string, number>;

const NONE_ALLOWED_ROLES = new Set<DeviceRole>([
  Protobuf.Config.Config_DeviceConfig_Role.SENSOR,
  Protobuf.Config.Config_DeviceConfig_Role.TRACKER,
  Protobuf.Config.Config_DeviceConfig_Role.TAK_TRACKER,
]);

const roleSupportsAllSkipDecoding = (role: DeviceRole) =>
  role === Protobuf.Config.Config_DeviceConfig_Role.REPEATER;

const roleAllowsNone = (role: DeviceRole) =>
  role === Protobuf.Config.Config_DeviceConfig_Role.CLIENT_MUTE || NONE_ALLOWED_ROLES.has(role);

export const getRoleDefaultRebroadcastMode = (role: DeviceRole): RebroadcastMode => {
  switch (role) {
    case Protobuf.Config.Config_DeviceConfig_Role.ROUTER:
      return Protobuf.Config.Config_DeviceConfig_RebroadcastMode.CORE_PORTNUMS_ONLY;
    case Protobuf.Config.Config_DeviceConfig_Role.CLIENT_HIDDEN:
      return Protobuf.Config.Config_DeviceConfig_RebroadcastMode.LOCAL_ONLY;
    case Protobuf.Config.Config_DeviceConfig_Role.CLIENT_MUTE:
      return Protobuf.Config.Config_DeviceConfig_RebroadcastMode.NONE;
    default:
      return Protobuf.Config.Config_DeviceConfig_RebroadcastMode.ALL;
  }
};

export const getEffectiveRebroadcastModeForRole = (
  role: DeviceRole,
  rebroadcastMode: RebroadcastMode,
): RebroadcastMode => {
  if (role === Protobuf.Config.Config_DeviceConfig_Role.CLIENT_MUTE) {
    return Protobuf.Config.Config_DeviceConfig_RebroadcastMode.NONE;
  }

  if (
    rebroadcastMode === Protobuf.Config.Config_DeviceConfig_RebroadcastMode.ALL_SKIP_DECODING &&
    !roleSupportsAllSkipDecoding(role)
  ) {
    return Protobuf.Config.Config_DeviceConfig_RebroadcastMode.ALL;
  }

  if (
    rebroadcastMode === Protobuf.Config.Config_DeviceConfig_RebroadcastMode.NONE &&
    (role === Protobuf.Config.Config_DeviceConfig_Role.ROUTER ||
      role === Protobuf.Config.Config_DeviceConfig_Role.ROUTER_LATE)
  ) {
    return Protobuf.Config.Config_DeviceConfig_RebroadcastMode.ALL;
  }

  return rebroadcastMode;
};

export const normalizeDeviceConfigForRole = <T extends RoleAwareDeviceConfig>(config: T): T => ({
  ...config,
  rebroadcastMode: getEffectiveRebroadcastModeForRole(config.role, config.rebroadcastMode),
});

export const getRoleAwareRebroadcastModeOptions = (role: DeviceRole) => {
  return Object.fromEntries(
    Object.entries(REBROADCAST_MODE_OPTIONS).filter(([name]) => {
      if (role === Protobuf.Config.Config_DeviceConfig_Role.CLIENT_MUTE) {
        return name === "NONE";
      }

      if (name === "ALL_SKIP_DECODING") {
        return roleSupportsAllSkipDecoding(role);
      }

      if (name === "NONE") {
        return roleAllowsNone(role);
      }

      return true;
    }),
  );
};
