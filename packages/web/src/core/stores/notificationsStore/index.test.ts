import { beforeEach, describe, expect, it, vi } from "vitest";

const NOTIFICATIONS_STORAGE_KEY = "darkmesh:notifications:v1";
const CONFIG_STORAGE_KEY = "darkmesh:notifications:config:v1";

async function freshStore() {
  vi.resetModules();
  return (await import("./index.ts")) as typeof import("./index.ts");
}

describe("NotificationsStore persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("persists config separately from the legacy notifications payload", async () => {
    const { useNotificationsStore } = await freshStore();
    const state = useNotificationsStore.getState();

    state.setConfig({
      batteryMonitoring: {
        enabled: true,
        scope: "selected",
        selectedNodeNums: [42],
        batteryPercentThreshold: 10,
        voltageThreshold: 3.4,
        cooldownMs: 15_000,
        nodeOverrides: {
          42: {
            batteryPercentThreshold: 8,
          },
        },
      },
    });
    state.add({ type: "service", nodeNum: 42, payload: { detail: "persist me" } });

    expect(JSON.parse(localStorage.getItem(NOTIFICATIONS_STORAGE_KEY) ?? "[]")).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem(CONFIG_STORAGE_KEY) ?? "{}")).toMatchObject({
      enablePersistence: true,
      batteryMonitoring: {
        enabled: true,
        scope: "selected",
        selectedNodeNums: [42],
        batteryPercentThreshold: 10,
        voltageThreshold: 3.4,
        cooldownMs: 15_000,
        nodeOverrides: {
          42: {
            batteryPercentThreshold: 8,
          },
        },
      },
    });

    const rehydrated = (await freshStore()).useNotificationsStore.getState();

    expect(rehydrated.notifications).toHaveLength(1);
    expect(rehydrated.notifications[0]).toMatchObject({ type: "service", nodeNum: 42 });
    expect(rehydrated.config.enablePersistence).toBe(true);
    expect(rehydrated.config.batteryMonitoring).toMatchObject({
      enabled: true,
      scope: "selected",
      selectedNodeNums: [42],
      batteryPercentThreshold: 10,
      voltageThreshold: 3.4,
      cooldownMs: 15_000,
      nodeOverrides: {
        42: {
          batteryPercentThreshold: 8,
        },
      },
    });
  });

  it("preserves prior battery-monitoring selections when later config updates omit them", async () => {
    const { useNotificationsStore } = await freshStore();
    const state = useNotificationsStore.getState();

    state.setConfig({
      batteryMonitoring: {
        scope: "selected",
        selectedNodeNums: [7],
        nodeOverrides: {
          7: {
            voltageThreshold: 3.25,
          },
        },
      },
    });
    state.setConfig({
      batteryMonitoring: {
        enabled: true,
        batteryPercentThreshold: 12,
      },
    });

    expect(useNotificationsStore.getState().config.batteryMonitoring).toMatchObject({
      enabled: true,
      scope: "selected",
      selectedNodeNums: [7],
      batteryPercentThreshold: 12,
      nodeOverrides: {
        7: {
          voltageThreshold: 3.25,
        },
      },
    });

    const rehydrated = (await freshStore()).useNotificationsStore.getState();

    expect(rehydrated.config.batteryMonitoring).toMatchObject({
      enabled: true,
      scope: "selected",
      selectedNodeNums: [7],
      batteryPercentThreshold: 12,
      nodeOverrides: {
        7: {
          voltageThreshold: 3.25,
        },
      },
    });
  });

  it("preserves browser notification event selections when later config updates omit them", async () => {
    const { useNotificationsStore } = await freshStore();
    const state = useNotificationsStore.getState();

    state.setConfig({
      browserNotifications: {
        enabled: true,
        eventTypes: {
          messages: false,
          distress: true,
        },
      },
    });
    state.setConfig({
      browserNotifications: {
        notifyInForeground: true,
        playSound: false,
        sound: "beep",
        eventTypes: {
          nodes: false,
        },
      },
    });

    expect(useNotificationsStore.getState().config.browserNotifications).toMatchObject({
      enabled: true,
      notifyInForeground: true,
      playSound: false,
      sound: "beep",
      eventTypes: {
        messages: false,
        nodes: false,
        distress: true,
        battery: true,
        system: false,
      },
    });

    const rehydrated = (await freshStore()).useNotificationsStore.getState();

    expect(rehydrated.config.browserNotifications).toMatchObject({
      enabled: true,
      notifyInForeground: true,
      playSound: false,
      sound: "beep",
      eventTypes: {
        messages: false,
        nodes: false,
        distress: true,
        battery: true,
        system: false,
      },
    });
  });
});
