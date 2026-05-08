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
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "../UI/Dialog.tsx";

export interface TracerouteResponseDialogProps {
  traceroute: Types.PacketMetadata<Protobuf.Mesh.RouteDiscovery> | undefined;
  open: boolean;
  onOpenChange: () => void;
}

export const TracerouteResponseDialog = ({
  traceroute,
  open,
  onOpenChange,
}: TracerouteResponseDialogProps) => {
  const { t } = useTranslation("dialog");
  const { getNode } = useNodeDB();
  const navigate = useNavigate();
  const setSelectedTraceRoute = useDarkMeshStore((state) => state.setSelectedTraceRoute);
  const route: number[] = traceroute?.data.route ?? [];
  const routeBack: number[] = traceroute?.data.routeBack ?? [];
  const snrTowards = (traceroute?.data.snrTowards ?? []).map((snr) => snr / 4);
  const snrBack = (traceroute?.data.snrBack ?? []).map((snr) => snr / 4);
  const from = getNode(traceroute?.to ?? 0); // The origin of the traceroute = the "to" node of the mesh packet
  const fromLongName = from
    ? (getNodeLongName(from) ?? `!${numberToHexUnpadded(from.num).toUpperCase()}`)
    : t("unknown.longName");
  const fromShortName = getNodeShortName(from) ?? t("unknown.shortName");

  const toUser = getNode(traceroute?.from ?? 0); // The destination of the traceroute = the "from" node of the mesh packet

  if (!toUser || !from) {
    return null;
  }

  const rows = [
    ...[from.num, ...route, toUser.num].map((nodeNum, index) => ({
      direction: "Forward",
      nodeNum,
      snr: snrTowards[index - 1],
    })),
    ...[toUser.num, ...routeBack, from.num].map((nodeNum, index) => ({
      direction: "Back",
      nodeNum,
      snr: snrBack[index - 1],
    })),
  ].filter((row) => row.nodeNum);

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
    onOpenChange();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-1/2 left-1/2 max-h-[86vh] max-w-[min(92vw,38rem)] -translate-x-1/2 -translate-y-1/2 rounded-md bg-[#303030] p-6 text-zinc-100 dark:bg-[#303030]">
        <DialogClose className="text-zinc-100" />
        <DialogHeader>
          <DialogTitle className="text-center text-4xl font-semibold text-zinc-100 max-md:text-3xl">
            Traceroute
          </DialogTitle>
          <p className="text-center text-2xl text-zinc-200 max-md:text-xl">
            {fromLongName} ({fromShortName})
          </p>
        </DialogHeader>
        <div className="max-h-[55vh] overflow-y-auto">
          <table className="w-full border-separate border-spacing-y-1 text-left text-sm">
            <thead className="text-zinc-100">
              <tr>
                <th className="px-2 py-2">Dir</th>
                <th className="px-2 py-2">Node</th>
                <th className="px-2 py-2">HEX</th>
                <th className="px-2 py-2 text-right">SNR</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const node = getNode(row.nodeNum);
                const name = node
                  ? (getNodeShortName(node) ?? getNodeLongName(node) ?? String(row.nodeNum))
                  : String(row.nodeNum);
                const hex = node?.user?.id ?? `!${numberToHexUnpadded(row.nodeNum).toUpperCase()}`;
                return (
                  <tr key={`${row.direction}-${row.nodeNum}-${index}`} className="bg-[#2b2b2b]">
                    <td className="px-2 py-2 text-zinc-300">{row.direction}</td>
                    <td className="px-2 py-2 font-semibold">{name}</td>
                    <td className="px-2 py-2 font-mono">{hex}</td>
                    <td className="px-2 py-2 text-right font-semibold text-[#00e531]">
                      {row.snr === undefined ? "?" : row.snr.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-6 flex justify-end gap-6">
          <Button
            size="sm"
            variant="ghost"
            className="font-semibold uppercase tracking-wider text-[var(--darkmesh-action-color,#00bcd4)]"
            onClick={handleViewOnMap}
          >
            {t("tracerouteResponse.viewOnMap", "View on Map")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="font-semibold uppercase tracking-wider text-[var(--darkmesh-action-color,#00bcd4)]"
            onClick={onOpenChange}
          >
            Chiudi
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
