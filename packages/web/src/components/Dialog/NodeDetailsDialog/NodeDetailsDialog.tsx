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
  StarIcon,
  TrashIcon,
  UsersIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export interface NodeDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const NodeDetailsDialog = ({ open, onOpenChange }: NodeDetailsDialogProps) => {
  const { t } = useTranslation("dialog");
  const { setDialogOpen, connection, getNeighborInfo, id: deviceId } = useDevice();
  const nodeDB = useNodeDB();
  const navigate = useNavigate();
  const { setNodeNumToBeRemoved, nodeNumDetails } = useAppStore();
  const { updateFavorite } = useFavoriteNode();
  const { updateIgnored } = useIgnoreNode();

  const node = nodeDB.getNode(nodeNumDetails);
  const environmentMetrics = node ? nodeDB.getEnvironmentMetrics(node.num) : undefined;

  const [isFavoriteState, setIsFavoriteState] = useState<boolean>(node?.isFavorite ?? false);
  const [isIgnoredState, setIsIgnoredState] = useState<boolean>(node?.isIgnored ?? false);

  useEffect(() => {
    if (!node) {
      return;
    }
    setIsFavoriteState(node.isFavorite);
    setIsIgnoredState(node.isIgnored);
  }, [node]);

  if (!node) {
    return null;
  }

  const currentNode = node;
  const neighborInfo = getNeighborInfo(currentNode.num);

  function handleDirectMessage() {
    navigate({ to: `/messages/direct/${currentNode.num}` });
    setDialogOpen("nodeDetails", false);
  }

  function handleRequestPosition() {
    toast({
      title: t("toast.requestingPosition.title", { ns: "ui" }),
    });

    connection?.requestPosition(currentNode.num).then(() =>
      toast({
        title: t("toast.positionRequestSent.title", { ns: "ui" }),
      }),
    );

    onOpenChange(false);
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
    try {
      toast({ title: t("toast.requestingNeighbor.title", { ns: "ui" }) });
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
    try {
      toast({ title: t("toast.requestingMetrics.title", { ns: "ui" }) });
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

  const deviceMetricsMap = [
    {
      key: "airUtilTx",
      label: t("nodeDetails.airTxUtilization"),
      value: currentNode.deviceMetrics?.airUtilTx,
      format: (val: number) => `${val.toFixed(2)}%`,
    },
    {
      key: "channelUtilization",
      label: t("nodeDetails.channelUtilization"),
      value: currentNode.deviceMetrics?.channelUtilization,
      format: (val: number) => `${val.toFixed(2)}%`,
    },
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogClose />
        <DialogHeader>
          <DialogTitle>
            {t("nodeDetails.title", {
              interpolation: { escapeValue: false },
              identifier: `${currentNode.user?.longName ?? t("unknown.shortName")} (${
                currentNode.user?.shortName ?? t("unknown.shortName")
              })`,
            })}
          </DialogTitle>
        </DialogHeader>

        <DialogFooter>
          <div className="w-full">
            <div className="flex flex-row flex-wrap items-center justify-evenly gap-2">
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      className="mr-1 p-2"
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
                      className="mr-1 p-2"
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
                      className="mr-1 p-2"
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
                      className="mr-1 p-2"
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
                    <Button className="mr-1 p-2" onClick={handleToggleFavorite}>
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

              <div className="flex flex-1 justify-start" />

              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      className={cn(
                        "mr-1 flex justify-end text-white",
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
                      className="flex justify-end"
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

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <NeighborInfoPanel nodeNum={currentNode.num} neighborInfo={neighborInfo} />
                <EnvironmentMetricsPanel metrics={environmentMetrics} />
              </div>

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

                <Button onClick={handleRequestPosition} name="requestPosition" className="mt-2">
                  <MapPinnedIcon className="mr-2" />
                  {t("nodeDetails.requestPosition")}
                </Button>
              </div>

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
                    <pre className="w-full text-xs">{JSON.stringify(currentNode, null, 2)}</pre>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
