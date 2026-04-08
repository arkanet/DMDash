import { useDarkMeshStore } from "@app/darkmesh/store.ts";
import { useTheme } from "@core/hooks/useTheme.ts";
import { useAppStore } from "@core/stores";
import { cn } from "@core/utils/cn.ts";
import { useEffect, useRef, useState } from "react";

interface GatewayHeaderProps {
  className?: string;
}

const SNR_GOOD_THRESHOLD = -7;
const SNR_FAIR_THRESHOLD = -15;
const RSSI_GOOD_THRESHOLD = -115;
const RSSI_FAIR_THRESHOLD = -126;
const CONFIDENCE_GOOD_MIN = 80;
const CONFIDENCE_FAIR_MIN = 60;
const CONFIDENCE_BAD_MIN = 30;

type SignalTone = {
  background: string;
  label: string;
  value: string;
};

function getSnrTone(value?: number): SignalTone {
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

function getRssiTone(value?: number): SignalTone {
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
  className,
}: {
  label: string;
  value: string;
  tone: SignalTone;
  className?: string;
}) {
  return (
    <div
      className={cn("flex flex-1 flex-col justify-center rounded-xl px-2.5 py-1.5", className)}
      style={{ backgroundColor: tone.background }}
    >
      <div
        className="text-[0.7rem] uppercase tracking-[0.14em] md:text-[10px]"
        style={{ color: tone.label }}
      >
        {label}
      </div>
      <div
        className="mt-0.5 text-[0.7rem] font-semibold md:text-[0.8125rem]"
        style={{ color: tone.value }}
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

  const snrTone = getSnrTone(gateway?.rxSnr);
  const rssiTone = getRssiTone(gateway?.rxRssi);
  const confidenceTone = getConfidenceTone(gateway?.confidence);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const computed = getComputedStyle(root);
    // If gateway vars are not defined, set sensible night defaults (device default = night)
    if (!computed.getPropertyValue("--gateway-bg")) {
      root.style.setProperty("--gateway-bg", "#222");
    }
    if (!computed.getPropertyValue("--color-zinc-100")) {
      root.style.setProperty("--color-zinc-100", "#e6eef8");
    }
    if (!computed.getPropertyValue("--color-gray-800")) {
      root.style.setProperty("--color-gray-800", "#1f2937");
    }
  }, []);

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
          className="flex w-fit shrink-0 flex-col p-0.5"
          style={{
            backgroundColor: `var(--gateway-bg, ${isDarkTheme ? "#222" : "#f1f1f1"})`,
          }}
        >
          <SignalMetric
            label="RSSI"
            value={formatRssi(gateway?.rxRssi)}
            tone={rssiTone}
            className="mr-1 mb-1 mt-1"
          />
          <SignalMetric
            label="SNR"
            value={formatSnr(gateway?.rxSnr)}
            tone={snrTone}
            className="mr-1 mb-1"
          />
        </div>
      </div>
    </div>
  );
}
