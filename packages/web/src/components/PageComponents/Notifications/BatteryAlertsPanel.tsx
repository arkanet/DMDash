import { useEffect } from "react";
import { Protobuf } from "@meshtastic/core";
import { useNotifications } from "@core/hooks/useNotifications.ts";
import { useNodeDB } from "@core/stores";
import useNotificationsStore from "@core/stores/notificationsStore/index.ts";
import useLocalStorage from "@core/hooks/useLocalStorage.ts";
import { filterNodesByQuery } from "@core/utils/filterNodes.ts";
import { useTranslation } from "react-i18next";
import { getNodeShortName, getNodeLongName } from "@app/darkmesh/utils";

type BatteryMonitoringConfig = ReturnType<
  typeof useNotificationsStore.getState
>["config"]["batteryMonitoring"];

function derivePrimaryScope(
  batteryMonitoring: BatteryMonitoringConfig,
  myNodeNum?: number,
): "all" | "local" | "selected" {
  if (batteryMonitoring.scope === "connected_bt") {
    return "local";
  }

  if (batteryMonitoring.scope !== "selected") {
    return "all";
  }

  const selected = batteryMonitoring.selectedNodeNums ?? [];
  if (selected.length === 1 && myNodeNum !== undefined && selected[0] === myNodeNum) {
    return "local";
  }

  return "selected";
}

function deriveSelectedNodeNum(
  batteryMonitoring: BatteryMonitoringConfig,
  primaryScope: "all" | "local" | "selected",
  myNodeNum?: number,
): number | null {
  if (primaryScope === "local") {
    return myNodeNum ?? null;
  }

  if (primaryScope !== "selected") {
    return null;
  }

  return batteryMonitoring.selectedNodeNums?.[0] ?? null;
}

export function BatteryAlertsPanel() {
  const { setConfig } = useNotifications();
  const nodeStore = useNodeDB();
  const nodes = nodeStore.getNodes(() => true, true);
  const myNode = nodeStore.getMyNode ? nodeStore.getMyNode() : undefined;
  const currentCfg = useNotificationsStore((s) => s.config);
  const batteryCfg = currentCfg.batteryMonitoring ?? {
    enabled: false,
    scope: "all",
    selectedNodeNums: [],
    batteryPercentThreshold: 15,
    voltageThreshold: 0,
    cooldownMs: 60 * 60 * 1000,
  };
  const initialPrimaryScope = derivePrimaryScope(batteryCfg, myNode?.num);
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
    }));
  const [selectedBatteryNodeNum, setSelectedBatteryNodeNum] = useLocalStorage<number | null>(
    "darkmesh:battery-alerts:selected-node:v1",
    deriveSelectedNodeNum(batteryCfg, initialPrimaryScope, myNode?.num),
  );
  const [primaryScope, setPrimaryScope] = useLocalStorage<"all" | "local" | "selected">(
    "darkmesh:battery-alerts:scope:v1",
    initialPrimaryScope,
  );
  const [nodeFilter, setNodeFilter] = useLocalStorage<string>(
    "darkmesh:battery-alerts:node-filter:v1",
    "",
  );

  useEffect(() => {
    if (primaryScope === "all") {
      setSelectedBatteryNodeNum(null);
      setNodeFilter("");
    } else if (primaryScope === "local") {
      const myNum = myNode?.num ?? null;
      setSelectedBatteryNodeNum(myNum);
      setNodeFilter("");
    }
  }, [primaryScope, myNode?.num, setNodeFilter, setSelectedBatteryNodeNum]);

  useEffect(() => {
    if (primaryScope !== "selected") return;
    const q = nodeFilter?.trim();
    if (!q) return;
    const nodesForFilter = nodeOptions.map((o) => ({
      num: o.num,
      user: { shortName: o.shortName, longName: o.longName, nameHex: o.nameHex },
    }));
    const matched = filterNodesByQuery(nodesForFilter, q) as { num: number }[];
    if (matched.length === 1) {
      setSelectedBatteryNodeNum(matched[0]?.num ?? null);
    }
  }, [nodeFilter, nodeOptions, primaryScope, setSelectedBatteryNodeNum]);

  const selectedNodeNums =
    primaryScope === "local" && myNode?.num !== undefined
      ? [myNode.num]
      : primaryScope === "selected" && selectedBatteryNodeNum !== null
        ? [selectedBatteryNodeNum]
        : [];

  const onBatterySettingChange = (patch: Partial<typeof batteryCfg>) => {
    setConfig({
      batteryMonitoring: {
        ...batteryCfg,
        ...patch,
        scope: primaryScope === "all" ? "all" : "selected",
        selectedNodeNums,
      },
    });
  };

  useEffect(() => {
    onBatterySettingChange({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryScope, selectedBatteryNodeNum, myNode?.num]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-sm block">
            <div className="mb-1 text-slate-500">Scope</div>
            <select
              className="h-8 w-56 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              value={primaryScope}
              onChange={(event) =>
                setPrimaryScope(event.target.value as "all" | "local" | "selected")
              }
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
                aria-label="Search battery alert nodes"
                className="h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                placeholder="Search nodes"
                value={nodeFilter}
                onChange={(event) => setNodeFilter(event.target.value)}
              />
            </label>
            <select
              className="mt-1 h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              value={selectedBatteryNodeNum !== null ? `direct:${selectedBatteryNodeNum}` : ""}
              onChange={(event) => {
                const value = event.target.value;
                if (!value) setSelectedBatteryNodeNum(null);
                else setSelectedBatteryNodeNum(Number(value.split(":")[1]));
              }}
            >
              <option value="">All nodes</option>
              {(() => {
                const q = nodeFilter?.trim();
                const direct = nodeOptions.map((n) => ({
                  label:
                    n.shortName ??
                    (n.nameHex ? `!${n.nameHex.toUpperCase()}` : t("unknown.shortName")),
                  value: `direct:${n.num}`,
                }));
                if (!q) {
                  return direct.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label} ({option.value.split(":")[1]})
                    </option>
                  ));
                }

                const nodesForFilter = nodeOptions.map((option) => ({
                  num: option.num,
                  user: { shortName: option.shortName, longName: option.longName },
                }));
                const matched = filterNodesByQuery(nodesForFilter, q) as { num: number }[];
                const matchedSet = new Set(matched.map((node) => node.num));
                return direct
                  .filter((option) => matchedSet.has(Number(option.value.split(":")[1])))
                  .map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label} ({option.value.split(":")[1]})
                    </option>
                  ));
              })()}
            </select>
          </div>
        )}
      </div>

      <div className="grid gap-2 md:grid-cols-3 items-center">
        <label className="flex items-center gap-2 md:col-span-3">
          <input
            type="checkbox"
            checked={batteryCfg.enabled}
            onChange={(event) => onBatterySettingChange({ enabled: event.target.checked })}
          />
          <span className="ml-1">Enable low battery notifications</span>
        </label>
        <div className="md:col-span-1">
          <label htmlFor="battery-threshold" className="block text-xs text-text-secondary">
            Battery % threshold
          </label>
          <input
            type="number"
            id="battery-threshold"
            min={0}
            max={100}
            value={batteryCfg.batteryPercentThreshold}
            onChange={(event) =>
              onBatterySettingChange({ batteryPercentThreshold: Number(event.target.value) })
            }
            className="h-8 w-56 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        <div className="md:col-span-1">
          <label htmlFor="voltage-threshold" className="block text-xs text-text-secondary">
            Voltage threshold (V)
          </label>
          <input
            id="voltage-threshold"
            type="number"
            min={0}
            step={0.01}
            value={batteryCfg.voltageThreshold}
            onChange={(event) =>
              onBatterySettingChange({ voltageThreshold: Number(event.target.value) })
            }
            className="h-8 w-56 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
      </div>
    </div>
  );
}

export default BatteryAlertsPanel;
