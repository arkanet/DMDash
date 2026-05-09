import { Types } from "@meshtastic/core";
import { fromByteArray, toByteArray } from "base64-js";

export type IOSBluetoothDeviceInfo = {
  id: string;
  name?: string;
};

type IOSBluetoothStatus = "connected" | "connecting" | "disconnected";

type IOSBluetoothPacketEventDetail = {
  deviceId: string;
  data: string | number[] | Uint8Array;
};

type IOSBluetoothStatusEventDetail = {
  deviceId: string;
  status: IOSBluetoothStatus;
  reason?: string;
};

export type DMDashIOSBluetoothBridge = {
  isAvailable?: () => boolean | Promise<boolean>;
  requestDevice: () => Promise<IOSBluetoothDeviceInfo>;
  connect: (deviceId: string) => Promise<void>;
  disconnect: (deviceId: string) => Promise<void>;
  write: (deviceId: string, base64Data: string) => Promise<void>;
};

declare global {
  interface Window {
    DMDashIOSBluetooth?: DMDashIOSBluetoothBridge;
  }
}

export const IOS_BLUETOOTH_PACKET_EVENT = "dmdash-ios-bluetooth-packet";
export const IOS_BLUETOOTH_STATUS_EVENT = "dmdash-ios-bluetooth-status";

function getBridge(): DMDashIOSBluetoothBridge | undefined {
  return globalThis.window?.DMDashIOSBluetooth;
}

function normalizePacketData(data: IOSBluetoothPacketEventDetail["data"]): Uint8Array {
  if (data instanceof Uint8Array) {
    return data;
  }
  if (Array.isArray(data)) {
    return new Uint8Array(data);
  }
  return toByteArray(data);
}

function toDeviceStatus(status: IOSBluetoothStatus): Types.DeviceStatusEnum {
  if (status === "connected") {
    return Types.DeviceStatusEnum.DeviceConnected;
  }
  if (status === "connecting") {
    return Types.DeviceStatusEnum.DeviceConnecting;
  }
  return Types.DeviceStatusEnum.DeviceDisconnected;
}

export async function isIOSBluetoothBridgeAvailable(): Promise<boolean> {
  const bridge = getBridge();
  if (!bridge) {
    return false;
  }
  return bridge.isAvailable ? await bridge.isAvailable() : true;
}

export async function requestIOSBluetoothDevice(): Promise<IOSBluetoothDeviceInfo> {
  const bridge = getBridge();
  if (!bridge) {
    throw new Error("DMDash iOS Bluetooth bridge is not available");
  }
  return await bridge.requestDevice();
}

export class TransportIOSBluetooth implements Types.Transport {
  private _toDevice: WritableStream<Uint8Array>;
  private _fromDevice: ReadableStream<Types.DeviceOutput>;
  private fromDeviceController?: ReadableStreamDefaultController<Types.DeviceOutput>;
  private readonly bridge: DMDashIOSBluetoothBridge;
  private readonly deviceId: string;
  private closingByUser = false;
  private lastStatus: Types.DeviceStatusEnum = Types.DeviceStatusEnum.DeviceDisconnected;

  public static async create(deviceId: string): Promise<TransportIOSBluetooth> {
    const bridge = getBridge();
    if (!bridge) {
      throw new Error("DMDash iOS Bluetooth bridge is not available");
    }
    return new TransportIOSBluetooth(bridge, deviceId);
  }

  private constructor(bridge: DMDashIOSBluetoothBridge, deviceId: string) {
    this.bridge = bridge;
    this.deviceId = deviceId;

    const onPacket = (event: Event) => {
      const detail = (event as CustomEvent<IOSBluetoothPacketEventDetail>).detail;
      if (!detail || detail.deviceId !== this.deviceId) {
        return;
      }
      this.enqueue({ type: "packet", data: normalizePacketData(detail.data) });
    };

    const onStatus = (event: Event) => {
      const detail = (event as CustomEvent<IOSBluetoothStatusEventDetail>).detail;
      if (!detail || detail.deviceId !== this.deviceId) {
        return;
      }
      this.emitStatus(toDeviceStatus(detail.status), detail.reason);
    };

    this._fromDevice = new ReadableStream<Types.DeviceOutput>({
      start: async (ctrl) => {
        this.fromDeviceController = ctrl;
        window.addEventListener(IOS_BLUETOOTH_PACKET_EVENT, onPacket);
        window.addEventListener(IOS_BLUETOOTH_STATUS_EVENT, onStatus);

        this.emitStatus(Types.DeviceStatusEnum.DeviceConnecting);
        try {
          await this.bridge.connect(this.deviceId);
          this.emitStatus(Types.DeviceStatusEnum.DeviceConnected);
        } catch (error) {
          this.emitStatus(Types.DeviceStatusEnum.DeviceDisconnected, "connect-error");
          throw error;
        }
      },
      cancel: () => {
        window.removeEventListener(IOS_BLUETOOTH_PACKET_EVENT, onPacket);
        window.removeEventListener(IOS_BLUETOOTH_STATUS_EVENT, onStatus);
      },
    });

    this._toDevice = new WritableStream<Uint8Array>({
      write: async (chunk) => {
        try {
          await this.bridge.write(this.deviceId, fromByteArray(chunk));
        } catch (error) {
          this.emitStatus(Types.DeviceStatusEnum.DeviceDisconnected, "write-error");
          throw error;
        }
      },
    });
  }

  get toDevice(): WritableStream<Uint8Array> {
    return this._toDevice;
  }

  get fromDevice(): ReadableStream<Types.DeviceOutput> {
    return this._fromDevice;
  }

  async disconnect(): Promise<void> {
    this.closingByUser = true;
    try {
      await this.bridge.disconnect(this.deviceId);
      this.emitStatus(Types.DeviceStatusEnum.DeviceDisconnected, "user");
    } finally {
      this.closingByUser = false;
    }
  }

  private emitStatus(next: Types.DeviceStatusEnum, reason?: string): void {
    if (next === this.lastStatus && reason !== "user") {
      return;
    }
    this.lastStatus = next;
    this.fromDeviceController?.enqueue({
      type: "status",
      data: { status: next, reason: this.closingByUser ? "user" : reason },
    });
  }

  private enqueue(output: Types.DeviceOutput): void {
    this.fromDeviceController?.enqueue(output);
  }
}
