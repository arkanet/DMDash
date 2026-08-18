import { BleClient, ScanMode, type ScanResult } from "@capacitor-community/bluetooth-le";
import { isNativeAppShell } from "@core/utils/nativeShell.ts";
import { Types } from "@meshtastic/core";
import { TransportWebBluetooth } from "@meshtastic/transport-web-bluetooth";

export type NativeBleDeviceSelection = {
  id: string;
  name?: string;
  rssi?: number;
};

export type NativeBleScanStop = () => Promise<void>;

const READ_RETRY_DELAYS_MS = [250, 750, 1500] as const;
const BLE_CONNECT_TIMEOUT_MS = 15_000;
const BLE_OPERATION_TIMEOUT_MS = 7_500;
const BLE_SCAN_OPTIONS = {
  services: [TransportWebBluetooth.ServiceUuid],
  optionalServices: [TransportWebBluetooth.ServiceUuid],
  allowDuplicates: false,
  displayMode: "list" as const,
};

let initializePromise: Promise<void> | undefined;

function normalizeUuid(value: string): string {
  return value.toLowerCase();
}

function dataViewToBytes(value: DataView): Uint8Array {
  const bytes = new Uint8Array(value.byteLength);
  bytes.set(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
  return bytes;
}

function bytesToDataView(value: Uint8Array): DataView {
  const bytes = new Uint8Array(value.byteLength);
  bytes.set(value);
  return new DataView(bytes.buffer);
}

function mapScanResult(result: ScanResult): NativeBleDeviceSelection {
  return {
    id: result.device.deviceId,
    name: result.localName ?? result.device.name,
    rssi: result.rssi,
  };
}

export function isNativeBleAvailable(): boolean {
  return isNativeAppShell();
}

export async function ensureNativeBleInitialized(): Promise<void> {
  if (!isNativeBleAvailable()) {
    throw new Error("Native Bluetooth is only available inside the DarkMesh iOS mobile app.");
  }

  initializePromise ??= (async () => {
    await BleClient.initialize();
    const enabled = await BleClient.isEnabled();
    if (!enabled) {
      throw new Error("Bluetooth is disabled on this device.");
    }
  })();

  try {
    await initializePromise;
  } catch (error) {
    initializePromise = undefined;
    throw error;
  }
}

export async function requestNativeBleDevice(): Promise<NativeBleDeviceSelection> {
  await ensureNativeBleInitialized();
  const device = await BleClient.requestDevice(BLE_SCAN_OPTIONS);
  return {
    id: device.deviceId,
    name: device.name,
  };
}

export async function scanNativeBleDevices(
  onDevice: (device: NativeBleDeviceSelection) => void,
): Promise<NativeBleScanStop> {
  await ensureNativeBleInitialized();
  await BleClient.requestLEScan(
    {
      ...BLE_SCAN_OPTIONS,
      scanMode: ScanMode.SCAN_MODE_LOW_LATENCY,
    },
    (result) => onDevice(mapScanResult(result)),
  );

  return async () => {
    await BleClient.stopLEScan();
  };
}

export async function hasNativeBleDevicePermission(deviceId?: string): Promise<boolean> {
  if (!deviceId || !isNativeBleAvailable()) {
    return false;
  }

  try {
    await ensureNativeBleInitialized();
    const knownDevices = await BleClient.getDevices([deviceId]);
    if (knownDevices.some((device) => device.deviceId === deviceId)) {
      return true;
    }

    const connectedDevices = await BleClient.getConnectedDevices([
      TransportWebBluetooth.ServiceUuid,
    ]);
    return connectedDevices.some((device) => device.deviceId === deviceId);
  } catch {
    return false;
  }
}

export class TransportNativeBle implements Types.Transport {
  static ToRadioUuid = TransportWebBluetooth.ToRadioUuid;
  static FromRadioUuid = TransportWebBluetooth.FromRadioUuid;
  static FromNumUuid = TransportWebBluetooth.FromNumUuid;
  static LogRadioUuid = TransportWebBluetooth.LogRadioUuid;
  static LegacyLogRadioUuid = TransportWebBluetooth.LegacyLogRadioUuid;
  static ServiceUuid = TransportWebBluetooth.ServiceUuid;

  private _toDevice: WritableStream<Uint8Array>;
  private _fromDevice: ReadableStream<Types.DeviceOutput>;
  private fromDeviceController?: ReadableStreamDefaultController<Types.DeviceOutput>;
  private lastStatus: Types.DeviceStatusEnum = Types.DeviceStatusEnum.DeviceDisconnected;
  private closingByUser = false;
  private connected = false;
  private reading = false;
  private readQueued = false;
  private readRetryTimer?: ReturnType<typeof setTimeout>;
  private consecutiveReadErrors = 0;
  private bleOperationQueue: Promise<void> = Promise.resolve();
  private logCharacteristicUuid?: string;

  private constructor(private readonly deviceId: string) {
    this._fromDevice = new ReadableStream<Types.DeviceOutput>({
      start: async (ctrl) => {
        this.fromDeviceController = ctrl;
        this.emitStatus(Types.DeviceStatusEnum.DeviceConnecting);

        try {
          await this.runBleOperation(() =>
            BleClient.startNotifications(
              this.deviceId,
              TransportNativeBle.ServiceUuid,
              TransportNativeBle.FromNumUuid,
              this.onFromNumChanged,
              { timeout: BLE_OPERATION_TIMEOUT_MS },
            ),
          );
          await this.startLogNotifications();
          this.emitStatus(Types.DeviceStatusEnum.DeviceConnected);
          this.readFromRadio();
        } catch {
          this.connected = false;
          this.emitStatus(Types.DeviceStatusEnum.DeviceDisconnected, "notify-failed");
        }
      },
    });

    this._toDevice = new WritableStream<Uint8Array>({
      write: async (chunk) => {
        try {
          await this.runBleOperation(() =>
            BleClient.write(
              this.deviceId,
              TransportNativeBle.ServiceUuid,
              TransportNativeBle.ToRadioUuid,
              bytesToDataView(chunk),
              { timeout: BLE_OPERATION_TIMEOUT_MS },
            ),
          );
          this.readFromRadio();
        } catch (error) {
          this.connected = false;
          this.emitStatus(Types.DeviceStatusEnum.DeviceDisconnected, "write-error");
          throw error;
        }
      },
    });
  }

  static async createFromDeviceId(deviceId: string): Promise<TransportNativeBle> {
    await ensureNativeBleInitialized();

    const transport = new TransportNativeBle(deviceId);
    try {
      await BleClient.connect(deviceId, transport.onBleDisconnected, {
        timeout: BLE_CONNECT_TIMEOUT_MS,
        skipDescriptorDiscovery: true,
      });
      transport.connected = true;
      await transport.ensureMeshtasticService();
      return transport;
    } catch (error) {
      await transport.disconnect();
      throw error;
    }
  }

  get toDevice(): WritableStream<Uint8Array> {
    return this._toDevice;
  }

  get fromDevice(): ReadableStream<Types.DeviceOutput> {
    return this._fromDevice;
  }

  async disconnect(): Promise<void> {
    try {
      this.closingByUser = true;
      this.clearReadRetry();
      this.emitStatus(Types.DeviceStatusEnum.DeviceDisconnected, "user");
      await this.stopNotifications();
      await BleClient.disconnect(this.deviceId);
    } catch {
      // Cleanup should stay best-effort; MeshDevice already treats disconnect as terminal.
    } finally {
      this.connected = false;
      this.closingByUser = false;
    }
  }

  private onBleDisconnected = () => {
    this.connected = false;
    if (this.closingByUser) {
      return;
    }
    this.clearReadRetry();
    this.emitStatus(Types.DeviceStatusEnum.DeviceDisconnected, "ble-disconnected");
  };

  private onFromNumChanged = () => {
    this.readFromRadio();
  };

  private onLogRadioChanged = (value: DataView) => {
    if (value.byteLength === 0) {
      return;
    }

    this.enqueue({ type: "logRecord", data: dataViewToBytes(value) });
  };

  private async ensureMeshtasticService(): Promise<void> {
    const services = await BleClient.getServices(this.deviceId);
    const service = services.find(
      (entry) => normalizeUuid(entry.uuid) === normalizeUuid(TransportNativeBle.ServiceUuid),
    );

    if (!service) {
      throw new Error("The selected device does not expose the Meshtastic BLE service.");
    }

    const characteristics = new Set(
      service.characteristics.map((characteristic) => normalizeUuid(characteristic.uuid)),
    );
    const required = [
      TransportNativeBle.ToRadioUuid,
      TransportNativeBle.FromRadioUuid,
      TransportNativeBle.FromNumUuid,
    ];
    const missing = required.find((uuid) => !characteristics.has(normalizeUuid(uuid)));
    if (missing) {
      throw new Error(`The Meshtastic BLE service is missing characteristic ${missing}.`);
    }
  }

  private async startLogNotifications(): Promise<void> {
    const logUuid = await this.getAvailableLogCharacteristicUuid();
    if (!logUuid) {
      return;
    }

    try {
      await this.runBleOperation(() =>
        BleClient.startNotifications(
          this.deviceId,
          TransportNativeBle.ServiceUuid,
          logUuid,
          this.onLogRadioChanged,
          { timeout: BLE_OPERATION_TIMEOUT_MS },
        ),
      );
      this.logCharacteristicUuid = logUuid;
    } catch {
      this.logCharacteristicUuid = undefined;
    }
  }

  private async getAvailableLogCharacteristicUuid(): Promise<string | undefined> {
    try {
      const services = await BleClient.getServices(this.deviceId);
      const service = services.find(
        (entry) => normalizeUuid(entry.uuid) === normalizeUuid(TransportNativeBle.ServiceUuid),
      );
      const characteristics = new Set(
        service?.characteristics.map((characteristic) => normalizeUuid(characteristic.uuid)) ?? [],
      );

      if (characteristics.has(normalizeUuid(TransportNativeBle.LogRadioUuid))) {
        return TransportNativeBle.LogRadioUuid;
      }
      if (characteristics.has(normalizeUuid(TransportNativeBle.LegacyLogRadioUuid))) {
        return TransportNativeBle.LegacyLogRadioUuid;
      }
    } catch {}

    return undefined;
  }

  private async stopNotifications(): Promise<void> {
    try {
      await this.runBleOperation(() =>
        BleClient.stopNotifications(
          this.deviceId,
          TransportNativeBle.ServiceUuid,
          TransportNativeBle.FromNumUuid,
        ),
      );
    } catch {}

    if (!this.logCharacteristicUuid) {
      return;
    }

    try {
      await this.runBleOperation(() =>
        BleClient.stopNotifications(
          this.deviceId,
          TransportNativeBle.ServiceUuid,
          this.logCharacteristicUuid!,
        ),
      );
    } catch {}
    this.logCharacteristicUuid = undefined;
  }

  private readFromRadio(): void {
    if (this.readRetryTimer) {
      this.readQueued = true;
      return;
    }

    if (this.reading) {
      this.readQueued = true;
      return;
    }
    this.reading = true;
    this.readQueued = false;

    void (async () => {
      try {
        let hasMoreData = true;
        while (hasMoreData && this.connected) {
          const value = await this.runBleOperation(() =>
            BleClient.read(
              this.deviceId,
              TransportNativeBle.ServiceUuid,
              TransportNativeBle.FromRadioUuid,
              { timeout: BLE_OPERATION_TIMEOUT_MS },
            ),
          );
          this.consecutiveReadErrors = 0;
          if (value.byteLength === 0) {
            hasMoreData = false;
            continue;
          }
          this.enqueue({ type: "packet", data: dataViewToBytes(value) });
        }
      } catch {
        if (!this.closingByUser) {
          const retryDelay = READ_RETRY_DELAYS_MS[this.consecutiveReadErrors];
          this.consecutiveReadErrors += 1;

          if (retryDelay !== undefined && this.connected) {
            this.readRetryTimer = setTimeout(() => {
              this.readRetryTimer = undefined;
              if (!this.closingByUser && this.connected) {
                this.readFromRadio();
              }
            }, retryDelay);
            return;
          }

          this.connected = false;
          this.clearReadRetry();
          this.emitStatus(Types.DeviceStatusEnum.DeviceDisconnected, "read-error");
        }
      } finally {
        this.reading = false;
        if (this.readQueued && this.connected && !this.readRetryTimer) {
          this.readFromRadio();
        }
      }
    })();
  }

  private emitStatus(next: Types.DeviceStatusEnum, reason?: string): void {
    if (next === this.lastStatus) {
      return;
    }
    this.lastStatus = next;
    this.fromDeviceController?.enqueue({
      type: "status",
      data: { status: next, reason },
    });
  }

  private enqueue(output: Types.DeviceOutput): void {
    this.fromDeviceController?.enqueue(output);
  }

  private clearReadRetry(): void {
    if (this.readRetryTimer) {
      clearTimeout(this.readRetryTimer);
      this.readRetryTimer = undefined;
    }
    this.readQueued = false;
    this.consecutiveReadErrors = 0;
  }

  private async runBleOperation<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.bleOperationQueue.then(operation);
    this.bleOperationQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return await run;
  }
}
