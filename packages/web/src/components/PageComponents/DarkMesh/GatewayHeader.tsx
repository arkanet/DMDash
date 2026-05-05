import { useDarkMeshStore } from "@app/darkmesh/store.ts";
import { useTheme } from "@core/hooks/useTheme.ts";
import { useAppStore } from "@core/stores";
import { cn } from "@core/utils/cn.ts";
import { useEffect, useRef, useState } from "react";
import { getMissingMetricTone, type SignalTone } from "./theme.ts";

interface GatewayHeaderProps {
  className?: string;
}

export const SNR_GOOD_THRESHOLD = -7;
export const SNR_FAIR_THRESHOLD = -15;
export const RSSI_GOOD_THRESHOLD = -115;
export const RSSI_FAIR_THRESHOLD = -126;
const CONFIDENCE_GOOD_MIN = 80;
const CONFIDENCE_FAIR_MIN = 60;
const CONFIDENCE_BAD_MIN = 30;

export function getSnrTone(value?: number): SignalTone {
  if (value === undefined) {
    return {
      background: "rgba(255,255,255,0.08)",
      label: "rgba(228,228,231,0.7)",
      value: "rgba(244,244,245,0.92)",
    };
  }

  if (value > SNR_GOOD_THRESHOLD) {
    return {
      background: "rgba(74, 222, 128, 0.75)",
      label: "rgba(10, 10, 10, 0.7)",
      value: "rgba(10, 10, 10, 0.94)",
    };
  }

  if (value > SNR_FAIR_THRESHOLD) {
    return {
      background: "rgba(250, 204, 21, 0.75)",
      label: "rgba(24, 24, 27, 0.72)",
      value: "rgba(24, 24, 27, 0.95)",
    };
  }

  return {
    background: "rgba(248, 113, 113, 0.75)",
    label: "rgba(24, 24, 27, 0.72)",
    value: "rgba(24, 24, 27, 0.95)",
  };
}

export function getRssiTone(value?: number): SignalTone {
  if (value === undefined) {
    return {
      background: "rgba(255,255,255,0.08)",
      label: "rgba(228,228,231,0.7)",
      value: "rgba(244,244,245,0.92)",
    };
  }

  if (value > RSSI_GOOD_THRESHOLD) {
    return {
      background: "rgba(74, 222, 128, 0.75)",
      label: "rgba(10, 10, 10, 0.7)",
      value: "rgba(10, 10, 10, 0.94)",
    };
  }

  if (value > RSSI_FAIR_THRESHOLD) {
    return {
      background: "rgba(250, 204, 21, 0.75)",
      label: "rgba(24, 24, 27, 0.72)",
      value: "rgba(24, 24, 27, 0.95)",
    };
  }

  return {
    background: "rgba(248, 113, 113, 0.75)",
    label: "rgba(24, 24, 27, 0.72)",
    value: "rgba(24, 24, 27, 0.95)",
  };
}

function getConfidenceTone(value?: number): SignalTone {
  if (value === undefined) {
    return {
      background: "rgba(255,255,255,0.08)",
      label: "rgba(228,228,231,0.7)",
      value: "rgba(244,244,245,0.92)",
    };
  }

  const normalized = Math.max(0, Math.min(100, value));

  if (normalized >= CONFIDENCE_GOOD_MIN) {
    return {
      background: "rgba(0, 255, 0, 0.75)",
      label: "rgba(10, 10, 10, 0.7)",
      value: "rgba(10, 10, 10, 0.94)",
    };
  }

  if (normalized >= CONFIDENCE_FAIR_MIN) {
    return {
      background: "rgba(255, 230, 0, 0.75)",
      label: "rgba(24, 24, 27, 0.72)",
      value: "rgba(24, 24, 27, 0.95)",
    };
  }

  if (normalized >= CONFIDENCE_BAD_MIN) {
    return {
      background: "rgba(247, 147, 26, 0.75)",
      label: "rgba(24, 24, 27, 0.72)",
      value: "rgba(24, 24, 27, 0.95)",
    };
  }

  return {
    background: "rgba(236, 55, 0, 0.75)",
    label: "rgba(24, 24, 27, 0.72)",
    value: "rgba(24, 24, 27, 0.95)",
  };
}

function formatSnr(value?: number): string {
  if (value === undefined) {
    return "n/a";
  }

  return `${value.toFixed(1).replace(/\.0$/, "")} dB`;
}

function formatRssi(value?: number): string {
  if (value === undefined) {
    return "n/a";
  }

  return `${value} dBm`;
}

function formatPercent(value?: number, digits = 2): string {
  if (value === undefined) return "n/a";
  return `${value.toFixed(digits)}%`;
}

function getAirTone(value?: number): SignalTone {
  if (value === undefined) {
    return {
      background: "rgba(255,255,255,0.08)",
      label: "rgba(228,228,231,0.7)",
      value: "rgba(244,244,245,0.92)",
    };
  }

  // Map percent 0..10 (air limit) to hue using same logic as NodeMetricsChart
  const airLimit = 10;
  const pct = Math.min(Math.max(value, 0), airLimit) / airLimit;
  // reuse a simple hue-from-segments like NodeMetricsChart
  const hue = (() => {
    const t = Math.min(Math.max(pct, 0), 1);
    if (t <= 1 / 3) {
      const local = t / (1 / 3);
      return 120 - (120 - 60) * local;
    } else if (t <= 2 / 3) {
      const local = (t - 1 / 3) / (1 / 3);
      return 60 - (60 - 30) * local;
    }
    const local = (t - 2 / 3) / (1 / 3);
    return 30 - 30 * local;
  })();

  const bg = `hsl(${Math.round(hue)} 85% 45%)`;
  return { background: bg, label: "rgba(10, 10, 10, 0.7)", value: "rgba(10, 10, 10, 0.94)" };
}

function getChannelTone(value?: number): SignalTone {
  if (value === undefined) {
    return {
      background: "rgba(255,255,255,0.08)",
      label: "rgba(228,228,231,0.7)",
      value: "rgba(244,244,245,0.92)",
    };
  }

  // channel utilization 0..100 -> hue
  const t = Math.min(Math.max(value / 100, 0), 1);
  let hue: number;
  if (t <= 1 / 3) {
    const local = t / (1 / 3);
    hue = 120 - (120 - 60) * local;
  } else if (t <= 2 / 3) {
    const local = (t - 1 / 3) / (1 / 3);
    hue = 60 - (60 - 30) * local;
  } else {
    const local = (t - 2 / 3) / (1 / 3);
    hue = 30 - 30 * local;
  }

  const bg = `hsl(${Math.round(hue)} 85% 45%)`;
  return { background: bg, label: "rgba(10, 10, 10, 0.7)", value: "rgba(10, 10, 10, 0.94)" };
}

function formatConfidence(value?: number): string {
  if (value === undefined) {
    return "n/a";
  }

  return `${Math.max(0, Math.min(100, value))}%`;
}

function SignalMetric({
  label,
  value,
  tone,
  isDarkTheme,
  className,
}: {
  label: string;
  value: string;
  tone: SignalTone;
  isDarkTheme: boolean;
  className?: string;
}) {
  const effectiveTone = value === "n/a" ? getMissingMetricTone(isDarkTheme) : tone;

  return (
    <div
      className={cn("flex flex-1 flex-col justify-center rounded-xl px-2.5 py-1.5", className)}
      style={{ backgroundColor: effectiveTone.background }}
    >
      <div
        className="text-[0.7rem] uppercase tracking-[0.14em] md:text-[10px]"
        style={{ color: effectiveTone.label }}
      >
        {label}
      </div>
      <div
        className="mt-0.5 text-[0.7rem] font-semibold md:text-[0.8125rem]"
        style={{ color: effectiveTone.value }}
      >
        {value}
      </div>
    </div>
  );
}

export function GatewayHeader({ className }: GatewayHeaderProps) {
  const { theme } = useTheme();
  const selectedDeviceId = useAppStore((state) => state.selectedDeviceId);
  const gatewaysByDevice = useDarkMeshStore((state) => state.gatewaysByDevice);
  const gateway = selectedDeviceId !== undefined ? gatewaysByDevice[selectedDeviceId] : undefined;
  const [highlight, setHighlight] = useState(false);
  const lastObservedAtRef = useRef<number | undefined>(gateway?.observedAt);
  const isDarkTheme = theme === "dark";

  useEffect(() => {
    if (!gateway?.observedAt || lastObservedAtRef.current === gateway.observedAt) {
      return;
    }

    lastObservedAtRef.current = gateway.observedAt;
    setHighlight(true);

    const timeoutId = window.setTimeout(() => {
      setHighlight(false);
    }, 1100);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [gateway?.observedAt]);

  const snrTone =
    gateway?.rxSnr === undefined ? getMissingMetricTone(isDarkTheme) : getSnrTone(gateway?.rxSnr);
  const rssiTone =
    gateway?.rxRssi === undefined
      ? getMissingMetricTone(isDarkTheme)
      : getRssiTone(gateway?.rxRssi);
  const confidenceTone =
    gateway?.confidence === undefined
      ? getMissingMetricTone(isDarkTheme)
      : getConfidenceTone(gateway?.confidence);

  return (
    <div className={cn("w-full", className)}>
      <div
        className={cn(
          "flex min-h-[92px] w-full overflow-hidden rounded-2xl border transition-[border-color,box-shadow] duration-500",
          highlight ? "border-emerald-400" : "border-zinc-800",
        )}
        style={{
          backgroundColor: `var(--gateway-bg, ${isDarkTheme ? "#222" : "#f1f1f1"})`,
          ...(highlight
            ? {
                boxShadow:
                  "0 0 0 1px rgba(52,211,153,0.58), 0 0 18px rgba(52,211,153,0.75), 0 0 34px rgba(16,185,129,0.34)",
              }
            : {}),
        }}
      >
        <div
          className={cn(
            "flex min-w-0 flex-1 flex-col justify-center border-r-0 px-3.5 py-3",
            isDarkTheme ? "text-zinc-100" : "text-zinc-900",
          )}
          style={{
            color: isDarkTheme
              ? `var(--color-zinc-100, ${"#e6eef8"})`
              : `var(--color-gray-800, ${"#0b1220"})`,
          }}
        >
          <div
            className={cn(
              "truncate text-[0.7rem] font-semibold md:text-[1rem]",
              isDarkTheme ? "text-zinc-100" : "text-gray-800",
            )}
            style={{
              color: isDarkTheme
                ? `var(--color-zinc-100, ${"#e6eef8"})`
                : `var(--color-gray-800, ${"#0b1220"})`,
            }}
          >
            {gateway?.nodeName ?? "No gateway detected yet"}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[0.7rem] md:text-[0.8125rem]">
            <span className={isDarkTheme ? "text-zinc-400" : "text-zinc-600"}>
              Gateway Relay Confidence:
            </span>
            <span
              className="rounded-md px-1.5 py-0.5 font-semibold"
              style={{
                backgroundColor: confidenceTone.background,
                color: confidenceTone.value,
              }}
            >
              {formatConfidence(gateway?.confidence)}
            </span>
          </div>
        </div>

        <div
          className="flex w-fit shrink-0 gap-1 items-center p-0.5"
          style={{
            backgroundColor: `var(--gateway-bg, ${isDarkTheme ? "#222" : "#f1f1f1"})`,
          }}
        >
          <SignalMetric
            label="SNR"
            value={formatSnr(gateway?.rxSnr)}
            tone={snrTone}
            isDarkTheme={isDarkTheme}
            className="mr-1 mb-1 w-30"
          />

          <SignalMetric
            label="RSSI"
            value={formatRssi(gateway?.rxRssi)}
            tone={rssiTone}
            isDarkTheme={isDarkTheme}
            className="mr-1 mb-1 w-30"
          />

          <SignalMetric
            label="AirUtl"
            value={formatPercent(gateway?.deviceMetrics?.airUtilTx)}
            tone={
              gateway?.deviceMetrics?.airUtilTx === undefined
                ? getMissingMetricTone(isDarkTheme)
                : getAirTone(gateway?.deviceMetrics?.airUtilTx)
            }
            isDarkTheme={isDarkTheme}
            className="mr-1 mb-1"
          />

          <SignalMetric
            label="ChUtl"
            value={formatPercent(gateway?.deviceMetrics?.channelUtilization)}
            tone={
              gateway?.deviceMetrics?.channelUtilization === undefined
                ? getMissingMetricTone(isDarkTheme)
                : getChannelTone(gateway?.deviceMetrics?.channelUtilization)
            }
            isDarkTheme={isDarkTheme}
            className="mr-1 mb-1"
          />
        </div>
      </div>
    </div>
  );
}
