import {
  defaultVisibilityState,
  MapLayerTool,
  type VisibilityState,
} from "@app/components/PageComponents/Map/Tools/MapLayerTool.tsx";
import { GatewayHeader } from "@components/PageComponents/DarkMesh/GatewayHeader.tsx";
import { VisualTracerouteCard } from "@components/PageComponents/DarkMesh/VisualTracerouteCard.tsx";
import { getTraceroutePanelTheme } from "@components/PageComponents/DarkMesh/theme.ts";
import { FilterControl } from "@components/generic/Filter/FilterControl.tsx";
import { type FilterState, useFilterNode } from "@components/generic/Filter/useFilterNode.ts";
import { BaseMap } from "@components/Map.tsx";
import {
  HeatmapLayer,
  type HeatmapMode,
} from "@components/PageComponents/Map/Layers/HeatmapLayer.tsx";
import { NodesLayer } from "@components/PageComponents/Map/Layers/NodesLayer.tsx";
import { PrecisionLayer } from "@components/PageComponents/Map/Layers/PrecisionLayer.tsx";
import { SNRLayer, SNRTooltip } from "@components/PageComponents/Map/Layers/SNRLayer.tsx";
import { WaypointLayer } from "@components/PageComponents/Map/Layers/WaypointLayer.tsx";
import type { PopupState } from "@components/PageComponents/Map/Popups/PopupWrapper.tsx";
import { PageLayout } from "@components/PageLayout.tsx";
import { Sidebar } from "@components/Sidebar.tsx";
import { Button } from "@components/UI/Button.tsx";
import { useDarkMeshStore } from "@app/darkmesh/store.ts";
import { distanceKm, getNodeShortName, getNodeLongName } from "@app/darkmesh/utils.ts";
import { useMapFitting } from "@core/hooks/useMapFitting.ts";
import { useTheme } from "@core/hooks/useTheme.ts";
import { useDevice, useNodeDB } from "@core/stores";
import { useToast } from "@core/hooks/useToast.ts";
import { cn } from "@core/utils/cn.ts";
import { hasPos, toLngLat } from "@core/utils/geo.ts";
import { Protobuf } from "@meshtastic/core";
import type { Types } from "@meshtastic/core";
import { numberToHexUnpadded } from "@noble/curves/abstract/utils";
import { CompassIcon, FunnelIcon, LocateFixedIcon, MinusIcon, PlusIcon } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Layer, Source, type MapLayerMouseEvent, useMap } from "react-map-gl/maplibre";
import useTracerouteStore from "@core/stores/tracerouteStore";
import { useParams } from "@tanstack/react-router";

function buildTraceCoordinates(
  nodes: Array<Protobuf.Mesh.NodeInfo | undefined>,
): [number, number][] {
  return nodes
    .filter((node): node is Protobuf.Mesh.NodeInfo =>
      Boolean(node?.position && hasPos(node.position)),
    )
    .map((node) => toLngLat(node.position));
}

function pathDistanceKm(coords: [number, number][]): number {
  let total = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const [lon1, lat1] = coords[i] as [number, number];
    const [lon2, lat2] = coords[i + 1] as [number, number];
    total += distanceKm({ latitude: lat1, longitude: lon1 }, { latitude: lat2, longitude: lon2 });
  }
  return total;
}

function isMobileResponsiveViewport(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
}

// Main page component
const MapPage: React.FC = () => {
  const [, setPinnedPopupNode] = useState<number | undefined>(undefined);
  const [popupState, setPopupState] = useState<PopupState | undefined>(undefined);

  // basic hooks used throughout the page
  const device = useDevice();
  const { getNode, getNodes, getMyNode } = useNodeDB();
  const connection = device.connection;
  const { toast } = useToast();
  const { t } = useTranslation();
  const mapParams = useParams({ strict: false }) as {
    long?: number;
    lat?: number;
    zoom?: number;
  };
  const { theme } = useTheme();
  const traceroutePanelTheme = getTraceroutePanelTheme(theme === "dark");
  // derived store selectors and local UI state
  const deviceId = device.id;
  const selectedTraceRoute = useDarkMeshStore((s) => s.selectedTraceRoute);
  const highlightedNeighborNodeFromStore = useDarkMeshStore((s) => s.highlightedNeighborNode);
  const pendingTraceRouteTarget = useDarkMeshStore(
    (s) => s.pendingTraceRouteTargetByDevice[deviceId],
  );
  const storedMapPopupNode = useDarkMeshStore((s) => s.mapPopupNodeByDevice[deviceId]);
  const clearSelectedTraceRoute = useDarkMeshStore((s) => s.setSelectedTraceRoute);
  const setStoredHighlightedNeighborNode = useDarkMeshStore((s) => s.setHighlightedNeighborNode);
  const setStoredMapPopupNode = useDarkMeshStore((s) => s.setMapPopupNode);
  const setPendingTraceRouteTarget = useDarkMeshStore((s) => s.setPendingTraceRouteTarget);
  const setPendingTraceRouteRequest = useDarkMeshStore((s) => s.setPendingTraceRouteRequest);

  const { nodeFilter, defaultFilterValues, isFilterDirty } = useFilterNode();
  const [filterState, setFilterState] = useState<FilterState>(defaultFilterValues);
  const nodes = getNodes();
  const validNodes = useMemo(() => nodes.filter((n) => Boolean(n && hasPos(n.position))), [nodes]);
  const filteredNodes = useMemo(
    () => nodes.filter((n) => Boolean(n) && nodeFilter(n as Protobuf.Mesh.NodeInfo, filterState)),
    [nodes, nodeFilter, filterState],
  );

  const [expandedCluster, setExpandedCluster] = useState<string | undefined>(undefined);
  const [mapZoom, setMapZoom] = useState(1.8);
  const [mapBearing, setMapBearing] = useState(0);

  // map helpers / refs
  const { default: mapRef } = useMap();
  const { focusLngLat, fitToNodes, fitToNodesKeepingCenter } = useMapFitting(
    mapRef as unknown as import("react-map-gl/maplibre").MapRef,
  );
  const prevTracerouteActive = useRef(false);
  const lastPopupStateRef = useRef<PopupState | undefined>(undefined);
  const restoredMapPopupNodeRef = useRef<number | undefined>(undefined);
  const requestedPositionTimestamps = useRef<Map<number, number>>(new Map());

  // visibility / layer UI
  const [visibilityState, setVisibilityState] = useState<VisibilityState>(defaultVisibilityState);
  const [heatmapMode, setHeatmapMode] = useState<HeatmapMode>("snr");
  const heatmapLayerElementId = useId();

  const heatmapLayerElement = useMemo(
    () => (
      <HeatmapLayer id={heatmapLayerElementId} filteredNodes={filteredNodes} mode={heatmapMode} />
    ),
    [heatmapLayerElementId, filteredNodes, heatmapMode],
  );

  const myNode = getMyNode();

  useEffect(() => {
    if (
      popupState ||
      storedMapPopupNode === undefined ||
      restoredMapPopupNodeRef.current === storedMapPopupNode
    ) {
      return;
    }

    const node = getNode(storedMapPopupNode);
    if (!node?.position || !hasPos(node.position)) {
      return;
    }

    focusLngLat(toLngLat(node.position));
    setPopupState({
      type: "node",
      num: storedMapPopupNode,
      offset: [0, 0],
      preventAutoPan: true,
    });
    restoredMapPopupNodeRef.current = storedMapPopupNode;
  }, [focusLngLat, getNode, nodes, popupState, storedMapPopupNode]);

  // hover tooltips are disabled; tooltips appear on click now
  const onMouseMove = useCallback(() => {
    // Intentionally no-op: we handle link tooltips via click handler (`onMapBackgroundClick`) and `clickedLink` state
    return;
  }, []);

  const getMapBounds = useCallback(() => {
    // no-op placeholder (BaseMap passes its mapRef on load)
    return;
  }, []);
  // Selected node links: draw links related to the currently opened (or pinned) node
  const [highlightedNeighborNode, setHighlightedNeighborNode] = useState<number | undefined>(
    undefined,
  );

  useEffect(() => {
    if (highlightedNeighborNodeFromStore === undefined) {
      return;
    }

    setHighlightedNeighborNode(highlightedNeighborNodeFromStore);
    clearSelectedTraceRoute(undefined);
    setPendingTraceRouteTarget(deviceId, undefined);
    setPendingTraceRouteRequest(deviceId, undefined);
  }, [
    clearSelectedTraceRoute,
    deviceId,
    highlightedNeighborNodeFromStore,
    setPendingTraceRouteRequest,
    setPendingTraceRouteTarget,
  ]);

  const selectedNodeLinks = useMemo(() => {
    const nodeNum = highlightedNeighborNode;
    if (!nodeNum) return undefined;

    const neighborInfo = device.getNeighborInfo(nodeNum);
    if (!neighborInfo || !Array.isArray(neighborInfo.neighbors)) return undefined;

    const features: Array<Record<string, unknown>> = [];
    const missing = new Set<number>();

    const nodeA = getNode(nodeNum);
    if (!nodeA) missing.add(nodeNum);

    for (const nb of neighborInfo.neighbors) {
      const b = Number(nb.nodeId);
      const nodeB = getNode(b);
      if (!nodeA || !nodeB) {
        if (!nodeA) missing.add(nodeNum);
        if (!nodeB) missing.add(b);
        continue;
      }
      if (!hasPos(nodeA.position) || !hasPos(nodeB.position)) {
        if (!hasPos(nodeA.position)) missing.add(nodeNum);
        if (!hasPos(nodeB.position)) missing.add(b);
        continue;
      }

      const [lngA, latA] = toLngLat(nodeA.position);
      const [lngB, latB] = toLngLat(nodeB.position);
      features.push({
        type: "Feature",
        properties: {
          from: nodeNum,
          to: b,
          snr: nb.snr,
          lengthKm: distanceKm(
            { latitude: latA, longitude: lngA },
            { latitude: latB, longitude: lngB },
          ),
        },
        geometry: {
          type: "LineString",
          coordinates: [toLngLat(nodeA.position), toLngLat(nodeB.position)],
        },
      });
    }

    if (features.length === 0 && missing.size === 0) return undefined;

    return {
      type: "FeatureCollection",
      features,
      missing: Array.from(missing),
    } as unknown as GeoJSON.FeatureCollection;
  }, [highlightedNeighborNode, device, getNode]);

  // All traceroute links
  const allTracerouteLinks = useMemo(() => {
    const features: Array<Record<string, unknown>> = [];
    const seen = new Set<string>();
    // include both device traceroutes and persisted traceroutes
    const storeEntries = useTracerouteStore.getState().getTraceroutes();

    for (const routesArr of device.traceroutes.values()) {
      for (const tr of routesArr) {
        const forward = [tr.to, ...(tr.data.route ?? []), tr.from];
        for (let i = 0; i < forward.length - 1; i++) {
          const a = Number(forward[i]);
          const b = Number(forward[i + 1]);
          const key = `${Math.min(a, b)}-${Math.max(a, b)}`;
          if (seen.has(key)) continue;
          seen.add(key);

          const nodeA = getNode(a);
          const nodeB = getNode(b);
          if (!nodeA || !nodeB) continue;
          if (!hasPos(nodeA.position) || !hasPos(nodeB.position)) continue;

          const [lngA, latA] = toLngLat(nodeA.position);
          const [lngB, latB] = toLngLat(nodeB.position);
          features.push({
            type: "Feature",
            properties: {
              from: a,
              to: b,
              // try to attach snr if present on packet
              snr: ((): number | undefined => {
                const v = tr.data?.snrTowards?.[i] ?? tr.data?.snrBack?.[i];
                return v !== undefined ? v / 4 : undefined;
              })(),
              lengthKm: distanceKm(
                { latitude: latA, longitude: lngA },
                { latitude: latB, longitude: lngB },
              ),
            },
            geometry: {
              type: "LineString",
              coordinates: [toLngLat(nodeA.position), toLngLat(nodeB.position)],
            },
          });
        }

        const back = [tr.from, ...(tr.data.routeBack ?? []), tr.to];
        for (let i = 0; i < back.length - 1; i++) {
          const a = Number(back[i]);
          const b = Number(back[i + 1]);
          const key = `${Math.min(a, b)}-${Math.max(a, b)}`;
          if (seen.has(key)) continue;
          seen.add(key);

          const nodeA = getNode(a);
          const nodeB = getNode(b);
          if (!nodeA || !nodeB) continue;
          if (!hasPos(nodeA.position) || !hasPos(nodeB.position)) continue;

          const [lngA2, latA2] = toLngLat(nodeA.position);
          const [lngB2, latB2] = toLngLat(nodeB.position);
          features.push({
            type: "Feature",
            properties: {
              from: a,
              to: b,
              snr: ((): number | undefined => {
                const v = tr.data?.snrBack?.[i] ?? tr.data?.snrTowards?.[i];
                return v !== undefined ? v / 4 : undefined;
              })(),
              lengthKm: distanceKm(
                { latitude: latA2, longitude: lngA2 },
                { latitude: latB2, longitude: lngB2 },
              ),
            },
            geometry: {
              type: "LineString",
              coordinates: [toLngLat(nodeA.position), toLngLat(nodeB.position)],
            },
          });
        }
      }
    }

    // include persisted traceroutes' derivedLinks
    for (const persisted of storeEntries) {
      const links = persisted.derivedLinks ?? [];
      for (const l of links) {
        const a = Number(l.from);
        const b = Number(l.to);
        const key = `${Math.min(a, b)}-${Math.max(a, b)}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const nodeA = getNode(a);
        const nodeB = getNode(b);
        if (!nodeA || !nodeB) continue;
        if (!hasPos(nodeA.position) || !hasPos(nodeB.position)) continue;

        {
          const [lngA3, latA3] = toLngLat(nodeA.position);
          const [lngB3, latB3] = toLngLat(nodeB.position);
          features.push({
            type: "Feature",
            properties: {
              from: a,
              to: b,
              snr:
                l.snrForward !== undefined && l.snrBackward !== undefined
                  ? (l.snrForward + l.snrBackward) / 2
                  : (l.snrForward ?? l.snrBackward),
              direction: l.direction,
              snrForward: l.snrForward,
              snrBackward: l.snrBackward,
              lengthKm: distanceKm(
                { latitude: latA3, longitude: lngA3 },
                { latitude: latB3, longitude: lngB3 },
              ),
            },
            geometry: {
              type: "LineString",
              coordinates: [toLngLat(nodeA.position), toLngLat(nodeB.position)],
            },
          });
        }
      }
    }

    if (features.length === 0) return undefined;
    return {
      type: "FeatureCollection",
      features,
    } as unknown as GeoJSON.FeatureCollection;
  }, [device.traceroutes, getNode]);

  // Automatically request positions for missing endpoints (cooldown 60s)
  useEffect(() => {
    const COOLDOWN_MS = 60 * 1000;
    if (!selectedNodeLinks) return;
    // selectedNodeLinks may contain .missing
    const missing: number[] =
      (selectedNodeLinks as unknown as { missing?: number[] })?.missing ?? [];
    if (!missing || missing.length === 0) return;
    if (!connection || typeof connection.requestPosition !== "function") {
      toast({
        title: t("toast.positionRequestError", "Unable to request GPS data"),
      });
      return;
    }

    const now = Date.now();
    const toRequest: number[] = [];
    for (const nodeNum of missing) {
      const last = requestedPositionTimestamps.current.get(nodeNum) ?? 0;
      if (now - last > COOLDOWN_MS) {
        toRequest.push(nodeNum);
        requestedPositionTimestamps.current.set(nodeNum, now);
      }
    }

    if (toRequest.length === 0) return;

    // Bulk request positions (fire-and-forget)
    toRequest.forEach(async (n) => {
      try {
        await connection.requestPosition(n);
      } catch (err) {
        // ignore per-node errors
        console.warn("requestPosition failed for", n, err);
      }
      try {
        // Best-effort: ask for nodeinfo as well
        await connection.sendPacket(new Uint8Array(), Protobuf.Portnums.PortNum.NODEINFO_APP, n);
      } catch {
        // ignore
      }
    });

    toast({
      title: t("toast.requestingPosition.title", "Requesting GPS data...", {
        ns: "ui",
      }),
    });
  }, [selectedNodeLinks, connection, toast, t]);

  // Node markers & clusters
  const onMapBackgroundClick = useCallback(
    (event?: MapLayerMouseEvent) => {
      setExpandedCluster(undefined);
      if (!event?.features || !event.features.length) return;

      // prefer traceroute node clicks
      const nodeFeature = event.features.find((f) => f?.layer?.id === "darkmesh-traceroute-nodes");
      if (nodeFeature?.properties) {
        const nodeNum = Number(nodeFeature.properties.nodeNum ?? nodeFeature.properties.num ?? 0);
        if (nodeNum) {
          event?.originalEvent?.stopPropagation?.();

          const node = getNode(nodeNum);

          // if we already have GPS, open node popup/dialog
          if (node && node.position && hasPos(node.position)) {
            setPopupState({
              type: "node",
              num: nodeNum,
              offset: [0, 0],
              preventAutoPan: true,
            });
            return;
          }

          // otherwise request GPS from device, wait for position packet then open dialog
          if (!connection || typeof connection.requestPosition !== "function") {
            toast({
              title: t("toast.positionRequestError", "Unable to request GPS data"),
            });
            return;
          }

          (async () => {
            toast({
              title: t("toast.requestingPosition.title", "Requesting GPS data...", { ns: "ui" }),
            });
            try {
              await connection.requestPosition(nodeNum);
            } catch (err) {
              console.warn("requestPosition failed", err);
              toast({
                title: t("toast.positionRequestError", "Failed to request position", { ns: "ui" }),
              });
              return;
            }

            // Also request node info in the same action
            try {
              await connection.sendPacket(
                new Uint8Array(),
                Protobuf.Portnums.PortNum.NODEINFO_APP,
                nodeNum,
              );
            } catch {
              // best-effort
            }

            // subscribe for position packet
            const onPos = (posPacket: Types.PacketMetadata<Protobuf.Mesh.Position>) => {
              try {
                if ((posPacket.from?.valueOf?.() ?? posPacket.from) === nodeNum) {
                  connection.events.onPositionPacket.unsubscribe(onPos);
                  setPopupState({
                    type: "node",
                    num: nodeNum,
                    offset: [0, 0],
                    preventAutoPan: true,
                  });
                  toast({
                    title: t("toast.positionRequestReceived", "GPS data received", { ns: "ui" }),
                  });
                }
              } catch {
                // ignore
              }
            };

            connection.events.onPositionPacket.subscribe(onPos);

            // Also ask for node info (best-effort) so node DB gets richer data
            try {
              await connection.sendPacket(
                new Uint8Array(),
                Protobuf.Portnums.PortNum.NODEINFO_APP,
                nodeNum,
              );
            } catch {
              // ignore
            }

            // timeout
            setTimeout(() => {
              connection.events.onPositionPacket.unsubscribe(onPos);
              toast({
                title: t("toast.positionRequestMissing", "GPS data missing", {
                  ns: "ui",
                }),
              });
            }, 15000);
          })();
        }
      }

      // If a traceroute link was clicked, show its tooltip (click-to-open)
      const linkFeature = event.features.find(
        (f) =>
          f?.layer?.id === "darkmesh-all-traceroute-links" ||
          f?.layer?.id === "darkmesh-selected-node-links" ||
          f?.layer?.id === "darkmesh-traceroute-forward" ||
          f?.layer?.id === "darkmesh-traceroute-backward",
      );
      if (linkFeature && linkFeature.properties) {
        try {
          const props = linkFeature.properties as Record<string, unknown>;
          // prefer explicit forward/back SNR values; fall back to unified `snr` when needed
          const snrA =
            props.snrForward !== undefined
              ? Number(props.snrForward)
              : props.snr !== undefined
                ? Number(props.snr)
                : undefined;
          const snrB =
            props.snrBackward !== undefined
              ? Number(props.snrBackward)
              : props.snr !== undefined
                ? Number(props.snr)
                : undefined;
          const fromNum = Number(props.from ?? 0) || undefined;
          const toNum = Number(props.to ?? 0) || undefined;
          const fromNode = fromNum ? getNode(fromNum) : undefined;
          const toNode = toNum ? getNode(toNum) : undefined;
          const fromName = fromNode
            ? (getNodeLongName(fromNode) ?? undefined)
            : fromNum
              ? undefined
              : undefined;
          const toName = toNode
            ? (getNodeLongName(toNode) ?? undefined)
            : toNum
              ? undefined
              : undefined;
          const fromShort = getNodeShortName(fromNode) ?? undefined;
          const toShort = getNodeShortName(toNode) ?? undefined;
          const lengthKm = (props.lengthKm ?? props.length) as number | undefined;
          setClickedLink({
            pos: { x: event.point.x, y: event.point.y },
            snrA,
            snrB,
            from: fromNum,
            to: toNum,
            fromName,
            toName,
            fromShort,
            toShort,
            lengthKm,
          });
          event?.originalEvent?.stopPropagation?.();
          return;
        } catch {
          // ignore
        }
      }

      // (duplicate node handling removed - handled earlier in node feature branch)
    },
    [getNode, setExpandedCluster, setPopupState, connection, toast, t],
  );

  // Precision circles
  const precisionCirclesElementId = useId();
  const precisionCirclesElement = useMemo(
    () => (
      <PrecisionLayer
        id={precisionCirclesElementId}
        filteredNodes={filteredNodes}
        isVisible={visibilityState.positionPrecision}
      />
    ),
    [filteredNodes, visibilityState.positionPrecision, precisionCirclesElementId],
  );

  // Waypoints
  const waypointLayerElement = useMemo(
    () => (
      <WaypointLayer
        mapRef={mapRef}
        myNode={myNode}
        isVisible={visibilityState.waypoints}
        popupState={popupState}
        setPopupState={setPopupState}
      />
    ),
    [mapRef, myNode, visibilityState.waypoints, popupState],
  );

  // Default initial view: center on local node when available, otherwise Rome.
  const initialMapView = useMemo(() => {
    const spanKm = 300; // target visible span across map in km
    const computeZoomForSpanKm = (spanKm: number, lat: number) => {
      const mapWidth =
        typeof window !== "undefined" ? Math.max(360, Math.min(window.innerWidth, 1600)) : 1024;
      const metersPerPixel = (spanKm * 1000) / mapWidth;
      const zoom = Math.log2((156543.03392 * Math.cos((lat * Math.PI) / 180)) / metersPerPixel);
      return Number(zoom.toFixed(2));
    };

    if (
      typeof mapParams.lat === "number" &&
      typeof mapParams.long === "number" &&
      typeof mapParams.zoom === "number"
    ) {
      return {
        latitude: mapParams.lat,
        longitude: mapParams.long,
        zoom: mapParams.zoom,
      } as const;
    }

    if (myNode && myNode.position && hasPos(myNode.position)) {
      const [lng, lat] = toLngLat(myNode.position);
      return {
        latitude: lat,
        longitude: lng,
        zoom: computeZoomForSpanKm(spanKm, lat),
      } as const;
    }

    // Rome fallback
    const romeLat = 41.9027835;
    const romeLng = 12.4963655;
    return {
      latitude: romeLat,
      longitude: romeLng,
      zoom: computeZoomForSpanKm(spanKm, romeLat),
    } as const;
  }, [mapParams.lat, mapParams.long, mapParams.zoom, myNode]);

  const tracerouteOverlay = useMemo(() => {
    if (!selectedTraceRoute) {
      return undefined;
    }

    // reference `validNodes` to ensure this memo recomputes when node positions update
    // (used intentionally to satisfy the hooks exhaustive-deps rule)
    void validNodes;

    const sourceNode = getNode(selectedTraceRoute.to);
    const destinationNode = getNode(selectedTraceRoute.from);

    if (!sourceNode || !destinationNode) {
      return undefined;
    }

    const route = Array.isArray(selectedTraceRoute.data?.route)
      ? selectedTraceRoute.data.route
      : [];
    const routeBack = Array.isArray(selectedTraceRoute.data?.routeBack)
      ? selectedTraceRoute.data.routeBack
      : [];

    const forwardNodes = [
      sourceNode,
      ...route.map((nodeNum) => getNode(nodeNum)),
      destinationNode,
    ].filter((node): node is Protobuf.Mesh.NodeInfo => Boolean(node));
    const backwardNodes = [
      destinationNode,
      ...routeBack.map((nodeNum) => getNode(nodeNum)),
      sourceNode,
    ].filter((node): node is Protobuf.Mesh.NodeInfo => Boolean(node));
    const forwardCoordinates = buildTraceCoordinates(forwardNodes);
    const backwardCoordinates = buildTraceCoordinates(backwardNodes);

    if (forwardCoordinates.length < 2 && backwardCoordinates.length < 2) {
      return undefined;
    }

    const involvedNodes = [...forwardNodes, ...backwardNodes].filter(
      (node, index, all) => all.findIndex((candidate) => candidate.num === node.num) === index,
    );
    const positionedInvolvedNodes = involvedNodes.filter((node): node is Protobuf.Mesh.NodeInfo =>
      Boolean(node.position && hasPos(node.position)),
    );

    return {
      trace: selectedTraceRoute,
      involvedNodes,
      positionedInvolvedNodes,
      hasMissingNodePositions: positionedInvolvedNodes.length !== involvedNodes.length,
      involvedNodeNums: new Set(involvedNodes.map((node) => node.num)),
      sourceLabel: getNodeLongName(sourceNode) ?? undefined,
      destinationLabel: getNodeLongName(destinationNode) ?? undefined,
      totalDistance: pathDistanceKm(forwardCoordinates) + pathDistanceKm(backwardCoordinates),
      featureCollection: {
        type: "FeatureCollection" as const,
        features: [
          ...(forwardCoordinates.length >= 2
            ? forwardCoordinates.slice(0, -1).map((_, i) => {
                const a = forwardCoordinates[i] as [number, number];
                const b = forwardCoordinates[i + 1] as [number, number];
                const fromNode = forwardNodes[i];
                const toNode = forwardNodes[i + 1];
                const snrVal = selectedTraceRoute.data?.snrTowards?.[i];
                return {
                  type: "Feature" as const,
                  properties: {
                    role: "forward",
                    from: fromNode?.num,
                    to: toNode?.num,
                    snrForward: typeof snrVal === "number" ? snrVal / 4 : undefined,
                    lengthKm: distanceKm(
                      { latitude: a[1], longitude: a[0] },
                      { latitude: b[1], longitude: b[0] },
                    ),
                  },
                  geometry: {
                    type: "LineString" as const,
                    coordinates: [a as [number, number], b as [number, number]],
                  },
                };
              })
            : []),
          ...(backwardCoordinates.length >= 2
            ? backwardCoordinates.slice(0, -1).map((_, i) => {
                const a = backwardCoordinates[i] as [number, number];
                const b = backwardCoordinates[i + 1] as [number, number];
                const fromNode = backwardNodes[i];
                const toNode = backwardNodes[i + 1];
                const snrVal = selectedTraceRoute.data?.snrBack?.[i];
                return {
                  type: "Feature" as const,
                  properties: {
                    role: "backward",
                    from: fromNode?.num,
                    to: toNode?.num,
                    snrBackward: typeof snrVal === "number" ? snrVal / 4 : undefined,
                    lengthKm: distanceKm(
                      { latitude: a[1], longitude: a[0] },
                      { latitude: b[1], longitude: b[0] },
                    ),
                  },
                  geometry: {
                    type: "LineString" as const,
                    coordinates: [a as [number, number], b as [number, number]],
                  },
                };
              })
            : []),
          ...positionedInvolvedNodes.map((n) => ({
            type: "Feature" as const,
            properties: {
              role: "node",
              nodeNum: n.num,
              name: getNodeLongName(n) ?? null,
              shortName: getNodeShortName(n) ?? null,
            },
            geometry: {
              type: "Point" as const,
              coordinates: toLngLat(n.position),
            },
          })),
        ],
      },
    };
  }, [getNode, selectedTraceRoute, validNodes]);

  const clearVisualTraceroute = useCallback(() => {
    clearSelectedTraceRoute(undefined);
    setPendingTraceRouteTarget(deviceId, undefined);
    setPendingTraceRouteRequest(deviceId, undefined);
  }, [clearSelectedTraceRoute, deviceId, setPendingTraceRouteRequest, setPendingTraceRouteTarget]);

  useEffect(
    () => () => {
      if (!isMobileResponsiveViewport()) {
        return;
      }

      clearSelectedTraceRoute(undefined);
      setPendingTraceRouteTarget(deviceId, undefined);
      setPendingTraceRouteRequest(deviceId, undefined);
      setStoredHighlightedNeighborNode(undefined);
    },
    [
      clearSelectedTraceRoute,
      deviceId,
      setPendingTraceRouteRequest,
      setPendingTraceRouteTarget,
      setStoredHighlightedNeighborNode,
    ],
  );

  const selectNodeFromCard = useCallback(
    (nodeNum: number) => {
      const node = getNode(nodeNum);

      if (node && node.position && hasPos(node.position)) {
        focusLngLat(toLngLat(node.position));
        setPopupState({
          type: "node",
          num: nodeNum,
          offset: [0, 0],
          preventAutoPan: true,
        });
        return;
      }

      if (!connection || typeof connection.requestPosition !== "function") {
        toast({
          title: t("toast.positionRequestError", "Unable to request GPS data"),
        });
        return;
      }

      (async () => {
        toast({
          title: t("toast.requestingPosition.title", "Requesting GPS data...", {
            ns: "ui",
          }),
        });
        try {
          await connection.requestPosition(nodeNum);
        } catch (err) {
          console.warn("requestPosition failed", err);
          toast({
            title: t("toast.positionRequestError", "Failed to request position", { ns: "ui" }),
          });
          return;
        }

        const onPos = (posPacket: Types.PacketMetadata<Protobuf.Mesh.Position>) => {
          try {
            if ((posPacket.from?.valueOf?.() ?? posPacket.from) === nodeNum) {
              connection.events.onPositionPacket.unsubscribe(onPos);
              const n = getNode(nodeNum);
              if (n && n.position && hasPos(n.position)) {
                focusLngLat(toLngLat(n.position));
                setPopupState({
                  type: "node",
                  num: nodeNum,
                  offset: [0, 0],
                  preventAutoPan: true,
                });
              }
              toast({
                title: t("toast.positionRequestReceived", "GPS data received", {
                  ns: "ui",
                }),
              });
            }
          } catch {
            // ignore
          }
        };

        connection.events.onPositionPacket.subscribe(onPos);

        setTimeout(() => {
          connection.events.onPositionPacket.unsubscribe(onPos);
          toast({
            title: t("toast.positionRequestMissing", "GPS data missing", {
              ns: "ui",
            }),
          });
        }, 15000);
      })();
    },
    [getNode, connection, focusLngLat, setPopupState, toast, t],
  );

  const handleZoomIn = useCallback(() => {
    mapRef?.zoomIn();
  }, [mapRef]);

  const handleZoomOut = useCallback(() => {
    mapRef?.zoomOut();
  }, [mapRef]);

  const handleReturnNorth = useCallback(() => {
    mapRef?.easeTo({ bearing: 0, duration: 260 });
  }, [mapRef]);

  const isNorthMisaligned = Math.abs(mapBearing) > 1;

  const markerElements = useMemo(
    () => (
      <NodesLayer
        mapRef={mapRef}
        mapZoom={mapZoom}
        filteredNodes={filteredNodes}
        myNode={myNode}
        expandedCluster={expandedCluster}
        setExpandedCluster={setExpandedCluster}
        popupState={popupState}
        setPopupState={setPopupState}
        isVisible={visibilityState.nodeMarkers}
        getNodeMarkerClassName={(node) =>
          tracerouteOverlay && !tracerouteOverlay.involvedNodeNums.has(node.num)
            ? "opacity-20 grayscale saturate-0"
            : undefined
        }
        onHighlightNeighbors={(num) =>
          setHighlightedNeighborNode((prev) => {
            const next = prev === num ? undefined : num;
            setStoredHighlightedNeighborNode(next);
            if (next !== undefined) {
              clearSelectedTraceRoute(undefined);
              setPendingTraceRouteTarget(deviceId, undefined);
              setPendingTraceRouteRequest(deviceId, undefined);
            }
            return next;
          })
        }
        highlightedNeighborNode={highlightedNeighborNode}
      />
    ),
    [
      filteredNodes,
      expandedCluster,
      mapRef,
      mapZoom,
      myNode,
      popupState,
      tracerouteOverlay,
      visibilityState.nodeMarkers,
      highlightedNeighborNode,
      clearSelectedTraceRoute,
      deviceId,
      setPendingTraceRouteRequest,
      setPendingTraceRouteTarget,
      setStoredHighlightedNeighborNode,
    ],
  );

  const pendingTraceRouteNode = pendingTraceRouteTarget
    ? getNode(pendingTraceRouteTarget)
    : undefined;
  const showTraceroutePanel = Boolean(selectedTraceRoute) || pendingTraceRouteTarget !== undefined;
  const showMobileTraceroutePanel = showTraceroutePanel && visibilityState.traceroutePanel;

  // clicked link state (tooltip appears on click)
  const [clickedLink, setClickedLink] = useState<
    | {
        pos: { x: number; y: number };
        snrA?: number | undefined;
        snrB?: number | undefined;
        from?: number;
        to?: number;
        fromName?: string | null;
        toName?: string | null;
        fromShort?: string | undefined;
        toShort?: string | undefined;
        lengthKm?: number;
      }
    | undefined
  >(undefined);

  const handleCleanLinks = useCallback(() => {
    clearSelectedTraceRoute(undefined);
    setPendingTraceRouteTarget(deviceId, undefined);
    setPendingTraceRouteRequest(deviceId, undefined);
    setHighlightedNeighborNode(undefined);
    setStoredHighlightedNeighborNode(undefined);
    setClickedLink(undefined);
  }, [
    clearSelectedTraceRoute,
    deviceId,
    setPendingTraceRouteRequest,
    setPendingTraceRouteTarget,
    setStoredHighlightedNeighborNode,
  ]);

  // Close tooltip on Escape or when clicking outside the tooltip element
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setClickedLink(undefined);
      }
    };

    const onDocClick = (e: MouseEvent) => {
      try {
        const el = document.querySelector(".snr-tooltip");
        if (!el) return;
        if (!(e.target instanceof Node)) return;
        if (!el.contains(e.target as Node)) {
          setClickedLink(undefined);
        }
      } catch {
        // ignore
      }
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onDocClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onDocClick);
    };
  }, []);

  useEffect(() => {
    if (!mapRef) {
      return;
    }

    // Only fit to traceroute nodes when a traceroute overlay appears
    // (avoid re-applying focus/zoom when the traceroute ends/clears)
    const wasActive = prevTracerouteActive.current;

    const frameId = window.requestAnimationFrame(() => {
      mapRef.resize();

      if (tracerouteOverlay && !wasActive) {
        if (tracerouteOverlay.hasMissingNodePositions) {
          fitToNodesKeepingCenter(tracerouteOverlay.positionedInvolvedNodes);
          return;
        }

        fitToNodes(tracerouteOverlay.positionedInvolvedNodes);
      }
    });

    // If a traceroute just ended, change only the zoom to show ~300km span
    if (!tracerouteOverlay && wasActive) {
      try {
        const center = mapRef.getCenter();
        const spanKm = 300;
        const computeZoomForSpanKm = (spanKmLocal: number, lat: number) => {
          const mapWidth =
            typeof window !== "undefined" ? Math.max(360, Math.min(window.innerWidth, 1600)) : 1024;
          const metersPerPixel = (spanKmLocal * 1000) / mapWidth;
          const zoom = Math.log2((156543.03392 * Math.cos((lat * Math.PI) / 180)) / metersPerPixel);
          return Number(zoom.toFixed(2));
        };

        const centerTyped = center as unknown as {
          lat?: number;
          lng?: number;
          latitude?: number;
          longitude?: number;
        };

        const lat = centerTyped.lat ?? centerTyped.latitude ?? 0;
        const lng = centerTyped.lng ?? centerTyped.longitude ?? 0;
        const zoom = computeZoomForSpanKm(spanKm, lat);
        mapRef.easeTo({ center: [lng, lat], zoom });
      } catch {
        // ignore
      }
    }

    // update ref to current state for next run
    prevTracerouteActive.current = Boolean(tracerouteOverlay);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [fitToNodes, fitToNodesKeepingCenter, mapRef, tracerouteOverlay]);

  // Hide traceroute overlay / links only on double-click
  useEffect(() => {
    if (!mapRef) return;
    const map = mapRef.getMap?.();
    if (!map || typeof map.on !== "function") return;

    const onDbl = () => {
      try {
        clearSelectedTraceRoute(undefined);
      } catch {
        // ignore
      }
      try {
        setVisibilityState((s) => ({ ...s, traceroutes: false }));
        // also clear pinned node selection
        setPinnedPopupNode(undefined);
        setHighlightedNeighborNode(undefined);
        setStoredHighlightedNeighborNode(undefined);
      } catch {
        // ignore
      }
    };

    map.on("dblclick", onDbl);
    return () => {
      try {
        map.off("dblclick", onDbl);
      } catch {
        // ignore
      }
    };
  }, [mapRef, clearSelectedTraceRoute, setVisibilityState, setStoredHighlightedNeighborNode]);

  // When a popupState switches to a node, pin that node so links persist after popup close
  useEffect(() => {
    if (popupState && popupState.type === "node") {
      setPinnedPopupNode(popupState.num);
      setStoredMapPopupNode(deviceId, popupState.num);
      restoredMapPopupNodeRef.current = popupState.num;
    } else if (lastPopupStateRef.current?.type === "node") {
      setStoredMapPopupNode(deviceId, undefined);
      restoredMapPopupNodeRef.current = undefined;
    }
    lastPopupStateRef.current = popupState;
  }, [deviceId, popupState, setStoredMapPopupNode]);

  return (
    <PageLayout
      label="Map"
      noPadding
      actions={[]}
      leftBar={<Sidebar />}
      headerContent={<GatewayHeader />}
      mobileHeaderContent={<GatewayHeader />}
    >
      <div className="relative flex flex-1 overflow-hidden">
        {showTraceroutePanel && (
          <aside
            className={cn(
              "absolute inset-y-0 left-0 z-20 w-[min(88vw,22rem)] shrink-0 overflow-y-auto border-r border-slate-300 bg-background/95 px-2 py-3 text-balance shadow-xl backdrop-blur-sm transition-transform duration-500 ease-out dark:border-slate-700 dark:bg-slate-950/95",
              showMobileTraceroutePanel
                ? "darkmesh-mobile-traceroute-panel-enter translate-x-0 pointer-events-auto"
                : "-translate-x-full pointer-events-none",
              "md:static md:block md:h-auto md:w-52 md:translate-x-0 md:pointer-events-auto md:rounded-none md:border-y-0 md:border-l-0 md:bg-background md:shadow-none md:backdrop-blur-none lg:w-64",
            )}
          >
            {tracerouteOverlay ? (
              <VisualTracerouteCard
                traceroute={tracerouteOverlay.trace}
                totalDistance={tracerouteOverlay.totalDistance}
                onClear={clearVisualTraceroute}
                onSelectNode={selectNodeFromCard}
                className="h-full shadow-none"
              />
            ) : selectedTraceRoute ? (
              <VisualTracerouteCard
                traceroute={selectedTraceRoute}
                totalDistance={0}
                onClear={clearVisualTraceroute}
                onSelectNode={selectNodeFromCard}
                className="h-full shadow-none"
              />
            ) : (
              <div
                className={cn(
                  "flex h-full flex-col rounded-2xl p-4 text-[0.75rem] shadow-none backdrop-blur-sm",
                  traceroutePanelTheme.containerClass,
                )}
              >
                <div className={cn("font-semibold", traceroutePanelTheme.titleClass)}>
                  Waiting for traceroute response
                </div>
                <div className={cn("mt-2 text-[0.75rem]", traceroutePanelTheme.mutedTextClass)}>
                  {pendingTraceRouteNode
                    ? (getNodeLongName(pendingTraceRouteNode) ?? undefined)
                    : `!${numberToHexUnpadded(pendingTraceRouteTarget ?? 0).toUpperCase()}`}
                </div>
                <div className="mt-4 flex gap-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className={cn("text-[0.75rem]", traceroutePanelTheme.actionButtonClass)}
                    onClick={clearVisualTraceroute}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </aside>
        )}

        <div className="relative min-w-0 flex-1">
          <BaseMap
            initialViewState={initialMapView}
            onLoad={getMapBounds}
            onMouseMove={onMouseMove}
            onMove={(event) => {
              setMapZoom(event.viewState.zoom);
              setMapBearing(event.viewState.bearing ?? 0);
            }}
            onClick={onMapBackgroundClick}
            interactiveLayerIds={[
              `${heatmapLayerElementId}-interaction`,
              "darkmesh-traceroute-nodes",
              "darkmesh-traceroute-forward",
              "darkmesh-traceroute-backward",
              "darkmesh-selected-node-links",
              "darkmesh-all-traceroute-links",
              "darkmesh-neighbor-links",
            ]}
          >
            {heatmapLayerElement}
            {markerElements}
            {precisionCirclesElement}
            {waypointLayerElement}
            {(visibilityState.remoteNeighbors || visibilityState.directNeighbors) && (
              <SNRLayer
                id="darkmesh-neighbor-links"
                filteredNodes={filteredNodes}
                myNode={myNode}
                visibilityState={visibilityState}
              />
            )}
            {tracerouteOverlay && (
              <Source
                id="darkmesh-traceroute-overlay"
                type="geojson"
                data={tracerouteOverlay.featureCollection}
              >
                <Layer
                  id="darkmesh-traceroute-nodes"
                  type="circle"
                  filter={["==", ["get", "role"], "node"]}
                  paint={{
                    "circle-color": "#f59e0b",
                    "circle-radius": 6,
                    "circle-stroke-color": "#111827",
                    "circle-stroke-width": 2,
                  }}
                />

                <Layer
                  id="darkmesh-traceroute-forward"
                  type="line"
                  filter={["==", ["get", "role"], "forward"]}
                  paint={{
                    "line-color": [
                      "interpolate",
                      ["linear"],
                      [
                        "coalesce",
                        ["get", "snr"],
                        ["get", "snrForward"],
                        ["get", "snrBackward"],
                        -30,
                      ],
                      -30,
                      "#ef4444",
                      -15,
                      "#f59e0b",
                      -5,
                      "#10b981",
                    ],
                    "line-width": 5,
                    "line-opacity": 0.9,
                  }}
                />
                <Layer
                  id="darkmesh-traceroute-backward"
                  type="line"
                  filter={["==", ["get", "role"], "backward"]}
                  paint={{
                    "line-color": [
                      "interpolate",
                      ["linear"],
                      [
                        "coalesce",
                        ["get", "snr"],
                        ["get", "snrForward"],
                        ["get", "snrBackward"],
                        -30,
                      ],
                      -30,
                      "#ef4444",
                      -15,
                      "#f59e0b",
                      -5,
                      "#10b981",
                    ],
                    "line-dasharray": [2, 1.5],
                    "line-width": 5,
                    "line-opacity": 0.9,
                  }}
                />
              </Source>
            )}

            {selectedNodeLinks && (
              <Source id="darkmesh-selected-node-links" type="geojson" data={selectedNodeLinks}>
                <Layer
                  id="darkmesh-selected-node-links"
                  type="line"
                  paint={{
                    "line-color": [
                      "interpolate",
                      ["linear"],
                      [
                        "coalesce",
                        ["get", "snr"],
                        ["get", "snrForward"],
                        ["get", "snrBackward"],
                        -30,
                      ],
                      -30,
                      "#ef4444",
                      -15,
                      "#f59e0b",
                      -5,
                      "#10b981",
                    ],
                    "line-width": 5,
                    "line-opacity": 0.95,
                  }}
                />
              </Source>
            )}

            {/* arrows for selected links (symbol layer) */}
            {selectedNodeLinks && (
              <Source
                id="darkmesh-selected-node-links-arrows"
                type="geojson"
                data={(() => {
                  const pts: GeoJSON.Feature[] = [];
                  for (const f of (selectedNodeLinks as unknown as GeoJSON.FeatureCollection)
                    ?.features ?? []) {
                    const coords = (f.geometry as GeoJSON.LineString).coordinates as [
                      number,
                      number,
                    ][];
                    if (!coords || coords.length < 2) continue;
                    const mid = coords[Math.floor(coords.length * 0.85)];
                    // simple arrow glyph
                    pts.push({
                      type: "Feature",
                      geometry: { type: "Point", coordinates: mid },
                      properties: {
                        text: "▶",
                        angle: 0,
                        from: (f.properties as Record<string, unknown>).from,
                        to: (f.properties as Record<string, unknown>).to,
                      },
                    } as GeoJSON.Feature);
                    if (((f.properties as Record<string, unknown>).direction ?? "") === "both") {
                      const mid2 = coords[Math.floor(coords.length * 0.15)];
                      pts.push({
                        type: "Feature",
                        geometry: {
                          type: "Point",
                          coordinates: mid2 as [number, number],
                        },
                        properties: {
                          text: "◀",
                          angle: 180,
                          from: (f.properties as Record<string, unknown>).from,
                          to: (f.properties as Record<string, unknown>).to,
                        },
                      } as GeoJSON.Feature);
                    }
                  }
                  return { type: "FeatureCollection", features: pts };
                })()}
              >
                <Layer
                  id="darkmesh-selected-node-links-arrows"
                  type="symbol"
                  layout={{
                    "text-field": ["get", "text"],
                    "text-size": 16,
                    "text-allow-overlap": true,
                    "text-ignore-placement": true,
                    "symbol-placement": "point",
                  }}
                  paint={{
                    "text-color": "#f59e0b",
                    "text-halo-color": "#111827",
                    "text-halo-width": 1,
                  }}
                />
              </Source>
            )}

            {visibilityState.traceroutes && allTracerouteLinks && (
              <Source id="darkmesh-all-traceroute-links" type="geojson" data={allTracerouteLinks}>
                <Layer
                  id="darkmesh-all-traceroute-links"
                  type="line"
                  paint={{
                    // color by SNR: interpolate from -30 (red) -> -15 (yellow) -> -5 (green)
                    "line-color": [
                      "interpolate",
                      ["linear"],
                      ["coalesce", ["get", "snr"], -30],
                      -30,
                      "#ef4444",
                      -15,
                      "#f59e0b",
                      -5,
                      "#10b981",
                    ],
                    // line width: match selected links baseline (1 count == 6px) and scale by count
                    "line-width": ["*", ["coalesce", ["get", "count"], 1], 6],
                    "line-opacity": 0.85,
                  }}
                />
              </Source>
            )}

            {/* arrows for all links */}
            {visibilityState.traceroutes && allTracerouteLinks && (
              <Source
                id="darkmesh-all-traceroute-links-arrows"
                type="geojson"
                data={(() => {
                  const pts: GeoJSON.Feature[] = [];
                  for (const f of (allTracerouteLinks as unknown as GeoJSON.FeatureCollection)
                    ?.features ?? []) {
                    const coords = (f.geometry as GeoJSON.LineString).coordinates as [
                      number,
                      number,
                    ][];
                    if (!coords || coords.length < 2) continue;
                    const mid = coords[Math.floor(coords.length * 0.85)];
                    pts.push({
                      type: "Feature",
                      geometry: { type: "Point", coordinates: mid },
                      properties: {
                        text: "▶",
                        angle: 0,
                        from: (f.properties as Record<string, unknown>).from,
                        to: (f.properties as Record<string, unknown>).to,
                      },
                    } as GeoJSON.Feature);
                    if (((f.properties as Record<string, unknown>).direction ?? "") === "both") {
                      const mid2 = coords[Math.floor(coords.length * 0.15)];
                      pts.push({
                        type: "Feature",
                        geometry: { type: "Point", coordinates: mid2 },
                        properties: {
                          text: "◀",
                          angle: 180,
                          from: (f.properties as Record<string, unknown>).from,
                          to: (f.properties as Record<string, unknown>).to,
                        },
                      } as GeoJSON.Feature);
                    }
                  }
                  return { type: "FeatureCollection", features: pts };
                })()}
              >
                <Layer
                  id="darkmesh-all-traceroute-links-arrows"
                  type="symbol"
                  layout={{
                    "text-field": ["get", "text"],
                    "text-size": 12,
                    "text-allow-overlap": true,
                    "text-ignore-placement": true,
                  }}
                  paint={{
                    "text-color": "#f97316",
                    "text-halo-color": "#111827",
                    "text-halo-width": 1,
                  }}
                />
              </Source>
            )}

            {clickedLink && (
              <SNRTooltip
                pos={clickedLink.pos}
                snrA={clickedLink.snrA}
                snrB={clickedLink.snrB}
                from={clickedLink.fromName ?? clickedLink.from?.toString?.()}
                to={clickedLink.toName ?? clickedLink.to?.toString?.()}
                fromShort={clickedLink.fromShort}
                toShort={clickedLink.toShort}
                lengthKm={clickedLink.lengthKm}
              />
            )}
            {/* linkPopup removed: click tooltip (SNRTooltip) is used instead */}
          </BaseMap>

          <div className="absolute top-2.5 right-2.5 z-20 flex flex-col space-y-1">
            <button
              type="button"
              className={cn(
                "rounded align-center",
                "w-[29px] px-1 py-1 shadow-l outline-[2px] outline-stone-600/20",
                "bg-stone-50 hover:bg-stone-200 dark:bg-stone-200 dark:hover:bg-stone-300",
                "text-slate-600 hover:text-slate-700",
                "dark:text-slate-600 hover:dark:text-slate-700",
              )}
              aria-label={t("maplibre.NavigationControl.ZoomIn")}
              onClick={handleZoomIn}
            >
              <PlusIcon className="w-[21px]" />
            </button>

            <button
              type="button"
              className={cn(
                "rounded align-center",
                "w-[29px] px-1 py-1 shadow-l outline-[2px] outline-stone-600/20",
                "bg-stone-50 hover:bg-stone-200 dark:bg-stone-200 dark:hover:bg-stone-300",
                "text-slate-600 hover:text-slate-700",
                "dark:text-slate-600 hover:dark:text-slate-700",
              )}
              aria-label={t("maplibre.NavigationControl.ZoomOut")}
              onClick={handleZoomOut}
            >
              <MinusIcon className="w-[21px]" />
            </button>

            {myNode && hasPos(myNode?.position) && (
              <button
                type="button"
                className={cn(
                  "rounded align-center",
                  "w-[29px] px-1 py-1 shadow-l outline-[2px] outline-stone-600/20",
                  "bg-stone-50 hover:bg-stone-200 dark:bg-stone-200 dark:hover:bg-stone-300 ",
                  "text-slate-600 hover:text-slate-700",
                  "dark:text-slate-600 hover:dark:text-slate-700",
                )}
                aria-label={t("mapMenu.locateAria")}
                onClick={() => focusLngLat(toLngLat(myNode.position))}
              >
                <LocateFixedIcon className="w-[21px]" />
              </button>
            )}

            <FilterControl
              filterState={filterState}
              defaultFilterValues={defaultFilterValues}
              setFilterState={setFilterState}
              isDirty={isFilterDirty(filterState)}
              parameters={{
                popoverContentProps: {
                  side: "bottom",
                  align: "end",
                  sideOffset: 7,
                  style: { position: "relative", top: "-150px", right: "35px" },
                },
                popoverTriggerClassName: cn(
                  "w-[29px] px-1 py-1 rounded shadow-l outline-[2px] outline-stone-600/20 ",
                  "dark:text-slate-600 dark:hover:text-slate-700 bg-stone-50 hover:bg-stone-200 dark:bg-stone-200 dark:hover:bg-stone-300 dark:active:bg-stone-300",
                  isFilterDirty(filterState)
                    ? "text-slate-100 dark:text-slate-100 bg-green-600 dark:bg-green-600 hover:bg-green-700 dark:hover:bg-green-700 hover:text-slate-200 dark:hover:text-slate-200 active:bg-green-800 dark:active:bg-green-800 outline-green-600 dark:outline-green-700"
                    : "",
                ),
                triggerIcon: <FunnelIcon className="w-[21px]" />,
                showTextSearch: true,
              }}
            />

            <MapLayerTool
              visibilityState={visibilityState}
              setVisibilityState={setVisibilityState}
              heatmapMode={heatmapMode}
              setHeatmapMode={setHeatmapMode}
              onCleanLinks={handleCleanLinks}
            />

            {isNorthMisaligned && (
              <button
                type="button"
                className={cn(
                  "rounded align-center",
                  "w-[29px] px-1 py-1 shadow-l outline-[2px] outline-stone-600/20",
                  "bg-stone-50 hover:bg-stone-200 dark:bg-stone-200 dark:hover:bg-stone-300",
                  "text-slate-600 hover:text-slate-700",
                  "dark:text-slate-600 hover:dark:text-slate-700",
                )}
                aria-label="Return to north"
                title="Return to north"
                onClick={handleReturnNorth}
              >
                <CompassIcon className="w-[21px]" />
              </button>
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default MapPage;
