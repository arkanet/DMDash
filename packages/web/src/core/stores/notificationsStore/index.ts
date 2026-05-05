import { create as createStore } from "zustand";

export type NotificationType =
  | "low_battery"
  | "service"
  | "retransmit"
  | "scheduled_send"
  | "custom";

export type Notification = {
  id: string;
  type: NotificationType;
  priority: number;
  nodeNum?: number;
  payload?: Record<string, unknown>;
  seen: boolean;
  timestamp: number;
};

export type NotificationsStore = {
  notifications: Notification[];
  config: {
    enablePersistence: boolean;
    ttlDays: number;
    maxEntries: number;
    // battery monitoring config
    batteryMonitoring: {
      enabled: boolean;
      scope: "all" | "selected" | "connected_bt";
      // when scope === 'selected', selectedNodeNums controls which nodes
      selectedNodeNums: number[];
      // battery percent threshold (0-100). 0 disables
      batteryPercentThreshold: number;
      // voltage threshold in V. 0 disables
      voltageThreshold: number;
      // cooldown between low-battery notifications per node in ms
      cooldownMs: number;
      // optional per-node overrides
      nodeOverrides?: Record<
        number,
        Partial<{
          enabled: boolean;
          batteryPercentThreshold: number;
          voltageThreshold: number;
          cooldownMs: number;
        }>
      >;
    };
  };
  add: (n: Omit<Partial<Notification>, "id" | "timestamp" | "seen">) => string;
  getAll: (opts?: { onlyUnseen?: boolean }) => Notification[];
  markSeen: (id: string) => void;
  markAllSeen: (nodeNum?: number) => void;
  remove: (id: string) => void;
  clearExpired: () => void;
  setConfig: (c: Partial<NotificationsStore["config"]>) => void;
};

type NotificationsConfig = NotificationsStore["config"];

const STORAGE_KEY = "darkmesh:notifications:v1";
const CONFIG_STORAGE_KEY = "darkmesh:notifications:config:v1";

const defaultConfig: NotificationsConfig = {
  enablePersistence: true,
  ttlDays: 7,
  maxEntries: 500,
  batteryMonitoring: {
    enabled: false,
    scope: "all",
    selectedNodeNums: [],
    batteryPercentThreshold: 15,
    voltageThreshold: 0,
    cooldownMs: 60 * 60 * 1000,
    nodeOverrides: {},
  },
};

function makeId() {
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

function loadFromStorage(): Notification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Notification[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveToStorage(list: Notification[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {}
}

function loadConfigFromStorage(): NotificationsConfig {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return defaultConfig;
    const parsed = JSON.parse(raw) as Partial<NotificationsConfig>;
    return {
      ...defaultConfig,
      ...parsed,
      batteryMonitoring: {
        ...defaultConfig.batteryMonitoring,
        ...parsed.batteryMonitoring,
        nodeOverrides: {
          ...(defaultConfig.batteryMonitoring.nodeOverrides ?? {}),
          ...(parsed.batteryMonitoring?.nodeOverrides ?? {}),
        },
      },
    };
  } catch {
    return defaultConfig;
  }
}

function saveConfigToStorage(config: NotificationsConfig) {
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch {}
}

export const useNotificationsStore = createStore<NotificationsStore>((set, get) => ({
  notifications: typeof window !== "undefined" ? loadFromStorage() : [],
  config: typeof window !== "undefined" ? loadConfigFromStorage() : defaultConfig,
  add: (n) => {
    const id = makeId();
    const timestamp = Date.now();
    const notif: Notification = {
      id,
      type: (n.type as NotificationType) ?? "custom",
      priority: n.priority ?? 1,
      nodeNum: n.nodeNum,
      payload: (n.payload ?? {}) as Record<string, unknown>,
      seen: false,
      timestamp,
    };

    set((s) => {
      const list = [notif, ...s.notifications].slice(0, s.config.maxEntries);
      if (s.config.enablePersistence) saveToStorage(list);
      return { notifications: list };
    });

    return id;
  },
  getAll: ({ onlyUnseen } = {}) => {
    const list = get().notifications;
    return onlyUnseen ? list.filter((n) => !n.seen) : list;
  },
  markSeen: (id) =>
    set((s) => {
      const list = s.notifications.map((n) => (n.id === id ? { ...n, seen: true } : n));
      if (s.config.enablePersistence) saveToStorage(list);
      return { notifications: list };
    }),
  markAllSeen: (nodeNum) =>
    set((s) => {
      const list = s.notifications.map((n) =>
        nodeNum === undefined || n.nodeNum === nodeNum ? { ...n, seen: true } : n,
      );
      if (s.config.enablePersistence) saveToStorage(list);
      return { notifications: list };
    }),
  remove: (id) =>
    set((s) => {
      const list = s.notifications.filter((n) => n.id !== id);
      if (s.config.enablePersistence) saveToStorage(list);
      return { notifications: list };
    }),
  clearExpired: () =>
    set((s) => {
      const cutoff = Date.now() - s.config.ttlDays * 24 * 60 * 60 * 1000;
      const list = s.notifications.filter((n) => n.timestamp >= cutoff);
      if (s.config.enablePersistence) saveToStorage(list);
      return { notifications: list };
    }),
  setConfig: (c) =>
    set((s) => {
      // shallow merge at top level, but deep-merge batteryMonitoring when provided
      const merged = {
        ...s.config,
        ...(c as Partial<NotificationsStore["config"]>),
      } as NotificationsStore["config"];
      if (c.batteryMonitoring) {
        merged.batteryMonitoring = { ...s.config.batteryMonitoring, ...c.batteryMonitoring };
        if (c.batteryMonitoring?.nodeOverrides) {
          merged.batteryMonitoring.nodeOverrides = {
            ...(s.config.batteryMonitoring.nodeOverrides || {}),
            ...(c.batteryMonitoring.nodeOverrides || {}),
          };
        }
      }
      saveConfigToStorage(merged);
      if (merged.enablePersistence) saveToStorage(s.notifications);
      return { config: merged };
    }),
}));

export default useNotificationsStore;
