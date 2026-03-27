import { Button } from "@components/UI/Button.tsx";
import { useNodeDB } from "@core/stores";
import { cn } from "@core/utils/cn.ts";
import type { Protobuf, Types } from "@meshtastic/core";
import { numberToHexUnpadded } from "@noble/curves/abstract/utils";
import { useMemo } from "react";

const SNR_GOOD_THRESHOLD = -7;
const SNR_FAIR_THRESHOLD = -15;

interface VisualTracerouteCardProps {
  traceroute: Types.PacketMetadata<Protobuf.Mesh.RouteDiscovery>;
  totalDistance: number;
  onClear: () => void;
  className?: string;
}

type RouteStep = {
  id: string;
  shortName: string;
  nodeHex: string;
  snr?: number;
};

function getSnrBadgeTone(snr?: number) {
  if (snr === undefined) {
    return {
      backgroundColor: "#808080",
      color: "#111827",
    };
  }

  if (snr >= SNR_GOOD_THRESHOLD) {
    return {
      backgroundColor: "#00ff00",
      color: "#111827",
    };
  }

  if (snr >= SNR_FAIR_THRESHOLD) {
    return {
      backgroundColor: "#ffe600",
      color: "#111827",
    };
  }

  return {
    backgroundColor: "#f7931a",
    color: "#111827",
  };
}

function formatSnr(snr?: number) {
  if (snr === undefined) {
    return "? dB";
  }

  return `${snr.toFixed(1).replace(/\.0$/, "")} dB`;
}

function RouteSection({ title, steps }: { title: string; steps: RouteStep[] }) {
  return (
    <div>
      <div className="text-[0.75rem] font-semibold text-zinc-100">{title}</div>
      <div className="mt-2 space-y-2">
        {steps.map((step, index) => (
          <div key={step.id}>
            {index > 0 && (
              <div className="mb-1 ml-1">
                <span
                  className="inline-flex rounded-full px-2 py-0.5 text-[0.75rem] font-semibold"
                  style={getSnrBadgeTone(step.snr)}
                >
                  ⇊ {formatSnr(step.snr)}
                </span>
              </div>
            )}
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[0.75rem] text-zinc-100">
              <div className="flex items-center justify-around gap-3">
                <span className="font-semibold">{step.shortName}</span>
                <span className="text-zinc-400">{step.nodeHex}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function VisualTracerouteCard({
  traceroute,
  totalDistance,
  onClear,
  className,
}: VisualTracerouteCardProps) {
  const { getNode } = useNodeDB();

  const sections = useMemo(() => {
    const originNode = getNode(traceroute.to);
    const destinationNode = getNode(traceroute.from);

    if (!originNode || !destinationNode) {
      return undefined;
    }

    const toLabelParts = (nodeNum: number) => {
      const node = getNode(nodeNum);
      const shortName = node?.user?.shortName?.trim();
      const nodeHex = `!${numberToHexUnpadded(nodeNum).toUpperCase()}`;

      return {
        shortName: shortName || nodeHex.slice(-4),
        nodeHex,
        display: shortName ? `${shortName} ${nodeHex}` : nodeHex,
      };
    };

    const forwardPath = [traceroute.to, ...traceroute.data.route, traceroute.from];
    const backwardPath = [traceroute.from, ...traceroute.data.routeBack, traceroute.to];
    const snrTowards = (traceroute.data.snrTowards ?? []).map((snr) => snr / 4);
    const snrBack = (traceroute.data.snrBack ?? []).map((snr) => snr / 4);

    return {
      title: `${toLabelParts(traceroute.to).display} -> ${toLabelParts(traceroute.from).display}`,
      forward: forwardPath.map((nodeNum, index) => ({
        id: `forward-${nodeNum}-${index}`,
        ...toLabelParts(nodeNum),
        snr: index > 0 ? snrTowards[index - 1] : undefined,
      })),
      backward:
        traceroute.data.routeBack.length > 0
          ? backwardPath.map((nodeNum, index) => ({
              id: `backward-${nodeNum}-${index}`,
              ...toLabelParts(nodeNum),
              snr: index > 0 ? snrBack[index - 1] : undefined,
            }))
          : [],
    };
  }, [getNode, traceroute]);

  if (!sections) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-2xl border border-white/10 bg-[#222] p-4 text-[0.75rem] text-zinc-100 shadow-2xl backdrop-blur-sm",
        className,
      )}
    >
      <div className="font-semibold">{sections.title}</div>
      <div className="mt-2 text-[0.75rem] text-zinc-400">
        Total route distance: {totalDistance.toFixed(2)} km
      </div>

      <div className="mt-4 flex-1 space-y-4 overflow-y-auto pr-1">
        <RouteSection title="Route traced toward destination" steps={sections.forward} />
        {sections.backward.length > 0 && (
          <RouteSection title="Route traced back to us" steps={sections.backward} />
        )}
      </div>

      <div className="mt-4 flex gap-3">
        <Button size="sm" variant="outline" className="text-[0.75rem]" onClick={onClear}>
          Clear traceroute
        </Button>
      </div>
    </div>
  );
}
