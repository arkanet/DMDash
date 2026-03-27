import { Button } from "@components/UI/Button.tsx";
import { useNodeDB } from "@core/stores";
import type { Protobuf, Types } from "@meshtastic/core";
import { numberToHexUnpadded } from "@noble/curves/abstract/utils";
import { useMemo } from "react";

const SNR_GOOD_THRESHOLD = -7;
const SNR_FAIR_THRESHOLD = -15;

interface VisualTracerouteCardProps {
  traceroute: Types.PacketMetadata<Protobuf.Mesh.RouteDiscovery>;
  totalDistance: number;
  onClear: () => void;
}

type RouteStep = {
  id: string;
  label: string;
  snr?: number;
};

function getSnrBadgeClassName(snr?: number) {
  if (snr === undefined) {
    return "bg-white/10 text-zinc-200";
  }

  if (snr >= SNR_GOOD_THRESHOLD) {
    return "bg-emerald-400/80 text-zinc-950";
  }

  if (snr >= SNR_FAIR_THRESHOLD) {
    return "bg-yellow-300/80 text-zinc-950";
  }

  return "bg-orange-400/80 text-zinc-950";
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
      <div className="text-xs uppercase tracking-[0.16em] text-zinc-400">{title}</div>
      <div className="mt-2 space-y-2">
        {steps.map((step, index) => (
          <div key={step.id}>
            {index > 0 && (
              <div className="mb-1 ml-1">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${getSnrBadgeClassName(step.snr)}`}
                >
                  ⇊ {formatSnr(step.snr)}
                </span>
              </div>
            )}
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100">
              {step.label}
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
}: VisualTracerouteCardProps) {
  const { getNode } = useNodeDB();

  const sections = useMemo(() => {
    const originNode = getNode(traceroute.to);
    const destinationNode = getNode(traceroute.from);

    if (!originNode || !destinationNode) {
      return undefined;
    }

    const toLabel = (nodeNum: number) =>
      getNode(nodeNum)?.user?.longName ?? `!${numberToHexUnpadded(nodeNum).toUpperCase()}`;

    const forwardPath = [traceroute.to, ...traceroute.data.route, traceroute.from];
    const backwardPath = [traceroute.from, ...traceroute.data.routeBack, traceroute.to];
    const snrTowards = (traceroute.data.snrTowards ?? []).map((snr) => snr / 4);
    const snrBack = (traceroute.data.snrBack ?? []).map((snr) => snr / 4);

    return {
      title: `${toLabel(traceroute.to)} -> ${toLabel(traceroute.from)}`,
      forward: forwardPath.map((nodeNum, index) => ({
        id: `forward-${nodeNum}-${index}`,
        label: toLabel(nodeNum),
        snr: index > 0 ? snrTowards[index - 1] : undefined,
      })),
      backward:
        traceroute.data.routeBack.length > 0
          ? backwardPath.map((nodeNum, index) => ({
              id: `backward-${nodeNum}-${index}`,
              label: toLabel(nodeNum),
              snr: index > 0 ? snrBack[index - 1] : undefined,
            }))
          : [],
    };
  }, [getNode, traceroute]);

  if (!sections) {
    return null;
  }

  return (
    <div className="absolute left-6 top-20 z-20 w-[26rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-white/10 bg-zinc-950/92 p-4 text-zinc-100 shadow-2xl backdrop-blur-sm lg:left-28">
      <div className="text-xs uppercase tracking-[0.18em] text-zinc-400">Visual Traceroute</div>
      <div className="mt-2 text-lg font-semibold">{sections.title}</div>
      <div className="mt-2 text-sm text-zinc-400">
        Total route distance: {totalDistance.toFixed(2)} km
      </div>

      <div className="mt-4 space-y-4">
        <RouteSection title="Route traced toward destination" steps={sections.forward} />
        {sections.backward.length > 0 && (
          <RouteSection title="Route traced back to us" steps={sections.backward} />
        )}
      </div>

      <div className="mt-4 flex gap-3">
        <Button size="sm" variant="outline" onClick={onClear}>
          Clear traceroute
        </Button>
      </div>
    </div>
  );
}
