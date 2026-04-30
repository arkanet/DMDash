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
import { Input } from "@components/UI/Input.tsx";
import useLang from "@core/hooks/useLang.ts";
import { useAppStore, useDevice, useNodeDB } from "@core/stores";
import { Protobuf, type Types } from "@meshtastic/core";
import { getNodeShortName, getNodeLongName, distanceKm } from "@app/darkmesh/utils.ts";
import { hasPos, toLngLat } from "@core/utils/geo.ts";
import { numberToHexUnpadded } from "@noble/curves/abstract/utils";
import { LockIcon, LockOpenIcon } from "lucide-react";
import { type JSX, useCallback, useDeferredValue, useEffect, useState } from "react";
import { useDarkMeshStore } from "@app/darkmesh/store.ts";
import { useTranslation } from "react-i18next";
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

export interface DeleteNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NodesPage = (): JSX.Element => {
  const { t } = useTranslation(["nodes", "ui"]);
  useLang();
  const { hardware, connection, setDialogOpen } = useDevice();

  const { setNodeNumDetails } = useAppStore();
  const { nodeFilter, defaultFilterValues, isFilterDirty } = useFilterNode();

  const [selectedTraceroute, setSelectedTraceroute] = useState<
    Types.PacketMetadata<Protobuf.Mesh.RouteDiscovery> | undefined
  >();
  const [selectedLocation, setSelectedLocation] = useState<
    Types.PacketMetadata<Protobuf.Mesh.Position> | undefined
  >();

  const [filterState, setFilterState] = useState<FilterState>(() => defaultFilterValues);
  const deferredFilterState = useDeferredValue(filterState);

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
  const handleTraceroute = useCallback(
    (traceroute: Types.PacketMetadata<Protobuf.Mesh.RouteDiscovery>) => {
      setSelectedTraceroute(traceroute);
    },
    [],
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
    if (!connection) {
      return;
    }
    connection.events.onPositionPacket.subscribe(handleLocation);
    return () => {
      connection.events.onPositionPacket.unsubscribe(handleLocation);
    };
  }, [connection, handleLocation]);

  const nodeDB = useNodeDB();
  const myNode = nodeDB.getNode ? nodeDB.getNode(hardware.myNodeNum) : undefined;

  const tableHeadings: Heading[] = [
    { title: "", sortable: false },
    { title: t("nodesTable.headings.longName"), sortable: true },
    { title: t("nodesTable.headings.distance", "Distance"), sortable: true },
    { title: t("nodesTable.headings.connection"), sortable: true },
    { title: t("nodesTable.headings.lastHeard"), sortable: true },
    { title: t("nodesTable.headings.encryption"), sortable: false },
    { title: t("nodesTable.headings.role", "Role"), sortable: true },
    { title: t("nodesTable.headings.utilization", "Air/Ch Util"), sortable: true },
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
    const distanceVal: number | undefined =
      myNode && hasPos(myNode.position) && hasPos(node.position)
        ? distanceKm(
            { latitude: toLngLat(myNode.position)[1], longitude: toLngLat(myNode.position)[0] },
            { latitude: toLngLat(node.position)[1], longitude: toLngLat(node.position)[0] },
          )
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

  return (
    <PageLayout
      label={t("navigation.nodes", { ns: "ui" })}
      leftBar={<Sidebar />}
      headerContent={<GatewayHeader />}
    >
      <div className="pl-2 pt-2 flex flex-row">
        <div className="flex-1 mr-2">
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
      <div className="overflow-y-auto">
        <div className="max-w-full">
          <div className="text-xs">
            <Table headings={tableHeadings} rows={tableRows} />
          </div>
        </div>
        <TracerouteResponseDialog
          traceroute={selectedTraceroute}
          open={!!selectedTraceroute}
          onOpenChange={() => setSelectedTraceroute(undefined)}
        />
        <LocationResponseDialog
          location={selectedLocation}
          open={!!selectedLocation}
          onOpenChange={() => setSelectedLocation(undefined)}
        />
      </div>
    </PageLayout>
  );
};

export default NodesPage;
