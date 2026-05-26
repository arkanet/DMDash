import { Types } from "@meshtastic/core";

function toArrayBuffer(uint8array: Uint8Array): ArrayBuffer {
  if (
    uint8array.buffer instanceof ArrayBuffer &&
    uint8array.byteOffset === 0 &&
    uint8array.byteLength === uint8array.buffer.byteLength
  ) {
    return uint8array.buffer;
  }
  return uint8array.slice().buffer;
}

const READ_RETRY_DELAYS_MS = [250, 750, 1500] as const;
const ANDROID_GATT_CONNECT_SETTLE_MS = 500;
const ANDROID_GATT_OPERATION_SETTLE_MS = 200;
const ANDROID_LOG_NOTIFICATION_DELAY_MS = 10_000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAndroidBluetoothHost(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.userAgent === "string" &&
    /android/i.test(navigator.userAgent)
  );
}

/**
 * Provides Web Bluetooth transport for Meshtastic devices.
 *
 * Implements the {@link Types.Transport} contract using the Web Bluetooth API.
 * Use {@link TransportWebBluetooth.create} or {@link TransportWebBluetooth.createFromDevice}
 * to construct an instance.
 */
export class TransportWebBluetooth implements Types.Transport {
  private _toDevice: WritableStream<Uint8Array>;
  private _fromDevice: ReadableStream<Types.DeviceOutput>;
  private fromDeviceController?: ReadableStreamDefaultController<Types.DeviceOutput>;

  private toRadioCharacteristic: BluetoothRemoteGATTCharacteristic;
  private fromRadioCharacteristic: BluetoothRemoteGATTCharacteristic;
  private fromNumCharacteristic: BluetoothRemoteGATTCharacteristic;
  private logRadioCharacteristic?: BluetoothRemoteGATTCharacteristic;
  private gattServer: BluetoothRemoteGATTServer;

  private lastStatus: Types.DeviceStatusEnum = Types.DeviceStatusEnum.DeviceDisconnected;

  private closingByUser = false;
  private reading = false;
  private readQueued = false;
  private readRetryTimer?: ReturnType<typeof setTimeout>;
  private consecutiveReadErrors = 0;
  private gattOperationQueue: Promise<void> = Promise.resolve();
  private logNotificationTimer?: ReturnType<typeof setTimeout>;
  /** UUID for the "toRadio" write characteristic. */
  static ToRadioUuid = "f75c76d2-129e-4dad-a1dd-7866124401e7";
  /** UUID for the "fromRadio" read characteristic. */
  static FromRadioUuid = "2c55e69e-4993-11ed-b878-0242ac120002";
  /** UUID for the "fromNum" notification characteristic. */
  static FromNumUuid = "ed9da18c-a800-4f66-a670-aa7547e34453";
  /** UUID for the "logRadio" notification characteristic. */
  static LogRadioUuid = "5a3d6e49-06e6-4423-9944-e9de8cdf9547";
  /** Legacy UUID for the "logRadio" notification characteristic. */
  static LegacyLogRadioUuid = "6c6fd238-78fa-436b-aacf-15c5be1ef2e2";
  /** UUID for the Meshtastic GATT service. */
  static ServiceUuid = "6ba1b218-15a8-461f-9fa8-5dcae273eafd";

  private onGattDisconnected = () => {
    if (this.closingByUser) {
      return;
    }
    this.clearReadRetry();
    this.clearLogNotificationTimer();
    this.emitStatus(Types.DeviceStatusEnum.DeviceDisconnected, "gatt-disconnected");
  };
  private onFromNumChanged = () => {
    this.readFromRadio();
  };
  private onLogRadioChanged = (event: Event) => {
    const characteristic = event.target as BluetoothRemoteGATTCharacteristic | null;
    const value = characteristic?.value ?? this.logRadioCharacteristic?.value;

    if (!value || value.byteLength === 0) {
      return;
    }

    const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    this.enqueue({ type: "logRecord", data: new Uint8Array(bytes) });
  };

  /**
   * Prompts the user to select a Bluetooth device, connects it, and returns a transport.
   */
  public static async create(): Promise<TransportWebBluetooth> {
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [TransportWebBluetooth.ServiceUuid] }],
    });
    return await TransportWebBluetooth.prepareConnection(device);
  }

  /**
   * Creates a transport from an existing, user-provided {@link BluetoothDevice}.
   */
  public static async createFromDevice(device: BluetoothDevice): Promise<TransportWebBluetooth> {
    return await TransportWebBluetooth.prepareConnection(device);
  }

  /**
   * Prepares and connects to a {@link BluetoothDevice}, resolving its GATT server
   * and characteristics, then returning a transport.
   *
   * @throws if required services or characteristics are missing.
   */
  public static async prepareConnection(device: BluetoothDevice): Promise<TransportWebBluetooth> {
    const gattServer = await device.gatt?.connect();
    if (!gattServer) {
      throw new Error("Failed to connect to GATT server");
    }
    if (isAndroidBluetoothHost()) {
      await delay(ANDROID_GATT_CONNECT_SETTLE_MS);
    }

    const service = await gattServer.getPrimaryService(TransportWebBluetooth.ServiceUuid);
    const toRadioCharacteristic = await service.getCharacteristic(
      TransportWebBluetooth.ToRadioUuid,
    );
    const fromRadioCharacteristic = await service.getCharacteristic(
      TransportWebBluetooth.FromRadioUuid,
    );
    const fromNumCharacteristic = await service.getCharacteristic(
      TransportWebBluetooth.FromNumUuid,
    );

    if (!toRadioCharacteristic || !fromRadioCharacteristic || !fromNumCharacteristic) {
      throw new Error("Failed to find required characteristics");
    }

    return new TransportWebBluetooth(
      toRadioCharacteristic,
      fromRadioCharacteristic,
      fromNumCharacteristic,
      service,
      gattServer,
    );
  }

  private static async getOptionalCharacteristic(
    service: BluetoothRemoteGATTService,
    uuid: string,
  ): Promise<BluetoothRemoteGATTCharacteristic | undefined> {
    try {
      return await service.getCharacteristic(uuid);
    } catch {
      return undefined;
    }
  }

  /**
   * Create a transport from resolved GATT characteristics and server.
   * Prefer using the static factory methods instead.
   */
  constructor(
    toRadioCharacteristic: BluetoothRemoteGATTCharacteristic,
    fromRadioCharacteristic: BluetoothRemoteGATTCharacteristic,
    fromNumCharacteristic: BluetoothRemoteGATTCharacteristic,
    private meshtasticService: BluetoothRemoteGATTService,
    gattServer: BluetoothRemoteGATTServer,
  ) {
    this.toRadioCharacteristic = toRadioCharacteristic;
    this.fromRadioCharacteristic = fromRadioCharacteristic;
    this.fromNumCharacteristic = fromNumCharacteristic;
    this.gattServer = gattServer;

    this._fromDevice = new ReadableStream<Types.DeviceOutput>({
      start: async (ctrl) => {
        this.fromDeviceController = ctrl;
        this.emitStatus(Types.DeviceStatusEnum.DeviceConnecting);

        this.gattServer.device.addEventListener("gattserverdisconnected", this.onGattDisconnected);

        try {
          this.fromNumCharacteristic.addEventListener(
            "characteristicvaluechanged",
            this.onFromNumChanged,
          );
          await this.runGattOperation(() => this.fromNumCharacteristic.startNotifications());
          if (!isAndroidBluetoothHost()) {
            await this.startLogNotifications();
          }
          this.emitStatus(Types.DeviceStatusEnum.DeviceConnected);
          // prime once in case data already queued
          this.readFromRadio();
          if (isAndroidBluetoothHost()) {
            this.scheduleLogNotifications();
          }
        } catch {
          this.emitStatus(Types.DeviceStatusEnum.DeviceDisconnected, "notify-failed");
          this.gattServer.device.removeEventListener(
            "gattserverdisconnected",
            this.onGattDisconnected,
          );
          this.fromNumCharacteristic.removeEventListener(
            "characteristicvaluechanged",
            this.onFromNumChanged,
          );
        }
      },
    });

    this._toDevice = new WritableStream<Uint8Array>({
      write: async (chunk) => {
        try {
          const ab = toArrayBuffer(chunk);
          await this.runGattOperation(() => this.toRadioCharacteristic.writeValue(ab));
          this.readFromRadio(); // ensure we read any response
        } catch (error) {
          this.emitStatus(Types.DeviceStatusEnum.DeviceDisconnected, "write-error");
          throw error;
        }
      },
    });
  }

  /** Writable stream of bytes to the device. */
  get toDevice(): WritableStream<Uint8Array> {
    return this._toDevice;
  }

  /** Readable stream of {@link Types.DeviceOutput} from the device. */
  get fromDevice(): ReadableStream<Types.DeviceOutput> {
    return this._fromDevice;
  }

  /**
   * Closes the GATT connection and emits `DeviceDisconnected("user")`.
   */
  async disconnect(): Promise<void> {
    try {
      this.closingByUser = true;
      this.clearReadRetry();
      this.clearLogNotificationTimer();
      this.emitStatus(Types.DeviceStatusEnum.DeviceDisconnected, "user");
      try {
        if (this.gattServer.connected) {
          await this.runGattOperation(async () => {
            await this.fromNumCharacteristic.stopNotifications?.();
          });
        }
      } catch {}
      this.fromNumCharacteristic.removeEventListener(
        "characteristicvaluechanged",
        this.onFromNumChanged,
      );
      try {
        if (this.gattServer.connected) {
          await this.runGattOperation(async () => {
            await this.logRadioCharacteristic?.stopNotifications?.();
          });
        }
      } catch {}
      this.logRadioCharacteristic?.removeEventListener(
        "characteristicvaluechanged",
        this.onLogRadioChanged,
      );
      this.gattServer.device.removeEventListener("gattserverdisconnected", this.onGattDisconnected);

      if (this.gattServer.connected) {
        this.gattServer.disconnect();
      }
    } finally {
      this.closingByUser = false;
    }
  }

  private async startLogNotifications(): Promise<void> {
    if (!this.gattServer.connected || this.closingByUser) {
      return;
    }

    this.logRadioCharacteristic =
      (await this.runGattOperation(() =>
        TransportWebBluetooth.getOptionalCharacteristic(
          this.meshtasticService,
          TransportWebBluetooth.LogRadioUuid,
        ),
      )) ??
      (await this.runGattOperation(() =>
        TransportWebBluetooth.getOptionalCharacteristic(
          this.meshtasticService,
          TransportWebBluetooth.LegacyLogRadioUuid,
        ),
      ));

    if (!this.logRadioCharacteristic) {
      return;
    }

    try {
      this.logRadioCharacteristic.addEventListener(
        "characteristicvaluechanged",
        this.onLogRadioChanged,
      );
      await this.runGattOperation(() => this.logRadioCharacteristic!.startNotifications());
    } catch {
      this.logRadioCharacteristic.removeEventListener(
        "characteristicvaluechanged",
        this.onLogRadioChanged,
      );
      this.logRadioCharacteristic = undefined;
    }
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
        while (hasMoreData && this.gattServer.connected && this.fromRadioCharacteristic) {
          const value = await this.runGattOperation(() => this.fromRadioCharacteristic.readValue());
          this.consecutiveReadErrors = 0;
          if (value.byteLength === 0) {
            hasMoreData = false;
            continue;
          }
          this.enqueue({
            type: "packet",
            data: new Uint8Array(value.buffer, value.byteOffset, value.byteLength),
          });
        }
      } catch {
        if (!this.closingByUser) {
          if (!this.gattServer.connected) {
            this.clearReadRetry();
            this.emitStatus(Types.DeviceStatusEnum.DeviceDisconnected, "read-error");
            return;
          }

          const retryDelay = READ_RETRY_DELAYS_MS[this.consecutiveReadErrors];
          this.consecutiveReadErrors += 1;

          if (retryDelay !== undefined) {
            this.readRetryTimer = setTimeout(() => {
              this.readRetryTimer = undefined;
              if (!this.closingByUser && this.gattServer.connected) {
                this.readFromRadio();
              }
            }, retryDelay);
            return;
          }

          this.clearReadRetry();
          this.emitStatus(Types.DeviceStatusEnum.DeviceDisconnected, "read-error");
        }
      } finally {
        this.reading = false;
        if (this.readQueued && this.gattServer.connected && !this.readRetryTimer) {
          this.readFromRadio();
        }
      }
    })();
  }

  private scheduleLogNotifications(): void {
    if (this.logNotificationTimer || this.closingByUser || !this.gattServer.connected) {
      return;
    }

    this.logNotificationTimer = setTimeout(() => {
      this.logNotificationTimer = undefined;
      if (!this.closingByUser && this.gattServer.connected) {
        void this.startLogNotifications();
      }
    }, ANDROID_LOG_NOTIFICATION_DELAY_MS);
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

  private clearLogNotificationTimer(): void {
    if (this.logNotificationTimer) {
      clearTimeout(this.logNotificationTimer);
      this.logNotificationTimer = undefined;
    }
  }

  private async runGattOperation<T>(operation: () => Promise<T | undefined>): Promise<T> {
    const run = this.gattOperationQueue.then(async () => {
      try {
        return await operation();
      } finally {
        if (isAndroidBluetoothHost()) {
          await delay(ANDROID_GATT_OPERATION_SETTLE_MS);
        }
      }
    });
    this.gattOperationQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return (await run) as T;
  }
}
