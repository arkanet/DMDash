import type {
  Connection,
  ConnectionStatus,
  ConnectionType,
  NewConnection,
} from "@app/core/stores/deviceStore/types";
import { randId } from "@app/core/utils/randId";
import { Bluetooth, Cable, Globe, Network, type LucideIcon } from "lucide-react";

export const DEFAULT_TCP_PORT = 4403;

export type NetworkConnectionMode = "http" | "tcp";

export type DiscoveredNetworkDevice = {
  id: string;
  name: string;
  host: string;
  addresses: string[];
  services: Array<{ protocol: NetworkConnectionMode; port: number }>;
};

function isPrivateIpv4(host: string): boolean {
  const parts = host.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return false;
  }
  const [a, b] = parts;
  return (
    a === 10 ||
    (a === 172 && b !== undefined && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a === 169 ||
    a === 127
  );
}

export function needsLocalNetworkBridge(host: string): boolean {
  const pageHost = globalThis.location.hostname;
  const localPage =
    pageHost === "localhost" || pageHost.endsWith(".local") || isPrivateIpv4(pageHost);
  return isPrivateIpv4(host.trim()) && !localPage;
}

export function createConnectionFromInput(input: NewConnection): Connection {
  const base = {
    id: randId(),
    name: input.name,
    createdAt: Date.now(),
    status: "disconnected" as ConnectionStatus,
  };
  if (input.type === "http") {
    return {
      ...base,
      type: "http",
      url: input.url,
      isDefault: false,
      name: input.name.length === 0 ? input.url : input.name,
    };
  }
  if (input.type === "tcp") {
    return {
      ...base,
      type: "tcp",
      host: input.host,
      port: input.port,
      isDefault: false,
      name: input.name.length === 0 ? `${input.host}:${input.port}` : input.name,
    };
  }
  if (input.type === "bluetooth") {
    return {
      ...base,
      type: "bluetooth",
      deviceId: input.deviceId,
      deviceName: input.deviceName,
      gattServiceUUID: input.gattServiceUUID,
    };
  }
  if (input.type === "ios-bluetooth") {
    return {
      ...base,
      type: "ios-bluetooth",
      deviceId: input.deviceId,
      deviceName: input.deviceName,
      name: input.name.length === 0 ? (input.deviceName ?? "iOS Bluetooth node") : input.name,
    };
  }
  return {
    ...base,
    type: "serial",
    usbVendorId: input.usbVendorId,
    usbProductId: input.usbProductId,
  };
}

export async function testTcpReachable(
  host: string,
  port = DEFAULT_TCP_PORT,
  timeoutMs = 5000,
): Promise<boolean> {
  try {
    if (needsLocalNetworkBridge(host)) {
      return false;
    }
    const protocol = globalThis.location.protocol === "https:" ? "wss:" : "ws:";
    const params = new URLSearchParams({ host, port: String(port) });
    const ws = new WebSocket(`${protocol}//${globalThis.location.host}/api/tcp/ws?${params}`);
    const timer = setTimeout(() => ws.close(1011, "timeout"), timeoutMs);
    return await new Promise<boolean>((resolve) => {
      ws.addEventListener("message", (event) => {
        if (typeof event.data !== "string") {
          return;
        }
        try {
          const message = JSON.parse(event.data) as { type?: string };
          if (message.type === "connected") {
            clearTimeout(timer);
            ws.close(1000, "probe complete");
            resolve(true);
          }
          if (message.type === "error") {
            clearTimeout(timer);
            ws.close();
            resolve(false);
          }
        } catch {
          // Ignore non-control messages.
        }
      });
      ws.addEventListener("error", () => {
        clearTimeout(timer);
        resolve(false);
      });
      ws.addEventListener("close", () => {
        clearTimeout(timer);
        resolve(false);
      });
    });
  } catch {
    return false;
  }
}

export async function testHttpReachable(url: string, timeoutMs = 2500): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    // Use no-cors to avoid CORS failure; opaque responses resolve but status is 0
    await fetch(url, {
      method: "GET",
      mode: "no-cors",
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timer);
    return true;
  } catch {
    return false;
  }
}

export async function discoverNetworkDevices(): Promise<DiscoveredNetworkDevice[]> {
  try {
    const response = await fetch("/api/network/discover", {
      method: "GET",
      cache: "no-store",
    });
    if (!response.ok) {
      return [];
    }
    const payload = (await response.json()) as {
      devices?: DiscoveredNetworkDevice[];
    };
    return payload.devices ?? [];
  } catch {
    return [];
  }
}

export function connectionTypeIcon(type: ConnectionType): LucideIcon {
  if (type === "http") {
    return Globe;
  }
  if (type === "tcp") {
    return Network;
  }
  if (type === "bluetooth") {
    return Bluetooth;
  }
  if (type === "ios-bluetooth") {
    return Bluetooth;
  }
  return Cable;
}

export function formatConnectionSubtext(conn: Connection): string {
  if (conn.type === "http") {
    return conn.url;
  }
  if (conn.type === "tcp") {
    return `${conn.host}:${conn.port}`;
  }
  if (conn.type === "bluetooth") {
    return conn.deviceName || conn.deviceId || "No device selected";
  }
  if (conn.type === "ios-bluetooth") {
    return conn.deviceName || conn.deviceId || "No iOS Bluetooth device selected";
  }
  const v = conn.usbVendorId ? conn.usbVendorId.toString(16) : "?";
  const p = conn.usbProductId ? conn.usbProductId.toString(16) : "?";
  return `USB ${v}:${p}`;
}
