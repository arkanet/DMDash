import { toJsonString } from "@bufbuild/protobuf";
import { Protobuf } from "@meshtastic/core";
import { create } from "zustand";

const MAX_DEBUG_LOGS = 500;

export type DebugLogKind = "fromRadio" | "logRecord" | "serial";

export type DebugLogEntry = {
  id: string;
  deviceId: number;
  kind: DebugLogKind;
  receivedAt: number;
  deviceTime?: number;
  level?: Protobuf.Mesh.LogRecord_Level;
  source?: string;
  title: string;
  message: string;
};

type DebugStore = {
  entries: DebugLogEntry[];
  addFromRadio: (deviceId: number, fromRadio: Protobuf.Mesh.FromRadio) => void;
  addLogRecord: (deviceId: number, record: Protobuf.Mesh.LogRecord) => void;
  addSerialDebugLog: (deviceId: number, data: Uint8Array) => void;
  clear: (deviceId?: number) => void;
};

const textDecoder = new TextDecoder();

function createDebugLogId(deviceId: number, receivedAt: number): string {
  return `${deviceId}-${receivedAt}-${Math.random().toString(36).slice(2)}`;
}

function trimEntries(entries: DebugLogEntry[]): DebugLogEntry[] {
  return entries.slice(0, MAX_DEBUG_LOGS);
}

function prependEntry(entries: DebugLogEntry[], entry: DebugLogEntry): DebugLogEntry[] {
  return trimEntries([entry, ...entries]);
}

function getLogLevelLabel(level: Protobuf.Mesh.LogRecord_Level): string {
  switch (level) {
    case Protobuf.Mesh.LogRecord_Level.CRITICAL:
      return "CRITICAL";
    case Protobuf.Mesh.LogRecord_Level.ERROR:
      return "ERROR";
    case Protobuf.Mesh.LogRecord_Level.WARNING:
      return "WARNING";
    case Protobuf.Mesh.LogRecord_Level.INFO:
      return "INFO";
    case Protobuf.Mesh.LogRecord_Level.DEBUG:
      return "DEBUG";
    case Protobuf.Mesh.LogRecord_Level.TRACE:
      return "TRACE";
    case Protobuf.Mesh.LogRecord_Level.UNSET:
    default:
      return "UNSET";
  }
}

function getFromRadioTitle(fromRadio: Protobuf.Mesh.FromRadio): string {
  switch (fromRadio.payloadVariant.case) {
    case "config": {
      const configVariant = fromRadio.payloadVariant.value.payloadVariant.case ?? "unknown";
      return `Config ${configVariant}`;
    }
    case "moduleConfig": {
      const configVariant = fromRadio.payloadVariant.value.payloadVariant.case ?? "unknown";
      return `ModuleConfig ${configVariant}`;
    }
    case undefined:
      return "unknown";
    default:
      return fromRadio.payloadVariant.case;
  }
}

function stringifyFromRadio(fromRadio: Protobuf.Mesh.FromRadio): string {
  try {
    return toJsonString(Protobuf.Mesh.FromRadioSchema, fromRadio, { prettySpaces: 2 });
  } catch {
    return JSON.stringify(fromRadio, null, 2);
  }
}

function isContinuation(record: Protobuf.Mesh.LogRecord): boolean {
  return (
    record.level === Protobuf.Mesh.LogRecord_Level.UNSET &&
    record.time === 0 &&
    record.source.trim().length === 0
  );
}

export const useDebugStore = create<DebugStore>()((set) => ({
  entries: [],
  addFromRadio: (deviceId, fromRadio) => {
    if (fromRadio.payloadVariant.case === "logRecord") {
      return;
    }

    const receivedAt = Date.now();
    const title = getFromRadioTitle(fromRadio);

    set((state) => ({
      entries: prependEntry(state.entries, {
        id: createDebugLogId(deviceId, receivedAt),
        deviceId,
        kind: "fromRadio",
        receivedAt,
        title,
        message: stringifyFromRadio(fromRadio),
      }),
    }));
  },
  addLogRecord: (deviceId, record) => {
    const receivedAt = Date.now();
    const message = record.message.trimEnd();

    if (isContinuation(record)) {
      set((state) => {
        const nextEntries = state.entries.slice();
        const index = nextEntries.findIndex(
          (entry) => entry.deviceId === deviceId && entry.kind === "logRecord",
        );

        if (index === -1) {
          return {
            entries: prependEntry(state.entries, {
              id: createDebugLogId(deviceId, receivedAt),
              deviceId,
              kind: "logRecord",
              receivedAt,
              level: record.level,
              title: getLogLevelLabel(record.level),
              message,
            }),
          };
        }

        const previous = nextEntries[index]!;
        nextEntries[index] = {
          ...previous,
          receivedAt,
          message: `${previous.message}${message}`,
        };
        return { entries: trimEntries(nextEntries) };
      });
      return;
    }

    set((state) => ({
      entries: prependEntry(state.entries, {
        id: createDebugLogId(deviceId, receivedAt),
        deviceId,
        kind: "logRecord",
        receivedAt,
        deviceTime: record.time > 0 ? record.time * 1000 : undefined,
        level: record.level,
        source: record.source.trim() || undefined,
        title: getLogLevelLabel(record.level),
        message,
      }),
    }));
  },
  addSerialDebugLog: (deviceId, data) => {
    const receivedAt = Date.now();
    const message = textDecoder.decode(data).trimEnd();

    if (!message) {
      return;
    }

    set((state) => ({
      entries: prependEntry(state.entries, {
        id: createDebugLogId(deviceId, receivedAt),
        deviceId,
        kind: "serial",
        receivedAt,
        title: "Serial",
        message,
      }),
    }));
  },
  clear: (deviceId) => {
    set((state) => ({
      entries:
        deviceId === undefined ? [] : state.entries.filter((entry) => entry.deviceId !== deviceId),
    }));
  },
}));

export { MAX_DEBUG_LOGS };
