import { Button } from "@components/UI/Button.tsx";
import { useTheme } from "@core/hooks/useTheme.ts";
import { useAppStore, useDevice, useNodeDB } from "@core/stores";
import { hasPos } from "@core/utils/geo.ts";
import { useToast } from "@core/hooks/useToast.ts";
import { cn } from "@core/utils/cn.ts";
import { Protobuf } from "@meshtastic/core";
import type { Types } from "@meshtastic/core";
import { numberToHexUnpadded } from "@noble/curves/abstract/utils";
import { useMemo } from "react";
import { useDarkMeshStore } from "@app/darkmesh/store.ts";
import { getTraceroutePanelTheme } from "./theme.ts";

const SNR_GOOD_THRESHOLD = -7;
const SNR_FAIR_THRESHOLD = -15;

interface VisualTracerouteCardProps {
  traceroute: Types.PacketMetadata<Protobuf.Mesh.RouteDiscovery>;
  totalDistance: number;
  onClear: () => void;
  onSelectNode?: (nodeNum: number) => void;
  className?: string;
}

type RouteStep = {
  id: string;
  shortName: string;
  nodeHex: string;
  snr?: number;
};

function getSnrBadgeTone(snr: number | undefined, isDarkTheme: boolean) {
  if (snr === undefined) {
    return {
      backgroundColor: isDarkTheme ? "#808080" : "rgb(0 0 0 / 0.15)",
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

function RouteSection({
  title,
  steps,
  onSelectNode,
  isDarkTheme,
}: {
  title: string;
  steps: RouteStep[];
  onSelectNode?: (num: number) => void;
  isDarkTheme: boolean;
}) {
  const { setNodeNumDetails } = useAppStore();
  const { connection, setDialogOpen } = useDevice();
  const { toast } = useToast();
  const { getNode } = useNodeDB();
  const panelTheme = getTraceroutePanelTheme(isDarkTheme);
  // prefer map popup behavior when parent passed an onSelectNode handler
  const openNode = (nodeNum: number, onSelectNode?: (num: number) => void) => {
    const node = getNode(nodeNum);
    if (node && node.position && hasPos(node.position)) {
      if (onSelectNode) {
        onSelectNode(nodeNum);
        return;
      }

      setNodeNumDetails(nodeNum);
      setDialogOpen("nodeDetails", true);
      return;
    }

    if (!connection || typeof connection.requestPosition !== "function") {
      toast({ title: "Unable to request GPS data" });
      return;
    }

    (async () => {
      toast({ title: "Requesting GPS data..." });
      try {
        await connection.requestPosition(nodeNum);
      } catch (err) {
        console.warn("requestPosition failed", err);
        toast({ title: "Failed to request position" });
        return;
      }
      // Also request node info together with position
      try {
        await connection.sendPacket(
          new Uint8Array(),
          Protobuf.Portnums.PortNum.NODEINFO_APP,
          nodeNum,
        );
      } catch {
        // ignore
      }
      const onPos = (posPacket: Types.PacketMetadata<Protobuf.Mesh.Position>) => {
        try {
          if ((posPacket.from?.valueOf?.() ?? posPacket.from) === nodeNum) {
            connection.events.onPositionPacket.unsubscribe(onPos);
            if (onSelectNode) {
              onSelectNode(nodeNum);
              toast({ title: "GPS data received" });
              return;
            }

            setNodeNumDetails(nodeNum);
            setDialogOpen("nodeDetails", true);
            toast({ title: "GPS data received" });
          }
        } catch {
          // ignore
        }
      };

      connection.events.onPositionPacket.subscribe(onPos);

      setTimeout(() => {
        connection.events.onPositionPacket.unsubscribe(onPos);
        toast({ title: "GPS data missing" });
      }, 15000);
    })();
  };

  return (
    <div>
      <div className={cn("text-[0.75rem] font-semibold", panelTheme.titleClass)}>{title}</div>
      <div className="mt-2 space-y-2">
        {steps.map((step, index) => (
          <div key={step.id}>
            {index > 0 && (
              <div className="mb-1 ml-1">
                <span
                  className="inline-flex rounded-full px-2 py-0.5 text-[0.75rem] font-semibold"
                  style={getSnrBadgeTone(step.snr, isDarkTheme)}
                >
                  ⇊ {formatSnr(step.snr)}
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={() => openNode(Number(step.nodeHex.replace(/^!/, "0x")), onSelectNode)}
              className={cn(
                "cursor-pointer rounded-xl px-3 py-2 text-left text-[0.75rem]",
                panelTheme.nodeButtonClass,
              )}
            >
              <div className="flex items-center justify-around gap-3">
                <span className="font-semibold">{step.shortName}</span>
                <span className={panelTheme.nodeHexClass}>{step.nodeHex}</span>
              </div>
            </button>
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
  onSelectNode,
  className,
}: VisualTracerouteCardProps) {
  const { getNode } = useNodeDB();
  const { theme } = useTheme();
  const isDarkTheme = theme === "dark";
  const panelTheme = getTraceroutePanelTheme(isDarkTheme);

  const sections = useMemo(() => {
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

    const route = Array.isArray(traceroute.data.route) ? traceroute.data.route : [];
    const routeBack = Array.isArray(traceroute.data.routeBack) ? traceroute.data.routeBack : [];
    const forwardPath = [traceroute.to, ...route, traceroute.from];
    const backwardPath = [traceroute.from, ...routeBack, traceroute.to];

    const snrTowardsArr = Array.isArray(traceroute.data.snrTowards)
      ? traceroute.data.snrTowards
      : [];
    const snrBackArr = Array.isArray(traceroute.data.snrBack) ? traceroute.data.snrBack : [];
    const snrTowards = snrTowardsArr.map((snr) => snr / 4);
    const snrBack = snrBackArr.map((snr) => snr / 4);

    return {
      title: `${toLabelParts(traceroute.to).display} -> ${toLabelParts(traceroute.from).display}`,
      forward: forwardPath.map((nodeNum, index) => ({
        id: `forward-${nodeNum}-${index}`,
        ...toLabelParts(nodeNum),
        snr: index > 0 ? snrTowards[index - 1] : undefined,
      })),
      backward:
        routeBack.length > 0
          ? backwardPath.map((nodeNum, index) => ({
              id: `backward-${nodeNum}-${index}`,
              ...toLabelParts(nodeNum),
              snr: index > 0 ? snrBack[index - 1] : undefined,
            }))
          : [],
    };
  }, [getNode, traceroute]);

  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-2xl p-4 text-[0.75rem] shadow-2xl backdrop-blur-sm",
        panelTheme.containerClass,
        className,
      )}
    >
      <div className={cn("font-semibold", panelTheme.titleClass)}>{sections.title}</div>
      <div className="mt-1 flex items-center gap-2">
        {/* Trace priority toggle */}
        <TracePriorityToggle />
      </div>
      <div
        className={cn(
          "mt-2 text-[0.75rem]",
          totalDistance > 0 ? panelTheme.routeInfoChipClass : panelTheme.mutedTextClass,
        )}
      >
        {totalDistance > 0
          ? `Total route distance: ${totalDistance.toFixed(2)} km`
          : "Route received; map distance unavailable until route nodes have GPS positions"}
      </div>

      <div className="mt-4 flex-1 space-y-4 overflow-y-auto pr-1">
        <RouteSection
          title="Route traced toward destination"
          steps={sections.forward}
          onSelectNode={onSelectNode}
          isDarkTheme={isDarkTheme}
        />
        {sections.backward.length > 0 && (
          <RouteSection
            title="Route traced back to us"
            steps={sections.backward}
            onSelectNode={onSelectNode}
            isDarkTheme={isDarkTheme}
          />
        )}
      </div>

      <div className="mt-4 flex gap-3">
        <Button
          size="sm"
          variant="outline"
          className={cn("text-[0.75rem]", panelTheme.actionButtonClass)}
          onClick={onClear}
        >
          Clear traceroute
        </Button>
      </div>
    </div>
  );
}

function TracePriorityToggle() {
  const { id: deviceId } = useDevice();
  const { theme } = useTheme();
  const traceEnabled = useDarkMeshStore((s) => (s.tracePriorityByDevice ?? {})[deviceId] ?? false);
  const setTracePriority = useDarkMeshStore((s) => s.setTracePriority);
  const panelTheme = getTraceroutePanelTheme(theme === "dark");

  return (
    <div className="ml-auto flex items-center gap-2">
      <div className={cn("text-[0.7rem]", panelTheme.tracePriorityLabelClass)}>Trace priority</div>
      <button
        type="button"
        onClick={() => setTracePriority(deviceId, !traceEnabled)}
        className={`h-8 rounded-md px-3 text-[0.75rem] font-semibold ${
          traceEnabled ? "bg-emerald-500 text-black" : panelTheme.tracePriorityOffClass
        }`}
      >
        {traceEnabled ? "ON" : "OFF"}
      </button>
    </div>
  );
}
