import { useMemo, useEffect, useState } from "react";
import { Protobuf } from "@meshtastic/core";
import { useNotifications } from "@core/hooks/useNotifications.ts";
import NotificationItem from "./NotificationItem";
import { useNodeDB } from "@core/stores";
import useNotificationsStore from "@core/stores/notificationsStore/index.ts";
import {
  getBrowserNotificationPermission,
  playBrowserNotificationSound,
  requestBrowserNotificationPermission,
  showBrowserNotification,
  unlockBrowserNotificationSound,
  type BrowserNotificationEventType,
  type BrowserNotificationSound,
} from "@core/services/browserNotifications.ts";
import useLocalStorage from "@core/hooks/useLocalStorage.ts";
import { filterNodesByQuery } from "@core/utils/filterNodes.ts";
import { useTranslation } from "react-i18next";
import { getNodeShortName, getNodeLongName } from "@app/darkmesh/utils";

export function NotificationsPanel() {
  const { notifications, markAllSeen, setConfig } = useNotifications();
  const nodeStore = useNodeDB();
  const nodes = nodeStore.getNodes(() => true, true);
  const myNode = nodeStore.getMyNode ? nodeStore.getMyNode() : undefined;
  const currentCfg = useNotificationsStore((s) => s.config);
  const [filter, setFilter] = useLocalStorage<"all" | "unseen">(
    "darkmesh:notifications:panel-filter:v1",
    "all",
  );

  const { t } = useTranslation();

  const nodeOptions = nodes
    .filter((n) => Boolean(n))
    .sort((l, r) => (r.lastHeard ?? 0) - (l.lastHeard ?? 0))
    .map((n) => ({
      num: n.num,
      shortName: getNodeShortName(n as Protobuf.Mesh.NodeInfo),
      longName: getNodeLongName(n as Protobuf.Mesh.NodeInfo),
      nameHex:
        (n.user as unknown as { nameHex?: string })?.nameHex ??
        (n as unknown as { nameHex?: string })?.nameHex,
      nodeId:
        (n as unknown as { nodeId?: string | number; nodeID?: string | number })?.nodeId ??
        (n as unknown as { nodeId?: string | number; nodeID?: string | number })?.nodeID ??
        undefined,
    }));
  const [selectedNotifNodeNum, setSelectedNotifNodeNum] = useLocalStorage<number | null>(
    "darkmesh:notifications:selected-node:v1",
    null,
  );
  const [primaryScope, setPrimaryScope] = useLocalStorage<"all" | "local" | "selected">(
    "darkmesh:notifications:scope:v1",
    "all",
  );

  // notif node filter state (immediate - same behavior as Distress Beacon)
  const [notifNodeFilter, setNotifNodeFilter] = useLocalStorage<string>(
    "darkmesh:notifications:node-filter:v1",
    "",
  );

  // keep selectedNotifNodeNum in sync with primaryScope and myNode
  useEffect(() => {
    if (primaryScope === "all") {
      setSelectedNotifNodeNum(null);
      setNotifNodeFilter("");
    } else if (primaryScope === "local") {
      const myNum = myNode?.num ?? null;
      setSelectedNotifNodeNum(myNum);
      setNotifNodeFilter("");
    }
    // if selected, preserve selection and allow filtering
  }, [primaryScope, myNode?.num, setNotifNodeFilter, setSelectedNotifNodeNum]);

  // Immediate auto-selection: when typing a query that matches exactly one node,
  // auto-select that node (mirrors Scheduled Messages behavior).
  useEffect(() => {
    if (primaryScope !== "selected") return;
    const q = notifNodeFilter?.trim();
    if (!q) return;
    const nodesForFilter = nodeOptions.map((o) => ({
      num: o.num,
      user: { shortName: o.shortName, longName: o.longName, nameHex: o.nameHex },
    }));
    const matched = filterNodesByQuery(nodesForFilter, q) as { num: number }[];
    if (matched.length === 1) {
      setSelectedNotifNodeNum(matched[0]?.num ?? null);
    }
  }, [notifNodeFilter, nodeOptions, primaryScope, setSelectedNotifNodeNum]);

  // filtered nodes for selection are computed inline where needed

  const list = useMemo(() => {
    const arr = notifications.slice().sort((a, b) => b.timestamp - a.timestamp);
    let out = arr;
    if (filter === "unseen") out = out.filter((n) => !n.seen);
    const myNum = myNode?.num ?? null;
    if (primaryScope === "all") {
      if (myNum !== null) out = out.filter((n) => n.nodeNum !== myNum);
    } else if (primaryScope === "local") {
      if (myNum !== null) out = out.filter((n) => n.nodeNum === myNum);
      else out = [];
    } else if (primaryScope === "selected") {
      if (selectedNotifNodeNum !== null)
        out = out.filter((n) => n.nodeNum === selectedNotifNodeNum);
    }
    return out;
  }, [notifications, filter, primaryScope, selectedNotifNodeNum, myNode]);

  const unread = notifications.filter((n) => !n.seen).length;
  const [browserPermission, setBrowserPermission] = useState(getBrowserNotificationPermission);

  const browserCfg = currentCfg.browserNotifications ?? {
    enabled: false,
    notifyInForeground: false,
    playSound: true,
    sound: "chime" as BrowserNotificationSound,
    eventTypes: {
      messages: true,
      nodes: true,
      distress: true,
      battery: true,
      system: false,
    },
  };

  const browserNotificationsEnabled = browserCfg.enabled && browserPermission === "granted";

  const updateBrowserEventType = (eventType: BrowserNotificationEventType, enabled: boolean) => {
    setConfig({
      browserNotifications: {
        eventTypes: {
          [eventType]: enabled,
        },
      },
    });
  };

  const setBrowserNotificationsEnabled = (enabled: boolean) => {
    setConfig({
      browserNotifications: {
        enabled,
      },
    });

    if (enabled) {
      void unlockBrowserNotificationSound();
    }
  };

  const setBrowserNotificationSoundEnabled = (enabled: boolean) => {
    setConfig({
      browserNotifications: {
        playSound: enabled,
      },
    });

    if (enabled) {
      void unlockBrowserNotificationSound();
    }
  };

  const enableBrowserNotifications = async () => {
    const permission = await requestBrowserNotificationPermission();
    setBrowserPermission(permission);
    setConfig({
      browserNotifications: {
        enabled: permission === "granted",
      },
    });

    if (permission === "granted") {
      await unlockBrowserNotificationSound();
      void showBrowserNotification({
        title: "DarkMesh notifications enabled",
        body: "Message, node, distress and battery alerts can now use this device notification system.",
        tag: "darkmesh-notifications-enabled",
        url: "/dashboard",
      });
      void playBrowserNotificationSound(3, browserCfg.sound);
    }
  };

  const testBrowserNotificationSound = async () => {
    await unlockBrowserNotificationSound();
    void playBrowserNotificationSound(3, browserCfg.sound);
  };

  useEffect(() => {
    if (!browserNotificationsEnabled || !browserCfg.playSound) {
      return;
    }

    const unlockSound = () => {
      void unlockBrowserNotificationSound();
      window.removeEventListener("pointerdown", unlockSound);
      window.removeEventListener("keydown", unlockSound);
    };

    window.addEventListener("pointerdown", unlockSound, { passive: true });
    window.addEventListener("keydown", unlockSound);

    return () => {
      window.removeEventListener("pointerdown", unlockSound);
      window.removeEventListener("keydown", unlockSound);
    };
  }, [browserCfg.playSound, browserNotificationsEnabled]);

  return (
    <div className="space-y-4">
      <div className="border-b border-slate-200 pb-4 dark:border-zinc-800">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-2">
            <div className="text-sm text-text-secondary">Unread: {unread}</div>
            <label className="text-sm block">
              <div className="mb-1 text-slate-500">Scope</div>
              <select
                className="h-8 w-56 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                value={primaryScope}
                onChange={(e) => setPrimaryScope(e.target.value as "all" | "local" | "selected")}
              >
                <option value="all">All Nodes</option>
                <option value="local">Local Node</option>
                <option value="selected">Selected Node</option>
              </select>
            </label>
          </div>
          {primaryScope === "selected" && (
            <div className="w-56">
              <label className="text-sm">
                <input
                  aria-label="Search nodes"
                  className="h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  placeholder="Search nodes"
                  value={notifNodeFilter}
                  onChange={(e) => setNotifNodeFilter(e.target.value)}
                />
              </label>
              <select
                className="mt-1 h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                value={selectedNotifNodeNum !== null ? `direct:${selectedNotifNodeNum}` : ""}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) setSelectedNotifNodeNum(null);
                  else setSelectedNotifNodeNum(Number(v.split(":")[1]));
                }}
              >
                <option value="">All nodes</option>
                {(() => {
                  // Use the same immediate filtering semantics as the Distress Beacon
                  const q = notifNodeFilter?.trim();
                  const direct = nodeOptions.map((n) => ({
                    label:
                      n.shortName ??
                      (n.nameHex ? `!${n.nameHex.toUpperCase()}` : t("unknown.shortName")),
                    value: `direct:${n.num}`,
                  }));
                  if (!q)
                    return direct.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label} ({o.value.split(":")[1]})
                      </option>
                    ));
                  // build lightweight nodes and run the shared filter
                  const nodesForFilter = nodeOptions.map((o) => ({
                    num: o.num,
                    user: { shortName: o.shortName, longName: o.longName },
                  }));
                  const matched = filterNodesByQuery(nodesForFilter, q) as { num: number }[];
                  const matchedSet = new Set(matched.map((n) => n.num));
                  // Only include direct node options (no channels)
                  return direct
                    .filter((o) => matchedSet.has(Number(o.value.split(":")[1])))
                    .map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label} ({o.value.split(":")[1]})
                      </option>
                    ));
                })()}
              </select>
            </div>
          )}
        </div>

        <div className="mt-3 flex gap-2">
          <button onClick={() => setFilter(filter === "all" ? "unseen" : "all")} className="btn">
            {filter === "all" ? "Show Unseen" : "Show All"}
          </button>
          <button onClick={() => markAllSeen()} className="btn">
            Mark All
          </button>
        </div>

        {/* Browser notification controls */}
        <div className="mt-3 grid gap-3 rounded-md border border-slate-200 p-3 text-sm dark:border-zinc-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-medium">Device notifications</div>
              <div className="text-xs text-text-secondary">
                Browser permission: {browserPermission}
              </div>
            </div>
            {browserPermission === "granted" ? (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={browserCfg.enabled}
                  onChange={(event) => setBrowserNotificationsEnabled(event.target.checked)}
                />
                <span>Use device notifications</span>
              </label>
            ) : (
              <button
                type="button"
                onClick={enableBrowserNotifications}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-zinc-700"
                disabled={browserPermission === "unsupported" || browserPermission === "denied"}
              >
                Enable device notifications
              </button>
            )}
          </div>

          {browserPermission === "unsupported" ? (
            <div className="text-xs text-amber-600 dark:text-amber-400">
              Device notifications require Notification API support and a secure context (HTTPS or
              localhost).
            </div>
          ) : null}
          {browserPermission === "denied" ? (
            <div className="text-xs text-amber-600 dark:text-amber-400">
              Permission is blocked. Re-enable notifications from browser or OS site settings.
            </div>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {(
              [
                ["messages", "Messages"],
                ["nodes", "New nodes"],
                ["distress", "Distress"],
                ["battery", "Battery"],
                ["system", "System"],
              ] as const
            ).map(([eventType, label]) => (
              <label
                key={eventType}
                className={`flex items-center gap-2 ${browserNotificationsEnabled ? "" : "opacity-60"}`}
              >
                <input
                  type="checkbox"
                  checked={browserCfg.eventTypes[eventType]}
                  disabled={!browserNotificationsEnabled}
                  onChange={(event) => updateBrowserEventType(eventType, event.target.checked)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-text-secondary">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={browserCfg.playSound}
                disabled={!browserNotificationsEnabled}
                onChange={(event) => setBrowserNotificationSoundEnabled(event.target.checked)}
              />
              <span>Play notification sound</span>
            </label>
            <label className="flex items-center gap-2">
              <span>Sound</span>
              <select
                className="h-7 rounded-md border border-slate-300 bg-white px-2 text-xs disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
                value={browserCfg.sound}
                disabled={!browserNotificationsEnabled || !browserCfg.playSound}
                onChange={(event) =>
                  setConfig({
                    browserNotifications: {
                      sound: event.target.value as BrowserNotificationSound,
                    },
                  })
                }
              >
                <option value="chime">Message chime</option>
                <option value="beep">Classic beep</option>
              </select>
            </label>
            <button
              type="button"
              onClick={testBrowserNotificationSound}
              disabled={!browserNotificationsEnabled || !browserCfg.playSound}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs disabled:opacity-50 dark:border-zinc-700"
            >
              Test sound
            </button>
          </div>

          <label className="flex items-center gap-2 text-xs text-text-secondary">
            <input
              type="checkbox"
              checked={browserCfg.notifyInForeground}
              disabled={!browserNotificationsEnabled}
              onChange={(event) =>
                setConfig({
                  browserNotifications: {
                    notifyInForeground: event.target.checked,
                  },
                })
              }
            />
            <span>Also notify while this app is visible</span>
          </label>
        </div>
      </div>

      <div className="max-h-96 overflow-auto">
        {list.length === 0 && (
          <div className="p-4 text-center text-text-secondary">No notifications</div>
        )}
        {list.map((n) => (
          <NotificationItem key={n.id} {...n} />
        ))}
      </div>
    </div>
  );
}

export default NotificationsPanel;
