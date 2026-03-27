import {
  EnvironmentMetricsPanel,
  NeighborInfoPanel,
} from "@components/PageComponents/DarkMesh/NodeInfoPanels.tsx";
import BatteryStatus from "@components/BatteryStatus.tsx";
import { Mono } from "@components/generic/Mono.tsx";
import { TimeAgo } from "@components/generic/TimeAgo.tsx";
import { Avatar } from "@components/UI/Avatar.tsx";
import { Separator } from "@components/UI/Separator.tsx";
import { Heading } from "@components/UI/Typography/Heading.tsx";
import { Subtle } from "@components/UI/Typography/Subtle.tsx";
import { useFavoriteNode } from "@core/hooks/useFavoriteNode.ts";
import { toast } from "@core/hooks/useToast.ts";
import {
  requestEnvironmentMetrics,
  requestNeighborInfo,
  startVisualTraceroute,
} from "@core/services/darkmesh/nodeActions.ts";
import { useDevice, useNodeDB } from "@core/stores";
import { formatQuantity } from "@core/utils/string.ts";
import type { Protobuf as ProtobufType } from "@meshtastic/core";
import { Protobuf } from "@meshtastic/core";
import {
  Tooltip,
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipTrigger,
} from "@radix-ui/react-tooltip";
import { useNavigate } from "@tanstack/react-router";
import { fromByteArray } from "base64-js";
import {
  BarChart2,
  Dot,
  LockIcon,
  LockOpenIcon,
  MapIcon,
  MessageSquareIcon,
  MountainSnow,
  Star,
  UsersIcon,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export interface NodeDetailProps {
  node: ProtobufType.Mesh.NodeInfo;
}

export const NodeDetail = ({ node }: NodeDetailProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation("nodes");
  const { connection, id: deviceId, getNeighborInfo } = useDevice();
  const { getEnvironmentMetrics } = useNodeDB();
  const { updateFavorite } = useFavoriteNode();

  const [showNeighbor, setShowNeighbor] = useState(false);
  const [showEnvironment, setShowEnvironment] = useState(false);

  const name = node.user?.longName ?? t("unknown.shortName");
  const hwModel = node.user?.hwModel ?? 0;
  const rawHardwareType = Protobuf.Mesh.HardwareModel[hwModel] as
    | keyof typeof Protobuf.Mesh.HardwareModel
    | undefined;
  const hardwareType = rawHardwareType
    ? rawHardwareType === "UNSET"
      ? t("unset")
      : rawHardwareType.replaceAll("_", " ")
    : `${hwModel}`;

  const neighborInfo = getNeighborInfo(node.num);
  const environmentMetrics = getEnvironmentMetrics(node.num);

  function handleDirectMessage() {
    navigate({ to: `/messages/direct/${node.num}` });
  }

  async function handleVisualTraceroute() {
    try {
      toast({ title: t("traceroute.sending", "Sending Visual Traceroute...") });
      await startVisualTraceroute(deviceId, connection, node.num);
      toast({ title: t("traceroute.sent", "Visual Traceroute request sent") });
    } catch (error) {
      console.warn("visual traceroute request failed", error);
      toast({ title: t("traceroute.error", "Failed to send traceroute request") });
    }
  }

  async function handleToggleNeighbor() {
    if (showNeighbor) {
      setShowNeighbor(false);
      return;
    }

    try {
      await requestNeighborInfo(connection, node.num);
      setShowEnvironment(false);
      setShowNeighbor(true);
    } catch (error) {
      console.warn("neighbor request failed", error);
      toast({ title: t("nodeDetail.neighbor.error", "Failed to request neighbor info") });
    }
  }

  async function handleToggleEnvironment() {
    if (showEnvironment) {
      setShowEnvironment(false);
      return;
    }

    try {
      await requestEnvironmentMetrics(connection, node.num);
      setShowNeighbor(false);
      setShowEnvironment(true);
    } catch (error) {
      console.warn("environment request failed", error);
      toast({ title: t("nodeDetail.metrics.error", "Failed to request environmental metrics") });
    }
  }

  function handlePublicKeyClick() {
    if (node.user?.publicKey && node.user.publicKey.length > 0) {
      toast({
        title: t("nodeDetail.publicKey", "Public Key"),
        description: fromByteArray(node.user.publicKey),
      });
      return;
    }

    toast({
      title: t("nodeDetail.noPublicKey.label", "No public key"),
      description: t("nodeDetail.noPublicKey", "No public key available"),
    });
  }

  return (
    <div className="min-w-[21rem] max-w-[34rem] p-2 text-slate-900">
      <div className="flex gap-3">
        <div className="flex min-w-8 flex-col items-center gap-2 pt-1">
          <Avatar nodeNum={node.num} size="sm" />

          <TooltipProvider>
            <div className="flex flex-col items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={t("nodeDetail.publicKeyButton", "Show public key")}
                    onClick={handlePublicKeyClick}
                  >
                    {node.user?.publicKey && node.user.publicKey.length > 0 ? (
                      <LockIcon
                        className="cursor-pointer text-green-600"
                        size={12}
                        strokeWidth={3}
                      />
                    ) : (
                      <LockOpenIcon
                        className="cursor-pointer text-yellow-500"
                        size={12}
                        strokeWidth={3}
                      />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipPortal>
                  <TooltipContent
                    side="top"
                    className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm"
                  >
                    {t("nodeDetail.publicKeyButton", "Show public key")}
                  </TooltipContent>
                </TooltipPortal>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={t("nodeDetail.message", "Send message")}
                    onClick={handleDirectMessage}
                  >
                    <MessageSquareIcon size={14} className="cursor-pointer hover:text-blue-500" />
                  </button>
                </TooltipTrigger>
                <TooltipPortal>
                  <TooltipContent
                    side="top"
                    className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm"
                  >
                    {t("nodeDetail.message", "Send message")}
                  </TooltipContent>
                </TooltipPortal>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={t("nodeDetail.visualTraceroute", "Visual Traceroute")}
                    onClick={handleVisualTraceroute}
                  >
                    <MapIcon size={14} className="cursor-pointer hover:text-blue-500" />
                  </button>
                </TooltipTrigger>
                <TooltipPortal>
                  <TooltipContent
                    side="top"
                    className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm"
                  >
                    {t("nodeDetail.visualTraceroute", "Visual Traceroute")}
                  </TooltipContent>
                </TooltipPortal>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={t("nodeDetail.neighbor", "Neighbor Info")}
                    onClick={handleToggleNeighbor}
                  >
                    <UsersIcon size={14} className="cursor-pointer hover:text-blue-500" />
                  </button>
                </TooltipTrigger>
                <TooltipPortal>
                  <TooltipContent
                    side="top"
                    className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm"
                  >
                    {t("nodeDetail.neighbor", "Neighbor Info")}
                  </TooltipContent>
                </TooltipPortal>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={t("nodeDetail.metrics.toggle", "Environment")}
                    onClick={handleToggleEnvironment}
                  >
                    <BarChart2 size={14} className="cursor-pointer hover:text-blue-500" />
                  </button>
                </TooltipTrigger>
                <TooltipPortal>
                  <TooltipContent
                    side="top"
                    className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm"
                  >
                    {t("nodeDetail.metrics.toggle", "Environment")}
                  </TooltipContent>
                </TooltipPortal>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={
                      node.isFavorite
                        ? t("nodeDetail.favorite.label")
                        : t("nodeDetail.notFavorite.label")
                    }
                    onClick={() =>
                      updateFavorite({ nodeNum: node.num, isFavorite: !node.isFavorite })
                    }
                  >
                    <Star
                      size={15}
                      className="cursor-pointer"
                      fill={node.isFavorite ? "black" : "none"}
                    />
                  </button>
                </TooltipTrigger>
                <TooltipPortal>
                  <TooltipContent
                    side="top"
                    className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm"
                  >
                    {node.isFavorite
                      ? t("nodeDetail.favorite.label")
                      : t("nodeDetail.notFavorite.label")}
                  </TooltipContent>
                </TooltipPortal>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex gap-3">
            <div className="min-w-0 flex-1">
              <Heading as="h5">{name}</Heading>
              {hardwareType !== t("unset") && <Subtle>{hardwareType}</Subtle>}

              {!!node.deviceMetrics?.batteryLevel && (
                <BatteryStatus deviceMetrics={node.deviceMetrics} />
              )}

              <div className="flex flex-wrap gap-2 items-center">
                {node.user?.shortName && <div>"{node.user.shortName}"</div>}
                {node.user?.id && <div>{node.user.id}</div>}
              </div>

              <div
                className="flex gap-1"
                title={new Date(node.lastHeard * 1000).toLocaleString(navigator.language)}
              >
                {node.lastHeard > 0 && (
                  <div>
                    {t("nodeDetail.status.heard")} <TimeAgo timestamp={node.lastHeard * 1000} />
                  </div>
                )}
                {node.viaMqtt && (
                  <div className="font-medium" style={{ color: "#660066" }}>
                    {t("nodeDetail.status.mqtt")}
                  </div>
                )}
              </div>
            </div>

            {showNeighbor && (
              <NeighborInfoPanel
                nodeNum={node.num}
                neighborInfo={neighborInfo}
                dense
                className="w-64 bg-white/5 p-2 dark:bg-black/10"
                title={t("nodeDetail.neighbor.header", "Neighbor Nodes")}
              />
            )}

            {showEnvironment && (
              <EnvironmentMetricsPanel
                metrics={environmentMetrics}
                dense
                className="w-56 bg-white/5 p-2 dark:bg-black/10"
                title={t("nodeDetail.metrics.header", "Environmental Metrics")}
              />
            )}
          </div>

          <Separator className="my-2" />

          <div className="mt-2 flex text-sm">
            <div className="flex grow items-center">
              <div className="mr-1 rounded-sm border-2 border-slate-900 px-0.5">
                {Number.isNaN(node.hopsAway) ? t("unit.hopsAway.unknown") : node.hopsAway}
              </div>
              <div>{node.hopsAway === 1 ? t("unit.hop.one") : t("unit.hop.plural")}</div>
            </div>

            {node.position?.altitude && (
              <div className="flex grow items-center">
                <MountainSnow
                  size={15}
                  className="ml-2 mr-1"
                  aria-label={t("nodeDetail.elevation.label")}
                />
                <div>
                  {formatQuantity(node.position.altitude, {
                    one: t("unit.meter.one"),
                    other: t("unit.meter.plural"),
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="mt-2 flex">
            {!!node.deviceMetrics?.channelUtilization && (
              <div className="grow">
                <div>{t("channelUtilization.short")}</div>
                <Mono>{node.deviceMetrics.channelUtilization.toPrecision(3)}%</Mono>
              </div>
            )}

            {!!node.deviceMetrics?.airUtilTx && (
              <div className="grow">
                <div>{t("airtimeUtilization.short")}</div>
                <Mono className="text-gray-500">
                  {node.deviceMetrics.airUtilTx.toPrecision(3)}%
                </Mono>
              </div>
            )}
          </div>

          {node.snr !== 0 && (
            <div className="mt-2">
              <div>{t("unit.snr")}</div>
              <Mono className="flex items-center text-xs text-gray-500">
                {node.snr}
                {t("unit.dbm")}
                <Dot />
                {Math.min(Math.max((node.snr + 10) * 5, 0), 100)}%
                <Dot />
                {(node.snr + 10) * 5}
                {t("unit.raw")}
              </Mono>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
