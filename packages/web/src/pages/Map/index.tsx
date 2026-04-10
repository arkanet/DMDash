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
import { cn } from "@core/utils/cn.ts";
import { boundsFromLngLat, hasPos, toLngLat } from "@core/utils/geo.ts";
import type { Protobuf } from "@meshtastic/core";
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
const DEFAULT_MAP_SPAN_KM = 300;
const TRACEROUTE_SPAN_KM = 500;

function computeZoomForSpanKm(spanKm: number, lat: number) {
  const mapWidth =
    typeof window !== "undefined" ? Math.max(360, Math.min(window.innerWidth, 1600)) : 1024;
  const safeCos = Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  const metersPerPixel = (spanKm * 1000) / mapWidth;
  const zoom = Math.log2((156543.03392 * safeCos) / metersPerPixel);
  return Number(zoom.toFixed(2));
}

const MapPage = () => {
  const { t } = useTranslation("map");
  const { id: deviceId } = useDevice();
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
  const onMapBackgroundClick = useCallback(() => {
    setExpandedCluster(undefined);
  }, []);

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
    if (myNode && myNode.position && hasPos(myNode.position)) {
      const [lng, lat] = toLngLat(myNode.position);
      return {
        latitude: lat,
        longitude: lng,
        zoom: computeZoomForSpanKm(DEFAULT_MAP_SPAN_KM, lat),
      } as const;
    }

    // Rome fallback
    const romeLat = 41.9027835;
    const romeLng = 12.4963655;
    return {
      latitude: romeLat,
      longitude: romeLng,
      zoom: computeZoomForSpanKm(DEFAULT_MAP_SPAN_KM, romeLat),
    } as const;
  }, [myNode]);

  // Animate/center map when a popup node is selected
  useEffect(() => {
    if (!popupState || popupState.type !== "node" || !mapRef) return;
    const sel = getNode(popupState.num);
    if (!sel || !sel.position || !hasPos(sel.position)) return;
    const [lng, lat] = toLngLat(sel.position);
    try {
      // center with animation
      mapRef.easeTo({ center: [lng, lat], duration: 600 });
    } catch {
      // fallback: set center directly
      try {
        const map = mapRef.getMap();
        map.setCenter([lng, lat]);
      } catch {
        // ignore
      }
    }
  }, [popupState, mapRef, getNode]);

  const tracerouteOverlay = useMemo(() => {
    if (!selectedTraceRoute) {
      return undefined;
    }

    const sourceNode = getNode(selectedTraceRoute.to);
    const destinationNode = getNode(selectedTraceRoute.from);

    if (!sourceNode || !destinationNode) {
      return undefined;
    }

    // Keep full node number paths (including intermediates) even if some nodes
    // are not yet present in the local `nodeDB`. Coordinates will be computed
    // only for nodes that have a known position.
    // Prefer explicit forward route when provided. If empty, reconstruct a
    // forward route from routeBack by taking unique intermediate hops in order.
    const rawForward = selectedTraceRoute.data.route ?? [];
    const rawBack = selectedTraceRoute.data.routeBack ?? [];

    let forwardNodeNums: number[];
    if (rawForward.length > 0) {
      forwardNodeNums = [selectedTraceRoute.to, ...rawForward, selectedTraceRoute.from];
    } else if (rawBack.length > 0) {
      const uniq: number[] = [];
      for (const n of rawBack) {
        if (!uniq.includes(n)) uniq.push(n);
      }
      forwardNodeNums = [selectedTraceRoute.to, ...uniq, selectedTraceRoute.from];
    } else {
      forwardNodeNums = [selectedTraceRoute.to, selectedTraceRoute.from];
    }
    const backwardNodeNums = [...forwardNodeNums].slice().reverse();

    const forwardCoordinates = buildTraceCoordinates(
      forwardNodeNums
        .map((n) => getNode(n))
        .filter((node): node is Protobuf.Mesh.NodeInfo => Boolean(node)),
    );
    const backwardCoordinates = buildTraceCoordinates(
      backwardNodeNums
        .map((n) => getNode(n))
        .filter((node): node is Protobuf.Mesh.NodeInfo => Boolean(node)),
    );

    if (forwardCoordinates.length < 2 && backwardCoordinates.length < 2) {
      return undefined;
    }

    const involvedNodeNums = Array.from(new Set([...forwardNodeNums, ...backwardNodeNums]));
    const involvedNodes = involvedNodeNums
      .map((n) => getNode(n))
      .filter((node): node is Protobuf.Mesh.NodeInfo => Boolean(node));

    return {
      trace: selectedTraceRoute,
      involvedNodes,
      involvedNodeNums: new Set(involvedNodeNums),
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
        ],
      },
    };
  }, [getNode, selectedTraceRoute]);

  const clearVisualTraceroute = useCallback(() => {
    clearSelectedTraceRoute(undefined);
    setPendingTraceRouteTarget(deviceId, undefined);
  }, [clearSelectedTraceRoute, deviceId, setPendingTraceRouteTarget]);

  const focusTracerouteNodes = useCallback(
    (nodes: Protobuf.Mesh.NodeInfo[]) => {
      if (!mapRef) {
        return;
      }

      const positionedNodes = nodes.filter((node): node is Protobuf.Mesh.NodeInfo =>
        Boolean(node.position && hasPos(node.position)),
      );

      if (positionedNodes.length === 0) {
        return;
      }

      const coords = positionedNodes.map((node) => toLngLat(node.position));
      if (coords.length === 1) {
        const firstCoord = coords[0];
        if (!firstCoord) {
          return;
        }

        const [lng, lat] = firstCoord;
        mapRef.easeTo({
          center: [lng, lat],
          zoom: computeZoomForSpanKm(TRACEROUTE_SPAN_KM, lat),
        });
        return;
      }

      const bounds = boundsFromLngLat(coords);
      if (!bounds) {
        return;
      }

      const centerLng = (bounds[0][0] + bounds[1][0]) / 2;
      const centerLat = (bounds[0][1] + bounds[1][1]) / 2;
      const fittedCamera = mapRef.cameraForBounds(bounds, {
        padding: { top: 40, bottom: 40, left: 40, right: 40 },
      });
      const tracerouteZoom = computeZoomForSpanKm(TRACEROUTE_SPAN_KM, centerLat);
      const zoom =
        typeof fittedCamera?.zoom === "number"
          ? Math.min(fittedCamera.zoom, tracerouteZoom)
          : tracerouteZoom;

      mapRef.easeTo({
        center: [centerLng, centerLat],
        zoom,
      });
    },
    [mapRef],
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

    const frameId = window.requestAnimationFrame(() => {
      mapRef.resize();

      if (tracerouteOverlay) {
        focusTracerouteNodes(tracerouteOverlay.involvedNodes);
        return;
      }

      if (pendingTraceRouteNode?.position && hasPos(pendingTraceRouteNode.position)) {
        focusTracerouteNodes([pendingTraceRouteNode]);
      }
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [focusTracerouteNodes, mapRef, pendingTraceRouteNode, showTraceroutePanel, tracerouteOverlay]);

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
            interactiveLayerIds={[snrLayerElementId, `${heatmapLayerElementId}-interaction`]}
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
                    "line-dasharray": [1, 1.5],
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
                  style: { right: "35px", top: "-150px", position: "fixed" },
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
