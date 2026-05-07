import { Types, Utils } from "@meshtastic/core";

const DEFAULT_TCP_PORT = 4403;
const CONNECT_TIMEOUT_MS = 10000;

function buildBridgeUrl(host: string, port: number): string {
  const protocol = globalThis.location.protocol === "https:" ? "wss:" : "ws:";
  const params = new URLSearchParams({
    host,
    port: String(port),
  });
  return `${protocol}//${globalThis.location.host}/api/tcp/ws?${params.toString()}`;
}

function blobToUint8Array(blob: Blob): Promise<Uint8Array> {
  return blob.arrayBuffer().then((buffer) => new Uint8Array(buffer));
}

function messageToBytes(data: MessageEvent["data"]): Promise<Uint8Array | undefined> {
  if (data instanceof ArrayBuffer) {
    return Promise.resolve(new Uint8Array(data));
  }
  if (data instanceof Blob) {
    return blobToUint8Array(data);
  }
  return Promise.resolve(undefined);
}

function parseControlMessage(
  data: MessageEvent["data"],
): { type?: string; message?: string } | undefined {
  if (typeof data !== "string") {
    return undefined;
  }
  try {
    return JSON.parse(data) as { type?: string; message?: string };
  } catch {
    return undefined;
  }
}

export class TransportTCPBridge implements Types.Transport {
  private readonly socket: WebSocket;
  private readonly _toDevice: WritableStream<Uint8Array>;
  private readonly _fromDevice: ReadableStream<Types.DeviceOutput>;
  private readonly unframedWriter: WritableStreamDefaultWriter<Uint8Array>;
  private fromDeviceController?: ReadableStreamDefaultController<Types.DeviceOutput>;
  private lastStatus = Types.DeviceStatusEnum.DeviceDisconnected;
  private closingByUser = false;

  public static create(host: string, port = DEFAULT_TCP_PORT): Promise<TransportTCPBridge> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(buildBridgeUrl(host, port));
      socket.binaryType = "arraybuffer";

      const timer = setTimeout(() => {
        socket.close(1011, "TCP bridge connection timed out");
        reject(new Error("TCP bridge connection timed out"));
      }, CONNECT_TIMEOUT_MS);

      const cleanup = () => {
        clearTimeout(timer);
        socket.removeEventListener("message", onMessage);
        socket.removeEventListener("error", onError);
        socket.removeEventListener("close", onClose);
      };

      const onMessage = (event: MessageEvent) => {
        const control = parseControlMessage(event.data);
        if (control?.type === "connected") {
          cleanup();
          resolve(new TransportTCPBridge(socket));
          return;
        }
        if (control?.type === "error") {
          cleanup();
          socket.close();
          reject(new Error(control.message ?? "TCP bridge connection failed"));
        }
      };

      const onError = () => {
        cleanup();
        reject(new Error("TCP bridge WebSocket failed"));
      };

      const onClose = (event: CloseEvent) => {
        cleanup();
        reject(new Error(event.reason || "TCP bridge closed before connecting"));
      };

      socket.addEventListener("message", onMessage);
      socket.addEventListener("error", onError);
      socket.addEventListener("close", onClose);
    });
  }

  private constructor(socket: WebSocket) {
    this.socket = socket;

    const framedStream = Utils.toDeviceStream();
    this.unframedWriter = framedStream.writable.getWriter();
    void framedStream.readable.pipeTo(
      new WritableStream<Uint8Array>({
        write: (chunk) => {
          if (this.socket.readyState !== WebSocket.OPEN) {
            throw new Error("TCP bridge is not open");
          }
          this.socket.send(chunk);
        },
      }),
    );

    this._toDevice = new WritableStream<Uint8Array>({
      write: async (chunk) => {
        await this.unframedWriter.write(chunk);
      },
      close: async () => {
        await this.disconnect();
      },
      abort: async () => {
        await this.disconnect();
      },
    });

    this._fromDevice = new ReadableStream<Types.DeviceOutput>({
      start: (controller) => {
        this.fromDeviceController = controller;
        this.emitStatus(Types.DeviceStatusEnum.DeviceConnected);

        const byteStream = new ReadableStream<Uint8Array>({
          start: (byteController) => {
            this.socket.addEventListener("message", (event) => {
              const control = parseControlMessage(event.data);
              if (control?.type === "error") {
                this.emitStatus(Types.DeviceStatusEnum.DeviceDisconnected, control.message);
                return;
              }
              void messageToBytes(event.data).then((bytes) => {
                if (bytes) {
                  byteController.enqueue(bytes);
                }
              });
            });
          },
        });

        void byteStream.pipeThrough(Utils.fromDeviceStream()).pipeTo(
          new WritableStream<Types.DeviceOutput>({
            write: (output) => {
              controller.enqueue(output);
            },
          }),
        );
      },
      cancel: async () => {
        await this.disconnect();
      },
    });

    this.socket.addEventListener("close", (event) => {
      if (!this.closingByUser) {
        this.emitStatus(
          Types.DeviceStatusEnum.DeviceDisconnected,
          event.reason || "tcp-bridge-closed",
        );
      }
    });
    this.socket.addEventListener("error", () => {
      if (!this.closingByUser) {
        this.emitStatus(Types.DeviceStatusEnum.DeviceDisconnected, "tcp-bridge-error");
      }
    });
  }

  get toDevice(): WritableStream<Uint8Array> {
    return this._toDevice;
  }

  get fromDevice(): ReadableStream<Types.DeviceOutput> {
    return this._fromDevice;
  }

  public disconnect(): Promise<void> {
    this.closingByUser = true;
    if (
      this.socket.readyState === WebSocket.OPEN ||
      this.socket.readyState === WebSocket.CONNECTING
    ) {
      this.socket.close(1000, "user");
    }
    this.emitStatus(Types.DeviceStatusEnum.DeviceDisconnected, "user");
    return Promise.resolve();
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
}
