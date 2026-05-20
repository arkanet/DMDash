import { create as createStore } from "zustand";
import {
  getBrowserNotificationEventType,
  playBrowserNotificationSound,
  showStoredBrowserNotification,
  type BrowserNotificationSound,
  type BrowserNotificationEventType,
} from "@core/services/browserNotifications.ts";

export type NotificationType =
  | "low_battery"
  | "direct_message"
  | "broadcast_message"
  | "distress_beacon"
  | "node_detected"
  | "beacon_send"
  | "beacon_failed"
  | "service"
  | "retransmit"
  | "scheduled_send"
  | "scheduled_failed"
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

export type BrowserNotificationsConfig = {
  enabled: boolean;
  notifyInForeground: boolean;
  playSound: boolean;
  sound: BrowserNotificationSound;
  eventTypes: Record<BrowserNotificationEventType, boolean>;
};

export type BatteryMonitoringConfig = {
  enabled: boolean;
  scope: "all" | "selected" | "connected_bt";
  selectedNodeNums: number[];
  batteryPercentThreshold: number;
  voltageThreshold: number;
  cooldownMs: number;
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

export type NotificationsConfig = {
  enablePersistence: boolean;
  ttlDays: number;
  maxEntries: number;
  browserNotifications: BrowserNotificationsConfig;
  batteryMonitoring: BatteryMonitoringConfig;
};

export type NotificationsConfigPatch = Partial<
  Omit<NotificationsConfig, "batteryMonitoring" | "browserNotifications">
> & {
  batteryMonitoring?: Partial<BatteryMonitoringConfig>;
  browserNotifications?: Partial<Omit<BrowserNotificationsConfig, "eventTypes">> & {
    eventTypes?: Partial<Record<BrowserNotificationEventType, boolean>>;
  };
};

export type NotificationsStore = {
  notifications: Notification[];
  config: NotificationsConfig;
  add: (n: Omit<Partial<Notification>, "id" | "timestamp" | "seen">) => string;
  getAll: (opts?: { onlyUnseen?: boolean }) => Notification[];
  markSeen: (id: string) => void;
  markAllSeen: (nodeNum?: number) => void;
  remove: (id: string) => void;
  clearExpired: () => void;
  setConfig: (c: NotificationsConfigPatch) => void;
};

const STORAGE_KEY = "darkmesh:notifications:v1";
const CONFIG_STORAGE_KEY = "darkmesh:notifications:config:v1";

const defaultConfig: NotificationsConfig = {
  enablePersistence: true,
  ttlDays: 7,
  maxEntries: 500,
  browserNotifications: {
    enabled: false,
    notifyInForeground: false,
    playSound: true,
    sound: "chime",
    eventTypes: {
      messages: true,
      nodes: true,
      distress: true,
      battery: true,
      system: false,
    },
  },
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
      browserNotifications: {
        ...defaultConfig.browserNotifications,
        ...parsed.browserNotifications,
        eventTypes: {
          ...defaultConfig.browserNotifications.eventTypes,
          ...parsed.browserNotifications?.eventTypes,
        },
      },
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

function shouldShowNativeNotification(
  notification: Notification,
  config: NotificationsConfig,
): boolean {
  if (!config.browserNotifications.enabled) {
    return false;
  }

  if (
    !config.browserNotifications.notifyInForeground &&
    typeof document !== "undefined" &&
    document.visibilityState === "visible" &&
    document.hasFocus()
  ) {
    return false;
  }

  const eventType = getBrowserNotificationEventType(notification.type);
  return config.browserNotifications.eventTypes[eventType] === true;
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

    if (shouldShowNativeNotification(notif, get().config)) {
      void showStoredBrowserNotification(notif);
      if (get().config.browserNotifications.playSound) {
        void playBrowserNotificationSound(notif.priority, get().config.browserNotifications.sound);
      }
    }

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
        ...c,
      } as NotificationsConfig;
      if (c.batteryMonitoring) {
        merged.batteryMonitoring = { ...s.config.batteryMonitoring, ...c.batteryMonitoring };
        if (c.batteryMonitoring?.nodeOverrides) {
          merged.batteryMonitoring.nodeOverrides = {
            ...(s.config.batteryMonitoring.nodeOverrides || {}),
            ...(c.batteryMonitoring.nodeOverrides || {}),
          };
        }
      }
      if (c.browserNotifications) {
        merged.browserNotifications = {
          ...s.config.browserNotifications,
          ...c.browserNotifications,
          eventTypes: {
            ...s.config.browserNotifications.eventTypes,
            ...(c.browserNotifications.eventTypes ?? {}),
          },
        };
      }
      saveConfigToStorage(merged);
      if (merged.enablePersistence) saveToStorage(s.notifications);
      return { config: merged };
    }),
}));

export default useNotificationsStore;
