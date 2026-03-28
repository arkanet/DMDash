import { create } from "@bufbuild/protobuf";
import { GatewayHeader } from "@components/PageComponents/DarkMesh/GatewayHeader.tsx";
import { PageLayout } from "@components/PageLayout.tsx";
import { Sidebar } from "@components/Sidebar.tsx";
import { Button } from "@components/UI/Button.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/UI/Card.tsx";
import { Input } from "@components/UI/Input.tsx";
import { useFavoriteNode } from "@core/hooks/useFavoriteNode.ts";
import { useToast } from "@core/hooks/useToast.ts";
import { useAppStore, useDevice, useNodeDB } from "@core/stores";
import { Protobuf } from "@meshtastic/core";
import {
  Activity,
  CalendarClock,
  Download,
  Gauge,
  MapIcon,
  Radar,
  RefreshCcw,
  Route,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  defaultBeaconConfig,
  defaultHuntConfig,
  useDarkMeshStore,
  type BeaconConfig,
  type HuntConfig,
} from "./store.ts";
import {
  buildDmdbContents,
  createNodeInfoFromSharedContact,
  getNodeDisplayName,
  parseDmdbContents,
  toLocalDateTimeValue,
} from "./utils.ts";

function DashboardCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-slate-200/80 bg-white/90 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/85">
      <CardHeader>
        <CardTitle className="uppercase tracking-[0.18em] text-sm text-slate-900 dark:text-white">
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function encodeDestinationValue(kind: "broadcast" | "direct", destination: number): string {
  return `${kind}:${destination}`;
}

function decodeDestinationValue(value: string): {
  kind: "broadcast" | "direct";
  destination: number;
} {
  const [kind, rawDestination] = value.split(":");
  return {
    kind: kind === "direct" ? "direct" : "broadcast",
    destination: Number(rawDestination),
  };
}

function formatScheduleRun(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function formatSince(timestamp?: number): string {
  if (!timestamp) {
    return "Never";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

const DarkMeshDashboardPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { updateFavorite } = useFavoriteNode();
  const { selectedDeviceId } = useAppStore();
  const deviceId = selectedDeviceId ?? -1;
  const { channels, traceroutes, unreadCounts, sendAdminMessage, connection } = useDevice();
  const { getMyNode, getNodes, addNode } = useNodeDB();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allSchedules = useDarkMeshStore((state) => state.schedules);
  const beaconConfig = useDarkMeshStore(
    (state) => state.beaconsByDevice[deviceId] ?? defaultBeaconConfig,
  );
  const huntConfig = useDarkMeshStore((state) => state.huntByDevice[deviceId] ?? defaultHuntConfig);
  const selectedTraceRoute = useDarkMeshStore((state) => state.selectedTraceRoute);

  const addSchedule = useDarkMeshStore((state) => state.addSchedule);
  const removeSchedule = useDarkMeshStore((state) => state.removeSchedule);
  const upsertBeaconConfig = useDarkMeshStore((state) => state.upsertBeaconConfig);
  const upsertHuntConfig = useDarkMeshStore((state) => state.upsertHuntConfig);
  const setHuntStatus = useDarkMeshStore((state) => state.setHuntStatus);
  const setHuntError = useDarkMeshStore((state) => state.setHuntError);
  const setSelectedTraceRoute = useDarkMeshStore((state) => state.setSelectedTraceRoute);

  const myNode = getMyNode();
  const schedules = useMemo(
    () => allSchedules.filter((schedule) => schedule.deviceId === deviceId),
    [allSchedules, deviceId],
  );
  const nodes = useMemo(
    () => getNodes((node) => node.num !== myNode?.num, true),
    [getNodes, myNode?.num],
  );

  const channelOptions = useMemo(
    () =>
      Array.from(channels.values())
        .filter((channel) => channel.role !== Protobuf.Channel.Channel_Role.DISABLED)
        .map((channel) => ({
          label:
            channel.settings?.name ||
            (channel.index === 0 ? "Primary broadcast" : `Channel ${channel.index}`),
          value: encodeDestinationValue("broadcast", channel.index),
        })),
    [channels],
  );

  const nodeOptions = useMemo(
    () =>
      nodes
        .filter((node) => Boolean(node.user))
        .sort((left, right) => (right.lastHeard ?? 0) - (left.lastHeard ?? 0))
        .map((node) => ({
          label: getNodeDisplayName(node, node.num),
          value: encodeDestinationValue("direct", node.num),
        })),
    [nodes],
  );

  const destinationOptions = useMemo(
    () => [...channelOptions, ...nodeOptions],
    [channelOptions, nodeOptions],
  );

  const flattenedTraceroutes = useMemo(
    () =>
      Array.from(traceroutes.values())
        .flat()
        .sort((left, right) => right.rxTime.getTime() - left.rxTime.getTime())
        .slice(0, 8),
    [traceroutes],
  );

  const unreadCount = useMemo(
    () => Array.from(unreadCounts.values()).reduce((total, value) => total + value, 0),
    [unreadCounts],
  );

  const [scheduleDestination, setScheduleDestination] = useState(
    destinationOptions[0]?.value ?? encodeDestinationValue("broadcast", 0),
  );
  const [scheduleText, setScheduleText] = useState("");
  const [scheduleAt, setScheduleAt] = useState(
    toLocalDateTimeValue(new Date(Date.now() + 10 * 60_000)),
  );
  const [scheduleRecurrence, setScheduleRecurrence] = useState<"once" | "daily" | "weekly">("once");
  const [beaconDraft, setBeaconDraft] = useState<BeaconConfig>(beaconConfig);
  const [huntDraft, setHuntDraft] = useState<HuntConfig>(huntConfig);
  const [exportFavoriteOnly, setExportFavoriteOnly] = useState(false);

  useEffect(() => {
    if (destinationOptions.length > 0) {
      setScheduleDestination((current) =>
        destinationOptions.some((option) => option.value === current)
          ? current
          : (destinationOptions[0]?.value ?? current),
      );
    }
  }, [destinationOptions]);

  useEffect(() => {
    setBeaconDraft(beaconConfig);
  }, [beaconConfig]);

  useEffect(() => {
    setHuntDraft(huntConfig);
  }, [huntConfig]);

  const handleAddSchedule = () => {
    if (!scheduleText.trim()) {
      toast({ title: "Add a message before scheduling it" });
      return;
    }

    const nextRunAt = new Date(scheduleAt).getTime();
    if (!Number.isFinite(nextRunAt) || nextRunAt <= Date.now()) {
      toast({ title: "Choose a future date and time for the scheduled message" });
      return;
    }

    const destination = decodeDestinationValue(scheduleDestination);
    const destinationLabel =
      destinationOptions.find((option) => option.value === scheduleDestination)?.label ??
      "Unknown destination";

    addSchedule({
      deviceId,
      destination: destination.destination,
      kind: destination.kind,
      label: destinationLabel,
      text: scheduleText.trim(),
      nextRunAt,
      recurrence: scheduleRecurrence,
    });

    setScheduleText("");
    setScheduleAt(toLocalDateTimeValue(new Date(Date.now() + 10 * 60_000)));
  };

  const handleSaveBeacon = () => {
    upsertBeaconConfig(deviceId, beaconDraft);
    toast({
      title: beaconDraft.enabled ? "DarkMesh beacon enabled" : "DarkMesh beacon settings saved",
    });
  };

  const handleValidateHunt = async () => {
    try {
      const response = await fetch(`${huntDraft.endpoint.replace(/\/+$/g, "")}/api/health`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${huntDraft.token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Endpoint returned ${response.status}`);
      }

      upsertHuntConfig(deviceId, {
        ...huntDraft,
        enabled: true,
      });
      setHuntStatus(deviceId, "Health check passed. Hunt forwarding is active.");
      toast({ title: "DarkMesh hunting endpoint validated" });
    } catch (error) {
      setHuntError(
        deviceId,
        error instanceof Error ? error.message : "Unknown hunt validation error",
      );
      toast({
        title: "Unable to validate the DarkMesh hunting endpoint",
      });
    }
  };

  const handleDisableHunt = () => {
    upsertHuntConfig(deviceId, {
      ...huntDraft,
      enabled: false,
    });
    setHuntStatus(deviceId, "Hunt forwarding disabled");
  };

  const handleExportDmdb = () => {
    if (!myNode) {
      toast({ title: "Connect to a node before exporting a DarkMesh NodeDB" });
      return;
    }

    const dmdbContents = buildDmdbContents(nodes, myNode.num, exportFavoriteOnly);
    const fileName = `darkmesh_${exportFavoriteOnly ? "favorites" : "nodes"}_${Date.now()}.dmdb`;
    const blob = new Blob([dmdbContents], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: `Exported ${exportFavoriteOnly ? "favorite " : ""}NodeDB as ${fileName}`,
    });
  };

  const handleImportDmdb = async (file?: File) => {
    if (!file) {
      return;
    }

    try {
      const parsed = parseDmdbContents(await file.text());

      parsed.contacts.forEach((contact) => {
        sendAdminMessage(
          create(Protobuf.Admin.AdminMessageSchema, {
            payloadVariant: {
              case: "addContact",
              value: contact,
            },
          }),
        );
        addNode(createNodeInfoFromSharedContact(contact, parsed.favoriteOnly));

        if (parsed.favoriteOnly) {
          updateFavorite({
            nodeNum: contact.nodeNum,
            isFavorite: true,
          });
        }
      });

      toast({
        title: `Imported ${parsed.contacts.length} DarkMesh contacts from v${parsed.version}`,
      });
    } catch (error) {
      toast({
        title:
          error instanceof Error ? error.message : "Unable to import the selected DarkMesh NodeDB",
      });
    }
  };

  return (
    <PageLayout
      label="DarkMesh Dashboard"
      leftBar={<Sidebar />}
      contentClassName="overflow-y-auto"
      headerContent={<GatewayHeader />}
    >
      {/* Top dashboard header removed per design update */}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          {/* Traceroute Visualization removed per design update */}
          <DashboardCard
            title="Scheduled Messages"
            description="Create and manage scheduled DarkMesh messages."
          >
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                icon={<MapIcon className="h-4 w-4" />}
                onClick={() => navigate({ to: "/messages/broadcast/0" })}
              >
                Open messages
              </Button>
            </div>

            <div className="space-y-3">
              {schedules.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 dark:border-zinc-800 dark:text-zinc-400">
                  No scheduled messages yet.
                </div>
              ) : (
                schedules.map((schedule) => (
                  <div
                    key={schedule.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/70"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {schedule.label}
                        </div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                          {schedule.text}
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => removeSchedule(schedule.id)}>
                        Remove
                      </Button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-zinc-400">
                      <span>{schedule.kind === "direct" ? "Direct" : "Broadcast"}</span>
                      <span>{schedule.recurrence}</span>
                      <span>{formatScheduleRun(schedule.nextRunAt)}</span>
                      {schedule.lastError ? (
                        <span className="text-red-500">{schedule.lastError}</span>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </DashboardCard>

          <DashboardCard
            title="Distress Beacon"
            description="Send DarkMesh-style periodic distress beacons with optional Plus Code location and UTC timestamp."
          >
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block text-slate-500 dark:text-slate-400">Destination</span>
                <select
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  value={encodeDestinationValue(beaconDraft.kind, beaconDraft.destination)}
                  onChange={(event) => {
                    const nextDestination = decodeDestinationValue(event.target.value);
                    const label =
                      destinationOptions.find((option) => option.value === event.target.value)
                        ?.label ?? beaconDraft.label;

                    setBeaconDraft((current) => ({
                      ...current,
                      destination: nextDestination.destination,
                      kind: nextDestination.kind,
                      label,
                    }));
                  }}
                >
                  {destinationOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm">
                <span className="mb-1 block text-slate-500 dark:text-slate-400">Interval</span>
                <input
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  type="number"
                  min={10}
                  value={beaconDraft.intervalSeconds}
                  onChange={(event) =>
                    setBeaconDraft((current) => ({
                      ...current,
                      intervalSeconds: Number(event.target.value),
                    }))
                  }
                />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-[0.9fr_1.1fr]">
              <label className="text-sm" htmlFor="darkmesh-beacon-prefix">
                <span className="mb-1 block text-slate-500 dark:text-slate-400">Prefix</span>
                <Input
                  id="darkmesh-beacon-prefix"
                  value={beaconDraft.prefix}
                  onChange={(event) =>
                    setBeaconDraft((current) => ({
                      ...current,
                      prefix: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="text-sm" htmlFor="darkmesh-beacon-message">
                <span className="mb-1 block text-slate-500 dark:text-slate-400">Message body</span>
                <Input
                  id="darkmesh-beacon-message"
                  value={beaconDraft.text}
                  onChange={(event) =>
                    setBeaconDraft((current) => ({
                      ...current,
                      text: event.target.value,
                    }))
                  }
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-4 text-sm">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={beaconDraft.includeName}
                  onChange={(event) =>
                    setBeaconDraft((current) => ({
                      ...current,
                      includeName: event.target.checked,
                    }))
                  }
                />
                Include node name
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={beaconDraft.includeGps}
                  onChange={(event) =>
                    setBeaconDraft((current) => ({
                      ...current,
                      includeGps: event.target.checked,
                    }))
                  }
                />
                Encode live GPS as Plus Code
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={beaconDraft.includeTime}
                  onChange={(event) =>
                    setBeaconDraft((current) => ({
                      ...current,
                      includeTime: event.target.checked,
                    }))
                  }
                />
                Append UTC Zulu time
              </label>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                icon={<Activity className="h-4 w-4" />}
                onClick={() => {
                  upsertBeaconConfig(deviceId, {
                    ...beaconDraft,
                    enabled: !beaconDraft.enabled,
                  });
                }}
              >
                {beaconDraft.enabled ? "Stop beacon" : "Start beacon"}
              </Button>
              <Button variant="outline" onClick={handleSaveBeacon}>
                Save beacon profile
              </Button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900/70">
              <div className="font-medium text-slate-900 dark:text-slate-100">
                {beaconDraft.enabled ? "Beacon is active" : "Beacon is idle"}
              </div>
              <div className="mt-2 text-slate-500 dark:text-slate-400">
                Last send: {formatSince(beaconDraft.lastSentAt)}
              </div>
              {beaconDraft.lastError ? (
                <div className="mt-2 text-red-500">{beaconDraft.lastError}</div>
              ) : null}
            </div>
          </DashboardCard>

          <DashboardCard
            title="Traceroute Visualization"
            description="Review recent traceroute responses and push them directly onto the DarkMesh map overlay."
          >
            <div className="flex flex-wrap gap-3">
              <Button
                icon={<MapIcon className="h-4 w-4" />}
                onClick={() => navigate({ to: "/map" })}
              >
                Open map
              </Button>
              {selectedTraceRoute ? (
                <Button variant="outline" onClick={() => setSelectedTraceRoute(undefined)}>
                  Clear overlay
                </Button>
              ) : null}
            </div>

            <div className="space-y-3">
              {flattenedTraceroutes.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 dark:border-zinc-800 dark:text-zinc-400">
                  No traceroutes captured yet.
                </div>
              ) : (
                flattenedTraceroutes.map((trace) => (
                  <div
                    key={`${trace.id}-${trace.from}-${trace.rxTime.toISOString()}`}
                    className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/70"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {getNodeDisplayName(
                            nodes.find((node) => node.num === trace.to),
                            trace.to,
                          )}{" "}
                          {"->"}{" "}
                          {getNodeDisplayName(
                            nodes.find((node) => node.num === trace.from),
                            trace.from,
                          )}
                        </div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                          {formatSince(trace.rxTime.getTime())} · {trace.data.route.length} forward
                          hops · {trace.data.routeBack.length} return hops
                        </div>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedTraceRoute(trace);
                          navigate({ to: "/map" });
                        }}
                      >
                        Show on map
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </DashboardCard>
        </div >

        <div className="space-y-6">
          <DashboardCard
            title="Hunting Forwarder"
            description="Mirror position, telemetry and traceroute packets to a DarkMesh-compatible web endpoint."
          >
            <label className="block text-sm" htmlFor="darkmesh-hunt-endpoint">
              <span className="mb-1 block text-slate-500 dark:text-slate-400">Endpoint</span>
              <Input
                id="darkmesh-hunt-endpoint"
                value={huntDraft.endpoint}
                onChange={(event) =>
                  setHuntDraft((current) => ({
                    ...current,
                    endpoint: event.target.value,
                  }))
                }
              />
            </label>

            <label className="block text-sm" htmlFor="darkmesh-hunt-token">
              <span className="mb-1 block text-slate-500 dark:text-slate-400">Bearer token</span>
              <Input
                id="darkmesh-hunt-token"
                value={huntDraft.token}
                onChange={(event) =>
                  setHuntDraft((current) => ({
                    ...current,
                    token: event.target.value,
                  }))
                }
              />
            </label>

            <label className="block text-sm">
              <span className="mb-1 block text-slate-500 dark:text-slate-400">Background mode</span>
              <select
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                value={huntDraft.backgroundMode}
                onChange={(event) =>
                  setHuntDraft((current) => ({
                    ...current,
                    backgroundMode: event.target.value as HuntConfig["backgroundMode"],
                  }))
                }
              >
                <option value="fast">Fast</option>
                <option value="medium">Medium</option>
                <option value="slow">Slow</option>
                <option value="super_slow">Super slow</option>
              </select>
            </label>

            <div className="flex flex-wrap gap-3">
              <Button
                icon={<Radar className="h-4 w-4" />}
                onClick={() => void handleValidateHunt()}
              >
                Validate & enable
              </Button>
              <Button variant="outline" onClick={handleDisableHunt}>
                Disable
              </Button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900/70">
              <div className="font-medium text-slate-900 dark:text-slate-100">
                {huntConfig.enabled ? "Hunt forwarding active" : "Hunt forwarding idle"}
              </div>
              <div className="mt-2 text-slate-500 dark:text-slate-400">
                Packets forwarded: {huntConfig.forwardedCount}
              </div>
              <div className="text-slate-500 dark:text-slate-400">
                Last activity: {formatSince(huntConfig.lastForwardAt)}
              </div>
              {huntConfig.lastStatus ? (
                <div className="mt-2 text-slate-500 dark:text-slate-400">
                  {huntConfig.lastStatus}
                </div>
              ) : null}
              {huntConfig.lastError ? (
                <div className="mt-2 text-red-500">{huntConfig.lastError}</div>
              ) : null}
            </div>
          </DashboardCard>

          <DashboardCard
            title="DarkMesh NodeDB"
            description="Export and import DarkMesh `.dmdb` bundles while staying on Meshtastic shared contact protobufs."
          >
            <div className="flex flex-wrap items-center gap-3">
              <Button icon={<Download className="h-4 w-4" />} onClick={handleExportDmdb}>
                Export .dmdb
              </Button>
              <Button
                variant="outline"
                icon={<Upload className="h-4 w-4" />}
                onClick={() => fileInputRef.current?.click()}
              >
                Import .dmdb
              </Button>
              <Button
                variant="ghost"
                icon={<RefreshCcw className="h-4 w-4" />}
                onClick={() => navigate({ to: "/nodes" })}
              >
                Review nodes
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".dmdb,text/plain"
                className="hidden"
                onChange={async (event) => {
                  await handleImportDmdb(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </div>

            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={exportFavoriteOnly}
                onChange={(event) => setExportFavoriteOnly(event.target.checked)}
              />
              Export only favorite nodes
            </label>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900/70">
              <div className="font-medium text-slate-900 dark:text-slate-100">
                `.dmdb` interoperability
              </div>
              <div className="mt-2 text-slate-500 dark:text-slate-400">
                The exported bundle mirrors DarkMesh Android: Meshtastic shared contacts encoded as
                URLs, separated by the DarkMesh `☠` delimiter and tagged with version `v0.1`.
              </div>
            </div>
          </DashboardCard>

          {/* Protocol Notes removed per design update */}
        </div>
      </div >
    </PageLayout >
  );
};

export default DarkMeshDashboardPage;
