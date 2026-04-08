import { cn } from "@core/utils/cn.ts";
import { useNodeDB } from "@core/stores";
import type { Protobuf } from "@meshtastic/core";
import { numberToHexUnpadded } from "@noble/curves/abstract/utils";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

type SortBy = "name" | "hex" | "snr";
type SortDir = "asc" | "desc";

interface NeighborInfoPanelProps {
  nodeNum: number;
  neighborInfo?: Protobuf.Mesh.NeighborInfo;
  className?: string;
  title?: string;
  dense?: boolean;
  onOpenNode?: (nodeNum: number) => void;
}

interface EnvironmentMetricsPanelProps {
  metrics?: Protobuf.Telemetry.EnvironmentMetrics;
  className?: string;
  title?: string;
  dense?: boolean;
}

function formatMetricValue(
  label: string,
  value: number | undefined,
  unit?: string,
  transform?: (raw: number) => number,
) {
  if (value === undefined) {
    return undefined;
  }

  const normalized = transform ? transform(value) : value;
  const decimals = Number.isInteger(normalized) ? 0 : 1;
  return {
    label,
    value: `${normalized.toFixed(decimals)}${unit ?? ""}`,
  };
}

export function NeighborInfoPanel({
  nodeNum,
  neighborInfo,
  className,
  title,
  dense = false,
  onOpenNode,
}: NeighborInfoPanelProps) {
  const { t } = useTranslation("dialog");
  const { getNode } = useNodeDB();
  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const sortedNeighbors = useMemo(() => {
    const neighbors = (neighborInfo?.neighbors ?? []).slice();

    neighbors.sort((left, right) => {
      const leftName = getNode(left.nodeId)?.user?.shortName ?? String(left.nodeId);
      const rightName = getNode(right.nodeId)?.user?.shortName ?? String(right.nodeId);
      const leftHex = numberToHexUnpadded(left.nodeId);
      const rightHex = numberToHexUnpadded(right.nodeId);
      const leftSnr = typeof left.snr === "number" ? left.snr : Number.NEGATIVE_INFINITY;
      const rightSnr = typeof right.snr === "number" ? right.snr : Number.NEGATIVE_INFINITY;

      let comparison = 0;
      if (sortBy === "name") {
        comparison = leftName.localeCompare(rightName);
      } else if (sortBy === "hex") {
        comparison = leftHex.localeCompare(rightHex);
      } else {
        comparison = leftSnr === rightSnr ? 0 : leftSnr < rightSnr ? -1 : 1;
      }

      return sortDir === "asc" ? comparison : -comparison;
    });

    return neighbors;
  }, [getNode, neighborInfo?.neighbors, sortBy, sortDir]);

  function toggleSort(nextSort: SortBy, nextDir: SortDir) {
    if (sortBy === nextSort) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
      return;
    }

    setSortBy(nextSort);
    setSortDir(nextDir);
  }

  return (
    <div
      className={cn(
        "rounded-lg bg-slate-100 p-3 text-slate-900 dark:bg-slate-800 dark:text-slate-500",
        className,
      )}
    >
      <p className={cn("font-semibold", dense ? "text-sm" : "text-base")}>
        {title ?? t("nodeDetails.neighborPanel", "Neighbor Info")}
      </p>

      {!neighborInfo || sortedNeighbors.length === 0 ? (
        <p className={cn("mt-2 text-slate-600 dark:text-slate-400", dense ? "text-xs" : "text-sm")}>
          {t("nodeDetail.neighbor.noData", "No neighbor info")}
        </p>
      ) : (
        <div className="mt-2">
          <div className={cn("mb-2 grid grid-cols-3 gap-2", dense ? "text-[11px]" : "text-xs")}>
            <button
              type="button"
              className="text-left font-medium"
              onClick={() => toggleSort("name", "asc")}
            >
              {t("nodeDetail.neighbor.node", "Node")}{" "}
              {sortBy === "name" ? (sortDir === "asc" ? "▲" : "▼") : ""}
            </button>
            <button
              type="button"
              className="text-center font-medium"
              onClick={() => toggleSort("hex", "asc")}
            >
              HEX {sortBy === "hex" ? (sortDir === "asc" ? "▲" : "▼") : ""}
            </button>
            <button
              type="button"
              className="text-right font-medium"
              onClick={() => toggleSort("snr", "desc")}
            >
              {t("nodeDetail.neighbor.snr", "SNR")}{" "}
              {sortBy === "snr" ? (sortDir === "asc" ? "▲" : "▼") : ""}
            </button>
          </div>

          <ul className="space-y-2">
            {sortedNeighbors.map((neighbor) => {
              const shortName =
                getNode(neighbor.nodeId)?.user?.shortName ?? String(neighbor.nodeId);
              const hex = `!${numberToHexUnpadded(neighbor.nodeId)}`;
              const snr = typeof neighbor.snr === "number" ? neighbor.snr.toFixed(2) : "-";

              return (
                <li
                  key={`${nodeNum}-${neighbor.nodeId}`}
                  className="rounded-md bg-white/60 px-2 py-1 dark:bg-black/10"
                >
                  <div
                    className={cn(
                      "grid grid-cols-3 items-center gap-2",
                      dense ? "text-[11px]" : "text-xs",
                    )}
                  >
                    <button
                      type="button"
                      className="truncate text-left text-left"
                      onClick={() => onOpenNode?.(neighbor.nodeId)}
                    >
                      {shortName}
                    </button>
                    <button
                      type="button"
                      className="text-center"
                      onClick={() => onOpenNode?.(neighbor.nodeId)}
                    >
                      {hex}
                    </button>
                    <div className="text-right">{snr}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

export function EnvironmentMetricsPanel({
  metrics,
  className,
  title,
  dense = false,
}: EnvironmentMetricsPanelProps) {
  const { t } = useTranslation("dialog");

  const entries = useMemo(
    () =>
      [
        formatMetricValue(
          t("nodeDetail.metrics.temperature", "Temperature"),
          metrics?.temperature,
          "°C",
        ),
        formatMetricValue(
          t("nodeDetail.metrics.humidity", "Humidity"),
          metrics?.relativeHumidity,
          "%",
        ),
        formatMetricValue(
          t("nodeDetail.metrics.pressure", "Pressure"),
          metrics?.barometricPressure,
          " hPa",
        ),
        formatMetricValue(t("nodeDetail.metrics.iaq", "IAQ"), metrics?.iaq),
        formatMetricValue(
          t("nodeDetail.metrics.windSpeed", "Wind Speed"),
          metrics?.windSpeed,
          " km/h",
          (value) => value * 3.6,
        ),
        formatMetricValue(
          t("nodeDetail.metrics.windDirection", "Wind Dir"),
          metrics?.windDirection,
          "°",
        ),
        formatMetricValue(t("nodeDetails.voltage", "Voltage"), metrics?.voltage, "V"),
        formatMetricValue(t("nodeDetails.current", "Current"), metrics?.current, "A"),
        formatMetricValue(t("nodeDetail.metrics.rain1h", "Rain 1h"), metrics?.rainfall1h, " mm"),
        formatMetricValue(t("nodeDetail.metrics.rain24h", "Rain 24h"), metrics?.rainfall24h, " mm"),
        formatMetricValue(
          t("nodeDetail.metrics.soilMoisture", "Soil Moisture"),
          metrics?.soilMoisture,
          "%",
        ),
        formatMetricValue(
          t("nodeDetail.metrics.soilTemperature", "Soil Temp"),
          metrics?.soilTemperature,
          "°C",
        ),
      ].filter((entry): entry is { label: string; value: string } => Boolean(entry)),
    [metrics, t],
  );

  return (
    <div
      className={cn(
        "rounded-lg bg-slate-100 p-3 text-slate-900 dark:bg-slate-800 dark:text-slate-500",
        className,
      )}
    >
      <p className={cn("font-semibold", dense ? "text-sm" : "text-base")}>
        {title ?? t("nodeDetails.metricsPanel", "Environmental Metrics")}
      </p>

      {entries.length === 0 ? (
        <p className={cn("mt-2 text-slate-600 dark:text-slate-400", dense ? "text-xs" : "text-sm")}>
          {t("nodeDetail.metrics.noData", "No metrics available")}
        </p>
      ) : (
        <div className="mt-2 overflow-auto">
          <table className="w-full table-fixed">
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.label} className="align-top">
                  <td className={cn("pr-2 font-medium", dense ? "text-[11px]" : "text-xs")}>
                    {entry.label}
                  </td>
                  <td className={cn(dense ? "text-[11px]" : "text-xs")}>{entry.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
