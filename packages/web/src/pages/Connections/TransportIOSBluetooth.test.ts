import { Types } from "@meshtastic/core";
import { fromByteArray } from "base64-js";
import { afterEach, describe, expect, it } from "vitest";
import {
  IOS_BLUETOOTH_PACKET_EVENT,
  IOS_BLUETOOTH_STATUS_EVENT,
  TransportIOSBluetooth,
  type DMDashIOSBluetoothBridge,
} from "./TransportIOSBluetooth.ts";

function installBridge() {
  const deviceId = "ios-device-1";
  let lastWritten: string | undefined;

  const bridge: DMDashIOSBluetoothBridge = {
    isAvailable: () => true,
    requestDevice: async () => ({ id: deviceId, name: "iPhone BLE Node" }),
    connect: async () => {},
    disconnect: async () => {},
    write: async (_deviceId, base64Data) => {
      lastWritten = base64Data;
    },
  };

  Object.defineProperty(window, "DMDashIOSBluetooth", {
    configurable: true,
    writable: true,
    value: bridge,
  });

  return {
    deviceId,
    writePacket(bytes: Uint8Array) {
      window.dispatchEvent(
        new CustomEvent(IOS_BLUETOOTH_PACKET_EVENT, {
          detail: { deviceId, data: Array.from(bytes) },
        }),
      );
    },
    dropLink() {
      window.dispatchEvent(
        new CustomEvent(IOS_BLUETOOTH_STATUS_EVENT, {
          detail: { deviceId, status: "disconnected", reason: "native-disconnected" },
        }),
      );
    },
    getLastWritten() {
      return lastWritten;
    },
  };
}

async function readUntilType(
  reader: ReadableStreamDefaultReader<Types.DeviceOutput>,
  expectedType: Types.DeviceOutput["type"],
): Promise<Types.DeviceOutput> {
  for (let index = 0; index < 10; index++) {
    const { value } = await reader.read();
    if (value?.type === expectedType) {
      return value;
    }
  }
  throw new Error(`Did not receive a ${expectedType} event`);
}

async function readUntilDisconnected(
  reader: ReadableStreamDefaultReader<Types.DeviceOutput>,
): Promise<Types.DeviceOutput> {
  for (let index = 0; index < 10; index++) {
    const { value } = await reader.read();
    if (
      value?.type === "status" &&
      value.data.status === Types.DeviceStatusEnum.DeviceDisconnected
    ) {
      return value;
    }
  }
  throw new Error("Did not receive a disconnected status");
}

afterEach(() => {
  Reflect.deleteProperty(window, "DMDashIOSBluetooth");
});

describe("TransportIOSBluetooth", () => {
  it("reads packets pushed by the native bridge", async () => {
    const bridge = installBridge();
    const transport = await TransportIOSBluetooth.create(bridge.deviceId);
    const reader = transport.fromDevice.getReader();

    const bytes = new Uint8Array([1, 2, 3]);
    bridge.writePacket(bytes);

    const packet = await readUntilType(reader, "packet");
    expect(packet.type === "packet" ? packet.data : undefined).toEqual(bytes);
    reader.releaseLock();
  });

  it("writes base64 packet data to the native bridge", async () => {
    const bridge = installBridge();
    const transport = await TransportIOSBluetooth.create(bridge.deviceId);
    const writer = transport.toDevice.getWriter();
    const bytes = new Uint8Array([0xaa, 0xbb]);

    await writer.write(bytes);

    expect(bridge.getLastWritten()).toBe(fromByteArray(bytes));
    writer.releaseLock();
  });

  it("emits disconnected status when the native bridge drops", async () => {
    const bridge = installBridge();
    const transport = await TransportIOSBluetooth.create(bridge.deviceId);
    const reader = transport.fromDevice.getReader();

    bridge.dropLink();

    const status = await readUntilDisconnected(reader);
    expect(status.type === "status" ? status.data.status : undefined).toBe(
      Types.DeviceStatusEnum.DeviceDisconnected,
    );
    reader.releaseLock();
  });
});
