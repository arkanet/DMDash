import {
  EnvironmentMetricsPanel,
  NeighborInfoPanel,
} from "@components/PageComponents/DarkMesh/NodeInfoPanels.tsx";
import { DeviceImage } from "@components/generic/DeviceImage.tsx";
import { TimeAgo } from "@components/generic/TimeAgo.tsx";
import { Uptime } from "@components/generic/Uptime.tsx";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@components/UI/Accordion.tsx";
import { Button } from "@components/UI/Button.tsx";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@components/UI/Dialog.tsx";
import { Separator } from "@components/UI/Separator.tsx";
import {
  Tooltip,
  TooltipArrow,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@components/UI/Tooltip.tsx";
import { useFavoriteNode } from "@core/hooks/useFavoriteNode.ts";
import { useIgnoreNode } from "@core/hooks/useIgnoreNode.ts";
import { toast } from "@core/hooks/useToast.ts";
import {
  requestEnvironmentMetrics,
  requestNeighborInfo,
  startVisualTraceroute,
} from "@core/services/darkmesh/nodeActions.ts";
import { useAppStore, useDevice, useNodeDB } from "@core/stores";
import { cn } from "@core/utils/cn.ts";
import { Protobuf } from "@meshtastic/core";
import { numberToHexUnpadded } from "@noble/curves/abstract/utils";
import { useNavigate } from "@tanstack/react-router";
import { fromByteArray } from "base64-js";
import {
  BarChart2,
  BellIcon,
  BellOffIcon,
  MapPin,
  MapPinnedIcon,
  MessageSquareIcon,
  RadioTowerIcon,
  Info,
  StarIcon,
  TrashIcon,
  UsersIcon,
} from "lucide-react";
import { Share2 } from "lucide-react";
// removed duplicate DialogFooter import
import { Input } from "@components/UI/Input.tsx";
import { QRCode } from "react-qrcode-logo";
import { buildSharedContactUrl } from "../../../darkmesh/utils.ts";
import NodeMetricsChart from "@components/NodeMetricsChart.tsx";
import NodeSignalChart from "@components/NodeSignalChart.tsx";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
// useDarkMeshStore not needed here after switching to node's rxRssi
import { urlOrIpv4Schema } from "@components/Dialog/AddConnectionDialog/validation.ts";

export interface NodeDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodeNum?: number;
  /** horizontal offset in percent for this dialog (e.g. -25 for 25% left) */
  offsetPercent?: number;
}

export const NodeDetailsDialog = ({
  open,
  onOpenChange,
  nodeNum: propNodeNum,
  offsetPercent = -25,
}: NodeDetailsDialogProps) => {
  const { t } = useTranslation("dialog");
  const { setDialogOpen, connection, getNeighborInfo, id: deviceId } = useDevice();
  // prefer node-provided rxRssi where available
  const nodeDB = useNodeDB();
  const navigate = useNavigate();
  const { setNodeNumToBeRemoved, nodeNumDetails } = useAppStore();
  const { updateFavorite } = useFavoriteNode();
  const { updateIgnored } = useIgnoreNode();

  // `node` is no longer used directly; use `nodeForRender`/`effectiveNodeNum` instead.
  const effectiveNodeNum = typeof propNodeNum === "number" ? propNodeNum : nodeNumDetails;
  const nodeForRender = nodeDB.getNode(effectiveNodeNum);
  const environmentMetricsForRender = nodeForRender
    ? nodeDB.getEnvironmentMetrics(nodeForRender.num)
    : undefined;

  const [isFavoriteState, setIsFavoriteState] = useState<boolean>(
    nodeForRender?.isFavorite ?? false,
  );
  const [isIgnoredState, setIsIgnoredState] = useState<boolean>(nodeForRender?.isIgnored ?? false);
  const [isRequestingPosition, setIsRequestingPosition] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string>("");
  const [showNeighborPanel, setShowNeighborPanel] = useState(false);
  const [showEnvPanel, setShowEnvPanel] = useState(false);
  const [nestedStack, setNestedStack] = useState<number[]>([]);

  useEffect(() => {
    if (!nodeForRender) {
      return;
    }
    setIsFavoriteState(nodeForRender.isFavorite);
    setIsIgnoredState(nodeForRender.isIgnored);
  }, [nodeForRender]);

  // Ensure we have the node we intend to render. useEffect and hooks above
  // must stay before any early return, so check `nodeForRender` here.
  if (!nodeForRender) {
    return null;
  }

  const currentNode = nodeForRender;
  const neighborInfo = getNeighborInfo(currentNode?.num ?? effectiveNodeNum);

  function handleDirectMessage() {
    navigate({ to: `/messages/direct/${currentNode.num}` });
    setDialogOpen("nodeDetails", false);
  }

  async function handleRequestPosition() {
    setIsRequestingPosition(true);

    try {
      toast({
        title: t("toast.requestingPosition.title", { ns: "ui" }),
      });

      await connection?.requestPosition(currentNode.num);

      toast({
        title: t("toast.positionRequestSent.title", { ns: "ui" }),
      });
    } catch (error) {
      console.warn("dialog position request failed", error);
      toast({
        title: t("toast.positionRequestError", {
          ns: "ui",
          defaultValue: "Failed to request position",
        }),
      });
    } finally {
      setIsRequestingPosition(false);
    }
  }

  async function handleVisualTraceroute() {
    try {
      toast({
        title: t("toast.sendingTraceroute.title", { ns: "ui" }),
      });
      await startVisualTraceroute(deviceId, connection, currentNode.num);
      toast({
        title: t("toast.tracerouteSent.title", { ns: "ui" }),
      });
      navigate({ to: "/map" });
    } catch (error) {
      console.warn("dialog visual traceroute failed", error);
      toast({
        title: t("toast.tracerouteError.title", { ns: "ui" }),
      });
    } finally {
      setDialogOpen("nodeDetails", false);
    }
  }

  async function handleRequestNeighborFromDialog() {
    const next = !showNeighborPanel;
    setShowNeighborPanel(next);
    if (!next) return;

    try {
      toast({ title: "Neighbor Info" });
      await requestNeighborInfo(connection, currentNode.num);
    } catch (error) {
      console.warn("dialog neighbor request failed", error);
      toast({
        title: t("toast.neighborRequestError", {
          ns: "ui",
          defaultValue: "Failed to request neighbor info",
        }),
      });
    }
  }

  async function handleRequestEnvironmentFromDialog() {
    const next = !showEnvPanel;
    setShowEnvPanel(next);
    if (!next) return;

    try {
      toast({ title: "Environmental Metrics" });
      await requestEnvironmentMetrics(connection, currentNode.num);
    } catch (error) {
      console.warn("dialog environment request failed", error);
      toast({
        title: t("toast.metricsRequestError", {
          ns: "ui",
          defaultValue: "Failed to request environmental metrics",
        }),
      });
    }
  }

  async function handleRequestNodeInfo() {
    try {
      toast({ title: t("Request Node Info", { ns: "ui" }) });

      if (connection && typeof connection.sendPacket === "function") {
        await connection.sendPacket(
          new Uint8Array(),
          Protobuf.Portnums.PortNum.NODEINFO_APP,
          currentNode.num,
        );
      } else if (connection && typeof connection.getMetadata === "function") {
        await connection.getMetadata(currentNode.num);
      } else {
        throw new Error("NodeInfo request is not available on the current connection");
      }

      toast({ title: t("Request Node Info ...", { ns: "ui" }) });
    } catch (error) {
      console.warn("dialog nodeinfo request failed", error);
      toast({
        title: t("Request Node Info Error", {
          ns: "ui",
          defaultValue: "Failed to request node info",
        }),
      });
    }
  }

  function handleNodeRemove() {
    setNodeNumToBeRemoved(currentNode.num);
    setDialogOpen("nodeRemoval", true);
    onOpenChange(false);
  }

  function handleToggleFavorite() {
    updateFavorite({ nodeNum: currentNode.num, isFavorite: !isFavoriteState });
    setIsFavoriteState(!isFavoriteState);
  }

  function handleToggleIgnored() {
    updateIgnored({ nodeNum: currentNode.num, isIgnored: !isIgnoredState });
    setIsIgnoredState(!isIgnoredState);
  }

  function handleRemoteAdmin() {
    navigate({ to: `/remote-admin/${currentNode.num}/radio` });
    setDialogOpen("nodeDetails", false);
  }

  const deviceMetricsMap = [
    {
      key: "batteryLevel",
      label: t("nodeDetails.batteryLevel"),
      value: currentNode.deviceMetrics?.batteryLevel,
      format: (val: number) => (val === 101 ? t("batteryStatus.pluggedIn") : `${val.toFixed(2)}%`),
    },
    {
      key: "voltage",
      label: t("nodeDetails.voltage"),
      value:
        typeof currentNode.deviceMetrics?.voltage === "number"
          ? Math.abs(currentNode.deviceMetrics.voltage)
          : undefined,
      format: (val: number) => `${val.toFixed(2)}V`,
    },
  ];

  const sectionClassName =
    "rounded-lg bg-slate-100 p-4 text-slate-900 dark:bg-slate-800 dark:text-slate-100";
  const actionButtonClassName = "w-full";
  const actionGridClassName = cn(
    "grid w-full items-center gap-1",
    currentNode.num !== nodeDB.myNodeNum ? "grid-cols-9" : "grid-cols-8",
  );
  const rawMetrics = {
    ...(currentNode ?? {}),
    environmentMetrics: environmentMetricsForRender,
  };

  function openNestedNode(nodeNum: number) {
    setNestedStack((s) => [...s, nodeNum]);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          aria-describedby={undefined}
          style={{ transform: `translateX(${offsetPercent}%)` }}
        >
          <DialogClose />
          <DialogHeader>
            <DialogTitle>
              {(() => {
                const ln = currentNode.user?.longName ?? "";

                function findValidUrlInText(text: string) {
                  const tokens = text.split(/\s+/);
                  for (const token of tokens) {
                    const cleaned = token.replace(/^[("'“]+|[),.!?"'”]+$/g, "");
                    if (!cleaned) continue;

                    try {
                      if (/^(https?:\/\/|ftp:\/\/|www\.)/i.test(cleaned)) {
                        const candidate = cleaned.startsWith("www.")
                          ? `http://${cleaned}`
                          : cleaned;
                        const u = new URL(candidate);
                        const hostWithPort = u.port ? `${u.hostname}:${u.port}` : u.hostname;
                        if (urlOrIpv4Schema.safeParse(hostWithPort).success) {
                          const idx = text.indexOf(token);
                          return { url: candidate, start: idx, end: idx + token.length };
                        }
                      }

                      if (cleaned.includes(".") || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(cleaned)) {
                        if (urlOrIpv4Schema.safeParse(cleaned).success) {
                          const idx = text.indexOf(token);
                          return { url: cleaned, start: idx, end: idx + token.length };
                        }
                      }
                    } catch {
                      // ignore
                    }
                  }

                  return null;
                }

                const found = findValidUrlInText(ln);
                if (found) {
                  const before = ln.slice(0, found.start);
                  const linkText = ln.slice(found.start, found.end);
                  const after = ln.slice(found.end);
                  const href = new RegExp("^(https?:\\/\\/)", "i").test(found.url)
                    ? found.url
                    : `http://${found.url}`;
                  return (
                    <span>
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
                      {` (${currentNode.user?.shortName ?? t("unknown.shortName")})`}
                    </span>
                  );
                }

                return (
                  <span>
                    {`${currentNode.user?.longName ?? t("unknown.shortName")} (${currentNode.user?.shortName ?? t("unknown.shortName")})`}
                  </span>
                );
              })()}
            </DialogTitle>
          </DialogHeader>

          <DialogFooter>
            <div className="w-full">
              <div className={actionGridClassName}>
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        className={actionButtonClassName}
                        aria-label={t("nodeDetails.message")}
                        onClick={handleDirectMessage}
                      >
                        <MessageSquareIcon />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="rounded bg-slate-800 px-4 py-1 text-xs text-white dark:bg-slate-600">
                      {t("nodeDetails.message")}
                      <TooltipArrow className="fill-slate-800 dark:fill-slate-600" />
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        className={actionButtonClassName}
                        aria-label={t("nodeDetails.visualTraceroute", "Visual Traceroute")}
                        onClick={handleVisualTraceroute}
                      >
                        <MapPin />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="rounded bg-slate-800 px-4 py-1 text-xs text-white dark:bg-slate-600">
                      {t("nodeDetails.visualTraceroute", "Visual Traceroute")}
                      <TooltipArrow className="fill-slate-800 dark:fill-slate-600" />
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        className={actionButtonClassName}
                        aria-label={t("nodeDetails.neighborPanel", "Neighbor")}
                        onClick={handleRequestNeighborFromDialog}
                      >
                        <UsersIcon />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="rounded bg-slate-800 px-4 py-1 text-xs text-white dark:bg-slate-600">
                      {t("nodeDetails.neighborPanel", "Neighbor")}
                      <TooltipArrow className="fill-slate-800 dark:fill-slate-600" />
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        className={actionButtonClassName}
                        aria-label={t("nodeDetails.metricsPanel", "Environment")}
                        onClick={handleRequestEnvironmentFromDialog}
                      >
                        <BarChart2 />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="rounded bg-slate-800 px-4 py-1 text-xs text-white dark:bg-slate-600">
                      {t("nodeDetails.metricsPanel", "Environment")}
                      <TooltipArrow className="fill-slate-800 dark:fill-slate-600" />
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        className={actionButtonClassName}
                        onClick={handleToggleFavorite}
                      >
                        <StarIcon
                          className={cn(isFavoriteState ? "fill-yellow-400 stroke-yellow-400" : "")}
                        />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="rounded bg-slate-800 px-4 py-1 text-xs text-white dark:bg-slate-600">
                      {t("nodeDetails.toggleFavorite", "Toggle favorite")}
                      <TooltipArrow className="fill-slate-800 dark:fill-slate-600" />
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        className={actionButtonClassName}
                        aria-label={t("nodeDetails.share", "Share contact")}
                        onClick={() => {
                          try {
                            const url = buildSharedContactUrl(currentNode);
                            setShareUrl(url);
                            setShareOpen(true);
                          } catch (err) {
                            console.warn("failed to build shared contact url", err);
                            toast({
                              title: t("nodeDetail.shareError", "Failed to build share URL"),
                            });
                          }
                        }}
                      >
                        <Share2 />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="rounded bg-slate-800 px-4 py-1 text-xs text-white dark:bg-slate-600">
                      {t("nodeDetails.share", "Share contact")}
                      <TooltipArrow className="fill-slate-800 dark:fill-slate-600" />
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {currentNode.num !== nodeDB.myNodeNum && (
                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          className={actionButtonClassName}
                          aria-label={t("nodeDetails.remoteAdmin", "Remote Admin")}
                          onClick={handleRemoteAdmin}
                        >
                          <RadioTowerIcon />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="rounded bg-slate-800 px-4 py-1 text-xs text-white dark:bg-slate-600">
                        {t("nodeDetails.remoteAdmin", "Remote Admin")}
                        <TooltipArrow className="fill-slate-800 dark:fill-slate-600" />
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}

                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        className={cn(
                          actionButtonClassName,
                          isIgnoredState
                            ? "bg-red-500 text-white hover:bg-red-600 dark:bg-red-500 dark:text-white hover:dark:bg-red-600"
                            : "",
                        )}
                        onClick={handleToggleIgnored}
                      >
                        {isIgnoredState ? <BellIcon /> : <BellOffIcon />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="rounded bg-slate-800 px-4 py-1 text-xs text-white dark:bg-slate-600">
                      {isIgnoredState ? t("nodeDetails.unignoreNode") : t("nodeDetails.ignoreNode")}
                      <TooltipArrow className="fill-slate-800 dark:fill-slate-600" />
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="destructive"
                        size="icon"
                        className={actionButtonClassName}
                        onClick={handleNodeRemove}
                      >
                        <TrashIcon />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="rounded bg-slate-800 px-4 py-1 text-xs text-white dark:bg-slate-600">
                      {t("nodeDetails.removeNode")}
                      <TooltipArrow className="fill-slate-800 dark:fill-slate-600" />
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <Separator className="mb-2 mt-5" />

              <div className="flex flex-col flex-wrap space-x-1 space-y-1">
                <div className="flex flex-row space-x-2">
                  <div className="w-full rounded-lg bg-slate-100 p-3 text-slate-900 dark:bg-slate-800 dark:text-slate-100">
                    <p className="text-lg font-semibold">{t("nodeDetails.details")}</p>
                    <table className="table-fixed w-full">
                      <tbody>
                        <tr>
                          <td>{t("nodeDetails.nodeNumber")}</td>
                          <td>{currentNode.num}</td>
                        </tr>
                        <tr>
                          <td>{t("nodeDetails.nodeHexPrefix")}</td>
                          <td>!{numberToHexUnpadded(currentNode.num)}</td>
                        </tr>
                        <tr>
                          <td>{t("nodeDetails.role")}</td>
                          <td>
                            {Protobuf.Config.Config_DeviceConfig_Role[
                              currentNode.user?.role ?? 0
                            ]?.replace(/_/g, " ")}
                          </td>
                        </tr>
                        <tr>
                          <td>{t("nodeDetails.lastHeard")}</td>
                          <td>
                            {currentNode.lastHeard === 0 ? (
                              t("nodesTable.lastHeardStatus.never", {
                                ns: "nodes",
                              })
                            ) : (
                              <TimeAgo timestamp={currentNode.lastHeard * 1000} />
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td>{t("nodeDetails.hardware")}</td>
                          <td>
                            {(
                              Protobuf.Mesh.HardwareModel[currentNode.user?.hwModel ?? 0] ??
                              t("unknown.shortName")
                            ).replace(/_/g, " ")}
                          </td>
                        </tr>
                        <tr>
                          <td>{t("nodeDetails.messageable")}</td>
                          <td>{currentNode.user?.isUnmessagable ? t("no") : t("yes")}</td>
                        </tr>
                        <tr>
                          <td>{t("hops.label", { ns: "ui" })}</td>
                          <td>
                            {typeof currentNode.hopsAway === "number"
                              ? currentNode.hopsAway
                              : t("hopsUnknown.label", { ns: "ui" })}
                          </td>
                        </tr>
                        <tr>
                          <td>{t(" ")}</td>
                          <td>
                            <Button onClick={handleRequestNodeInfo} className="mt-0">
                              <Info className="mr-2" />
                              {t("Node Info")}
                            </Button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <DeviceImage
                    className="w-40 rounded-lg border-4 border-slate-200 p-2 dark:border-slate-800"
                    deviceType={
                      Protobuf.Mesh.HardwareModel[currentNode.user?.hwModel ?? 0] ?? "UNKNOWN"
                    }
                  />
                </div>
              </div>

              {shareOpen && (
                <div className="mt-4">
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
                                title: t("nodeDetails.shareCopied", "Copied URL to clipboard"),
                              });
                            } catch {
                              toast({ title: t("nodeDetails.shareCopyError", "Failed to copy") });
                            }
                          }}
                        >
                          {t("button.copy", "Copy")}
                        </Button>
                        <Button onClick={() => setShareOpen(false)}>{t("close", "Close")}</Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-3">
                <div className={sectionClassName}>
                  <p className="text-lg font-semibold">{t("nodeDetails.security")}</p>
                  <table className="table-auto w-full">
                    <tbody>
                      <tr>
                        <td className="pr-2">{t("nodeDetails.publicKey")}</td>
                        <td>
                          <pre className="pt-0.5 text-xs">
                            {currentNode.user?.publicKey && currentNode.user.publicKey.length > 0
                              ? fromByteArray(currentNode.user.publicKey)
                              : t("unknown.longName")}
                          </pre>
                        </td>
                      </tr>
                      <tr>
                        <td />
                        <td>
                          {currentNode.isKeyManuallyVerified
                            ? t("nodeDetails.KeyManuallyVerifiedTrue")
                            : t("nodeDetails.KeyManuallyVerifiedFalse")}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="mt-3 grid gap-3 grid-cols-1 justify-items-stretch">
                  {showNeighborPanel && (
                    <NeighborInfoPanel
                      className="w-full"
                      nodeNum={currentNode?.num ?? effectiveNodeNum}
                      neighborInfo={neighborInfo}
                      onOpenNode={(num: number) => openNestedNode(num)}
                    />
                  )}
                  {showEnvPanel && (
                    <EnvironmentMetricsPanel
                      className="w-full"
                      metrics={environmentMetricsForRender}
                    />
                  )}
                </div>

                {nestedStack.map((n, idx) => (
                  <NodeDetailsDialog
                    key={`${n}-${idx}`}
                    open={true}
                    onOpenChange={(open) => {
                      if (!open) {
                        setNestedStack((s) => s.filter((_, i) => i !== idx));
                      }
                    }}
                    nodeNum={n}
                    offsetPercent={offsetPercent + (idx + 1) * 10}
                  />
                ))}

                <div className={`${sectionClassName} mt-3`}>
                  <p className="text-lg font-semibold">{t("nodeDetails.position")}</p>

                  {currentNode.position ? (
                    <table className="table-auto w-full">
                      <tbody>
                        {currentNode.position.latitudeI && currentNode.position.longitudeI && (
                          <tr>
                            <td>{t("locationResponse.coordinates")}</td>
                            <td>
                              <a
                                className="text-blue-500 dark:text-blue-400"
                                href={`https://www.openstreetmap.org/?mlat=${
                                  currentNode.position.latitudeI / 1e7
                                }&mlon=${currentNode.position.longitudeI / 1e7}&layers=N`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {currentNode.position.latitudeI / 1e7},{" "}
                                {currentNode.position.longitudeI / 1e7}
                              </a>
                            </td>
                          </tr>
                        )}
                        {currentNode.position.altitude && (
                          <tr>
                            <td>{t("locationResponse.altitude")}</td>
                            <td>
                              {currentNode.position.altitude}
                              {t("unit.meter.suffix")}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  ) : (
                    <p>{t("unknown.longName")}</p>
                  )}

                  <Button
                    onClick={handleRequestPosition}
                    name="requestPosition"
                    className="mt-2"
                    disabled={isRequestingPosition}
                  >
                    <MapPinnedIcon className="mr-2" />
                    {t("nodeDetails.requestPosition")}
                  </Button>
                </div>

                {/* Utilization chart inserted between Position and Device Metrics */}
                <NodeSignalChart
                  snr={currentNode.snr}
                  rssi={
                    (currentNode as unknown as Protobuf.Mesh.NodeInfo & { rxRssi?: number })
                      .rxRssi ?? undefined
                  }
                  invertOrder={true}
                />

                <NodeMetricsChart
                  airUtilTx={currentNode.deviceMetrics?.airUtilTx}
                  channelUtilization={currentNode.deviceMetrics?.channelUtilization}
                />

                {currentNode.deviceMetrics && (
                  <div className={`${sectionClassName} mt-3`}>
                    <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {t("nodeDetails.deviceMetrics")}
                    </p>
                    <table className="table-fixed w-full">
                      <tbody>
                        {deviceMetricsMap
                          .filter((metric) => metric.value !== undefined)
                          .map((metric) => (
                            <tr key={metric.key}>
                              <td>{metric.label}: </td>
                              <td>{metric.format(metric.value ?? 0)}</td>
                            </tr>
                          ))}
                        {currentNode.deviceMetrics.uptimeSeconds && (
                          <tr>
                            <td>{t("nodeDetails.uptime")}</td>
                            <td>
                              <Uptime seconds={currentNode.deviceMetrics.uptimeSeconds} />
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="mt-3 w-full max-w-[464px] rounded-lg bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100">
                <Accordion className="AccordionRoot" type="single" collapsible>
                  <AccordionItem className="AccordionItem" value="item-1">
                    <AccordionTrigger>
                      <p className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                        {t("nodeDetails.allRawMetrics")}
                      </p>
                    </AccordionTrigger>
                    <AccordionContent className="overflow-x-scroll">
                      <pre className="w-full text-xs">{JSON.stringify(rawMetrics, null, 2)}</pre>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
