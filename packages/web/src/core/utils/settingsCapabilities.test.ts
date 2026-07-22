import { create } from "@bufbuild/protobuf";
import { Protobuf } from "@meshtastic/core";
import {
  getSettingsMetadata,
  isConfigTabSupported,
  isLegacyFirmwareTextCompressionSupported,
  isModuleConfigTabSupported,
  resolveTextCompressionModeForFirmware,
} from "./settingsCapabilities.ts";

const createMetadata = (overrides: Partial<Protobuf.Mesh.DeviceMetadata> = {}) =>
  create(Protobuf.Mesh.DeviceMetadataSchema, {
    hasBluetooth: false,
    hasWifi: false,
    hasEthernet: false,
    excludedModules: 0,
    firmwareVersion: "2.7.16",
    ...overrides,
  });

describe("settingsCapabilities", () => {
  it("selects local and remote metadata with Android-compatible lookup", () => {
    const localMetadata = createMetadata({ firmwareVersion: "2.7.15" });
    const remoteMetadata = createMetadata({ firmwareVersion: "2.7.20" });
    const metadata = new Map<number, Protobuf.Mesh.DeviceMetadata>([
      [0, localMetadata],
      [1234, remoteMetadata],
    ]);

    expect(getSettingsMetadata(metadata, 1234, false)).toBe(localMetadata);
    expect(getSettingsMetadata(metadata, 1234, true)).toBe(remoteMetadata);
  });

  it("shows bluetooth and network tabs only when supported by metadata", () => {
    const bluetoothOnly = createMetadata({ hasBluetooth: true });
    const networkOnly = createMetadata({ hasWifi: true });
    const unsupported = createMetadata();

    expect(isConfigTabSupported("bluetooth", bluetoothOnly)).toBe(true);
    expect(isConfigTabSupported("bluetooth", unsupported)).toBe(false);
    expect(isConfigTabSupported("network", networkOnly)).toBe(true);
    expect(isConfigTabSupported("network", unsupported)).toBe(false);
  });

  it("hides status message and traffic management when metadata is missing", () => {
    expect(isModuleConfigTabSupported("statusmessage", undefined)).toBe(false);
    expect(isModuleConfigTabSupported("trafficManagement", undefined)).toBe(false);
    expect(isModuleConfigTabSupported("remoteHardware", undefined)).toBe(true);
  });

  it("enables status message from firmware 2.7.17 unless excluded", () => {
    const unsupported = createMetadata({ firmwareVersion: "2.7.16" });
    const supported = createMetadata({ firmwareVersion: "2.7.17" });
    const excluded = createMetadata({
      firmwareVersion: "2.7.17",
      excludedModules: 1 << 13,
    });

    expect(isModuleConfigTabSupported("statusmessage", unsupported)).toBe(false);
    expect(isModuleConfigTabSupported("statusmessage", supported)).toBe(true);
    expect(isModuleConfigTabSupported("statusmessage", excluded)).toBe(false);
  });

  it("enables traffic management from firmware 2.7.20", () => {
    const unsupported = createMetadata({ firmwareVersion: "2.7.19" });
    const supported = createMetadata({ firmwareVersion: "2.7.20" });

    expect(isModuleConfigTabSupported("trafficManagement", unsupported)).toBe(false);
    expect(isModuleConfigTabSupported("trafficManagement", supported)).toBe(true);
  });

  it("hides standard modules when their excludedModules bit is set", () => {
    const available = createMetadata();
    const excluded = createMetadata({ excludedModules: 1 << 8 });

    expect(isModuleConfigTabSupported("remoteHardware", available)).toBe(true);
    expect(isModuleConfigTabSupported("remoteHardware", excluded)).toBe(false);
  });

  it("keeps firmware text compression only for legacy or unknown firmware", () => {
    const legacy = createMetadata({ firmwareVersion: "2.7.21" });
    const appCompression = createMetadata({ firmwareVersion: "2.7.26-darkmesh" });

    expect(isLegacyFirmwareTextCompressionSupported(undefined)).toBe(true);
    expect(isLegacyFirmwareTextCompressionSupported(legacy)).toBe(true);
    expect(isLegacyFirmwareTextCompressionSupported(appCompression)).toBe(false);
    expect(resolveTextCompressionModeForFirmware("remote", legacy)).toBe("remote");
    expect(resolveTextCompressionModeForFirmware("remote", appCompression)).toBe("app");
    expect(resolveTextCompressionModeForFirmware("app", appCompression)).toBe("app");
  });
});
