import { create } from "@bufbuild/protobuf";
import { GatewayHeader } from "@components/PageComponents/DarkMesh/GatewayHeader.tsx";
import { PageLayout } from "@components/PageLayout.tsx";
import { Sidebar } from "@components/Sidebar.tsx";
import { Button } from "@components/UI/Button.tsx";
import { Checkbox } from "@components/UI/Checkbox/index.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/UI/Card.tsx";
import { Input } from "@components/UI/Input.tsx";
import { useFavoriteNode } from "@core/hooks/useFavoriteNode.ts";
import { useToast } from "@core/hooks/useToast.ts";
import { useAppStore, useDevice, useNodeDB } from "@core/stores";
import { Protobuf } from "@meshtastic/core";
import { Activity, Download, MapIcon, Radar, RefreshCcw, Upload, BarChart2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { filterNodesByQuery } from "@core/utils/filterNodes.ts";
import { useNavigate } from "@tanstack/react-router";
import {
  defaultBeaconConfig,
  defaultHuntConfig,
  useDarkMeshStore,
  type BeaconConfig,
  type HuntConfig,
} from "./store.ts";
import { validateHuntEndpoint } from "./huntApi.ts";
import PowerNotificationPanel from "@components/PageComponents/PowerNotification/PowerNotificationPanel.tsx";
import NotificationsPanel from "@components/PageComponents/Notifications/NotificationsPanel.tsx";
import TraceroutePanel from "./TraceroutePanel";
import { numberToHexUnpadded } from "@noble/curves/abstract/utils";
import {
  buildDmdbContents,
  createNodeInfoFromSharedContact,
  getNodeDisplayName,
  getNodeLongName,
  parseDmdbContents,
} from "./utils.ts";
import { hasPos } from "@core/utils/geo.ts";

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

const BACKBONE_ROLES = [
  Protobuf.Config.Config_DeviceConfig_Role.ROUTER,
  Protobuf.Config.Config_DeviceConfig_Role.ROUTER_LATE,
  Protobuf.Config.Config_DeviceConfig_Role.CLIENT_BASE,
];

const DarkMeshDashboardPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { updateFavorite } = useFavoriteNode();
  const { selectedDeviceId, identiconsEnabled, setIdenticonsEnabled } = useAppStore();
  const deviceId = selectedDeviceId ?? -1;
  const { channels, traceroutes, sendAdminMessage, connection: _connection } = useDevice();
  const { getMyNode, getNodes, addNode } = useNodeDB();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allSchedules = useDarkMeshStore((state) => state.schedules);
  const beaconConfig = useDarkMeshStore(
    (state) => state.beaconsByDevice[deviceId] ?? defaultBeaconConfig,
  );
  const huntConfig = useDarkMeshStore((state) => state.huntByDevice[deviceId] ?? defaultHuntConfig);
  const huntDraft = useDarkMeshStore(
    (state) =>
      state.huntDraftByDevice[deviceId] ?? state.huntByDevice[deviceId] ?? defaultHuntConfig,
  );
  const selectedTraceRoute = useDarkMeshStore((state) => state.selectedTraceRoute);

  const removeSchedule = useDarkMeshStore((state) => state.removeSchedule);
  const upsertBeaconConfig = useDarkMeshStore((state) => state.upsertBeaconConfig);
  const upsertHuntConfig = useDarkMeshStore((state) => state.upsertHuntConfig);
  const upsertHuntDraft = useDarkMeshStore((state) => state.upsertHuntDraft);
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
          label: getNodeLongName(node) ?? `!${numberToHexUnpadded(node.num).toUpperCase()}`,
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

  // schedule UI state is not currently wired in; keep schedules from store
  const [beaconDraft, setBeaconDraft] = useState<BeaconConfig>(beaconConfig);
  const [exportFavoriteOnly, setExportFavoriteOnly] = useState(false);
  const [exportGpsOnly, setExportGpsOnly] = useState(false);
  const [exportBackboneOnly, setExportBackboneOnly] = useState(false);
  const nodeDB = useNodeDB();
  const [pruneHours, setPruneHours] = useState<number>(24);

  // destinationOptions available for future schedule UI

  useEffect(() => {
    setBeaconDraft(beaconConfig);
  }, [beaconConfig]);

  const updateHuntDraft = (patch: Partial<HuntConfig>) => {
    upsertHuntDraft(deviceId, {
      ...huntDraft,
      ...patch,
    });
  };

  const [beaconFilter, setBeaconFilter] = useState("");

  const filteredBeaconDestinationOptions = (() => {
    const q = beaconFilter.trim();
    const direct = destinationOptions.filter((o) => o.value.startsWith("direct:"));
    const broadcasts = destinationOptions.filter((o) => o.value.startsWith("broadcast:"));

    if (!q) return [...broadcasts, ...direct];

    const ql = q.toLowerCase();
    const matchedBroadcasts = broadcasts.filter((b) => (b.label || "").toLowerCase().includes(ql));

    const nodes = direct.map((o) => ({
      num: Number(o.value.split(":")[1]),
      user: { shortName: o.label, longName: o.label },
    }));
    const matchedNodes = filterNodesByQuery(nodes, q) as { num: number }[];
    const matchedSet = new Set(matchedNodes.map((n: { num: number }) => n.num));

    const out: { label: string; value: string }[] = [];
    for (const b of matchedBroadcasts) out.push(b);
    for (const d of direct) if (matchedSet.has(Number(d.value.split(":")[1]))) out.push(d);
    return out;
  })();
  // Add-schedule handler removed because it's not currently wired into the UI.
  // Keep implementation history in git if needed later.

  const handleSaveBeacon = () => {
    upsertBeaconConfig(deviceId, beaconDraft);
    toast({
      title: beaconDraft.enabled ? "DarkMesh beacon enabled" : "DarkMesh beacon settings saved",
    });
  };

  const handleValidateHunt = async () => {
    // If mode includes remote, perform health check against configured endpoint; otherwise enable local mode
    try {
      if (huntDraft.mode === "remote" || huntDraft.mode === "both") {
        await validateHuntEndpoint(huntDraft.endpoint, huntDraft.token);

        upsertHuntConfig(deviceId, {
          ...huntDraft,
          enabled: true,
        });
        updateHuntDraft({ enabled: true });
        setHuntStatus(deviceId, "Health check passed. Hunt forwarding is active.");
        toast({ title: "DarkMesh hunting endpoint validated" });
      } else {
        // local-only: just enable local forwarding
        upsertHuntConfig(deviceId, {
          ...huntDraft,
          enabled: true,
        });
        updateHuntDraft({ enabled: true });
        setHuntStatus(deviceId, "Local hunt forwarding enabled (packets persisted locally)");
        toast({ title: "Local hunting enabled" });
      }
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
    updateHuntDraft({ enabled: false });
    setHuntStatus(deviceId, "Hunt forwarding disabled");
  };

  function TracePriorityButton() {
    const traceEnabled = useDarkMeshStore(
      (s) => (s.tracePriorityByDevice ?? {})[deviceId] ?? false,
    );
    const setTracePriority = useDarkMeshStore((s) => s.setTracePriority);

    return (
      <Button
        size="sm"
        variant={traceEnabled ? "default" : "outline"}
        onClick={() => setTracePriority(deviceId, !traceEnabled)}
      >
        {traceEnabled ? "Trace Priority: ON" : "Trace Priority: OFF"}
      </Button>
    );
  }

  const handleExportDmdb = () => {
    if (!myNode) {
      toast({ title: "Connect to a node before exporting a DarkMesh NodeDB" });
      return;
    }
    const BACKBONE_ROLES = [
      Protobuf.Config.Config_DeviceConfig_Role.ROUTER,
      Protobuf.Config.Config_DeviceConfig_Role.ROUTER_LATE,
      Protobuf.Config.Config_DeviceConfig_Role.CLIENT_BASE,
    ];

    const filteredNodes = nodes.filter((node) => {
      if (node.num === myNode.num) return false;
      if (exportFavoriteOnly && !node.isFavorite) return false;
      if (exportGpsOnly && !hasPos(node.position)) return false;
      if (exportBackboneOnly) {
        const role = node.user?.role ?? Protobuf.Config.Config_DeviceConfig_Role.CLIENT;
        if (!BACKBONE_ROLES.includes(role)) return false;
      }
      return true;
    });

    const dmdbContents = buildDmdbContents(
      filteredNodes,
      myNode.num,
      exportFavoriteOnly,
      exportGpsOnly,
      exportBackboneOnly,
    );
    const tags: string[] = [];
    if (exportFavoriteOnly) tags.push("fav");
    if (exportGpsOnly) tags.push("gps");
    if (exportBackboneOnly) tags.push("backbone");
    const fileName = `darkmesh_${tags.join("-") || "nodes"}_${Date.now()}.dmdb`;
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

      const contactsToAdd = parsed.backboneOnly
        ? parsed.contacts.filter((contact) => {
            const role = contact.user?.role ?? Protobuf.Config.Config_DeviceConfig_Role.CLIENT;
            return BACKBONE_ROLES.includes(role);
          })
        : parsed.contacts;

      const skipped = parsed.contacts.length - contactsToAdd.length;

      contactsToAdd.forEach((contact) => {
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

      const notes: string[] = [];
      if (parsed.gpsOnly) notes.push("GPS-only exported file (advisory)");
      if (parsed.backboneOnly)
        notes.push(
          `Backbone-only exported file${skipped > 0 ? `; skipped ${skipped} non-backbone contacts` : ""}`,
        );
      if (parsed.favoriteOnly) notes.push("Imported contacts marked as favorites");

      toast({
        title: `Imported ${contactsToAdd.length} DarkMesh contacts from v${parsed.version}`,
        description: notes.join("; ") || undefined,
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
          <div>
            <NotificationsPanel />
          </div>
          <div>
            <TraceroutePanel />
          </div>
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
              <Button
                variant="ghost"
                icon={<BarChart2 className="h-4 w-4" />}
                onClick={() => navigate({ to: "/report" })}
              >
                Report
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

            <div className="mt-4">
              <PowerNotificationPanel destinationOptions={destinationOptions} />
            </div>
          </DashboardCard>

          <DashboardCard
            title="Distress Beacon"
            description="Send DarkMesh-style periodic distress beacons with optional Plus Code location and UTC timestamp."
          >
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block text-slate-500 dark:text-slate-400">Destination</span>
                <input
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm mb-2 dark:border-zinc-700 dark:bg-zinc-900"
                  placeholder="Search channels or contacts"
                  value={beaconFilter}
                  onChange={(event) => setBeaconFilter(event.target.value)}
                />
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
                  {filteredBeaconDestinationOptions.map((option) => (
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
              {/* Trace priority toggle for current device */}
              <TracePriorityButton />
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

          <DashboardCard
            title="NodeDB Cleanup"
            description="Remove stale nodes not heard from in the selected hours."
          >
            <div className="flex items-center gap-3">
              <label className="text-sm text-zinc-400" htmlFor="darkmesh-prune-hours">
                Prune nodes older than
              </label>
              <select
                id="darkmesh-prune-hours"
                className="h-10 rounded-md border border-slate-300 bg-white/95 px-3 text-sm text-slate-800 dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-100"
                value={String(pruneHours)}
                onChange={(e) => setPruneHours(Number(e.target.value))}
              >
                <option value="3">3 hours</option>
                <option value="6">6 hours</option>
                <option value="12">12 hours</option>
                <option value="18">18 hours</option>
                <option value="24">24 hours</option>
              </select>

              <div className="flex items-center gap-2">
                <Checkbox
                  checked={Boolean(nodeDB?.skipFavoritesDuringPrune)}
                  onChange={(v) => {
                    try {
                      nodeDB.setPruneSkipFavorites(Boolean(v));
                    } catch (err) {
                      console.warn("setPruneSkipFavorites failed", err);
                    }
                  }}
                >
                  Skip favorites
                </Checkbox>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    try {
                      const days = pruneHours / 24;
                      let pruned = 0;
                      if (typeof nodeDB.pruneStaleNodesWithDays === "function") {
                        pruned = nodeDB.pruneStaleNodesWithDays(days);
                      } else {
                        pruned = nodeDB.pruneStaleNodes();
                      }
                      toast({
                        title: pruned > 0 ? `Pruned ${pruned} node(s)` : "No nodes to prune",
                      });
                    } catch (err) {
                      toast({
                        title: "Prune failed",
                        description: err instanceof Error ? err.message : String(err),
                      });
                    }
                  }}
                >
                  Run prune
                </Button>
              </div>
            </div>
          </DashboardCard>
        </div>

        <div className="space-y-6">
          <DashboardCard
            title="Display Preferences"
            description="Choose how node avatars are rendered across the map, dialogs and node surfaces."
          >
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 text-sm dark:border-zinc-800 dark:bg-zinc-900/70">
              <Checkbox checked={identiconsEnabled} onChange={setIdenticonsEnabled}>
                Enable identicon avatars
              </Checkbox>
              <p className="mt-3 text-slate-500 dark:text-slate-400">
                Disable this option to return to the original short-name avatar view.
              </p>
            </div>
          </DashboardCard>

          <DashboardCard
            title="Hunting Forwarder"
            description="Mirror position, telemetry and traceroute packets to a DarkMesh-compatible web endpoint."
          >
            <label className="block text-sm" htmlFor="darkmesh-hunt-endpoint">
              <span className="mb-1 block text-slate-500 dark:text-slate-400">Endpoint</span>
              <Input
                id="darkmesh-hunt-endpoint"
                value={huntDraft.endpoint}
                disabled={huntDraft.mode === "local"}
                onChange={(event) =>
                  updateHuntDraft({
                    endpoint: event.target.value,
                  })
                }
              />
            </label>

            <label className="block text-sm" htmlFor="darkmesh-hunt-token">
              <span className="mb-1 block text-slate-500 dark:text-slate-400">Bearer token</span>
              <Input
                id="darkmesh-hunt-token"
                value={huntDraft.token}
                disabled={huntDraft.mode === "local"}
                onChange={(event) =>
                  updateHuntDraft({
                    token: event.target.value,
                  })
                }
              />
            </label>

            <label className="block text-sm">
              <span className="mb-1 block text-slate-500 dark:text-slate-400">Forwarding mode</span>
              <select
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                value={huntDraft.mode ?? "local"}
                onChange={(event) =>
                  updateHuntDraft({
                    mode: event.target.value as HuntConfig["mode"],
                  })
                }
              >
                <option value="local">Local (persist only)</option>
                <option value="remote">Remote (forward only)</option>
                <option value="both">Both (local + remote)</option>
              </select>
            </label>

            <label className="block text-sm">
              <span className="mb-1 block text-slate-500 dark:text-slate-400">Background mode</span>
              <select
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                value={huntDraft.backgroundMode}
                onChange={(event) =>
                  updateHuntDraft({
                    backgroundMode: event.target.value as HuntConfig["backgroundMode"],
                  })
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

            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={exportGpsOnly}
                onChange={(event) => setExportGpsOnly(event.target.checked)}
              />
              Only nodes with GPS
            </label>

            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={exportBackboneOnly}
                onChange={(event) => setExportBackboneOnly(event.target.checked)}
              />
              Backbone network only (routers/base)
            </label>

            <div className="mt-2 text-xs text-slate-500">
              <div>
                BACKBONE: nodes whose role is <strong>ROUTER</strong>, <strong>ROUTER_LATE</strong>{" "}
                or <strong>CLIENT_BASE</strong>.
              </div>
              <div>GPS: node has recorded position (latitude/longitude) available.</div>
            </div>

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
      </div>
    </PageLayout>
  );
};

export default DarkMeshDashboardPage;
