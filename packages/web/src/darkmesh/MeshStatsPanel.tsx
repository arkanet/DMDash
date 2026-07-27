import { Button } from "@components/UI/Button.tsx";
import { useAppStore, useDevice } from "@core/stores";
import {
  isLegacyFirmwareTextCompressionSupported,
  resolveTextCompressionModeForFirmware,
} from "@core/utils/settingsCapabilities.ts";
import { cn } from "@core/utils/cn.ts";
import { defaultMeshStats, useDarkMeshStore, type MessageCompressionMode } from "./store.ts";

function formatMetricNumber(value: number, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits,
  }).format(value);
}

function formatBytes(value: number): string {
  if (value >= 1_000_000) {
    return `${formatMetricNumber(value)} byte - ${formatMetricNumber(value / 1_000_000, 6)} MB`;
  }

  return `${formatMetricNumber(value)} byte`;
}

function formatAirtime(valueMs: number): string {
  return `${formatMetricNumber(valueMs, 0)} Ms - ${formatMetricNumber(valueMs / 1000, 2)} Secs`;
}

interface MeshStatsPanelProps {
  className?: string;
}

export function MeshStatsPanel({ className }: MeshStatsPanelProps) {
  const selectedDeviceId = useAppStore((state) => state.selectedDeviceId);
  const deviceId = selectedDeviceId ?? -1;
  const { metadata } = useDevice();
  const meshStats = useDarkMeshStore(
    (state) => state.meshStatsByDevice?.[deviceId] ?? defaultMeshStats,
  );
  const compressionMode = useDarkMeshStore(
    (state) => state.compressionModeByDevice?.[deviceId] ?? "app",
  );
  const setCompressionMode = useDarkMeshStore((state) => state.setCompressionMode);
  const resetMeshStats = useDarkMeshStore((state) => state.resetMeshStats);

  const localMetadata = metadata.get(0);
  const legacyFirmwareTextCompressionSupported =
    isLegacyFirmwareTextCompressionSupported(localMetadata);
  const effectiveCompressionMode = resolveTextCompressionModeForFirmware(
    compressionMode,
    localMetadata,
  );
  const traceSuccessRate =
    meshStats.traceTotal > 0 ? (meshStats.traceSuccess / meshStats.traceTotal) * 100 : 0;

  return (
    <div className={cn("space-y-4", className)}>
      <label className="block text-sm">
        <span className="mb-1 block text-slate-500 dark:text-slate-400">
          Message compression mode
        </span>
        <select
          className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          value={effectiveCompressionMode}
          onChange={(event) =>
            setCompressionMode(deviceId, event.target.value as MessageCompressionMode)
          }
        >
          <option value="app">App compression (2.7.26+)</option>
          <option value="remote" disabled={!legacyFirmwareTextCompressionSupported}>
            Firmware compression (legacy)
          </option>
        </select>
      </label>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {legacyFirmwareTextCompressionSupported
          ? "Legacy firmware compression is available for older DarkMesh firmware; app compression works with 2.7.26+ and official-compatible firmware."
          : `Firmware ${localMetadata?.firmwareVersion ?? "2.7.26+"} uses app-side compression, so legacy firmware compression is disabled.`}
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-4 text-sm dark:border-zinc-800 dark:bg-zinc-900/70">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold uppercase text-slate-900 dark:text-slate-100">
              Traceroute Stats
            </h4>
            <Button size="sm" variant="outline" onClick={() => resetMeshStats(deviceId, "trace")}>
              Reset
            </Button>
          </div>
          <dl className="grid gap-3">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500 dark:text-slate-400">TOTAL:</dt>
              <dd className="font-medium">{formatMetricNumber(meshStats.traceTotal)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500 dark:text-slate-400">SUCCESS:</dt>
              <dd className="font-medium">{formatMetricNumber(meshStats.traceSuccess)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500 dark:text-slate-400">SUCCESS RATE:</dt>
              <dd className="font-medium">{formatMetricNumber(traceSuccessRate, 2)} %</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500 dark:text-slate-400">LONGEST:</dt>
              <dd className="font-medium">{formatMetricNumber(meshStats.traceLongestKm)} Km</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500 dark:text-slate-400">TOTAL TRAVELED:</dt>
              <dd className="font-medium">{formatMetricNumber(meshStats.traceMaxTraveledKm)} Km</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-4 text-sm dark:border-zinc-800 dark:bg-zinc-900/70">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold uppercase text-slate-900 dark:text-slate-100">
              Compression Stats
            </h4>
            <Button
              size="sm"
              variant="outline"
              onClick={() => resetMeshStats(deviceId, "compression")}
            >
              Reset
            </Button>
          </div>
          <dl className="grid gap-3">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500 dark:text-slate-400">MODE:</dt>
              <dd className="font-medium">
                {effectiveCompressionMode === "app" ? "App" : "Firmware"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500 dark:text-slate-400">SENT TOTAL:</dt>
              <dd className="font-medium">{formatMetricNumber(meshStats.compressionSentTotal)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500 dark:text-slate-400">BYTES SAVED:</dt>
              <dd className="font-medium text-right">
                {formatBytes(meshStats.compressionBytesSaved)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500 dark:text-slate-400">AIRTIME SAVED:</dt>
              <dd className="font-medium text-right">
                {formatAirtime(meshStats.compressionAirtimeSavedMs)}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
