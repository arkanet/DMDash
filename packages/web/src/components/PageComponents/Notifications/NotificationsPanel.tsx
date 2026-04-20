import { useMemo, useState, useEffect } from "react";
import { useNotifications } from "@core/hooks/useNotifications.ts";
import NotificationItem from "./NotificationItem";
import { useNodeDB } from "@core/stores";
import useNotificationsStore from "@core/stores/notificationsStore/index.ts";
import { filterNodesByQuery } from "@core/utils/filterNodes.ts";
// using select + filter UI (like Scheduled Messages)

export function NotificationsPanel() {
  const { notifications, markAllSeen, setConfig } = useNotifications();
  const nodeStore = useNodeDB();
  const nodes = nodeStore.getNodes(() => true, true);
  const myNode = nodeStore.getMyNode ? nodeStore.getMyNode() : undefined;
  const currentCfg = useNotificationsStore((s) => s.config);
  const [filter, setFilter] = useState<"all" | "unseen">("all");

  const nodeOptions = nodes
    .filter((n) => Boolean(n))
    .sort((l, r) => (r.lastHeard ?? 0) - (l.lastHeard ?? 0))
    .map((n) => ({
      num: n.num,
      shortName: n.user?.shortName,
      longName: n.user?.longName,
      nameHex:
        (n.user as unknown as { nameHex?: string })?.nameHex ??
        (n as unknown as { nameHex?: string })?.nameHex,
      nodeId:
        (n as unknown as { nodeId?: string | number; nodeID?: string | number })?.nodeId ??
        (n as unknown as { nodeId?: string | number; nodeID?: string | number })?.nodeID ??
        undefined,
    }));
  const [selectedNotifNodeNum, setSelectedNotifNodeNum] = useState<number | null>(null);
  const [primaryScope, setPrimaryScope] = useState<"all" | "local" | "selected">("all");

  // notif node filter state (immediate - same behavior as Distress Beacon)
  const [notifNodeFilter, setNotifNodeFilter] = useState("");

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
  }, [primaryScope, myNode]);

  // Immediate auto-selection: when typing a query that matches exactly one node,
  // auto-select that node (mirrors Scheduled Messages behavior).
  useEffect(() => {
    if (primaryScope !== "selected") return;
    const q = notifNodeFilter?.trim();
    if (!q) return;
    const nodesForFilter = nodeOptions.map((o) => ({
      num: o.num,
      user: { shortName: o.shortName, longName: o.longName },
    }));
    const matched = filterNodesByQuery(nodesForFilter, q) as { num: number }[];
    if (matched.length === 1) {
      setSelectedNotifNodeNum(matched[0]?.num ?? null);
    }
  }, [notifNodeFilter, nodeOptions, primaryScope]);

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

  const batteryCfg = currentCfg.batteryMonitoring ?? {
    enabled: false,
    scope: "all",
    selectedNodeNums: [],
    batteryPercentThreshold: 15,
    voltageThreshold: 0,
    cooldownMs: 60 * 60 * 1000,
  };

  const onBatterySettingChange = (patch: Partial<typeof batteryCfg>) => {
    const scopeForCfg =
      primaryScope === "local" ? "selected" : (primaryScope as "all" | "selected" | "connected_bt");
    const merged = { ...batteryCfg, ...patch, scope: scopeForCfg };
    setConfig({ batteryMonitoring: merged });
  };

  // keep battery selected node in sync with primary scope/selection
  useEffect(() => {
    if (primaryScope === "selected") {
      onBatterySettingChange({
        selectedNodeNums: selectedNotifNodeNum ? [selectedNotifNodeNum] : [],
      });
    } else {
      onBatterySettingChange({ selectedNodeNums: [] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryScope, selectedNotifNodeNum]);

  return (
    <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-md shadow-md">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">Notifications</div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-text-secondary">Unread: {unread}</div>
            <div>
              <label className="text-sm block">
                <div className="mb-1 text-slate-500">Scope</div>
                <select
                  className="h-8 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
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
                      label: n.shortName ?? `!${n.num}`,
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
        </div>

        {/* Battery notification controls */}
        <div className="mt-3 grid gap-2 md:grid-cols-3 items-center">
          <label className="flex items-center gap-2 md:col-span-3">
            <input
              type="checkbox"
              checked={batteryCfg.enabled}
              onChange={(e) => onBatterySettingChange({ enabled: e.target.checked })}
            />
            <span className="ml-1">Enable low battery notifications</span>
          </label>
          <div className="md:col-span-1">
            <label className="block text-xs text-text-secondary">Battery % threshold</label>
            <input
              type="number"
              min={0}
              max={100}
              value={batteryCfg.batteryPercentThreshold}
              onChange={(e) =>
                onBatterySettingChange({ batteryPercentThreshold: Number(e.target.value) })
              }
              className="w-full"
            />
          </div>

          <div className="md:col-span-1">
            <label className="block text-xs text-text-secondary">Voltage threshold (V)</label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={batteryCfg.voltageThreshold}
              onChange={(e) => onBatterySettingChange({ voltageThreshold: Number(e.target.value) })}
              className="w-full"
            />
          </div>

          <div className="mt-3 flex gap-2 md:col-span-3">
            <button onClick={() => setFilter(filter === "all" ? "unseen" : "all")} className="btn">
              {filter === "all" ? "Show Unseen" : "Show All"}
            </button>
            <button onClick={() => markAllSeen()} className="btn">
              Mark All
            </button>
          </div>
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
