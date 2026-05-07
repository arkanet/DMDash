import type { IncomingMessage, ServerResponse } from "node:http";
import { createRequire } from "node:module";
import type { Answer } from "dns-packet";

const requireMdns = createRequire(import.meta.url);
const mdns = requireMdns("multicast-dns") as typeof import("multicast-dns");

type NetworkProtocol = "http" | "tcp";

export type NetworkDiscoveryService = {
  protocol: NetworkProtocol;
  port: number;
};

export type NetworkDiscoveryDevice = {
  id: string;
  name: string;
  host: string;
  addresses: string[];
  services: NetworkDiscoveryService[];
};

const DISCOVERY_TIMEOUT_MS = 2500;
const SERVICE_TYPES = ["_http._tcp.local", "_meshtastic._tcp.local"] as const;

type ServiceRecord = {
  name: string;
  host: string;
  addresses: Set<string>;
  services: Map<NetworkProtocol, number>;
};

function answerData(answer: Answer): unknown {
  return (answer as { data?: unknown }).data;
}

function serviceProtocol(serviceType: string): NetworkProtocol | undefined {
  if (serviceType === "_http._tcp.local") {
    return "http";
  }
  if (serviceType === "_meshtastic._tcp.local") {
    return "tcp";
  }
  return undefined;
}

function normalizeName(name: string): string {
  return name.replace(/\._(?:http|meshtastic)\._tcp\.local$/i, "").replace(/\\032/g, " ");
}

function isLikelyMeshtasticDevice(device: NetworkDiscoveryDevice): boolean {
  const haystack = `${device.id} ${device.name} ${device.host}`.toLowerCase();
  return haystack.includes("meshtastic");
}

function dataString(answer: Answer): string | undefined {
  const data = answerData(answer);
  return typeof data === "string" ? data : undefined;
}

function dataHostPort(answer: Answer): { target?: string; port?: number } | undefined {
  const data = answerData(answer);
  if (!data || typeof data !== "object") {
    return undefined;
  }
  const record = data as { target?: unknown; port?: unknown };
  return {
    target: typeof record.target === "string" ? record.target : undefined,
    port: typeof record.port === "number" ? record.port : undefined,
  };
}

function addAddress(record: ServiceRecord, address: string | undefined) {
  if (address) {
    record.addresses.add(address);
  }
}

function getOrCreateRecord(records: Map<string, ServiceRecord>, name: string): ServiceRecord {
  const id = name.toLowerCase();
  const existing = records.get(id);
  if (existing) {
    return existing;
  }
  const created: ServiceRecord = {
    name: normalizeName(name),
    host: "",
    addresses: new Set(),
    services: new Map(),
  };
  records.set(id, created);
  return created;
}

function collectAnswers(records: Map<string, ServiceRecord>, answers: Answer[]) {
  const hostAddresses = new Map<string, Set<string>>();

  for (const answer of answers) {
    if (answer.type === "A" || answer.type === "AAAA") {
      const address = dataString(answer);
      if (!address) {
        continue;
      }
      const host = answer.name.toLowerCase();
      const addresses = hostAddresses.get(host) ?? new Set<string>();
      addresses.add(address);
      hostAddresses.set(host, addresses);
    }
  }

  for (const answer of answers) {
    if (answer.type !== "PTR") {
      continue;
    }
    const protocol = serviceProtocol(answer.name);
    const serviceName = dataString(answer);
    if (!protocol || !serviceName) {
      continue;
    }
    getOrCreateRecord(records, serviceName);
  }

  for (const answer of answers) {
    if (answer.type !== "SRV") {
      continue;
    }
    const srv = dataHostPort(answer);
    if (!srv?.target || !srv.port) {
      continue;
    }
    const record = getOrCreateRecord(records, answer.name);
    record.host = srv.target.replace(/\.$/, "");
    const lowerHost = srv.target.toLowerCase();
    for (const address of hostAddresses.get(lowerHost) ?? []) {
      addAddress(record, address);
    }
    if (answer.name.endsWith("._http._tcp.local")) {
      record.services.set("http", srv.port);
    }
    if (answer.name.endsWith("._meshtastic._tcp.local")) {
      record.services.set("tcp", srv.port);
    }
  }

  for (const record of records.values()) {
    const addresses =
      hostAddresses.get(`${record.host.toLowerCase()}.`) ??
      hostAddresses.get(record.host.toLowerCase());
    for (const address of addresses ?? []) {
      addAddress(record, address);
    }
  }
}

export async function discoverNetworkDevices(
  timeoutMs = DISCOVERY_TIMEOUT_MS,
): Promise<NetworkDiscoveryDevice[]> {
  const records = new Map<string, ServiceRecord>();
  const instance = mdns({ multicast: true, loopback: false });

  return await new Promise((resolve) => {
    const finish = () => {
      instance.destroy();
      resolve(
        Array.from(records.entries())
          .map(([id, record]) => ({
            id,
            name: record.name || record.host || id,
            host: record.host,
            addresses: Array.from(record.addresses),
            services: Array.from(record.services.entries()).map(([protocol, port]) => ({
              protocol,
              port,
            })),
          }))
          .filter(
            (device) =>
              device.host && device.services.length > 0 && isLikelyMeshtasticDevice(device),
          ),
      );
    };

    instance.on("response", (response) => {
      collectAnswers(records, [...response.answers, ...response.additionals]);
    });

    instance.on("warning", () => {
      // Discovery is opportunistic; keep listening until timeout.
    });

    for (const serviceType of SERVICE_TYPES) {
      instance.query({
        questions: [{ name: serviceType, type: "PTR" }],
      });
    }

    setTimeout(finish, timeoutMs);
  });
}

export async function handleNetworkDiscoveryProxy(
  _req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  try {
    const devices = await discoverNetworkDevices();
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ devices }));
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Network discovery failed",
      }),
    );
  }
}
