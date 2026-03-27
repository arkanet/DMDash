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
import { hasPos, toLngLat } from "@core/utils/geo.ts";
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

  const tracerouteOverlay = useMemo(() => {
    if (!selectedTraceRoute) {
      return undefined;
    }

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
        ],
      },
    };
  }, [getNode, selectedTraceRoute]);

  const clearVisualTraceroute = useCallback(() => {
    clearSelectedTraceRoute(undefined);
    setPendingTraceRouteTarget(deviceId, undefined);
  }, [clearSelectedTraceRoute, deviceId, setPendingTraceRouteTarget]);

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

  useEffect(() => {
    if (!tracerouteOverlay) {
      return;
    }

    fitToNodes(tracerouteOverlay.involvedNodes);
  }, [fitToNodes, tracerouteOverlay]);

  const pendingTraceRouteNode = pendingTraceRouteTarget
    ? getNode(pendingTraceRouteTarget)
    : undefined;

  return (
    <PageLayout
      label="Map"
      noPadding
      actions={[]}
      leftBar={<Sidebar />}
      headerContent={<GatewayHeader />}
    >
      <div className="relative flex-1">
        <BaseMap
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

        {tracerouteOverlay && (
          <VisualTracerouteCard
            traceroute={tracerouteOverlay.trace}
            totalDistance={tracerouteOverlay.totalDistance}
            onClear={clearVisualTraceroute}
          />
        )}
        {!tracerouteOverlay && pendingTraceRouteTarget !== undefined && (
          <div className="absolute left-6 top-20 z-20 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-white/10 bg-zinc-950/92 p-4 text-zinc-100 shadow-2xl backdrop-blur-sm lg:left-28">
            <div className="text-xs uppercase tracking-[0.18em] text-zinc-400">
              Visual Traceroute
            </div>
            <div className="mt-2 text-lg font-semibold">Waiting for traceroute response</div>
            <div className="mt-2 text-sm text-zinc-400">
              {pendingTraceRouteNode
                ? getNodeDisplayName(pendingTraceRouteNode, pendingTraceRouteNode.num)
                : `!${numberToHexUnpadded(pendingTraceRouteTarget).toUpperCase()}`}
            </div>
            <div className="mt-4 flex gap-3">
              <Button size="sm" variant="outline" onClick={clearVisualTraceroute}>
                Cancel
              </Button>
            </div>
          </div>
        )}
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
    </PageLayout>
  );
};

export default MapPage;
