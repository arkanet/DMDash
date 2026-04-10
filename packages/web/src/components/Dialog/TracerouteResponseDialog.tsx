import { useDarkMeshStore } from "@app/darkmesh/store.ts";
import { Button } from "@components/UI/Button.tsx";
import { useNodeDB } from "@core/stores";
import type { Protobuf, Types } from "@meshtastic/core";
import { numberToHexUnpadded } from "@noble/curves/abstract/utils";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { TraceRoute } from "../PageComponents/Messages/TraceRoute.tsx";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../UI/Dialog.tsx";

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
  // Accept both camelCase and snake_case field names from parsed proto
  const data = (traceroute?.data ?? {}) as unknown as {
    snrTowards?: number[];
    snr_towards?: number[];
    snrBack?: number[];
    snr_back?: number[];
    route?: number[];
    routeBack?: number[];
  };

  const rawSnrTowards: number[] = data.snrTowards ?? data.snr_towards ?? [];
  const rawSnrBack: number[] = data.snrBack ?? data.snr_back ?? [];

  let snrTowards = (rawSnrTowards ?? []).map((snr) => snr / 4);
  const snrBack = (rawSnrBack ?? []).map((snr) => snr / 4);

  // Fallback: if `snrTowards` is not present, estimate it by reversing `snrBack`.
  // This is a temporary client-side estimate until firmware populates real
  // `snr_towards` values.
  if ((rawSnrTowards ?? []).length === 0 && (rawSnrBack ?? []).length > 0) {
    snrTowards = [...(rawSnrBack ?? [])]
      .slice()
      .reverse()
      .map((snr) => snr / 4);
  }
  const from = getNode(traceroute?.to ?? 0); // The origin of the traceroute = the "to" node of the mesh packet
  const fromLongName =
    from?.user?.longName ?? (from ? `!${numberToHexUnpadded(from?.num)}` : t("unknown.shortName"));
  const fromShortName =
    from?.user?.shortName ??
    (from ? `${numberToHexUnpadded(from?.num).substring(0, 4)}` : t("unknown.shortName"));

  const toUser = getNode(traceroute?.from ?? 0); // The destination of the traceroute = the "from" node of the mesh packet

  if (!toUser || !from) {
    return null;
  }

  function handleViewOnMap() {
    if (!traceroute) {
      return;
    }

    setSelectedTraceRoute(traceroute);
    navigate({ to: "/map" });
    onOpenChange();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogClose />
        <DialogHeader>
          <DialogTitle>
            {t("tracerouteResponse.title", {
              identifier: `${fromLongName} (${fromShortName})`,
            })}
          </DialogTitle>
        </DialogHeader>
        <DialogDescription>
          <TraceRoute
            route={route}
            routeBack={routeBack}
            from={{ user: from.user }}
            to={{ user: toUser.user }}
            snrTowards={snrTowards}
            snrBack={snrBack}
          />
        </DialogDescription>
        <div className="mt-4 flex justify-end">
          <Button size="sm" variant="outline" onClick={handleViewOnMap}>
            {t("tracerouteResponse.viewOnMap", "View on Map")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
