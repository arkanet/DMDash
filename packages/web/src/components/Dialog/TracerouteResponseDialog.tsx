import { useDarkMeshStore } from "@app/darkmesh/store.ts";
import { Button } from "@components/UI/Button.tsx";
import { useNodeDB } from "@core/stores";
import type { Protobuf, Types } from "@meshtastic/core";
import { getNodeShortName, getNodeLongName } from "@app/darkmesh/utils";
import { numberToHexUnpadded } from "@noble/curves/abstract/utils";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { useTracerouteStore } from "@core/stores/tracerouteStore";
import { useAppStore } from "@core/stores/appStore";
import { Dialog, DialogContent, DialogTitle } from "../UI/Dialog.tsx";

export interface TracerouteResponseDialogProps {
  traceroute: Types.PacketMetadata<Protobuf.Mesh.RouteDiscovery> | undefined;
  open: boolean;
  onOpenChange: () => void;
  durationMs?: number;
}

function isMobileResponsiveViewport(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
}

export const TracerouteResponseDialog = ({
  traceroute,
  open,
  onOpenChange,
  durationMs,
}: TracerouteResponseDialogProps) => {
  const { t } = useTranslation("dialog");
  const { getNode } = useNodeDB();
  const navigate = useNavigate();
  const setSelectedTraceRoute = useDarkMeshStore((state) => state.setSelectedTraceRoute);
  const setPendingTraceRouteTarget = useDarkMeshStore((state) => state.setPendingTraceRouteTarget);
  const setPendingTraceRouteRequest = useDarkMeshStore(
    (state) => state.setPendingTraceRouteRequest,
  );
  const route: number[] = traceroute?.data.route ?? [];
  const routeBack: number[] = traceroute?.data.routeBack ?? [];
  const snrTowards = (traceroute?.data.snrTowards ?? []).map((snr) => snr / 4);
  const snrBack = (traceroute?.data.snrBack ?? []).map((snr) => snr / 4);
  const from = getNode(traceroute?.to ?? 0); // The origin of the traceroute = the "to" node of the mesh packet
  const toUser = getNode(traceroute?.from ?? 0); // The destination of the traceroute = the "from" node of the mesh packet

  if (!toUser || !from) {
    return null;
  }

  const forwardPath = [from.num, ...route, toUser.num].filter(Boolean);
  const backwardPath = [toUser.num, ...routeBack, from.num].filter(Boolean);
  const resolvedDurationMs = durationMs ?? getStoredDurationMs(traceroute);

  function handleViewOnMap() {
    if (!traceroute) {
      return;
    }

    try {
      const deviceId = useAppStore.getState().selectedDeviceId ?? -1;
      useTracerouteStore.getState().addTraceroute(deviceId, traceroute, { source: "manual" });
    } catch (e) {
      console.warn("failed to persist manual traceroute", e);
    }

    setSelectedTraceRoute(traceroute);
    navigate({ to: "/map" });
  }

  function handleCloseProcess() {
    if (isMobileResponsiveViewport()) {
      const deviceId = useAppStore.getState().selectedDeviceId;
      setSelectedTraceRoute(undefined);
      if (deviceId !== undefined) {
        setPendingTraceRouteTarget(deviceId, undefined);
        setPendingTraceRouteRequest(deviceId, undefined);
      }
    }
    onOpenChange();
  }

  return (
    <Dialog open={open} onOpenChange={handleCloseProcess}>
      <DialogContent className="mobile-traceroute-dialog top-1/2 left-1/2 max-h-[86vh] w-[min(86vw,38rem)] max-w-[min(86vw,38rem)] -translate-x-1/2 -translate-y-1/2 rounded-sm bg-[#303030] p-6 text-zinc-100 dark:bg-[#303030]">
        <DialogTitle className="text-left text-[1.5rem] font-normal text-zinc-100 max-md:text-[1.125rem]">
          Traceroute
        </DialogTitle>
        <div className="mt-5 max-h-[62vh] overflow-y-auto pr-1 text-[0.675rem] leading-tight text-zinc-300 max-md:mt-3 max-md:max-h-[60vh] max-md:text-[0.8625rem]">
          <TracerouteRouteSection
            title="Route traced toward destination:"
            path={forwardPath}
            snrs={snrTowards}
            getNode={getNode}
          />
          <TracerouteRouteSection
            title="Route traced back to us:"
            path={backwardPath}
            snrs={snrBack}
            getNode={getNode}
          />
          <p className="mt-8 text-zinc-300 max-md:mt-4">
            Duration: {formatDuration(resolvedDurationMs)}
          </p>
        </div>
        <div className="mt-6 flex justify-end gap-6 max-md:mt-4 max-md:gap-3">
          <Button
            size="sm"
            variant="ghost"
            className="text-[0.4375rem] font-semibold uppercase tracking-wider text-[var(--darkmesh-action-color,#00bcd4)] max-md:px-2 max-md:text-[0.65625rem]"
            onClick={handleViewOnMap}
          >
            {t("tracerouteResponse.viewOnMap", "View on Map")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-[0.4375rem] font-semibold uppercase tracking-wider text-[var(--darkmesh-action-color,#00bcd4)] max-md:px-2 max-md:text-[0.65625rem]"
            onClick={handleCloseProcess}
          >
            CHIUDI
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

function TracerouteRouteSection({
  title,
  path,
  snrs,
  getNode,
}: {
  title: string;
  path: number[];
  snrs: number[];
  getNode: (nodeNum: number) => Protobuf.Mesh.NodeInfo | undefined;
}) {
  return (
    <section className="mt-6 first:mt-0 max-md:mt-4">
      <h2 className="mb-5 text-zinc-300 max-md:mb-3">{title}</h2>
      <ol className="space-y-2 max-md:space-y-1.5">
        {path.map((nodeNum, index) => (
          <li key={`${title}-${nodeNum}-${index}`}>
            <div className="flex gap-2 max-md:gap-1.5">
              <span className="mt-[0.42em] size-3 shrink-0 bg-zinc-300 max-md:size-2" />
              <span>{formatTracerouteNode(getNode(nodeNum), nodeNum)}</span>
            </div>
            {index < path.length - 1 ? <SnrLine snr={snrs[index]} /> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

function SnrLine({ snr }: { snr: number | undefined }) {
  return (
    <div className={`ml-0 mt-1 font-semibold max-md:mt-0.5 ${getSnrClassName(snr)}`}>
      ⇊ {snr === undefined ? "n/a" : `${formatSnr(snr)} dB`}
    </div>
  );
}

function formatTracerouteNode(node: Protobuf.Mesh.NodeInfo | undefined, nodeNum: number): string {
  const fallback = `!${numberToHexUnpadded(nodeNum).toUpperCase()}`;
  if (!node) {
    return `${fallback} (${fallback.slice(-4)})`;
  }

  const longName = getNodeLongName(node) ?? fallback;
  const shortName = getNodeShortName(node) ?? fallback.slice(-4);
  return `${longName} (${shortName})`;
}

function formatSnr(snr: number): string {
  return Number.isInteger(snr) ? snr.toFixed(1) : snr.toFixed(2);
}

function getSnrClassName(snr: number | undefined): string {
  if (snr === undefined) {
    return "text-zinc-400";
  }
  return snr >= -10 ? "text-[#00e531]" : "text-yellow-300";
}

function formatDuration(durationMs: number | undefined): string {
  if (durationMs === undefined || !Number.isFinite(durationMs) || durationMs < 0) {
    return "n/a";
  }

  return `${(durationMs / 1000).toFixed(1).replace(".", ",")} s`;
}

function getStoredDurationMs(
  traceroute: Types.PacketMetadata<Protobuf.Mesh.RouteDiscovery> | undefined,
): number | undefined {
  const record = traceroute as
    | (Types.PacketMetadata<Protobuf.Mesh.RouteDiscovery> & {
        durationMs?: number;
        duration?: number;
      })
    | undefined;
  const duration = record?.durationMs ?? record?.duration;
  return typeof duration === "number" ? duration : undefined;
}
