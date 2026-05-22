import { describe, expect, it, vi } from "vitest";
import { runTransportContract } from "../../../tests/utils/transportContract.ts";
import { Types } from "@meshtastic/core";
import { TransportWebBluetooth } from "./transport.ts";

class MiniEmitter {
  private listeners = new Map<string, Set<(e: Event) => void>>();
  addEventListener(type: string, listener: (e: Event) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
  }
  removeEventListener(type: string, listener: (e: Event) => void) {
    this.listeners.get(type)?.delete(listener);
  }
  dispatchEvent(event: Event) {
    this.listeners.get(event.type)?.forEach((l) => {
      l(event);
    });
  }
}

function stubWebBluetooth() {
  const incomingQueue: Uint8Array[] = [];
  let lastWritten: Uint8Array | undefined;
  let isConnected = true;
  let failNextRead = false;
  let logValue = new DataView(new ArrayBuffer(0));

  // fromRadioCharacteristic: read bytes from queue, one buffer per read
  const fromRadioCharacteristic: BluetoothRemoteGATTCharacteristic = {
    async readValue() {
      if (failNextRead) {
        failNextRead = false;
        throw new Error("GATT operation failed for unknown reason");
      }
      const next = incomingQueue.shift() ?? new Uint8Array();
      return new DataView(next.buffer, next.byteOffset, next.byteLength) as unknown as DataView;
    },
    addEventListener() {},
    removeEventListener() {},
  } as unknown as BluetoothRemoteGATTCharacteristic;

  // characteristicvaluechanged event plumbing (fromNumCharacteristic)
  const charEmitter = new MiniEmitter();

  const fromNumCharacteristic: BluetoothRemoteGATTCharacteristic = {
    async startNotifications() {
      return this;
    },
    async stopNotifications() {
      if (!isConnected) {
        throw new Error("GATT Server is disconnected");
      }
      return this;
    },
    addEventListener(type: string, listener: (e: Event) => void) {
      charEmitter.addEventListener(type, listener);
    },
    removeEventListener(type: string, listener: (e: Event) => void) {
      charEmitter.removeEventListener(type, listener);
    },
  } as unknown as BluetoothRemoteGATTCharacteristic;

  const logEmitter = new MiniEmitter();

  const logRadioCharacteristic: BluetoothRemoteGATTCharacteristic = {
    get value() {
      return logValue;
    },
    async startNotifications() {
      return this;
    },
    async stopNotifications() {
      if (!isConnected) {
        throw new Error("GATT Server is disconnected");
      }
      return this;
    },
    addEventListener(type: string, listener: (e: Event) => void) {
      logEmitter.addEventListener(type, listener);
    },
    removeEventListener(type: string, listener: (e: Event) => void) {
      logEmitter.removeEventListener(type, listener);
    },
  } as unknown as BluetoothRemoteGATTCharacteristic;

  const toRadioCharacteristic: BluetoothRemoteGATTCharacteristic = {
    async writeValue(bufferSource: BufferSource) {
      const u8 =
        bufferSource instanceof ArrayBuffer
          ? new Uint8Array(bufferSource)
          : new Uint8Array(bufferSource.buffer, bufferSource.byteOffset, bufferSource.byteLength);
      lastWritten = new Uint8Array(u8);
    },
  } as unknown as BluetoothRemoteGATTCharacteristic;

  // Primary service returns our three characteristics by UUID
  const primaryService: BluetoothRemoteGATTService = {
    async getCharacteristic(uuid: string) {
      if (uuid === TransportWebBluetooth.ToRadioUuid) {
        return toRadioCharacteristic;
      }
      if (uuid === TransportWebBluetooth.FromRadioUuid) {
        return fromRadioCharacteristic;
      }
      if (uuid === TransportWebBluetooth.FromNumUuid) {
        return fromNumCharacteristic;
      }
      if (uuid === TransportWebBluetooth.LogRadioUuid) {
        return logRadioCharacteristic;
      }
      throw new Error(`Unknown characteristic: ${uuid}`);
    },
  } as unknown as BluetoothRemoteGATTService;

  // Device-level emitter to deliver gattserverdisconnected
  const deviceEmitter = new MiniEmitter();

  // GATT server with readonly connected
  const gattServer: BluetoothRemoteGATTServer = {
    get connected() {
      return isConnected;
    },
    async connect() {
      isConnected = true;
      return gattServer;
    },
    disconnect() {
      isConnected = false;
      deviceEmitter.dispatchEvent(new Event("gattserverdisconnected"));
    },
    async getPrimaryService() {
      return primaryService;
    },
    device: {
      addEventListener: (...args: Parameters<EventTarget["addEventListener"]>) =>
        deviceEmitter.addEventListener(args[0] as string, args[1] as (e: Event) => void),
      removeEventListener: (...args: Parameters<EventTarget["removeEventListener"]>) =>
        deviceEmitter.removeEventListener(args[0] as string, args[1] as (e: Event) => void),
    } as unknown as BluetoothDevice,
  } as unknown as BluetoothRemoteGATTServer;

  const fakeDevice: BluetoothDevice = {
    async watchAdvertisements() {},
    gatt: gattServer,
  } as unknown as BluetoothDevice;

  const fakeNavigator = {
    bluetooth: {
      async requestDevice() {
        return fakeDevice;
      },
    },
  };

  vi.stubGlobal("navigator", Object.assign({}, globalThis.navigator, fakeNavigator));

  // helper actions for tests/contract
  return {
    pushIncoming: (u8: Uint8Array) => {
      incomingQueue.push(u8);
      charEmitter.dispatchEvent(new Event("characteristicvaluechanged"));
    },
    pushLogRecord: (u8: Uint8Array) => {
      logValue = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
      logEmitter.dispatchEvent(new Event("characteristicvaluechanged"));
    },
    assertLastWritten: (u8: Uint8Array) => {
      expect(lastWritten).toBeDefined();
      expect(lastWritten).toEqual(u8);
    },
    // simulate underlying link drop (OS-level disconnect)
    triggerGattDisconnect: () => {
      isConnected = false;
      deviceEmitter.dispatchEvent(new Event("gattserverdisconnected"));
    },
    failNextRead: () => {
      failNextRead = true;
    },
    cleanup: () => {
      vi.unstubAllGlobals();
    },
  };
}

describe("TransportWebBluetooth (contract)", () => {
  runTransportContract({
    name: "TransportWebBluetooth",
    setup: () => {},
    teardown: () => {
      (globalThis as unknown as { __ble?: ReturnType<typeof stubWebBluetooth> }).__ble?.cleanup();
      (globalThis as unknown as { __ble?: ReturnType<typeof stubWebBluetooth> }).__ble = undefined;
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    },
    create: async () => {
      (globalThis as unknown as { __ble: ReturnType<typeof stubWebBluetooth> }).__ble =
        stubWebBluetooth();
      return await TransportWebBluetooth.create();
    },
    pushIncoming: async (bytes) => {
      (globalThis as unknown as { __ble: ReturnType<typeof stubWebBluetooth> }).__ble.pushIncoming(
        bytes,
      );
      await Promise.resolve();
    },
    assertLastWritten: (bytes) => {
      (
        globalThis as unknown as { __ble: ReturnType<typeof stubWebBluetooth> }
      ).__ble.assertLastWritten(bytes);
    },
    triggerDisconnect: async () => {
      (
        globalThis as unknown as { __ble: ReturnType<typeof stubWebBluetooth> }
      ).__ble.triggerGattDisconnect();
      await Promise.resolve();
    },
  });

  it("disconnect() tolerates a GATT drop before stopNotifications()", async () => {
    const ble = stubWebBluetooth();

    try {
      const transport = await TransportWebBluetooth.create();
      const reader = transport.fromDevice.getReader();

      ble.triggerGattDisconnect();

      await expect(transport.disconnect()).resolves.toBeUndefined();

      reader.releaseLock();
    } finally {
      ble.cleanup();
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    }
  });

  it("emits BLE logRadio notifications as logRecord outputs", async () => {
    const ble = stubWebBluetooth();

    try {
      const transport = await TransportWebBluetooth.create();
      const reader = transport.fromDevice.getReader();

      for (let i = 0; i < 10; i++) {
        const { value } = await reader.read();
        if (
          value?.type === "status" &&
          value.data.status === Types.DeviceStatusEnum.DeviceConnected
        ) {
          break;
        }
      }

      const logBytes = new Uint8Array([0x01, 0x02, 0x03]);
      ble.pushLogRecord(logBytes);

      let sawLogRecord = false;
      for (let i = 0; i < 10; i++) {
        const { value } = await reader.read();
        if (value?.type === "logRecord") {
          expect(value.data).toEqual(logBytes);
          sawLogRecord = true;
          break;
        }
      }

      expect(sawLogRecord).toBe(true);

      reader.releaseLock();
    } finally {
      ble.cleanup();
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    }
  });

  it("read errors emit disconnect status without rejecting a fire-and-forget read", async () => {
    const ble = stubWebBluetooth();

    try {
      const transport = await TransportWebBluetooth.create();
      const reader = transport.fromDevice.getReader();
      const writer = transport.toDevice.getWriter();

      ble.failNextRead();
      await expect(writer.write(new Uint8Array([0xaa]))).resolves.toBeUndefined();

      let sawReadError = false;
      for (let i = 0; i < 10; i++) {
        const { value } = await reader.read();
        if (
          value?.type === "status" &&
          value.data.status === Types.DeviceStatusEnum.DeviceDisconnected &&
          value.data.reason === "read-error"
        ) {
          sawReadError = true;
          break;
        }
      }

      expect(sawReadError).toBe(true);

      writer.releaseLock();
      reader.releaseLock();
    } finally {
      ble.cleanup();
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    }
  });
});
