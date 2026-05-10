import { LocationResponseDialog } from "@app/components/Dialog/LocationResponseDialog.tsx";
import { TracerouteResponseDialog } from "@app/components/Dialog/TracerouteResponseDialog.tsx";
import { GatewayHeader } from "@components/PageComponents/DarkMesh/GatewayHeader.tsx";
import { FilterControl } from "@components/generic/Filter/FilterControl.tsx";
import { type FilterState, useFilterNode } from "@components/generic/Filter/useFilterNode.ts";
import { Mono } from "@components/generic/Mono.tsx";
import { type DataRow, type Heading, Table } from "@components/generic/Table/index.tsx";
// TimeAgo not used here (we use compact labels)
import { PageLayout } from "@components/PageLayout.tsx";
import { Sidebar } from "@components/Sidebar.tsx";
import { Avatar } from "@components/UI/Avatar.tsx";
import { Button } from "@components/UI/Button.tsx";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@components/UI/Dialog.tsx";
import { Input } from "@components/UI/Input.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "@components/UI/Popover.tsx";
import useLang from "@core/hooks/useLang.ts";
import { useFavoriteNode } from "@core/hooks/useFavoriteNode.ts";
import { useIgnoreNode } from "@core/hooks/useIgnoreNode.ts";
import { useToast } from "@core/hooks/useToast.ts";
import { requestNeighborInfo, startVisualTraceroute } from "@core/services/darkmesh/nodeActions.ts";
import { useAppStore, useDevice, useDeviceStore, useNodeDB } from "@core/stores";
import { Protobuf, type Types } from "@meshtastic/core";
import {
  buildSharedContactUrl,
  getNodeShortName,
  getNodeLongName,
  getPacketRxTimeDate,
  getPacketRxTimeMs,
} from "@app/darkmesh/utils.ts";
import { getColorFromNodeNum, isLightColor } from "@core/utils/color.ts";
import {
  getDirectMessageNavigationBlockDescription,
  shouldBlockDirectMessageNavigation,
} from "@core/utils/directMessageKeyExchange.ts";
import { distanceBetweenPositions, hasPos, positionPoint } from "@core/utils/geo.ts";
import { normalizeNodeStatus } from "@core/utils/nodeStatus.ts";
import { numberToHexUnpadded } from "@noble/curves/abstract/utils";
import {
  ArrowLeftIcon,
  BatteryIcon,
  BatteryChargingIcon,
  BriefcaseIcon,
  CheckIcon,
  ChevronRightIcon,
  ClockIcon,
  CopyIcon,
  CpuIcon,
  HashIcon,
  InfoIcon,
  ListFilterIcon,
  LockIcon,
  LockOpenIcon,
  MapPinIcon,
  PlugZapIcon,
  RadioTowerIcon,
  RouteIcon,
  SearchIcon,
  Share2Icon,
  StarIcon,
  UserIcon,
  UsersIcon,
} from "lucide-react";
import {
  type ComponentType,
  type CSSProperties,
  type JSX,
  type ReactNode,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { type NeighborDiscoveryRecord, useDarkMeshStore } from "@app/darkmesh/store.ts";
import { fromByteArray } from "base64-js";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { QRCode } from "react-qrcode-logo";
import {
  getSnrTone,
  getRssiTone,
  SNR_GOOD_THRESHOLD,
  SNR_FAIR_THRESHOLD,
  RSSI_GOOD_THRESHOLD,
  RSSI_FAIR_THRESHOLD,
} from "@components/PageComponents/DarkMesh/GatewayHeader.tsx";
// removed unused base16 import (MAC column removed)

const NODEDB_DEBOUNCE_MS = 250;
const ONLINE_NODE_MAX_AGE_SECONDS = 900;

function isMobileResponsiveViewport(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
}

type MobileNodeSort =
  | "recent"
  | "az"
  | "distance"
  | "hop"
  | "channel"
  | "mqtt"
  | "favorite"
  | "infrastructure"
  | "online";

const MOBILE_NODE_SORT_OPTIONS: { id: MobileNodeSort; label: string }[] = [
  { id: "recent", label: "Ricevuto più di recente" },
  { id: "az", label: "A-Z" },
  { id: "distance", label: "Distanza" },
  { id: "hop", label: "Distanza in Hop" },
  { id: "channel", label: "Canale" },
  { id: "mqtt", label: "via MQTT" },
  { id: "favorite", label: "By Favorite" },
  { id: "infrastructure", label: "By Infrastructure" },
  { id: "online", label: "Online Only" },
];
const MOBILE_NODE_PREFS_KEY = "darkmesh-mobile-node-prefs";

function loadMobileNodePrefs() {
  if (typeof window === "undefined") return undefined;

  try {
    return JSON.parse(window.sessionStorage.getItem(MOBILE_NODE_PREFS_KEY) ?? "null") as
      | {
          sort?: MobileNodeSort;
          includeUnknown?: boolean;
          showDetails?: boolean;
        }
      | undefined;
  } catch {
    return undefined;
  }
}

export interface DeleteNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatNameHex(nodeNum: number, node?: Protobuf.Mesh.NodeInfo): string {
  const explicit =
    (node?.user as unknown as { nameHex?: string } | undefined)?.nameHex ??
    (node as unknown as { nameHex?: string } | undefined)?.nameHex;
  if (explicit) {
    return explicit.startsWith("!") ? explicit : `!${explicit}`;
  }
  return `!${numberToHexUnpadded(nodeNum).toUpperCase()}`;
}

function formatLastHeard(lastHeard?: number): string {
  if (!lastHeard) {
    return "n/a";
  }
  const seconds = Math.max(0, Math.round((Date.now() - lastHeard * 1000) / 1000));
  if (seconds < 90) {
    return "now";
  }
  if (seconds < 3600) {
    return `${Math.round(seconds / 60)} min`;
  }
  if (seconds < 86400) {
    return `${Math.round(seconds / 3600)} h`;
  }
  return `${Math.round(seconds / 86400)} d`;
}

function formatRole(role?: Protobuf.Config.Config_DeviceConfig_Role): string | undefined {
  if (role === undefined) {
    return undefined;
  }
  const raw = Protobuf.Config.Config_DeviceConfig_Role[role];
  return raw ? raw.replaceAll("_", " ") : undefined;
}

function formatHardwareModel(hwModel?: Protobuf.Mesh.HardwareModel): string | undefined {
  if (hwModel === undefined || hwModel === Protobuf.Mesh.HardwareModel.UNSET) {
    return undefined;
  }
  const raw = Protobuf.Mesh.HardwareModel[hwModel];
  return raw ? raw.replaceAll("_", "-").replaceAll("p", ".").toLowerCase() : `${hwModel}`;
}

function formatDistance(distanceKm?: number): string | undefined {
  if (distanceKm === undefined) {
    return undefined;
  }
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)} km`;
}

function getNodeDistance(node: Protobuf.Mesh.NodeInfo, myNode?: Protobuf.Mesh.NodeInfo): number {
  if (myNode && hasPos(myNode.position) && hasPos(node.position)) {
    return distanceBetweenPositions(myNode.position, node.position) ?? Number.POSITIVE_INFINITY;
  }
  return Number.POSITIVE_INFINITY;
}

function getNodeDisplayName(node: Protobuf.Mesh.NodeInfo): string {
  return getNodeLongName(node) ?? getNodeShortName(node) ?? formatNameHex(node.num, node);
}

function isUnknownNode(node: Protobuf.Mesh.NodeInfo): boolean {
  return !(node.user?.publicKey && node.user.publicKey.length > 0);
}

function isOnlineNode(node: Protobuf.Mesh.NodeInfo): boolean {
  if (!node.lastHeard) {
    return false;
  }
  return Date.now() / 1000 - node.lastHeard <= ONLINE_NODE_MAX_AGE_SECONDS;
}

function isInfrastructureNode(node: Protobuf.Mesh.NodeInfo): boolean {
  const roleName = formatRole(node.user?.role)?.toUpperCase() ?? "";
  return (
    roleName.includes("ROUTER") ||
    roleName.includes("REPEATER") ||
    roleName.includes("INFRASTRUCTURE")
  );
}

function getNodeChannelSortValue(node: Protobuf.Mesh.NodeInfo): number {
  const channel = (node as Protobuf.Mesh.NodeInfo & { channel?: number; channelIndex?: number })
    .channel;
  const channelIndex = (
    node as Protobuf.Mesh.NodeInfo & { channel?: number; channelIndex?: number }
  ).channelIndex;
  return channel ?? channelIndex ?? Number.MAX_SAFE_INTEGER;
}

function getNodeDisplayChannel(node: Protobuf.Mesh.NodeInfo): number | undefined {
  const channel = (node as Protobuf.Mesh.NodeInfo & { channel?: number; channelIndex?: number })
    .channel;
  const channelIndex = (
    node as Protobuf.Mesh.NodeInfo & { channel?: number; channelIndex?: number }
  ).channelIndex;
  const nodeChannel = channel ?? channelIndex;

  if (nodeChannel === undefined || nodeChannel === 0) {
    return undefined;
  }

  return nodeChannel;
}

function formatPosition(position?: Protobuf.Mesh.Position) {
  if (!hasPos(position)) {
    return undefined;
  }
  const validPosition = position as Protobuf.Mesh.Position;
  const latitude = Number(validPosition.latitudeI) / 1e7;
  const longitude = Number(validPosition.longitudeI) / 1e7;
  return {
    latitude,
    longitude,
    label: `${latitude.toFixed(6)} ${longitude.toFixed(6)}`,
  };
}

function getNodeBaseColorStyle(nodeNum: number): CSSProperties {
  const bg = getColorFromNodeNum(nodeNum);
  return {
    backgroundColor: `rgb(${bg.r}, ${bg.g}, ${bg.b})`,
    color: isLightColor(bg) ? "#0b0b0b" : "#ffffff",
  };
}

function getNodeStatusText(node: Protobuf.Mesh.NodeInfo): string | undefined {
  return normalizeNodeStatus((node as Protobuf.Mesh.NodeInfo & { nodeStatus?: string }).nodeStatus);
}

function getBatteryLabel(node: Protobuf.Mesh.NodeInfo): { label: string; plugged: boolean } {
  const metrics = node.deviceMetrics as
    | (Protobuf.Telemetry.DeviceMetrics & {
        powerSupplyStatus?: number;
        isCharging?: boolean;
        hasPower?: boolean;
      })
    | undefined;
  const batteryLevel = metrics?.batteryLevel;
  const plugged =
    Boolean(metrics?.isCharging || metrics?.hasPower) ||
    Boolean(metrics?.powerSupplyStatus && metrics.powerSupplyStatus > 0) ||
    batteryLevel === 101;
  const battery =
    batteryLevel === undefined ? "n/a" : batteryLevel === 101 ? "plugged" : `${batteryLevel}%`;
  const voltage =
    typeof metrics?.voltage === "number" ? ` ${Math.abs(metrics.voltage).toFixed(2)}V` : "";
  return { label: `${battery}${voltage}`, plugged };
}

function EncryptionIcon({
  node,
  hasError,
  onCopyPublicKey,
}: {
  node: Protobuf.Mesh.NodeInfo;
  hasError: boolean;
  onCopyPublicKey?: (publicKey: Uint8Array) => void;
}) {
  if (hasError) {
    return <LockOpenIcon className="size-6 text-red-500" aria-label="Encryption error" />;
  }
  if (node.user?.publicKey && node.user.publicKey.length > 0) {
    return (
      <button
        type="button"
        className="rounded-full p-1 text-[#27c847] active:bg-white/10"
        aria-label="Copy public key"
        title="Copy public key"
        onClick={() => onCopyPublicKey?.(node.user?.publicKey ?? new Uint8Array())}
      >
        <LockIcon className="size-6" />
      </button>
    );
  }
  return <LockOpenIcon className="size-6 text-yellow-400" aria-label="Public key missing" />;
}

const NodesPage = (): JSX.Element => {
  const { t } = useTranslation(["nodes", "ui"]);
  useLang();
  const device = useDevice();
  const { hardware, connection, setDialogOpen } = device;
  const { updateFavorite } = useFavoriteNode();
  const { updateIgnored } = useIgnoreNode();
  const { toast } = useToast();
  const navigate = useNavigate({ from: "/" });

  const { setNodeNumDetails } = useAppStore();
  const { nodeFilter, defaultFilterValues, isFilterDirty } = useFilterNode();

  const [selectedTraceroute, setSelectedTraceroute] = useState<
    Types.PacketMetadata<Protobuf.Mesh.RouteDiscovery> | undefined
  >();
  const [selectedLocation, setSelectedLocation] = useState<
    Types.PacketMetadata<Protobuf.Mesh.Position> | undefined
  >();
  const [mobileActionNode, setMobileActionNode] = useState<number | undefined>();
  const [selectedNodeInfo, setSelectedNodeInfo] = useState<number | undefined>();
  const [selectedNeighborNode, setSelectedNeighborNode] = useState<number | undefined>();
  const [selectedNeighborResponse, setSelectedNeighborResponse] = useState<
    Protobuf.Mesh.NeighborInfo | undefined
  >();
  const [selectedTracerouteDurationMs, setSelectedTracerouteDurationMs] = useState<
    number | undefined
  >();
  const [pendingNeighborNode, setPendingNeighborNode] = useState<number | undefined>();
  const [pendingNodeInfoNode, setPendingNodeInfoNode] = useState<number | undefined>();
  const [pendingMetadataNode, setPendingMetadataNode] = useState<number | undefined>();
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [mobileSort, setMobileSort] = useState<MobileNodeSort>(
    () => loadMobileNodePrefs()?.sort ?? "recent",
  );
  const [includeUnknownNodes, setIncludeUnknownNodes] = useState(
    () => loadMobileNodePrefs()?.includeUnknown ?? true,
  );
  const [showNodeDetails, setShowNodeDetails] = useState(
    () => loadMobileNodePrefs()?.showDetails ?? true,
  );
  const pendingTracerouteNodeRef = useRef<number | undefined>(undefined);
  const pendingTracerouteStartedAtRef = useRef<number | undefined>(undefined);
  const pendingNeighborNodeRef = useRef<number | undefined>(undefined);
  const [filterState, setFilterState] = useState<FilterState>(() => defaultFilterValues);
  const deferredFilterState = useDeferredValue(filterState);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        MOBILE_NODE_PREFS_KEY,
        JSON.stringify({
          sort: mobileSort,
          includeUnknown: includeUnknownNodes,
          showDetails: showNodeDetails,
        }),
      );
    } catch {
      // ignore storage failures
    }
  }, [includeUnknownNodes, mobileSort, showNodeDetails]);

  // stable predicate so the selector identity doesn’t thrash
  const predicate = useCallback(
    (node: Protobuf.Mesh.NodeInfo) => nodeFilter(node, deferredFilterState),
    [nodeFilter, deferredFilterState],
  );

  // subscribe to actual data (nodes array) and to nodeErrors ref for badge updates
  const { nodes: filteredNodes, hasNodeError } = useNodeDB(
    (db) => ({
      nodes: db.getNodes(predicate, true),
      hasNodeError: db.hasNodeError,
      _errorsRef: db.nodeErrors, // include the Map ref so UI also re-renders on error changes
    }),
    { debounce: NODEDB_DEBOUNCE_MS },
  );
  const gateways = useDarkMeshStore((s) => s.gatewaysByDevice);
  const setHighlightedNeighborNode = useDarkMeshStore((s) => s.setHighlightedNeighborNode);
  const addNeighborDiscoveryRecord = useDarkMeshStore((s) => s.addNeighborDiscoveryRecord);
  const selectedStoreTraceRoute = useDarkMeshStore((s) => s.selectedTraceRoute);
  const neighborDiscoveryRecords =
    useDarkMeshStore((s) => s.neighborDiscoveryByDevice?.[device.id]) ?? {};
  const pendingNeighborInfo = useDeviceStore((s) => {
    const pendingNode = pendingNeighborNode;
    if (pendingNode === undefined) {
      return undefined;
    }
    return s.getDevice(device.id)?.neighborInfo.get(pendingNode);
  });

  const openTracerouteDialog = useCallback(
    (traceroute: Types.PacketMetadata<Protobuf.Mesh.RouteDiscovery>) => {
      setSelectedTracerouteDurationMs(
        pendingTracerouteStartedAtRef.current !== undefined
          ? Date.now() - pendingTracerouteStartedAtRef.current
          : undefined,
      );
      setSelectedTraceroute(traceroute);
      pendingTracerouteNodeRef.current = undefined;
      pendingTracerouteStartedAtRef.current = undefined;
    },
    [],
  );

  const openNeighborDialog = useCallback(
    (nodeNum: number, neighborInfo: Protobuf.Mesh.NeighborInfo) => {
      addNeighborDiscoveryRecord(device.id, nodeNum, neighborInfo);
      setSelectedNeighborResponse(neighborInfo);
      setSelectedNeighborNode(nodeNum);
      pendingNeighborNodeRef.current = undefined;
      setPendingNeighborNode(undefined);
    },
    [addNeighborDiscoveryRecord, device.id],
  );

  const closeNeighborDiscoveryProcess = useCallback(() => {
    setSelectedNeighborNode(undefined);
    setSelectedNeighborResponse(undefined);
    if (isMobileResponsiveViewport()) {
      setHighlightedNeighborNode(undefined);
    }
  }, [setHighlightedNeighborNode]);

  const handleTraceroute = useCallback(
    (traceroute: Types.PacketMetadata<Protobuf.Mesh.RouteDiscovery>) => {
      const pendingNode = pendingTracerouteNodeRef.current;
      if (pendingNode === undefined) {
        return;
      }
      if (traceroute.from.valueOf() !== pendingNode) {
        return;
      }
      openTracerouteDialog(traceroute);
    },
    [openTracerouteDialog],
  );

  const handleLocation = useCallback(
    (location: Types.PacketMetadata<Protobuf.Mesh.Position>) => {
      if (
        location.to.valueOf() !== hardware.myNodeNum ||
        location.from.valueOf() === hardware.myNodeNum
      ) {
        return;
      }
      setSelectedLocation(location);
    },
    [hardware.myNodeNum],
  );

  const handleNeighborInfo = useCallback(
    (neighborInfo: Types.PacketMetadata<Protobuf.Mesh.NeighborInfo>) => {
      const pendingNode = pendingNeighborNodeRef.current;
      if (pendingNode === undefined || neighborInfo.from.valueOf() !== pendingNode) {
        return;
      }
      openNeighborDialog(pendingNode, neighborInfo.data);
    },
    [openNeighborDialog],
  );

  const handleNodeInfoResponse = useCallback(
    (nodeInfo: Protobuf.Mesh.NodeInfo) => {
      if (pendingNodeInfoNode === undefined || nodeInfo.num !== pendingNodeInfoNode) {
        return;
      }
      toast({
        title: "Informazioni nodo ricevute",
        description: getNodeDisplayName(nodeInfo),
      });
      setPendingNodeInfoNode(undefined);
    },
    [pendingNodeInfoNode, toast],
  );

  const handleUserResponse = useCallback(
    (user: Types.PacketMetadata<Protobuf.Mesh.User>) => {
      if (pendingNodeInfoNode === undefined || user.from.valueOf() !== pendingNodeInfoNode) {
        return;
      }
      toast({
        title: "Informazioni utente ricevute",
        description:
          user.data.longName || user.data.shortName || formatNameHex(user.from.valueOf()),
      });
      setPendingNodeInfoNode(undefined);
    },
    [pendingNodeInfoNode, toast],
  );

  const handleMetadataResponse = useCallback(
    (metadata: Types.PacketMetadata<Protobuf.Mesh.DeviceMetadata>) => {
      if (pendingMetadataNode === undefined || metadata.from.valueOf() !== pendingMetadataNode) {
        return;
      }
      toast({
        title: "Metadata ricevuti",
        description: metadata.data.firmwareVersion || formatNameHex(metadata.from.valueOf()),
      });
      setPendingMetadataNode(undefined);
    },
    [pendingMetadataNode, toast],
  );

  function handleNodeInfoDialog(nodeNum: number): void {
    setNodeNumDetails(nodeNum);
    setDialogOpen("nodeDetails", true);
  }

  useEffect(() => {
    if (!connection) {
      return;
    }
    connection.events.onTraceRoutePacket.subscribe(handleTraceroute);
    return () => {
      connection.events.onTraceRoutePacket.unsubscribe(handleTraceroute);
    };
  }, [connection, handleTraceroute]);

  useEffect(() => {
    if (!selectedStoreTraceRoute) {
      return;
    }
    const pendingNode = pendingTracerouteNodeRef.current;
    if (pendingNode === undefined || selectedStoreTraceRoute.from.valueOf() !== pendingNode) {
      return;
    }
    openTracerouteDialog(selectedStoreTraceRoute);
  }, [openTracerouteDialog, selectedStoreTraceRoute]);

  useEffect(() => {
    if (!connection) {
      return;
    }
    connection.events.onPositionPacket.subscribe(handleLocation);
    return () => {
      connection.events.onPositionPacket.unsubscribe(handleLocation);
    };
  }, [connection, handleLocation]);

  useEffect(() => {
    if (!connection) {
      return;
    }
    connection.events.onNeighborInfoPacket.subscribe(handleNeighborInfo);
    return () => {
      connection.events.onNeighborInfoPacket.unsubscribe(handleNeighborInfo);
    };
  }, [connection, handleNeighborInfo]);

  useEffect(() => {
    const pendingNode = pendingNeighborNodeRef.current;
    if (pendingNode === undefined || pendingNeighborInfo === undefined) {
      return;
    }
    openNeighborDialog(pendingNode, pendingNeighborInfo);
  }, [openNeighborDialog, pendingNeighborInfo]);

  useEffect(() => {
    if (!connection) {
      return;
    }
    connection.events.onNodeInfoPacket.subscribe(handleNodeInfoResponse);
    connection.events.onUserPacket.subscribe(handleUserResponse);
    connection.events.onDeviceMetadataPacket.subscribe(handleMetadataResponse);
    return () => {
      connection.events.onNodeInfoPacket.unsubscribe(handleNodeInfoResponse);
      connection.events.onUserPacket.unsubscribe(handleUserResponse);
      connection.events.onDeviceMetadataPacket.unsubscribe(handleMetadataResponse);
    };
  }, [connection, handleMetadataResponse, handleNodeInfoResponse, handleUserResponse]);

  useEffect(() => {
    if (pendingNeighborNode === undefined) {
      return;
    }
    const timeout = window.setTimeout(() => {
      pendingNeighborNodeRef.current = undefined;
      setPendingNeighborNode(undefined);
      toast({
        title: "Neighbor discovery",
        description: "Nessuna risposta ricevuta entro il timeout.",
      });
    }, 30_000);
    return () => window.clearTimeout(timeout);
  }, [pendingNeighborNode, toast]);

  useEffect(() => {
    if (pendingNodeInfoNode === undefined && pendingMetadataNode === undefined) {
      return;
    }
    const timeout = window.setTimeout(() => {
      setPendingNodeInfoNode(undefined);
      setPendingMetadataNode(undefined);
      toast({
        title: "Richiesta nodo",
        description: "Nessuna risposta ricevuta entro il timeout.",
      });
    }, 30_000);
    return () => window.clearTimeout(timeout);
  }, [pendingMetadataNode, pendingNodeInfoNode, toast]);

  const nodeDB = useNodeDB();
  const myNode = nodeDB.getNode ? nodeDB.getNode(hardware.myNodeNum) : undefined;
  const mobileNodes = useMemo(() => {
    const sorted = filteredNodes
      .filter((node) => includeUnknownNodes || !isUnknownNode(node))
      .filter((node) => mobileSort !== "online" || isOnlineNode(node))
      .slice();

    sorted.sort((a, b) => {
      if (a.num === hardware.myNodeNum) {
        return -1;
      }
      if (b.num === hardware.myNodeNum) {
        return 1;
      }

      switch (mobileSort) {
        case "az":
          return getNodeDisplayName(a).localeCompare(getNodeDisplayName(b));
        case "distance":
          return getNodeDistance(a, myNode) - getNodeDistance(b, myNode);
        case "hop":
          return (a.hopsAway ?? Number.MAX_SAFE_INTEGER) - (b.hopsAway ?? Number.MAX_SAFE_INTEGER);
        case "channel":
          return getNodeChannelSortValue(a) - getNodeChannelSortValue(b);
        case "mqtt":
          return Number(b.viaMqtt === true) - Number(a.viaMqtt === true);
        case "favorite":
          return Number(b.isFavorite) - Number(a.isFavorite);
        case "infrastructure":
          return Number(isInfrastructureNode(b)) - Number(isInfrastructureNode(a));
        case "online":
        case "recent":
        default:
          return (b.lastHeard ?? 0) - (a.lastHeard ?? 0);
      }
    });

    return sorted;
  }, [filteredNodes, hardware.myNodeNum, includeUnknownNodes, mobileSort, myNode]);

  const tableHeadings: Heading[] = [
    { title: "", sortable: false },
    { title: t("nodesTable.headings.longName"), sortable: true },
    { title: t("nodesTable.headings.distance", "Distance"), sortable: true },
    { title: t("nodesTable.headings.connection"), sortable: true },
    { title: t("nodesTable.headings.lastHeard"), sortable: true },
    { title: t("nodesTable.headings.encryption"), sortable: false },
    { title: t("nodesTable.headings.role", "Role"), sortable: true },
    {
      title: t("nodesTable.headings.utilization", "Air/Ch Util"),
      sortable: true,
    },
    { title: t("nodesTable.headings.snrRssi", "SNR RSSI"), sortable: true },
  ];

  const tableRows: DataRow[] = filteredNodes.map((node) => {
    // MAC Address column removed — no client-side MAC formatting here

    const shortName =
      getNodeShortName(node) ??
      (node ? `!${numberToHexUnpadded(node.num).toUpperCase()}` : t("unknown.shortName"));
    const longName =
      getNodeLongName(node) ??
      (node ? `!${numberToHexUnpadded(node.num).toUpperCase()}` : t("unknown.longName"));

    // precompute small-spark values for SNR/RSSI mini-graphs using Gateway thresholds
    const snrSpan = Math.abs(SNR_GOOD_THRESHOLD - SNR_FAIR_THRESHOLD) || 8;
    const snrMin = SNR_FAIR_THRESHOLD - snrSpan;
    const snrMax = SNR_GOOD_THRESHOLD + snrSpan;
    const snrWidth = Math.round(
      Math.min(Math.max((node.snr - snrMin) / (snrMax - snrMin), 0), 1) * 100,
    );
    const snrTone = getSnrTone(node.snr);
    const gateway = gateways?.[node.num];
    type NodeInfoWithRx = Protobuf.Mesh.NodeInfo & { rxRssi?: number };
    const nodeExt = node as NodeInfoWithRx;
    // prefer the node's observed rxRssi when available; fall back to gateway-observed
    const rxRssiVal = nodeExt.rxRssi ?? gateway?.rxRssi;
    const rssiSpan = Math.abs(RSSI_GOOD_THRESHOLD - RSSI_FAIR_THRESHOLD) || 11;
    const rssiMin = RSSI_FAIR_THRESHOLD - rssiSpan;
    const rssiMax = RSSI_GOOD_THRESHOLD + rssiSpan;
    const rssiWidth = Math.round(
      (typeof rxRssiVal === "number"
        ? Math.min(Math.max((rxRssiVal - rssiMin) / (rssiMax - rssiMin), 0), 1)
        : 0) * 100,
    );
    const rssiTone = getRssiTone(rxRssiVal as number | undefined);

    // compute compact Last Heard label here (avoid nested declarations in JSX)
    let lastHeardContent: JSX.Element | string;
    if (node.lastHeard === 0) {
      lastHeardContent = t("unknown.longName");
    } else {
      const diffInSeconds = (Date.now() - node.lastHeard * 1000) / 1000;
      const abs = Math.abs(Math.round(diffInSeconds));
      if (abs >= 60) {
        const mins = Math.round(abs / 60);
        lastHeardContent = `${mins} min`;
      } else {
        lastHeardContent = `${abs} sec`;
      }
    }

    // compute distance relative to local node when possible
    const distanceVal =
      myNode && hasPos(myNode.position) && hasPos(node.position)
        ? distanceBetweenPositions(myNode.position, node.position)
        : undefined;

    return {
      id: node.num,
      isFavorite: node.isFavorite,
      cells: [
        {
          content: (
            <div style={{ width: "fit-content", maxWidth: "fit-content" }}>
              <div className="mx-auto" style={{ width: "2.25rem" }}>
                <Avatar
                  nodeNum={node.num}
                  className={hasNodeError(node.num) ? "text-red-500" : undefined}
                  showError={hasNodeError(node.num)}
                  showFavorite={node.isFavorite}
                  size="sm"
                />
              </div>
            </div>
          ),
          sortValue: shortName,
        },
        {
          content: (
            <button
              type="button"
              onMouseDown={() => handleNodeInfoDialog(node.num)}
              onKeyUp={(evt) => {
                if (evt.key === "Enter") {
                  handleNodeInfoDialog(node.num);
                }
              }}
              className="cursor-pointer ml-2 whitespace-break-spaces text-left"
            >
              <div className="underline font-medium">{longName}</div>
              <div className="text-xs text-text-secondary mt-0.5">
                {(node.user as unknown as { nameHex?: string })?.nameHex ??
                  `!${numberToHexUnpadded(node.num).toUpperCase()}`}
              </div>
            </button>
          ),
          sortValue: longName,
        },
        {
          content: (
            <div
              style={{ width: "fit-content", maxWidth: "fit-content" }}
              className="text-[0.75rem]"
            >
              {typeof distanceVal === "number"
                ? `${distanceVal.toFixed(2)} km`
                : t("unknown.shortName")}
            </div>
          ),
          sortValue: typeof distanceVal === "number" ? distanceVal : Number.POSITIVE_INFINITY,
        },
        {
          content: (
            <div
              style={{ width: "fit-content", maxWidth: "fit-content" }}
              className="text-[0.75rem]"
            >
              {node.hopsAway !== undefined ? (
                node?.viaMqtt === false && node.hopsAway === 0 ? (
                  t("nodesTable.connectionStatus.direct")
                ) : (
                  <span>
                    {node.hopsAway?.toString()} {"Hop"}{" "}
                    {node?.viaMqtt === true ? t("nodesTable.connectionStatus.viaMqtt") : ""}
                  </span>
                )
              ) : (
                t("unknown.longName")
              )}
            </div>
          ),
          sortValue: node.hopsAway ?? Number.MAX_SAFE_INTEGER,
        },
        {
          content: (
            <div
              style={{ width: "fit-content", maxWidth: "fit-content" }}
              className="text-[0.75rem]"
            >
              <span className="font-mono text-[0.75rem] text-text-secondary">
                {lastHeardContent}
              </span>
            </div>
          ),
          sortValue: node.lastHeard,
        },
        {
          content: (
            <Mono>
              {node.user?.publicKey && node.user?.publicKey.length > 0 ? (
                <LockIcon className="text-green-600 mx-auto" />
              ) : (
                <LockOpenIcon className="text-yellow-300 mx-auto" />
              )}
            </Mono>
          ),
          sortValue: "", // Non-sortable column
        },
        {
          content: (
            <div
              style={{ width: "fit-content", maxWidth: "fit-content" }}
              className="text-[0.75rem]"
            >
              <span className="font-mono text-[0.75rem] text-text-secondary">
                {
                  Protobuf.Config.Config_DeviceConfig_Role[
                    node.user?.role ?? Protobuf.Config.Config_DeviceConfig_Role.CLIENT
                  ]
                }
              </span>
            </div>
          ),
          sortValue: node.user?.role ?? Protobuf.Config.Config_DeviceConfig_Role.CLIENT,
        },
        {
          content: (
            <div className="text-[0.65rem]">
              <div className="flex flex-col" style={{ width: "7rem", maxWidth: "7rem" }}>
                <div className="flex items-center">
                  <div className="pr-1" style={{ width: "3rem" }}>
                    <div className="w-full h-2 bg-slate-200 rounded overflow-hidden">
                      <div
                        className="h-2 rounded"
                        style={{
                          width: `${Math.round(Math.min((Math.max(Math.log10((node.deviceMetrics?.airUtilTx ?? 0) + 1) - Math.log10(1), 0) / (Math.log10(10 + 1) - Math.log10(1) || 1)) * 100, 0))}%`,
                          background: `hsl(${Math.round(Math.min(Math.max(((node.deviceMetrics?.airUtilTx ?? 0) / 10) * 10, 0), 1) * 120)} 85% 45%)`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="ml-2 text-xs text-right">
                    {(node.deviceMetrics?.airUtilTx ?? 0).toFixed(2)}%
                  </div>
                </div>

                <div className="flex items-center">
                  <div className="pr-1" style={{ width: "3rem" }}>
                    <div className="w-full h-2 bg-slate-200 rounded overflow-hidden">
                      <div
                        className="h-2 rounded"
                        style={{
                          width: `${Math.round(Math.min(Math.max(node.deviceMetrics?.channelUtilization ?? 0, 0), 100))}%`,
                          background: `hsl(${Math.round(Math.min(Math.max((node.deviceMetrics?.channelUtilization ?? 0) / 100, 0), 1) * 120)} 85% 45%)`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="ml-2 text-xs text-right">
                    {(node.deviceMetrics?.channelUtilization ?? 0).toFixed(2)}%
                  </div>
                </div>
              </div>
            </div>
          ),
          sortValue: node.deviceMetrics?.airUtilTx ?? 0,
        },
        {
          content: (
            <div className="text-[0.65rem]">
              <div className="flex flex-col" style={{ width: "7rem", maxWidth: "7rem" }}>
                <div className="flex items-center">
                  <div className="pr-1" style={{ width: "3rem" }}>
                    <div className="w-full h-2 bg-slate-200 rounded overflow-hidden">
                      <div
                        className="h-2 rounded"
                        style={{
                          width: `${snrWidth}%`,
                          background: snrTone.background,
                        }}
                      />
                    </div>
                  </div>
                  <div className="ml-2 text-xs text-right">
                    {node.snr}
                    {t("unit.dbm")}
                  </div>
                </div>

                <div className="flex items-center">
                  <div className="pr-1" style={{ width: "3rem" }}>
                    <div className="w-full h-2 bg-slate-200 rounded overflow-hidden">
                      <div
                        className="h-2 rounded"
                        style={{
                          width: `${rssiWidth}%`,
                          background: rssiTone.background,
                        }}
                      />
                    </div>
                  </div>
                  <div className="ml-2 text-xs text-right">
                    {typeof rxRssiVal === "number" ? `${rxRssiVal} dBm` : "n/a"}
                  </div>
                </div>
              </div>
            </div>
          ),
          sortValue: node.snr,
        },
        // Model and MAC columns intentionally removed — keep cells aligned with headings
      ],
    };
  });

  const requestNodeInfo = async (nodeNum: number) => {
    if (!connection) {
      throw new Error("Nessuna connessione disponibile");
    }
    if (typeof connection.sendPacket === "function") {
      await connection.sendPacket(
        new Uint8Array(),
        Protobuf.Portnums.PortNum.NODEINFO_APP,
        nodeNum,
      );
    } else if (typeof connection.getMetadata === "function") {
      await connection.getMetadata(nodeNum);
    } else {
      throw new Error("Richiesta informazioni non disponibile sulla connessione corrente");
    }
  };

  const runMobileNodeAction = async (
    successTitle: string,
    action: () => Promise<unknown> | unknown,
  ) => {
    try {
      await action();
      toast({ title: successTitle });
    } catch (error) {
      toast({
        title: "Azione non riuscita",
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const copyMobileNodePublicKey = useCallback(
    async (publicKey: Uint8Array) => {
      if (publicKey.length === 0) {
        return;
      }

      try {
        await navigator.clipboard.writeText(fromByteArray(publicKey));
        toast({ title: "Public key copiata" });
      } catch {
        toast({ title: "Copia public key non riuscita", variant: "destructive" });
      }
    },
    [toast],
  );

  const mobileNodeCards = mobileNodes.map((node) => {
    const shortName = getNodeShortName(node) ?? `!${numberToHexUnpadded(node.num).toUpperCase()}`;
    const longName = getNodeLongName(node) ?? `!${numberToHexUnpadded(node.num).toUpperCase()}`;
    const isLocalNode = node.num === hardware.myNodeNum;
    const distanceVal =
      myNode && hasPos(myNode.position) && hasPos(node.position)
        ? distanceBetweenPositions(myNode.position, node.position)
        : undefined;
    const position = formatPosition(node.position);
    const altitude =
      hasPos(node.position) && typeof node.position?.altitude === "number"
        ? `${Math.round(node.position.altitude)} m MSL`
        : undefined;
    const hardwareModel = formatHardwareModel(node.user?.hwModel);
    const roleName = formatRole(node.user?.role);
    const nameHex = formatNameHex(node.num, node);
    const battery = getBatteryLabel(node);
    const nodeStatus = getNodeStatusText(node);
    const displayChannel = getNodeDisplayChannel(node);
    const hasPositionRow = Boolean(position || altitude);
    const hasIdentityRow = Boolean(hardwareModel || roleName || nameHex);
    const hasUtilRow =
      node.deviceMetrics?.channelUtilization !== undefined ||
      node.deviceMetrics?.airUtilTx !== undefined;
    const hasDetailRows = hasPositionRow || hasIdentityRow || hasUtilRow || Boolean(nodeStatus);
    const actionMenu = (
      <div className="flex max-h-[70vh] flex-col overflow-y-auto py-2 text-lg">
        <button
          className="px-5 py-3 text-left hover:bg-[#242424]"
          type="button"
          onClick={() => {
            setMobileActionNode(undefined);
            setSelectedNodeInfo(node.num);
          }}
        >
          Node Info
        </button>
        {!isLocalNode ? (
          <>
            <button
              className="px-5 py-3 text-left hover:bg-[#242424]"
              type="button"
              onClick={() => {
                setMobileActionNode(undefined);
                const nodeError = nodeDB.getNodeError(node.num);
                const description = getDirectMessageNavigationBlockDescription(node, nodeError);
                if (shouldBlockDirectMessageNavigation(node, nodeError) && description) {
                  toast({
                    title: "Unable to open direct message",
                    description,
                    variant: "destructive",
                  });
                  return;
                }
                navigate({
                  to: "/messages/$type/$chatId",
                  params: {
                    type: "direct",
                    chatId: String(node.num),
                  },
                });
              }}
            >
              Messaggio diretto
            </button>
            <button
              className="px-5 py-3 text-left hover:bg-[#242424]"
              type="button"
              onClick={() => {
                setMobileActionNode(undefined);
                setPendingNodeInfoNode(node.num);
                void runMobileNodeAction("Richiesta info inviata", () => requestNodeInfo(node.num));
              }}
            >
              Richiedi informazioni utente
            </button>
            <button
              className="px-5 py-3 text-left hover:bg-[#242424]"
              type="button"
              onClick={() => {
                setMobileActionNode(undefined);
                setPendingMetadataNode(node.num);
                void runMobileNodeAction("Richiesta metadata inviata", () => {
                  if (typeof connection?.getMetadata !== "function") {
                    throw new Error("Metadata non disponibile sulla connessione corrente");
                  }
                  return connection.getMetadata(node.num);
                });
              }}
            >
              Request user metadata
            </button>
            <button
              className="px-5 py-3 text-left hover:bg-[#242424]"
              type="button"
              onClick={() => {
                setMobileActionNode(undefined);
                void runMobileNodeAction("Richiesta posizione inviata", () => {
                  if (typeof connection?.requestPosition !== "function") {
                    throw new Error(
                      "Richiesta posizione non disponibile sulla connessione corrente",
                    );
                  }
                  return connection.requestPosition(node.num);
                });
              }}
            >
              Richiedi posizione
            </button>
            <button
              className="px-5 py-3 text-left hover:bg-[#242424]"
              type="button"
              onClick={() => {
                setMobileActionNode(undefined);
                pendingTracerouteNodeRef.current = node.num;
                pendingTracerouteStartedAtRef.current = Date.now();
                void runMobileNodeAction("Traceroute avviato", async () => {
                  try {
                    return await startVisualTraceroute(device.id, connection, node.num);
                  } catch (error) {
                    pendingTracerouteNodeRef.current = undefined;
                    pendingTracerouteStartedAtRef.current = undefined;
                    throw error;
                  }
                });
              }}
            >
              Traceroute
            </button>
            <button
              className="px-5 py-3 text-left hover:bg-[#242424]"
              type="button"
              onClick={() => {
                setMobileActionNode(undefined);
                pendingNeighborNodeRef.current = node.num;
                setPendingNeighborNode(node.num);
                void runMobileNodeAction("Neighbor discovery avviata", () =>
                  requestNeighborInfo(connection, node.num),
                );
              }}
            >
              Neighbor Discovery
            </button>
            <button
              className="px-5 py-3 text-left hover:bg-[#242424]"
              type="button"
              onClick={() => {
                setMobileActionNode(undefined);
                updateFavorite({
                  nodeNum: node.num,
                  isFavorite: !node.isFavorite,
                });
              }}
            >
              Set Favorite
            </button>
            <button
              className="px-5 py-3 text-left hover:bg-[#242424]"
              type="button"
              onClick={() => {
                setMobileActionNode(undefined);
                updateIgnored({
                  nodeNum: node.num,
                  isIgnored: !node.isIgnored,
                });
              }}
            >
              Ignora
            </button>
            <button
              className="px-5 py-3 text-left hover:bg-[#242424]"
              type="button"
              onClick={() => {
                setMobileActionNode(undefined);
                nodeDB.removeNode(node.num);
                toast({ title: "Nodo eliminato" });
              }}
            >
              Elimina
            </button>
          </>
        ) : null}
      </div>
    );

    return (
      <div
        key={node.num}
        className="rounded-md bg-background-secondary p-2.5 text-text-primary shadow-[0_2px_8px_rgba(0,0,0,0.2)] dark:bg-[#303030] dark:text-zinc-100 dark:shadow-[0_2px_8px_rgba(0,0,0,0.45)]"
      >
        <div className="grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-start gap-1.5">
          <Popover
            open={mobileActionNode === node.num}
            onOpenChange={(open) => setMobileActionNode(open ? node.num : undefined)}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-full px-1.5 py-1 text-[0.875rem]"
                style={getNodeBaseColorStyle(node.num)}
              >
                <Avatar
                  nodeNum={node.num}
                  size="sm"
                  className="size-7"
                  avatarClassName="ring-2 ring-white/70"
                  showError={hasNodeError(node.num)}
                  showFavorite={node.isFavorite}
                  showStatusIndicator={false}
                />
                <span className="max-w-20 truncate">{shortName}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              side="right"
              sideOffset={8}
              className="w-[min(18rem,calc(100vw-2rem))] border-zinc-800 bg-[#101010] p-0 text-zinc-100"
            >
              {actionMenu}
            </PopoverContent>
          </Popover>

          <EncryptionIcon
            node={node}
            hasError={hasNodeError(node.num)}
            onCopyPublicKey={copyMobileNodePublicKey}
          />

          <div className="min-w-0 text-[0.9375rem] leading-tight">
            <span className="whitespace-normal break-words">{longName}</span>
            {node.isFavorite ? (
              <StarIcon className="ml-1.5 inline size-4 fill-[#8d0606] text-[#8d0606]" />
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-1 whitespace-nowrap text-[0.875rem] text-text-secondary dark:text-zinc-200">
            <RadioTowerIcon className="size-4" />
            <span>{formatLastHeard(node.lastHeard)}</span>
          </div>
        </div>

        <div className="mt-1.5 grid grid-cols-[1fr_auto] items-center gap-2 text-[0.875rem]">
          <span>{formatDistance(distanceVal) ?? "distanza n/a"}</span>
          <span className="flex items-center justify-end gap-1 whitespace-nowrap">
            {battery.plugged ? (
              <BatteryChargingIcon className="size-4" />
            ) : (
              <BatteryIcon className="size-4" />
            )}
            {battery.plugged ? <PlugZapIcon className="size-3.5 text-[#00e531]" /> : null}
            {battery.label}
          </span>
        </div>

        <div className="mt-1 flex items-center justify-between gap-2 text-[0.875rem]">
          <span>
            {node.hopsAway !== undefined
              ? `Distanza in Hop: ${node.hopsAway}`
              : "Distanza in Hop: n/a"}
          </span>
          {displayChannel !== undefined ? (
            <span className="whitespace-nowrap text-right text-text-secondary dark:text-zinc-300">
              Ch: {displayChannel}
            </span>
          ) : null}
        </div>

        {showNodeDetails && hasDetailRows ? (
          <div className="mt-2 border-t border-zinc-500/35 pt-2">
            {hasPositionRow ? (
              <div className="grid grid-cols-[1fr_auto] gap-2 text-[0.875rem]">
                {position ? (
                  <button
                    type="button"
                    className="text-left text-cyan-400 underline"
                    onClick={() => {
                      navigate({
                        to: "/map/$long/$lat/$zoom",
                        params: {
                          long: String(position.longitude),
                          lat: String(position.latitude),
                          zoom: "16",
                        },
                      });
                    }}
                  >
                    {position.label}
                  </button>
                ) : (
                  <span />
                )}
                {altitude ? <span>{altitude}</span> : null}
              </div>
            ) : null}
            {hasIdentityRow ? (
              <div className="mt-1 grid grid-cols-[1fr_auto_1fr] gap-2 text-[0.875rem]">
                <span className="truncate">{hardwareModel ?? ""}</span>
                <span className="text-center">{roleName ?? ""}</span>
                <span className="text-right">{nameHex}</span>
              </div>
            ) : null}
            {hasUtilRow ? (
              <div className="mt-1.5 text-[0.875rem]">
                {node.deviceMetrics?.channelUtilization !== undefined ? (
                  <>
                    ChUtil{" "}
                    <span className="text-[#00e531]">
                      {node.deviceMetrics.channelUtilization.toFixed(1)}%
                    </span>{" "}
                  </>
                ) : null}
                {node.deviceMetrics?.airUtilTx !== undefined ? (
                  <>
                    AirUtilTX{" "}
                    <span className="text-[#00e531]">
                      {node.deviceMetrics.airUtilTx.toFixed(1)}%
                    </span>
                  </>
                ) : null}
              </div>
            ) : null}
            {nodeStatus ? (
              <div className="mt-2 flex items-start gap-2 text-[0.875rem] text-text-primary dark:text-zinc-100">
                <MapPinIcon className="mt-1 size-4 text-[#00e531]" />
                <span className="whitespace-pre-wrap break-words">{nodeStatus}</span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  });

  const selectedNodeInfoNode =
    selectedNodeInfo !== undefined ? nodeDB.getNode(selectedNodeInfo) : undefined;
  const selectedNeighborInfo =
    selectedNeighborResponse ??
    (selectedNeighborNode !== undefined ? device.getNeighborInfo(selectedNeighborNode) : undefined);
  const selectedNeighborSource =
    selectedNeighborNode !== undefined ? nodeDB.getNode(selectedNeighborNode) : undefined;

  return (
    <PageLayout
      label={t("navigation.nodes", { ns: "ui" })}
      leftBar={<Sidebar />}
      headerContent={<GatewayHeader />}
      mobileHeaderContent={<GatewayHeader />}
    >
      <div className="hidden pl-2 pt-2 md:flex md:flex-row">
        <div className="mr-2 flex-1">
          <Input
            placeholder={t("search.nodes")}
            value={filterState.nodeName}
            className="bg-transparent"
            showClearButton={!!filterState.nodeName}
            onChange={(e) =>
              setFilterState((prev) => ({
                ...prev,
                nodeName: e.target.value,
              }))
            }
          />
        </div>
        <div className="flex justify-end">
          <FilterControl
            filterState={filterState}
            defaultFilterValues={defaultFilterValues}
            setFilterState={setFilterState}
            isDirty={isFilterDirty(filterState)}
            parameters={{
              popoverContentProps: {
                side: "bottom",
                align: "end",
                sideOffset: 12,
              },
              popoverTriggerClassName: "mr-1 p-2",
              showTextSearch: false,
            }}
          />
        </div>
      </div>
      <div className="sticky top-0 z-30 flex shrink-0 items-center gap-3 bg-background-primary px-3 py-4 md:hidden dark:bg-[#101010]">
        <div className="flex h-14 min-w-0 flex-1 items-center gap-3 rounded-md border border-zinc-500 px-3 text-zinc-400">
          <SearchIcon className="size-7 shrink-0" />
          <Input
            placeholder="Search nodes ..."
            value={filterState.nodeName}
            className="h-full border-0 bg-transparent px-0 text-xl shadow-none focus-visible:ring-0"
            actionContainerClassName="border-0 bg-transparent dark:border-0 dark:bg-transparent divide-x-0 dark:divide-x-0"
            actionButtonClassName="hover:bg-transparent dark:hover:bg-transparent"
            showClearButton={!!filterState.nodeName}
            onChange={(e) =>
              setFilterState((prev) => ({
                ...prev,
                nodeName: e.target.value,
              }))
            }
          />
        </div>
        <Popover open={mobileFilterOpen} onOpenChange={setMobileFilterOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex size-14 shrink-0 items-center justify-center rounded-md text-zinc-100 hover:bg-white/10"
              aria-label="Filtro nodi"
            >
              <ListFilterIcon className="size-8" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={12}
            className="mobile-sorter-popover border-zinc-900 bg-[#101010] p-0 text-zinc-100 shadow-2xl"
          >
            <div className="max-h-[70vh] overflow-y-auto py-2 text-[0.9375rem]">
              {MOBILE_NODE_SORT_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-[#242424]"
                  onClick={() => {
                    setMobileSort(option.id);
                    setMobileFilterOpen(false);
                  }}
                >
                  <span className={mobileSort === option.id ? "font-semibold" : undefined}>
                    {option.label}
                  </span>
                  {mobileSort === option.id ? <CheckIcon className="size-6" /> : null}
                </button>
              ))}
              <div className="my-2 border-t border-zinc-700" />
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-[#242424]"
                onClick={() => {
                  setIncludeUnknownNodes((value) => !value);
                  setMobileFilterOpen(false);
                }}
              >
                <span>Includi sconosciuti</span>
                {includeUnknownNodes ? <CheckIcon className="size-6" /> : null}
              </button>
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-[#242424]"
                onClick={() => {
                  setShowNodeDetails((value) => !value);
                  setMobileFilterOpen(false);
                }}
              >
                <span>Mostra dettagli</span>
                {showNodeDetails ? <CheckIcon className="size-6" /> : null}
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      <div className="hidden overflow-y-auto md:block">
        <div className="max-w-full">
          <div className="text-xs">
            <Table headings={tableHeadings} rows={tableRows} />
          </div>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto bg-background-primary px-2.5 pb-4 md:hidden dark:bg-[#101010]">
        {mobileNodeCards}
      </div>

      <TracerouteResponseDialog
        traceroute={selectedTraceroute}
        open={!!selectedTraceroute}
        durationMs={selectedTracerouteDurationMs}
        onOpenChange={() => {
          setSelectedTraceroute(undefined);
          setSelectedTracerouteDurationMs(undefined);
        }}
      />
      <LocationResponseDialog
        location={selectedLocation}
        open={!!selectedLocation}
        onOpenChange={() => setSelectedLocation(undefined)}
      />

      <Dialog open={!!selectedNeighborNode} onOpenChange={closeNeighborDiscoveryProcess}>
        <DialogContent className="top-1/2 left-1/2 max-h-[86vh] max-w-[min(92vw,38rem)] -translate-x-1/2 -translate-y-1/2 rounded-md bg-[#303030] p-6 text-zinc-100 dark:bg-[#303030]">
          <DialogHeader>
            <DialogTitle className="text-center text-4xl font-semibold text-zinc-100 max-md:text-3xl">
              Neighbor Discovery
            </DialogTitle>
          </DialogHeader>
          <p className="text-center text-2xl text-zinc-300 max-md:text-xl">
            {selectedNeighborSource ? getNodeLongName(selectedNeighborSource) : "Nodo"}
          </p>
          <div className="max-h-[55vh] overflow-y-auto">
            <table className="w-full border-separate border-spacing-y-1 text-left text-sm">
              <thead className="text-zinc-100">
                <tr>
                  <th className="px-2 py-2">Node</th>
                  <th className="px-2 py-2">HEX</th>
                  <th className="px-2 py-2 text-right">SNR</th>
                </tr>
              </thead>
              <tbody>
                {(selectedNeighborInfo?.neighbors ?? []).map((neighbor, index) => {
                  const nodeNum = Number(neighbor.nodeId);
                  const neighborNode = nodeDB.getNode(nodeNum);
                  const label =
                    getNodeLongName(neighborNode) ??
                    getNodeShortName(neighborNode) ??
                    String(nodeNum);
                  return (
                    <tr key={`${neighbor.nodeId}-${index}`} className="bg-[#2b2b2b]">
                      <td className="px-2 py-2 font-semibold">{label}</td>
                      <td className="px-2 py-2 font-mono">
                        {neighborNode?.user?.id ?? formatNameHex(nodeNum, neighborNode)}
                      </td>
                      <td
                        className={`px-2 py-2 text-right font-semibold ${
                          neighbor.snr >= -10 ? "text-[#00e531]" : "text-yellow-300"
                        }`}
                      >
                        {neighbor.snr.toFixed(1)} dB
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {(selectedNeighborInfo?.neighbors ?? []).length === 0 ? (
              <p className="py-8 text-center text-zinc-300">Nessun neighbor discovery ricevuto.</p>
            ) : null}
          </div>
          <div className="mt-6 flex justify-end gap-6">
            <button
              type="button"
              className="font-semibold uppercase tracking-wider text-[var(--darkmesh-action-color,#00bcd4)]"
              onClick={() => {
                setSelectedNeighborNode(undefined);
                setSelectedNeighborResponse(undefined);
                setHighlightedNeighborNode(selectedNeighborNode);
                const point = selectedNeighborSource
                  ? positionPoint(selectedNeighborSource.position)
                  : undefined;
                if (point) {
                  navigate({
                    to: "/map/$long/$lat/$zoom",
                    params: {
                      long: String(point.longitude),
                      lat: String(point.latitude),
                      zoom: "14",
                    },
                  });
                  return;
                }
                navigate({ to: "/map" });
              }}
            >
              VIEW ON MAP
            </button>
            <button
              type="button"
              className="font-semibold uppercase tracking-wider text-[var(--darkmesh-action-color,#00bcd4)]"
              onClick={closeNeighborDiscoveryProcess}
            >
              Chiudi
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedNodeInfoNode} onOpenChange={() => setSelectedNodeInfo(undefined)}>
        <DialogContent className="inset-0 h-dvh max-h-dvh w-screen max-w-none rounded-none bg-[#111] p-0 text-zinc-100 dark:bg-[#111] sm:max-w-none sm:rounded-none">
          {selectedNodeInfoNode ? (
            <MobileNodeInfoDialog
              node={selectedNodeInfoNode}
              neighborRecords={neighborDiscoveryRecords[selectedNodeInfoNode.num] ?? []}
              onClose={() => setSelectedNodeInfo(undefined)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
};

function MobileNodeInfoDialog({
  node,
  neighborRecords,
  onClose,
}: {
  node: Protobuf.Mesh.NodeInfo;
  neighborRecords: NeighborDiscoveryRecord[];
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const device = useDevice();
  const [shareOpen, setShareOpen] = useState(false);
  const [activeLog, setActiveLog] = useState<"traceroute" | "neighbor" | undefined>();
  const [selectedTraceLog, setSelectedTraceLog] = useState<
    Types.PacketMetadata<Protobuf.Mesh.RouteDiscovery> | undefined
  >();
  const shortName = getNodeShortName(node) ?? formatNameHex(node.num, node).slice(-4);
  const longName = getNodeLongName(node) ?? formatNameHex(node.num, node);
  const hardwareModel = formatHardwareModel(node.user?.hwModel);
  const roleName = formatRole(node.user?.role);
  const nodeStatus = getNodeStatusText(node);
  const lastHeard = formatLastHeard(node.lastHeard);
  const uptimeSeconds = node.deviceMetrics?.uptimeSeconds;
  const uptime =
    typeof uptimeSeconds === "number"
      ? `${Math.floor(uptimeSeconds / 86400)}d ${Math.floor((uptimeSeconds % 86400) / 3600)}h ${Math.floor((uptimeSeconds % 3600) / 60)}m`
      : undefined;
  const firmware =
    (node as Protobuf.Mesh.NodeInfo & { metadata?: { firmwareVersion?: string } }).metadata
      ?.firmwareVersion ??
    (node as Protobuf.Mesh.NodeInfo & { deviceMetadata?: { firmwareVersion?: string } })
      .deviceMetadata?.firmwareVersion;
  const hasNeighborInfo =
    neighborRecords.length > 0 || Boolean(device.getNeighborInfo(node.num)?.neighbors?.length);
  const neighborInfo = device.getNeighborInfo(node.num);
  const traceRoutes = device.traceroutes.get(node.num) ?? [];
  const point = positionPoint(node.position);
  const sharedContactUrl = buildSharedContactUrl(node);

  const copyValue = async (label: string, value?: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: `${label} copiato` });
    } catch {
      toast({ title: "Copia non riuscita", variant: "destructive" });
    }
  };

  const openMap = () => {
    onClose();
    if (point) {
      navigate({
        to: "/map/$long/$lat/$zoom",
        params: {
          long: String(point.longitude),
          lat: String(point.latitude),
          zoom: "14",
        },
      });
      return;
    }
    navigate({ to: "/map" });
  };

  const openRemoteAdmin = () => {
    onClose();
    navigate({
      to: "/remote-admin/$nodeNum/radio",
      params: { nodeNum: String(node.num) },
    });
  };

  const registryRows = [
    {
      label: "Mappa Dei Nodi",
      icon: MapPinIcon,
      enabled: hasPos(node.position),
      onClick: openMap,
    },
    {
      label: "Registro Di Traceroute",
      icon: RouteIcon,
      enabled: traceRoutes.length > 0,
      onClick: () => setActiveLog("traceroute"),
    },
    {
      label: "Neighbor Discovery Log",
      icon: UsersIcon,
      enabled: hasNeighborInfo,
      onClick: () => setActiveLog("neighbor"),
    },
  ] as const;

  return (
    <div className="flex h-full flex-col bg-[#111] text-zinc-100">
      <div className="flex items-center gap-3 border-b border-zinc-800 bg-[#202020] px-4 py-3">
        <button
          type="button"
          className="rounded-full p-2 text-zinc-100 hover:bg-white/10"
          onClick={onClose}
          aria-label="Close node info"
        >
          <ArrowLeftIcon className="size-6" />
        </button>
        <DialogTitle className="min-w-0 text-base font-semibold text-zinc-100">
          <span className="block truncate">{longName}</span>
          <span className="block truncate text-sm font-normal text-zinc-300">
            {hardwareModel ?? "UNSET"}
          </span>
        </DialogTitle>
        <DialogClose className="sr-only" />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        <InfoSection title="Personal Identicon">
          <div className="flex justify-center rounded-md bg-[#202020] py-4">
            <div
              className="inline-flex items-center gap-3 rounded-full px-3 py-2"
              style={getNodeBaseColorStyle(node.num)}
            >
              <Avatar nodeNum={node.num} size="lg" showStatusIndicator={false} />
              <span className="text-xl font-semibold">{shortName}</span>
            </div>
          </div>
        </InfoSection>

        {hardwareModel ? (
          <InfoSection title="Device">
            <div className="rounded-md bg-[#202020] p-4">
              <InfoLine
                icon={CpuIcon}
                label="Hardware"
                value={hardwareModel}
                onClick={() => copyValue("Hardware", hardwareModel)}
              />
            </div>
          </InfoSection>
        ) : null}

        {nodeStatus ? (
          <InfoSection title="Status Message">
            <div className="rounded-md bg-[#202020] p-4">
              <p className="whitespace-pre-wrap break-words text-zinc-200">{nodeStatus}</p>
            </div>
          </InfoSection>
        ) : null}

        <InfoSection title="Details">
          <div className="rounded-md bg-[#202020] p-4">
            <InfoLine
              icon={HashIcon}
              label="Node Number"
              value={String(node.num)}
              onClick={() => copyValue("Node Number", String(node.num))}
            />
            <InfoLine
              icon={UserIcon}
              label="User Id"
              value={node.user?.id ?? formatNameHex(node.num, node)}
              onClick={() => copyValue("User Id", node.user?.id ?? formatNameHex(node.num, node))}
            />
            {roleName ? (
              <InfoLine
                icon={BriefcaseIcon}
                label="Role"
                value={roleName}
                onClick={() => copyValue("Role", roleName)}
              />
            ) : null}
            {uptime ? (
              <InfoLine
                icon={ClockIcon}
                label="Uptime"
                value={uptime}
                onClick={() => copyValue("Uptime", uptime)}
              />
            ) : null}
            {firmware ? (
              <InfoLine
                icon={CpuIcon}
                label="Firmware version"
                value={firmware}
                onClick={() => copyValue("Firmware version", firmware)}
              />
            ) : null}
            <InfoLine
              icon={RadioTowerIcon}
              label="Last heard"
              value={lastHeard}
              onClick={() => copyValue("Last heard", lastHeard)}
            />
          </div>
        </InfoSection>

        <InfoSection title="Share">
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-sm bg-[#252525] px-4 py-3 text-left"
            onClick={() => setShareOpen(true)}
          >
            <span className="flex items-center gap-3">
              <Share2Icon className="size-5" />
              Share Contact
            </span>
            <ChevronRightIcon className="size-5" />
          </button>
        </InfoSection>

        <InfoSection title="Registri">
          <div className="space-y-1">
            {registryRows.map(({ label, icon: Icon, enabled, onClick }) => (
              <button
                type="button"
                key={label}
                className="flex w-full items-center justify-between rounded-sm bg-[#252525] px-4 py-3 text-left"
                onClick={onClick}
              >
                <span
                  className={`flex items-center gap-3 ${
                    enabled ? "text-zinc-100" : "text-zinc-600"
                  }`}
                >
                  <Icon className="size-5" />
                  {label}
                </span>
                <ChevronRightIcon
                  className={enabled ? "size-5 text-zinc-100" : "size-5 text-zinc-600"}
                />
              </button>
            ))}
          </div>
        </InfoSection>

        <InfoSection title="Amministrazione">
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-sm bg-[#252525] px-4 py-3 text-left"
            onClick={openRemoteAdmin}
          >
            <span className="flex items-center gap-3">
              <InfoIcon className="size-5" />
              Amministrazione Remota
            </span>
            <ChevronRightIcon className="size-5" />
          </button>
        </InfoSection>
      </div>
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-h-[86vh] max-w-[min(92vw,28rem)] rounded-2xl bg-[#151515] p-6 text-zinc-100">
          <DialogTitle className="text-center text-xl">Condividi</DialogTitle>
          <p className="text-center text-cyan-400">{longName}</p>
          <div className="mx-auto bg-white p-3">
            <QRCode value={sharedContactUrl} size={260} qrStyle="squares" />
          </div>
          <div className="flex items-start gap-3">
            <p className="min-w-0 flex-1 break-all text-cyan-400">{sharedContactUrl}</p>
            <button
              type="button"
              className="rounded-full bg-cyan-700 p-3 text-white"
              onClick={() => copyValue("Share Contact", sharedContactUrl)}
            >
              <CopyIcon className="size-5" />
            </button>
          </div>
          <button
            type="button"
            className="self-end text-lg font-semibold text-zinc-100"
            onClick={() => setShareOpen(false)}
          >
            Chiudi
          </button>
        </DialogContent>
      </Dialog>
      <Dialog open={activeLog !== undefined} onOpenChange={() => setActiveLog(undefined)}>
        <DialogContent className="inset-0 h-dvh max-h-dvh w-screen max-w-none rounded-none bg-[#111] p-0 text-zinc-100 dark:bg-[#111] sm:max-w-none sm:rounded-none">
          {activeLog ? (
            <NodeLogPanel
              title={getNodeLogTitle(activeLog)}
              nodeName={longName}
              onClose={() => setActiveLog(undefined)}
            >
              {activeLog === "traceroute" ? (
                <TraceRouteLog
                  routes={traceRoutes}
                  onOpen={(route) => setSelectedTraceLog(route)}
                />
              ) : null}
              {activeLog === "neighbor" ? (
                <NeighborLog records={neighborRecords} fallbackNeighborInfo={neighborInfo} />
              ) : null}
            </NodeLogPanel>
          ) : null}
        </DialogContent>
      </Dialog>
      <TracerouteResponseDialog
        traceroute={selectedTraceLog}
        open={!!selectedTraceLog}
        onOpenChange={() => setSelectedTraceLog(undefined)}
      />
    </div>
  );
}

function InfoSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-lg font-medium text-zinc-100">{title}</h2>
      {children}
    </section>
  );
}

function getNodeLogTitle(log: "traceroute" | "neighbor"): string {
  switch (log) {
    case "traceroute":
      return "Registro Di Traceroute";
    case "neighbor":
      return "Neighbor Discovery Log";
  }
}

function NodeLogPanel({
  title,
  nodeName,
  children,
  onClose,
}: {
  title: string;
  nodeName: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="flex h-full flex-col bg-[#111] text-zinc-100">
      <div className="flex items-center gap-3 border-b border-zinc-800 bg-[#202020] px-4 py-3">
        <button type="button" className="rounded-full p-2 hover:bg-white/10" onClick={onClose}>
          <ArrowLeftIcon className="size-6" />
        </button>
        <DialogTitle className="min-w-0 text-lg font-semibold">
          <span className="block truncate">{nodeName}</span>
          <span className="block truncate text-sm font-normal text-zinc-300">{title}</span>
        </DialogTitle>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
    </div>
  );
}

function MetricCard({ children }: { children: ReactNode }) {
  return <div className="mb-3 rounded-md bg-[#202020] p-4 text-lg">{children}</div>;
}

function TraceRouteLog({
  routes,
  onOpen,
}: {
  routes: Types.PacketMetadata<Protobuf.Mesh.RouteDiscovery>[];
  onOpen: (route: Types.PacketMetadata<Protobuf.Mesh.RouteDiscovery>) => void;
}) {
  if (!routes.length) return <MetricCard>Nessun traceroute storato.</MetricCard>;
  return (
    <div className="space-y-3">
      {routes
        .slice()
        .reverse()
        .map((route, index) => {
          const hopCount = route.data.route.length;
          const returnHopCount = route.data.routeBack.length;
          const label =
            hopCount || returnHopCount
              ? `Forward ${hopCount || 0} hop - Back ${returnHopCount || 0} hop`
              : "Nessuna risposta";
          return (
            <button
              key={`${route.from}-${getPacketRxTimeMs(route.rxTime)}-${index}`}
              type="button"
              className="flex w-full items-center gap-4 rounded-md bg-[#252525] p-4 text-left text-xl"
              onClick={() => onOpen(route)}
            >
              <UsersIcon className="size-7 shrink-0" />
              <span>
                {formatLogDate(route.rxTime)} - {label}
              </span>
            </button>
          );
        })}
    </div>
  );
}

function NeighborLog({
  records,
  fallbackNeighborInfo,
}: {
  records: NeighborDiscoveryRecord[];
  fallbackNeighborInfo?: Protobuf.Mesh.NeighborInfo;
}) {
  const navigate = useNavigate();
  const setHighlightedNeighborNode = useDarkMeshStore((s) => s.setHighlightedNeighborNode);
  const [selectedRecord, setSelectedRecord] = useState<NeighborDiscoveryRecord | undefined>();
  const displayRecords =
    records.length > 0
      ? records
      : fallbackNeighborInfo
        ? [
            {
              id: "current",
              nodeNum: 0,
              observedAt: Date.now(),
              neighborInfo: fallbackNeighborInfo,
            } satisfies NeighborDiscoveryRecord,
          ]
        : [];

  if (!displayRecords.length) return <MetricCard>Nessun neighbor discovery storato.</MetricCard>;
  return (
    <>
      <div className="space-y-3">
        {displayRecords.map((record) => {
          const neighbors = record.neighborInfo.neighbors ?? [];
          return (
            <button
              key={record.id}
              type="button"
              className="flex w-full items-center gap-4 rounded-md bg-[#252525] p-4 text-left text-xl"
              onClick={() => setSelectedRecord(record)}
            >
              <UsersIcon className="size-7 shrink-0" />
              <span className="min-w-0 flex-1">
                {formatLogDate(new Date(record.observedAt))} - {neighbors.length} nodi
              </span>
            </button>
          );
        })}
      </div>
      <Dialog open={!!selectedRecord} onOpenChange={() => setSelectedRecord(undefined)}>
        <DialogContent className="top-1/2 left-1/2 max-h-[86vh] max-w-[min(92vw,38rem)] -translate-x-1/2 -translate-y-1/2 rounded-md bg-[#303030] p-6 text-zinc-100 dark:bg-[#303030]">
          <DialogHeader>
            <DialogTitle className="text-center text-4xl font-semibold text-zinc-100 max-md:text-3xl">
              Neighbor Discovery
            </DialogTitle>
          </DialogHeader>
          {selectedRecord ? (
            <div className="max-h-[55vh] overflow-y-auto">
              <table className="w-full border-separate border-spacing-y-1 text-left text-sm">
                <thead className="text-zinc-100">
                  <tr>
                    <th className="px-2 py-2">Node</th>
                    <th className="px-2 py-2">HEX</th>
                    <th className="px-2 py-2 text-right">SNR</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedRecord.neighborInfo.neighbors ?? []).map((neighbor, index) => {
                    const nodeNum = Number(neighbor.nodeId);
                    return (
                      <tr key={`${neighbor.nodeId}-${index}`} className="bg-[#2b2b2b]">
                        <td className="px-2 py-2 font-semibold">{nodeNum}</td>
                        <td className="px-2 py-2 font-mono">{formatNameHex(nodeNum)}</td>
                        <td
                          className={`px-2 py-2 text-right font-semibold ${
                            neighbor.snr >= -10 ? "text-[#00e531]" : "text-yellow-300"
                          }`}
                        >
                          {neighbor.snr.toFixed(1)} dB
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
          <div className="mt-6 flex justify-end gap-6">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="font-semibold uppercase tracking-wider text-[var(--darkmesh-action-color,#00bcd4)]"
              onClick={() => {
                if (selectedRecord) {
                  setHighlightedNeighborNode(selectedRecord.nodeNum);
                  navigate({ to: "/map" });
                }
                setSelectedRecord(undefined);
              }}
            >
              VIEW ON MAP
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="font-semibold uppercase tracking-wider text-[var(--darkmesh-action-color,#00bcd4)]"
              onClick={() => setSelectedRecord(undefined)}
            >
              OK
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function formatLogDate(date: unknown): string {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(getPacketRxTimeDate(date));
}

function InfoLine({
  icon: Icon,
  label,
  value,
  good = false,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  good?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="flex min-w-0 items-center gap-3 text-zinc-200">
        <Icon className={good ? "size-5 text-[#00e531]" : "size-5 text-zinc-100"} />
        <span className="truncate">{label}</span>
      </span>
      <span className="text-right text-zinc-100">{value}</span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 py-2 text-left text-sm"
        onClick={onClick}
      >
        {content}
      </button>
    );
  }

  return <div className="flex items-center justify-between gap-4 py-2 text-sm">{content}</div>;
}

export default NodesPage;
