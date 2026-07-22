import type { ValidConfigType, ValidModuleConfigType } from "@core/stores";
import { Protobuf, type Types } from "@meshtastic/core";

const MODULE_CONFIG_TYPE_INDEX: Record<
  Exclude<ValidModuleConfigType, "statusmessage" | "trafficManagement">,
  number
> = {
  mqtt: 0,
  serial: 1,
  externalNotification: 2,
  storeForward: 3,
  rangeTest: 4,
  telemetry: 5,
  cannedMessage: 6,
  audio: 7,
  remoteHardware: 8,
  neighborInfo: 9,
  ambientLighting: 10,
  detectionSensor: 11,
  paxcounter: 12,
};

const STATUS_MESSAGE_INDEX = 13;
const MIN_STATUS_MESSAGE_VERSION = [2, 7, 17] as const;
const MIN_TRAFFIC_MANAGEMENT_VERSION = [2, 7, 20] as const;
const MIN_APP_SIDE_TEXT_COMPRESSION_VERSION = [2, 7, 26] as const;

const parseFirmwareVersion = (firmwareVersion?: string) => {
  if (!firmwareVersion) {
    return undefined;
  }

  const parts = firmwareVersion.match(/\d+/g)?.slice(0, 3).map(Number);
  if (!parts || parts.length === 0 || parts.some(Number.isNaN)) {
    return undefined;
  }

  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0] as const;
};

const isAtLeastVersion = (
  firmwareVersion: string | undefined,
  minimum: readonly [number, number, number],
) => {
  const current = parseFirmwareVersion(firmwareVersion);
  if (!current) {
    return false;
  }

  for (let index = 0; index < minimum.length; index += 1) {
    const currentPart = current[index] ?? 0;
    const minimumPart = minimum[index] ?? 0;

    if (currentPart > minimumPart) {
      return true;
    }
    if (currentPart < minimumPart) {
      return false;
    }
  }

  return true;
};

export const isLegacyFirmwareTextCompressionSupported = (
  metadata?: Protobuf.Mesh.DeviceMetadata,
) => {
  if (!metadata?.firmwareVersion) {
    return true;
  }

  return !isAtLeastVersion(metadata.firmwareVersion, MIN_APP_SIDE_TEXT_COMPRESSION_VERSION);
};

export const resolveTextCompressionModeForFirmware = (
  mode: Types.TextCompressionMode,
  metadata?: Protobuf.Mesh.DeviceMetadata,
): Types.TextCompressionMode => {
  if (mode === "remote" && !isLegacyFirmwareTextCompressionSupported(metadata)) {
    return "app";
  }

  return mode;
};

const isExcludedModule = (excludedModules: number | bigint | undefined, index: number) => {
  if (excludedModules === undefined) {
    return false;
  }

  return (Number(excludedModules) & (1 << index)) !== 0;
};

export const getSettingsMetadata = (
  metadata: Map<number, Protobuf.Mesh.DeviceMetadata>,
  targetNodeNum: number,
  isRemote: boolean,
) => (isRemote ? metadata.get(targetNodeNum) : metadata.get(0));

export const isConfigTabSupported = (
  tab: ValidConfigType | "user" | "channels",
  metadata?: Protobuf.Mesh.DeviceMetadata,
) => {
  if (!metadata) {
    return true;
  }

  switch (tab) {
    case "bluetooth":
      return metadata.hasBluetooth;
    case "network":
      return metadata.hasWifi || metadata.hasEthernet;
    default:
      return true;
  }
};

export const isModuleConfigTabSupported = (
  tab: ValidModuleConfigType,
  metadata?: Protobuf.Mesh.DeviceMetadata,
) => {
  if (!metadata) {
    return tab !== "statusmessage" && tab !== "trafficManagement";
  }

  if (tab === "statusmessage") {
    return (
      !isExcludedModule(metadata.excludedModules, STATUS_MESSAGE_INDEX) &&
      isAtLeastVersion(metadata.firmwareVersion, MIN_STATUS_MESSAGE_VERSION)
    );
  }

  if (tab === "trafficManagement") {
    return isAtLeastVersion(metadata.firmwareVersion, MIN_TRAFFIC_MANAGEMENT_VERSION);
  }

  return !isExcludedModule(metadata.excludedModules, MODULE_CONFIG_TYPE_INDEX[tab]);
};
