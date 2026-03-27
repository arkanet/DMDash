import { useDarkMeshStore } from "@app/darkmesh/store.ts";
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

function SignalMetric({ label, value, tone }: { label: string; value: string; tone: SignalTone }) {
  return (
    <div
      className="flex flex-1 flex-col justify-center rounded-xl px-3 py-2"
      style={{ backgroundColor: tone.background }}
    >
      <div
        className="text-xs uppercase tracking-[0.16em] md:text-[11px]"
        style={{ color: tone.label }}
      >
        {label}
      </div>
      <div className="mt-1 text-xs font-semibold md:text-sm" style={{ color: tone.value }}>
        {value}
      </div>
    </div>
  );
}

export function GatewayHeader({ className }: GatewayHeaderProps) {
  const selectedDeviceId = useAppStore((state) => state.selectedDeviceId);
  const gateway = useDarkMeshStore((state) =>
    selectedDeviceId !== undefined ? state.gatewaysByDevice[selectedDeviceId] : undefined,
  );
  const [highlight, setHighlight] = useState(false);
  const lastObservedAtRef = useRef<number | undefined>(gateway?.observedAt);

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

  return (
    <div className={cn("w-full", className)}>
      <div
        className={cn(
          "flex min-h-[102px] w-full overflow-hidden rounded-2xl border bg-zinc-950/96 transition-[border-color,box-shadow] duration-500",
          highlight ? "border-emerald-400" : "border-zinc-800",
        )}
        style={
          highlight
            ? {
                boxShadow:
                  "0 0 0 1px rgba(52,211,153,0.58), 0 0 18px rgba(52,211,153,0.75), 0 0 34px rgba(16,185,129,0.34)",
              }
            : undefined
        }
      >
        <div className="flex min-w-0 flex-1 flex-col justify-center border-r-0 px-4 py-4 text-zinc-100">
          <div className="text-xs uppercase tracking-[0.18em] text-zinc-400">
            Last detected gateway
          </div>
          <div className="mt-2 truncate text-xs font-semibold text-zinc-100 md:text-lg">
            {gateway?.nodeName ?? "No gateway detected yet"}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs md:text-sm">
            <span className="text-zinc-400">Gateway Relay Confidence:</span>
            <span
              className="rounded-md px-2 py-1 font-semibold"
              style={{
                backgroundColor: confidenceTone.background,
                color: confidenceTone.value,
              }}
            >
              {formatConfidence(gateway?.confidence)}
            </span>
          </div>
        </div>

        <div className="flex w-fit shrink-0 flex-col gap-px bg-white/5 p-1">
          <SignalMetric label="RSSI" value={formatRssi(gateway?.rxRssi)} tone={rssiTone} />
          <SignalMetric label="SNR" value={formatSnr(gateway?.rxSnr)} tone={snrTone} />
        </div>
      </div>
    </div>
  );
}
