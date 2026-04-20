import { Share2 } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@components/UI/Dialog.tsx";
import { QRCode } from "react-qrcode-logo";
import { Input } from "@components/UI/Input.tsx";
import { Button } from "@components/UI/Button.tsx";
import { buildSharedContactUrl } from "../../../../darkmesh/utils.ts";
import {
  EnvironmentMetricsPanel,
  NeighborInfoPanel,
} from "@components/PageComponents/DarkMesh/NodeInfoPanels.tsx";
import NodeMetricsChart from "@components/NodeMetricsChart.tsx";
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
import { useDevice, useNodeDB, useAppStore } from "@core/stores";
import { formatQuantity } from "@core/utils/string.ts";
import type { Protobuf as ProtobufType } from "@meshtastic/core";
import { Protobuf } from "@meshtastic/core";
import NodeSignalChart from "@components/NodeSignalChart.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipTrigger,
} from "@radix-ui/react-tooltip";
import { useNavigate } from "@tanstack/react-router";
import { fromByteArray } from "base64-js";
import { getNodeShortName, getNodeLongName } from "@app/darkmesh/utils.ts";
import { numberToHexUnpadded } from "@noble/curves/abstract/utils";
import {
  BarChart2,
  LockIcon,
  LockOpenIcon,
  MapIcon,
  MessageSquareIcon,
  MountainSnow,
  RadioTowerIcon,
  Star,
  UsersIcon,
  Info,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { urlOrIpv4Schema } from "@components/Dialog/AddConnectionDialog/validation.ts";

export interface NodeDetailProps {
  node: ProtobufType.Mesh.NodeInfo;
  onSelectNode?: (nodeNum: number) => void;
}

export const NodeDetail = ({ node, onSelectNode }: NodeDetailProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation("nodes");
  const { connection, hardware, id: deviceId, getNeighborInfo, setDialogOpen } = useDevice();
  const { setNodeNumDetails } = useAppStore();
  const { getEnvironmentMetrics } = useNodeDB();
  const { getNode } = useNodeDB();
  const { updateFavorite } = useFavoriteNode();

  // not using gateway rxRssi here; use node's rxRssi where available

  const [showNeighbor, setShowNeighbor] = useState(false);
  const [showEnvironment, setShowEnvironment] = useState(false);
  const [showPublicKey, setShowPublicKey] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string>("");

  const name = getNodeLongName(node) ?? `!${numberToHexUnpadded(node.num)}`;

  function findValidUrlInText(text: string) {
    const tokens = text.split(/\s+/);
    for (const token of tokens) {
      const cleaned = token.replace(/^[("'“]+|[),.!?"'”]+$/g, "");
      if (!cleaned) continue;

      try {
        // explicit schemes or www
        if (/^(https?:\/\/|ftp:\/\/|www\.)/i.test(cleaned)) {
          const candidate = cleaned.startsWith("www.") ? `http://${cleaned}` : cleaned;
          const u = new URL(candidate);
          const hostWithPort = u.port ? `${u.hostname}:${u.port}` : u.hostname;
          if (urlOrIpv4Schema.safeParse(hostWithPort).success) {
            const idx = text.indexOf(token);
            return { url: candidate, start: idx, end: idx + token.length };
          }
        }

        // bare domain or ipv4
        if (cleaned.includes(".") || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(cleaned)) {
          if (urlOrIpv4Schema.safeParse(cleaned).success) {
            const idx = text.indexOf(token);
            return { url: cleaned, start: idx, end: idx + token.length };
          }
        }
      } catch {
        // ignore parse errors
      }
    }

    return null;
  }
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
  const publicKey =
    node.user?.publicKey && node.user.publicKey.length > 0
      ? fromByteArray(node.user.publicKey)
      : undefined;

  const roleLabelRaw = Protobuf.Config.Config_DeviceConfig_Role[node.user?.role ?? 0];
  const formatEnumLabel = (label: string) => label.replace(/_/g, " ");
  const roleLabel = roleLabelRaw ? formatEnumLabel(roleLabelRaw) : undefined;

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
      toast({
        title: t("traceroute.error", "Failed to send traceroute request"),
      });
    }
  }

  async function handleToggleNeighbor() {
    if (showNeighbor) {
      setShowNeighbor(false);
      return;
    }

    try {
      toast({ title: t("nodeDetail.neighbor.requestSent", "Request Neighbor Info Sent...") });
      await requestNeighborInfo(connection, node.num);
      setShowEnvironment(false);
      setShowNeighbor(true);
    } catch (error) {
      console.warn("neighbor request failed", error);
      toast({
        title: t("nodeDetail.neighbor.error", "Failed to request neighbor info"),
      });
    }
  }

  async function handleToggleEnvironment() {
    if (showEnvironment) {
      setShowEnvironment(false);
      return;
    }

    try {
      toast({ title: t("nodeDetail.metrics.requestSent", "Request Environmental Info Sent...") });
      await requestEnvironmentMetrics(connection, node.num);
      setShowNeighbor(false);
      setShowEnvironment(true);
    } catch (error) {
      console.warn("environment request failed", error);
      toast({
        title: t("nodeDetail.metrics.error", "Failed to request environmental metrics"),
      });
    }
  }

  function handlePublicKeyClick() {
    setShowPublicKey((current) => !current);
  }

  function handleRemoteAdmin() {
    navigate({ to: `/remote-admin/${node.num}/radio` });
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
                      updateFavorite({
                        nodeNum: node.num,
                        isFavorite: !node.isFavorite,
                      })
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

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={t("nodeDetail.share", "Share contact")}
                    onClick={() => {
                      try {
                        const url = buildSharedContactUrl(node);
                        setShareUrl(url);
                        setShareOpen(true);
                      } catch (_err) {
                        console.warn("failed to build shared contact url", _err);
                        toast({ title: t("nodeDetail.shareError", "Failed to build share URL") });
                      }
                    }}
                  >
                    <Share2 size={15} className="cursor-pointer hover:text-blue-500" />
                  </button>
                </TooltipTrigger>
                <TooltipPortal>
                  <TooltipContent
                    side="top"
                    className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm"
                  >
                    {t("nodeDetail.share", "Share contact")}
                  </TooltipContent>
                </TooltipPortal>
              </Tooltip>

              {node.num !== hardware.myNodeNum && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label={t("nodeDetail.remoteAdmin", "Remote Admin")}
                      onClick={handleRemoteAdmin}
                    >
                      <RadioTowerIcon size={15} className="cursor-pointer hover:text-blue-500" />
                    </button>
                  </TooltipTrigger>
                  <TooltipPortal>
                    <TooltipContent
                      side="top"
                      className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm"
                    >
                      {t("nodeDetail.remoteAdmin", "Remote Admin")}
                    </TooltipContent>
                  </TooltipPortal>
                </Tooltip>
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={t("nodeDetail.requestNodeInfo", "Request Node Info")}
                    onClick={async () => {
                      try {
                        toast({ title: t("Request Node Info", { ns: "ui" }) });

                        if (connection && typeof connection.sendPacket === "function") {
                          await connection.sendPacket(
                            new Uint8Array(),
                            Protobuf.Portnums.PortNum.NODEINFO_APP,
                            node.num,
                          );
                        } else if (connection && typeof connection.getMetadata === "function") {
                          await connection.getMetadata(node.num);
                        } else {
                          throw new Error(
                            "NodeInfo request is not available on the current connection",
                          );
                        }

                        toast({ title: t("Request Node Info ...", { ns: "ui" }) });
                      } catch (err) {
                        console.warn("popup nodeinfo request failed", err);
                        toast({
                          title: t("Request Node Info Error", {
                            ns: "ui",
                            defaultValue: "Failed to request node info",
                          }),
                        });
                      }
                    }}
                  >
                    <Info size={15} className="cursor-pointer hover:text-blue-500" />
                  </button>
                </TooltipTrigger>
                <TooltipPortal>
                  <TooltipContent
                    side="top"
                    className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm"
                  >
                    {t("nodeDetail.requestNodeInfo", "Request Node Info")}
                  </TooltipContent>
                </TooltipPortal>
              </Tooltip>

              <Dialog open={shareOpen} onOpenChange={setShareOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("nodeDetail.shareDialog.title", "Share Contact")}</DialogTitle>
                    <DialogClose />
                  </DialogHeader>
                  <div className="flex gap-4 items-center">
                    <QRCode value={shareUrl} size={140} qrStyle="dots" />
                    <div className="flex-1">
                      <Input value={shareUrl} readOnly />
                      <div className="mt-2 flex gap-2">
                        <Button
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(shareUrl);
                              toast({
                                title: t("nodeDetail.shareCopied", "Copied URL to clipboard"),
                              });
                            } catch {
                              toast({ title: t("nodeDetail.shareCopyError", "Failed to copy") });
                            }
                          }}
                        >
                          {t("button.copy", "Copy")}
                        </Button>
                        <Button onClick={() => setShareOpen(false)}>{t("close", "Close")}</Button>
                      </div>
                    </div>
                  </div>
                  <DialogFooter />
                </DialogContent>
              </Dialog>
            </div>
          </TooltipProvider>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex gap-3">
            <div className="min-w-0 flex-1">
              <Heading as="h5">
                {(() => {
                  const ln = node.user?.longName ?? "";
                  const found = findValidUrlInText(ln);
                  if (found) {
                    const before = ln.slice(0, found.start);
                    const linkText = ln.slice(found.start, found.end);
                    const after = ln.slice(found.end);
                    const href = new RegExp("^(https?:\\/\\/)", "i").test(found.url)
                      ? found.url
                      : `http://${found.url}`;
                    return (
                      <>
                        {before}
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="no-underline text-current"
                        >
                          {linkText}
                        </a>
                        {after}
                      </>
                    );
                  }

                  return name;
                })()}
              </Heading>
              {hardwareType !== t("unset") && <Subtle>{hardwareType}</Subtle>}

              {!!node.deviceMetrics?.batteryLevel && (
                <BatteryStatus deviceMetrics={node.deviceMetrics} />
              )}

              <div className="flex flex-wrap gap-2 items-center">
                {(getNodeShortName(node) ?? node.user?.shortName) && (
                  <div>"{getNodeShortName(node) ?? node.user?.shortName}"</div>
                )}
                {node.user?.id && <div>{node.user.id}</div>}
              </div>

              {roleLabel && (
                <div className="mt-1">
                  <Subtle>{roleLabel}</Subtle>
                </div>
              )}

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

              {showPublicKey && (
                <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[0.75rem] dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100">
                  <div className="font-semibold text-slate-700 dark:text-slate-200">
                    {publicKey
                      ? t("nodeDetail.publicKey", "Public Key")
                      : t("nodeDetail.noPublicKey.label", "No public key")}
                  </div>
                  <Mono className="mt-1 block break-all text-[0.75rem]">
                    {publicKey ?? t("nodeDetail.noPublicKey", "No public key available")}
                  </Mono>
                </div>
              )}
            </div>

            {showNeighbor && (
              <NeighborInfoPanel
                nodeNum={node.num}
                neighborInfo={neighborInfo}
                dense
                className="w-64 bg-white/5 p-2 dark:bg-black/10"
                title={t("nodeDetail.neighbor.header", "Neighbor Nodes")}
                onOpenNode={(num: number) => {
                  (async () => {
                    // If node already has GPS, select immediately
                    const target = getNode(num);
                    if (
                      target?.position &&
                      target.position.latitudeI &&
                      target.position.longitudeI
                    ) {
                      onSelectNode?.(num);
                      return;
                    }

                    if (!connection) {
                      toast({ title: t("nodeDetail.gps.noConnection", "No connection") });
                      return;
                    }

                    toast({ title: t("nodeDetail.gps.request", "GPS data request") });

                    try {
                      await connection.requestPosition(num);
                    } catch (err) {
                      console.warn("requestPosition failed", err);
                    }

                    // wait up to 15s for position packet from that node
                    const got = await new Promise<boolean>((resolve) => {
                      const handler = (loc: unknown) => {
                        try {
                          const l = loc as unknown as {
                            from?: number | { valueOf?: () => number };
                          };
                          const from =
                            l.from &&
                            typeof (l.from as unknown as { valueOf?: unknown }).valueOf ===
                              "function"
                              ? (l.from as { valueOf: () => number }).valueOf()
                              : (l.from as number | undefined);
                          if (from === num) {
                            connection.events.onPositionPacket.unsubscribe(handler);
                            clearTimeout(timer);
                            resolve(true);
                          }
                        } catch {
                          // ignore
                        }
                      };

                      connection.events.onPositionPacket.subscribe(handler);

                      const timer = setTimeout(() => {
                        connection.events.onPositionPacket.unsubscribe(handler);
                        resolve(false);
                      }, 15000);
                    });

                    if (got) {
                      onSelectNode?.(num);
                    } else {
                      // Apri il pannello nodeinfo sopra la mappa se GPS mancante
                      try {
                        setNodeNumDetails(num);
                        setDialogOpen("nodeDetails", true);
                      } catch (err) {
                        console.warn("failed to open node details panel", err);
                        toast({ title: t("nodeDetail.gps.missing", "GPS data missing") });
                      }
                    }
                  })();
                }}
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

          <div className="mt-1 w-full max-w-[320px] space-y-1">
            <NodeSignalChart
              snr={node.snr}
              rssi={
                (node as unknown as ProtobufType.Mesh.NodeInfo & { rxRssi?: number }).rxRssi ??
                undefined
              }
              noBackground={true}
              invertOrder={true}
            />
            <NodeMetricsChart
              airUtilTx={node.deviceMetrics?.airUtilTx}
              channelUtilization={node.deviceMetrics?.channelUtilization}
              noBackground={true}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
