import { useDarkMeshStore } from "@app/darkmesh/store.ts";
import { getNodeShortName } from "@app/darkmesh/utils.ts";
import { useTheme } from "@core/hooks/useTheme.ts";
import { useAppStore, useNodeDB } from "@core/stores";
import { cn } from "@core/utils/cn.ts";
import { getColorFromNodeNum, isLightColor } from "@core/utils/color.ts";
import { type CSSProperties, useEffect, useRef, useState } from "react";
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
const CHANNEL_UTIL_GOOD_MAX = 25;
const CHANNEL_UTIL_FAIR_MAX = 50;
const AIR_UTIL_GOOD_MAX = 3;
const AIR_UTIL_FAIR_MAX = 6;
const AIR_UTIL_BAD_MAX = 10;

const qualityTone = {
  good: {
    background: "rgb(0, 255, 0)",
    label: "rgba(10, 10, 10, 0.7)",
    value: "rgba(10, 10, 10, 0.94)",
  },
  fair: {
    background: "rgb(255, 255, 0)",
    label: "rgba(24, 24, 27, 0.72)",
    value: "rgba(24, 24, 27, 0.95)",
  },
  bad: {
    background: "rgb(247, 147, 26)",
    label: "rgba(24, 24, 27, 0.72)",
    value: "rgba(24, 24, 27, 0.95)",
  },
  reallyBad: {
    background: "rgb(236, 55, 0)",
    label: "rgba(24, 24, 27, 0.72)",
    value: "rgba(24, 24, 27, 0.95)",
  },
} satisfies Record<string, SignalTone>;

export function getSnrTone(value?: number): SignalTone {
  if (value === undefined) {
    return {
      background: "rgba(255,255,255,0.08)",
      label: "rgba(228,228,231,0.7)",
      value: "rgba(244,244,245,0.92)",
    };
  }

  if (value > SNR_GOOD_THRESHOLD) {
    return qualityTone.good;
  }

  if (value > SNR_FAIR_THRESHOLD) {
    return qualityTone.fair;
  }

  return qualityTone.bad;
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
    return qualityTone.good;
  }

  if (value > RSSI_FAIR_THRESHOLD) {
    return qualityTone.fair;
  }

  return qualityTone.bad;
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
    return qualityTone.good;
  }

  if (normalized >= CONFIDENCE_FAIR_MIN) {
    return qualityTone.fair;
  }

  if (normalized >= CONFIDENCE_BAD_MIN) {
    return qualityTone.bad;
  }

  return qualityTone.reallyBad;
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

  if (value <= AIR_UTIL_GOOD_MAX) return qualityTone.good;
  if (value <= AIR_UTIL_FAIR_MAX) return qualityTone.fair;
  if (value <= AIR_UTIL_BAD_MAX) return qualityTone.bad;
  return qualityTone.reallyBad;
}

function getChannelTone(value?: number): SignalTone {
  if (value === undefined) {
    return {
      background: "rgba(255,255,255,0.08)",
      label: "rgba(228,228,231,0.7)",
      value: "rgba(244,244,245,0.92)",
    };
  }

  if (value <= CHANNEL_UTIL_GOOD_MAX) return qualityTone.good;
  if (value <= CHANNEL_UTIL_FAIR_MAX) return qualityTone.fair;
  return qualityTone.bad;
}

function formatConfidence(value?: number): string {
  if (value === undefined) {
    return "n/a";
  }

  return `${Math.max(0, Math.min(100, value))}%`;
}

function formatGatewayTime(value?: number): string {
  if (value === undefined || !Number.isFinite(value)) {
    return "--:--:--";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function getSimplifiedAvatarStyle(nodeNum?: number): CSSProperties {
  if (nodeNum === undefined) {
    return {
      backgroundColor: "rgba(255,255,255,0.08)",
      color: "rgba(244,244,245,0.92)",
    };
  }

  const bg = getColorFromNodeNum(nodeNum);

  return {
    backgroundColor: `rgb(${bg.r}, ${bg.g}, ${bg.b})`,
    color: isLightColor(bg) ? "#0b0b0b" : "#ffffff",
  };
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
      className={cn(
        "flex flex-1 flex-col items-center justify-center rounded-xl px-2.5 py-1.5 text-center max-md:rounded-md max-md:px-1 max-md:py-0.5",
        className,
      )}
      style={{ backgroundColor: effectiveTone.background }}
    >
      <div
        className="whitespace-nowrap text-center text-[0.6rem] uppercase tracking-[0.14em] md:text-[10px]"
        style={{ color: effectiveTone.label }}
      >
        {label}
      </div>
      <div
        className="mt-0.5 whitespace-nowrap text-center text-[0.62rem] font-semibold md:text-[0.8125rem]"
        style={{ color: effectiveTone.value }}
      >
        {value}
      </div>
    </div>
  );
}

function GatewayMobileMetric({
  label,
  value,
  tone,
  isDarkTheme,
}: {
  label: string;
  value: string;
  tone: SignalTone;
  isDarkTheme: boolean;
}) {
  const effectiveTone = value === "n/a" ? getMissingMetricTone(isDarkTheme) : tone;

  return (
    <div
      className="flex min-h-8 min-w-0 items-center justify-center rounded-md px-2 py-1 text-center text-[0.74rem] font-semibold leading-tight"
      style={{
        backgroundColor: effectiveTone.background,
        color: effectiveTone.value,
      }}
    >
      <span className="truncate">
        {label} {value}
      </span>
    </div>
  );
}

export function GatewayHeader({ className }: GatewayHeaderProps) {
  const { theme } = useTheme();
  const selectedDeviceId = useAppStore((state) => state.selectedDeviceId);
  const gatewaysByDevice = useDarkMeshStore((state) => state.gatewaysByDevice);
  const gateway = selectedDeviceId !== undefined ? gatewaysByDevice[selectedDeviceId] : undefined;
  const gatewayNode = useNodeDB((nodeDB) =>
    gateway?.nodeNum === undefined ? undefined : nodeDB.getNode(gateway.nodeNum),
  );
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
  const airUtil = gateway?.deviceMetrics?.airUtilTx;
  const channelUtil = gateway?.deviceMetrics?.channelUtilization;
  const airTone = airUtil === undefined ? getMissingMetricTone(isDarkTheme) : getAirTone(airUtil);
  const channelTone =
    channelUtil === undefined ? getMissingMetricTone(isDarkTheme) : getChannelTone(channelUtil);
  const gatewayShortName =
    getNodeShortName(gatewayNode) ??
    (gateway?.nodeName ? gateway.nodeName.trim().slice(0, 4).toUpperCase() : "----");

  return (
    <div className={cn("w-full", className)}>
      <div
        className={cn(
          "flex w-full flex-col gap-2 overflow-hidden rounded-2xl border p-2 transition-[border-color,box-shadow] duration-500 md:hidden",
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
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="shrink-0 rounded-full px-2.5 py-1 text-[0.76rem] font-semibold leading-none"
            style={getSimplifiedAvatarStyle(gateway?.nodeNum)}
          >
            {gatewayShortName}
          </span>
          <span
            className={cn(
              "shrink-0 whitespace-nowrap text-[0.72rem]",
              isDarkTheme ? "text-zinc-100" : "text-zinc-800",
            )}
          >
            Relay Confidence :
          </span>
          <span
            className="shrink-0 rounded-md px-2 py-1 text-[0.76rem] font-semibold leading-none"
            style={{
              backgroundColor: confidenceTone.background,
              color: confidenceTone.value,
            }}
          >
            {formatConfidence(gateway?.confidence)}
          </span>
          <span
            className={cn(
              "ml-auto shrink-0 text-[0.72rem]",
              isDarkTheme ? "text-zinc-100" : "text-zinc-800",
            )}
          >
            {formatGatewayTime(gateway?.observedAt)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <GatewayMobileMetric
            label="SNR"
            value={formatSnr(gateway?.rxSnr)}
            tone={snrTone}
            isDarkTheme={isDarkTheme}
          />
          <GatewayMobileMetric
            label="RSSI"
            value={formatRssi(gateway?.rxRssi)}
            tone={rssiTone}
            isDarkTheme={isDarkTheme}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <GatewayMobileMetric
            label="ChUtil"
            value={formatPercent(channelUtil, 1)}
            tone={channelTone}
            isDarkTheme={isDarkTheme}
          />
          <GatewayMobileMetric
            label="AirUtil"
            value={formatPercent(airUtil, 1)}
            tone={airTone}
            isDarkTheme={isDarkTheme}
          />
        </div>
      </div>

      <div
        className={cn(
          "hidden min-h-[92px] w-full flex-row overflow-hidden rounded-2xl border transition-[border-color,box-shadow] duration-500 md:flex",
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
            "flex min-w-0 flex-1 flex-col justify-center border-r-0 px-3.5 py-3 md:scale-90",
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
              "text-[0.8rem] font-semibold md:text-[1rem]",
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
          <div className="mt-1 flex w-full flex-nowrap items-center gap-2 text-[0.68rem] md:mt-1.5 md:w-auto md:text-[0.8125rem]">
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
          className="ml-auto flex w-fit max-w-none shrink-0 items-center p-0.5 text-center"
          style={{
            backgroundColor: `var(--gateway-bg, ${isDarkTheme ? "#222" : "#f1f1f1"})`,
          }}
        >
          <div className="flex min-w-0 flex-col gap-1 md:contents">
            <SignalMetric
              label="SNR"
              value={formatSnr(gateway?.rxSnr)}
              tone={snrTone}
              isDarkTheme={isDarkTheme}
              className="min-w-0 md:mr-1 md:mb-1 md:scale-90"
            />

            <SignalMetric
              label="RSSI"
              value={formatRssi(gateway?.rxRssi)}
              tone={rssiTone}
              isDarkTheme={isDarkTheme}
              className="min-w-0 md:mr-1 md:mb-1 md:scale-90"
            />
          </div>

          <div className="flex min-w-0 flex-col gap-1 md:contents">
            <SignalMetric
              label="AirUtl"
              value={formatPercent(airUtil)}
              tone={airTone}
              isDarkTheme={isDarkTheme}
              className="min-w-0 md:mr-1 md:mb-1 md:scale-90"
            />

            <SignalMetric
              label="ChUtl"
              value={formatPercent(channelUtil)}
              tone={channelTone}
              isDarkTheme={isDarkTheme}
              className="min-w-0 md:mr-1 md:mb-1 md:scale-90"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
