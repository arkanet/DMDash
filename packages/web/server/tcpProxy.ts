import net from "node:net";
import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, type RawData } from "ws";

const DEFAULT_TCP_PORT = 4403;
const MIN_PORT = 10;
const MAX_PORT = 65535;
const CONNECT_TIMEOUT_MS = 8000;

function sendControl(ws: { send: (data: string) => void }, message: Record<string, unknown>) {
  ws.send(JSON.stringify(message));
}

function parsePort(value: string | null): number {
  if (!value) {
    return DEFAULT_TCP_PORT;
  }
  const port = Number.parseInt(value, 10);
  if (!Number.isInteger(port) || port < MIN_PORT || port > MAX_PORT) {
    throw new Error(`Invalid TCP port: ${value}`);
  }
  return port;
}

function parseTcpBridgeUrl(req: IncomingMessage): {
  host: string;
  port: number;
} {
  const url = new URL(req.url ?? "/", "http://localhost");
  const host = url.searchParams.get("host")?.trim();
  if (!host) {
    throw new Error("Missing TCP host");
  }
  return {
    host,
    port: parsePort(url.searchParams.get("port")),
  };
}

function toBuffer(data: RawData): Buffer {
  if (Buffer.isBuffer(data)) {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return Buffer.from(data);
  }
  if (Array.isArray(data)) {
    return Buffer.concat(data);
  }
  return Buffer.from(data);
}

export function attachTcpBridgeProxy(server: Server | null | undefined): void {
  if (!server) {
    return;
  }

  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const pathname = req.url?.split("?")[0];
    if (pathname !== "/api/tcp/ws") {
      return;
    }

    let target: { host: string; port: number };
    try {
      target = parseTcpBridgeUrl(req);
    } catch {
      socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      const tcp = net.createConnection({
        host: target.host,
        port: target.port,
      });
      let tcpReady = false;

      tcp.setTimeout(CONNECT_TIMEOUT_MS);

      tcp.on("connect", () => {
        tcpReady = true;
        tcp.setTimeout(0);
        sendControl(ws, { type: "connected" });
      });

      tcp.on("data", (chunk) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(chunk);
        }
      });

      tcp.on("timeout", () => {
        sendControl(ws, { type: "error", message: "TCP connection timed out" });
        tcp.destroy();
        ws.close(1011, "TCP connection timed out");
      });

      tcp.on("error", (error) => {
        if (ws.readyState === ws.OPEN) {
          sendControl(ws, { type: "error", message: error.message });
          ws.close(1011, error.message.slice(0, 123));
        }
      });

      tcp.on("close", () => {
        if (ws.readyState === ws.OPEN || ws.readyState === ws.CONNECTING) {
          ws.close(tcpReady ? 1000 : 1011, tcpReady ? "TCP closed" : "TCP connect failed");
        }
      });

      ws.on("message", (data, isBinary) => {
        if (!isBinary) {
          return;
        }
        tcp.write(toBuffer(data));
      });

      ws.on("close", () => {
        tcp.destroy();
      });

      ws.on("error", () => {
        tcp.destroy();
      });
    });
  });
}
