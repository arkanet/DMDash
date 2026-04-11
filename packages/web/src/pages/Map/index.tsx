import {
  defaultVisibilityState,
  MapLayerTool,
  type VisibilityState,
} from "@app/components/PageComponents/Map/Tools/MapLayerTool.tsx";
import { GatewayHeader } from "@components/PageComponents/DarkMesh/GatewayHeader.tsx";
import { VisualTracerouteCard } from "@components/PageComponents/DarkMesh/VisualTracerouteCard.tsx";
import { FilterControl } from "@components/generic/Filter/FilterControl.tsx";
import { type FilterState, useFilterNode } from "@components/generic/Filter/useFilterNode.ts";
import { BaseMap } from "@components/Map.tsx";
import {
  HeatmapLayer,
  type HeatmapMode,
} from "@components/PageComponents/Map/Layers/HeatmapLayer.tsx";
import { NodesLayer } from "@components/PageComponents/Map/Layers/NodesLayer.tsx";
import { PrecisionLayer } from "@components/PageComponents/Map/Layers/PrecisionLayer.tsx";
import {
  SNRLayer,
  SNRTooltip,
  type SNRTooltipProps,
} from "@components/PageComponents/Map/Layers/SNRLayer.tsx";
import { WaypointLayer } from "@components/PageComponents/Map/Layers/WaypointLayer.tsx";
import type { PopupState } from "@components/PageComponents/Map/Popups/PopupWrapper.tsx";
import { PageLayout } from "@components/PageLayout.tsx";
import { Sidebar } from "@components/Sidebar.tsx";
import { Button } from "@components/UI/Button.tsx";
import { useDarkMeshStore } from "@app/darkmesh/store.ts";
import { distanceKm, getNodeDisplayName } from "@app/darkmesh/utils.ts";
import { useMapFitting } from "@core/hooks/useMapFitting.ts";
import { useDevice, useNodeDB } from "@core/stores";
import { useToast } from "@core/hooks/useToast.ts";
import { cn } from "@core/utils/cn.ts";
import { hasPos, toLngLat } from "@core/utils/geo.ts";
import { Protobuf } from "@meshtastic/core";
import type { Types } from "@meshtastic/core";
import { numberToHexUnpadded } from "@noble/curves/abstract/utils";
import { FunnelIcon, LocateFixedIcon, MinusIcon, PlusIcon } from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Layer, Source, type MapLayerMouseEvent, useMap } from "react-map-gl/maplibre";

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

  for (let index = 1; index < coords.length; index += 1) {
    const previous = coords[index - 1];
    const current = coords[index];
    if (!previous || !current) {
      continue;
    }

    total += distanceKm(
      { latitude: previous[1], longitude: previous[0] },
      { latitude: current[1], longitude: current[0] },
    );
  }

  return total;
}

const NODEDB_DEBOUNCE_MS = 250;

const MapPage = () => {
  const { t } = useTranslation("map");
  const { id: deviceId, connection } = useDevice();
  const { toast } = useToast();
  const { getNode } = useNodeDB();
  const { nodes: validNodes, myNode } = useNodeDB(
    (db) => ({
      // only nodes with a position
      nodes: db.getNodes((n): n is Protobuf.Mesh.NodeInfo => Boolean(n.position?.latitudeI)),
      myNode: db.getMyNode(),

      // References to cause re-render on change
      _errorsRef: db.nodeErrors,
      _nodeNumRef: db.myNodeNum,
    }),
    { debounce: NODEDB_DEBOUNCE_MS },
  );
  const { nodeFilter, defaultFilterValues, isFilterDirty } = useFilterNode();
  const { default: mapRef } = useMap();
  const { focusLngLat, fitToNodes } = useMapFitting(mapRef);
  const selectedTraceRoute = useDarkMeshStore((state) => state.selectedTraceRoute);
  const pendingTraceRouteTarget = useDarkMeshStore(
    (state) => state.pendingTraceRouteTargetByDevice[deviceId],
  );
  const clearSelectedTraceRoute = useDarkMeshStore((state) => state.setSelectedTraceRoute);
  const setPendingTraceRouteTarget = useDarkMeshStore((state) => state.setPendingTraceRouteTarget);

  const hasFitBoundsOnce = useRef(false);
  const prevTracerouteActive = useRef(false);
  const [snrHover, setSnrHover] = useState<SNRTooltipProps>();
  const [expandedCluster, setExpandedCluster] = useState<string | undefined>();
  const [popupState, setPopupState] = useState<PopupState | undefined>();

  const [visibilityState, setVisibilityState] = useState<VisibilityState>(
    () => defaultVisibilityState,
  );
  const [heatmapMode, setHeatmapMode] = useState<HeatmapMode>("density");

  // Filters
  const [filterState, setFilterState] = useState<FilterState>(() => defaultFilterValues);
  const deferredFilterState = useDeferredValue(filterState);

  const filteredNodes = useMemo(
    () => validNodes.filter((node) => nodeFilter(node, deferredFilterState)),
    [validNodes, deferredFilterState, nodeFilter],
  );

  // Map fitting
  const getMapBounds = useCallback(() => {
    if (!hasFitBoundsOnce.current) {
      fitToNodes(validNodes);
      hasFitBoundsOnce.current = true;
    }
  }, [fitToNodes, validNodes]);

  // SNR lines
  const snrLayerElementId = useId();
  const snrLayerElement = useMemo(
    () => (
      <SNRLayer
        id={snrLayerElementId}
        filteredNodes={filteredNodes}
        myNode={myNode}
        visibilityState={visibilityState}
      />
    ),
    [filteredNodes, myNode, visibilityState, snrLayerElementId],
  );

  // Heatmap
  const heatmapLayerElementId = useId();
  const heatmapLayerElement = useMemo(
    () =>
      visibilityState.heatmap ? (
        <HeatmapLayer id={heatmapLayerElementId} filteredNodes={filteredNodes} mode={heatmapMode} />
      ) : null,
    [filteredNodes, visibilityState.heatmap, heatmapMode, heatmapLayerElementId],
  );

  const onMouseMove = useCallback(
    (event: MapLayerMouseEvent) => {
      const {
        features,
        point: { x, y },
      } = event;
      const hoveredFeature = features?.[0];

      if (hoveredFeature?.properties) {
        const { from, to, snr, name, shortName, num } = hoveredFeature.properties;
        const hoverNum = typeof num === "number" ? num : 0;

        // Handle Heatmap Hover
        if (
          hoveredFeature.layer.id === `${heatmapLayerElementId}-interaction` &&
          name !== undefined
        ) {
          setSnrHover({
            pos: { x, y },
            snr: snr, // Single node SNR
            from:
              name ||
              shortName ||
              t("fallbackName", {
                last4: numberToHexUnpadded(hoverNum).slice(-4).toUpperCase(),
              }),
            to: "", // Single node tooltip
          });
          return;
        }

        // Handle SNR Line Hover
        const fromLong =
          getNode(from)?.user?.longName ??
          t("fallbackName", {
            last4: numberToHexUnpadded(from).slice(-4).toUpperCase(),
          });

        const toLong =
          getNode(to)?.user?.longName ??
          t("fallbackName", {
            last4: numberToHexUnpadded(to).slice(-4).toUpperCase(),
          });

        setSnrHover({ pos: { x, y }, snr, from: fromLong, to: toLong });
      } else {
        setSnrHover(undefined);
      }
    },
    [getNode, t, heatmapLayerElementId],
  );

  // Node markers & clusters
  const onMapBackgroundClick = useCallback(
    (event?: MapLayerMouseEvent) => {
      setExpandedCluster(undefined);

      if (!event?.features || !event.features.length) return;

      // prefer traceroute node clicks
      const nodeFeature = event.features.find((f) => f?.layer?.id === "darkmesh-traceroute-nodes");
      if (!nodeFeature?.properties) return;

      const nodeNum = Number(nodeFeature.properties.nodeNum ?? nodeFeature.properties.num ?? 0);
      if (!nodeNum) return;

      event?.originalEvent?.stopPropagation?.();

      const node = getNode(nodeNum);

      // if we already have GPS, open node popup/dialog
      if (node && node.position && hasPos(node.position)) {
        setPopupState({ type: "node", num: nodeNum, offset: [0, 0], preventAutoPan: true });
        return;
      }

      // otherwise request GPS from device, wait for position packet then open dialog
      if (!connection || typeof connection.requestPosition !== "function") {
        toast({ title: t("toast.positionRequestError", "Unable to request GPS data") });
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
              setPopupState({ type: "node", num: nodeNum, offset: [0, 0], preventAutoPan: true });
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
          toast({ title: t("toast.positionRequestMissing", "GPS data missing", { ns: "ui" }) });
        }, 15000);
      })();
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
  }, [myNode]);

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

    const forwardNodes = [
      sourceNode,
      ...selectedTraceRoute.data.route.map((nodeNum) => getNode(nodeNum)),
      destinationNode,
    ].filter((node): node is Protobuf.Mesh.NodeInfo => Boolean(node));
    const backwardNodes = [
      destinationNode,
      ...selectedTraceRoute.data.routeBack.map((nodeNum) => getNode(nodeNum)),
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

    return {
      trace: selectedTraceRoute,
      involvedNodes,
      involvedNodeNums: new Set(involvedNodes.map((node) => node.num)),
      sourceLabel: getNodeDisplayName(sourceNode, sourceNode.num),
      destinationLabel: getNodeDisplayName(destinationNode, destinationNode.num),
      totalDistance: pathDistanceKm(forwardCoordinates) + pathDistanceKm(backwardCoordinates),
      featureCollection: {
        type: "FeatureCollection" as const,
        features: [
          ...(forwardCoordinates.length >= 2
            ? [
                {
                  type: "Feature" as const,
                  properties: {
                    role: "forward",
                  },
                  geometry: {
                    type: "LineString" as const,
                    coordinates: forwardCoordinates,
                  },
                },
              ]
            : []),
          ...(backwardCoordinates.length >= 2
            ? [
                {
                  type: "Feature" as const,
                  properties: {
                    role: "backward",
                  },
                  geometry: {
                    type: "LineString" as const,
                    coordinates: backwardCoordinates,
                  },
                },
              ]
            : []),
          ...involvedNodes
            .filter((n) => Boolean(n.position && hasPos(n.position)))
            .map((n) => ({
              type: "Feature" as const,
              properties: {
                role: "node",
                nodeNum: n.num,
                name: n.user?.longName ?? null,
                shortName: n.user?.shortName ?? null,
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
  }, [clearSelectedTraceRoute, deviceId, setPendingTraceRouteTarget]);

  const selectNodeFromCard = useCallback(
    (nodeNum: number) => {
      const node = getNode(nodeNum);

      if (node && node.position && hasPos(node.position)) {
        focusLngLat(toLngLat(node.position));
        setPopupState({ type: "node", num: nodeNum, offset: [0, 0], preventAutoPan: true });
        return;
      }

      if (!connection || typeof connection.requestPosition !== "function") {
        toast({ title: t("toast.positionRequestError", "Unable to request GPS data") });
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

        const onPos = (posPacket: Types.PacketMetadata<Protobuf.Mesh.Position>) => {
          try {
            if ((posPacket.from?.valueOf?.() ?? posPacket.from) === nodeNum) {
              connection.events.onPositionPacket.unsubscribe(onPos);
              const n = getNode(nodeNum);
              if (n && n.position && hasPos(n.position)) {
                focusLngLat(toLngLat(n.position));
                setPopupState({ type: "node", num: nodeNum, offset: [0, 0], preventAutoPan: true });
              }
              toast({
                title: t("toast.positionRequestReceived", "GPS data received", { ns: "ui" }),
              });
            }
          } catch {
            // ignore
          }
        };

        connection.events.onPositionPacket.subscribe(onPos);

        setTimeout(() => {
          connection.events.onPositionPacket.unsubscribe(onPos);
          toast({ title: t("toast.positionRequestMissing", "GPS data missing", { ns: "ui" }) });
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

  const markerElements = useMemo(
    () => (
      <NodesLayer
        mapRef={mapRef}
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
      />
    ),
    [
      filteredNodes,
      expandedCluster,
      mapRef,
      myNode,
      popupState,
      tracerouteOverlay,
      visibilityState.nodeMarkers,
    ],
  );

  const pendingTraceRouteNode = pendingTraceRouteTarget
    ? getNode(pendingTraceRouteTarget)
    : undefined;
  const showTraceroutePanel = Boolean(tracerouteOverlay) || pendingTraceRouteTarget !== undefined;

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
        fitToNodes(tracerouteOverlay.involvedNodes);
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
  }, [fitToNodes, mapRef, tracerouteOverlay]);

  return (
    <PageLayout
      label="Map"
      noPadding
      actions={[]}
      leftBar={<Sidebar />}
      headerContent={<GatewayHeader />}
    >
      <div className="flex flex-1 overflow-hidden">
        {showTraceroutePanel && (
          <aside className="w-52 lg:w-64 shrink-0 border-r border-slate-300 bg-background px-2 py-3 text-balance dark:border-slate-700">
            {tracerouteOverlay ? (
              <VisualTracerouteCard
                traceroute={tracerouteOverlay.trace}
                totalDistance={tracerouteOverlay.totalDistance}
                onClear={clearVisualTraceroute}
                onSelectNode={selectNodeFromCard}
                className="h-full shadow-none"
              />
            ) : (
              <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-[#222] p-4 text-[0.75rem] text-zinc-100 shadow-none backdrop-blur-sm">
                <div className="font-semibold">Waiting for traceroute response</div>
                <div className="mt-2 text-[0.75rem] text-zinc-400">
                  {pendingTraceRouteNode
                    ? getNodeDisplayName(pendingTraceRouteNode, pendingTraceRouteNode.num)
                    : `!${numberToHexUnpadded(pendingTraceRouteTarget ?? 0).toUpperCase()}`}
                </div>
                <div className="mt-4 flex gap-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-[0.75rem]"
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
            onClick={onMapBackgroundClick}
            interactiveLayerIds={[
              snrLayerElementId,
              `${heatmapLayerElementId}-interaction`,
              "darkmesh-traceroute-nodes",
            ]}
          >
            {heatmapLayerElement}
            {markerElements}
            {snrLayerElement}
            {precisionCirclesElement}
            {waypointLayerElement}
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
                    "line-color": "#ef4444",
                    "line-width": 4,
                    "line-opacity": 0.9,
                  }}
                />
                <Layer
                  id="darkmesh-traceroute-backward"
                  type="line"
                  filter={["==", ["get", "role"], "backward"]}
                  paint={{
                    "line-color": "#38bdf8",
                    "line-width": 4,
                    "line-opacity": 0.9,
                  }}
                />
              </Source>
            )}

            {snrHover && (
              <SNRTooltip
                pos={snrHover.pos}
                snr={snrHover.snr}
                from={snrHover.from}
                to={snrHover.to}
              />
            )}
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
            />
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default MapPage;
