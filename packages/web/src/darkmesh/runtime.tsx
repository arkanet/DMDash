import { useToast } from "@core/hooks/useToast.ts";
import { useNotifications } from "@core/hooks/useNotifications.ts";
import {
  getDirectMessageKeyExchangeDescription,
  getDirectMessageKeyExchangeStatus,
} from "@core/utils/directMessageKeyExchange.ts";
import { useAppStore, useDevice, useNodeDB } from "@core/stores";
import useNotificationsStore from "@core/stores/notificationsStore/index.ts";
import { Protobuf, type Types } from "@meshtastic/core";
import { useEffect } from "react";
import { forwardHuntPayload } from "./huntApi.ts";
import { defaultBeaconConfig, defaultHuntConfig, useDarkMeshStore } from "./store.ts";
import {
  buildHuntPayload,
  buildDistressMessage,
  computeNextRunAt,
  getHuntBackgroundIntervalMs,
  getHuntTracerouteCandidates,
  getNodeDisplayName,
  getNodeLongName,
  normalizeHuntTraceroutePacket,
  resolveDestination,
  resolveRelayCandidate,
} from "./utils.ts";

const HUNT_SAFE_THROTTLE_MS = 15_000;

async function forwardHuntPacket<T>(
  deviceId: number,
  hunterId: string,
  localNodeNum: number,
  huntConfig: typeof defaultHuntConfig,
  packet: Types.PacketMetadata<T>,
) {
  // Forwarding behavior depends on huntConfig.mode:
  // - 'local'  => persist to local traceroute store only
  // - 'remote' => POST to configured endpoint only
  // - 'both'   => do both (persist locally and POST remote)
  const mode =
    (huntConfig && (huntConfig as { mode?: (typeof defaultHuntConfig)["mode"] }).mode) || "local";
  try {
    // lazy-import traceroute store to avoid circular deps
    const { default: useTracerouteStore } = await import("@core/stores/tracerouteStore");
    const isTraceroutePacket =
      packet.data &&
      typeof packet.data === "object" &&
      "route" in (packet.data as Record<string, unknown>);
    const localHuntPacket = isTraceroutePacket
      ? (normalizeHuntTraceroutePacket(
          packet as unknown as Types.PacketMetadata<Protobuf.Mesh.RouteDiscovery>,
          localNodeNum,
        ) as unknown as Types.PacketMetadata<T>)
      : packet;

    // persist locally when requested
    if (isTraceroutePacket && (mode === "local" || mode === "both")) {
      try {
        useTracerouteStore
          .getState()
          .addTraceroute(
            deviceId,
            localHuntPacket as unknown as Types.PacketMetadata<Protobuf.Mesh.RouteDiscovery>,
            { source: "hunt" },
          );
        // update UI state for local persistence
        useDarkMeshStore.getState().setHuntStatus(deviceId, "Stored packet in local hunt DB");
      } catch (e) {
        // log but continue if remote forwarding is enabled
        console.warn("local traceroute persistence failed", e);
      }
    }

    // perform remote forward when requested
    if ((mode === "remote" || mode === "both") && huntConfig.endpoint && huntConfig.token) {
      await forwardHuntPayload(
        huntConfig.endpoint,
        huntConfig.token,
        buildHuntPayload(hunterId, packet),
      );

      // mark forwarded for telemetry/UI
      useDarkMeshStore.getState().markHuntForwarded(deviceId);
      return;
    }

    // If we get here, either mode was 'local' or remote config missing; treat as success
    return;
  } catch (err) {
    // surface errors to caller
    throw err instanceof Error ? err : new Error(String(err));
  }
}

export function DarkMeshRuntime() {
  const { connection, traceroutes: deviceTraceroutes } = useDevice();
  const { getMyNode, getNode, getNodes, getNodeError } = useNodeDB();
  const selectedDeviceId = useAppStore((state) => state.selectedDeviceId);
  const huntEnabled = useDarkMeshStore((state) =>
    selectedDeviceId === undefined
      ? false
      : (state.huntByDevice[selectedDeviceId] ?? defaultHuntConfig).enabled,
  );
  const huntBackgroundMode = useDarkMeshStore((state) =>
    selectedDeviceId === undefined
      ? defaultHuntConfig.backgroundMode
      : (state.huntByDevice[selectedDeviceId] ?? defaultHuntConfig).backgroundMode,
  );
  const huntTracePriority = useDarkMeshStore((state) =>
    selectedDeviceId === undefined
      ? false
      : ((state.tracePriorityByDevice ?? {})[selectedDeviceId] ?? false),
  );
  const { toast } = useToast();
  const { notify } = useNotifications();

  useEffect(() => {
    if (!connection || selectedDeviceId === undefined) {
      return;
    }

    // Migrate any existing in-memory traceroutes from the device store
    (async () => {
      try {
        const mod = await import("@core/stores/tracerouteStore");
        const useTracerouteStore = (mod &&
          (mod.default ??
            (mod as unknown as { useTracerouteStore?: unknown }).useTracerouteStore)) as unknown as
          | {
              getState: () =>
                | {
                    getTraceroutes: () => unknown[];
                    addTraceroute: (deviceId: number, pkt: unknown, opts?: unknown) => void;
                  }
                | undefined;
            }
          | undefined;
        if (!useTracerouteStore) return;
        const existing = useTracerouteStore.getState()?.getTraceroutes?.() ?? [];
        if (existing && existing.length > 0) {
          // already migrated
          return;
        }

        // deviceTraceroutes is a Map<number, RouteDiscovery[]>
        for (const entry of deviceTraceroutes?.entries() ?? []) {
          const [deviceId, arr] = entry as unknown as [
            number,
            Types.PacketMetadata<Protobuf.Mesh.RouteDiscovery>[],
          ];
          for (const pkt of arr) {
            try {
              useTracerouteStore.getState()?.addTraceroute?.(deviceId, pkt, { source: "device" });
            } catch {
              // ignore per-packet errors
            }
          }
        }
      } catch {
        // ignore migration failures
      }
    })();

    console.debug("DarkMeshRuntime: subscribing to connection events for device", selectedDeviceId);
    try {
      const eventSummary: Record<string, unknown> = {};
      const connTyped = connection as unknown as { events?: Record<string, unknown> } | undefined;
      if (connTyped?.events) {
        eventSummary.keys = Object.keys(connTyped.events).slice(0, 50);
      }
      // eslint-disable-next-line no-console
      console.debug("DarkMeshRuntime: connection events summary", eventSummary);
    } catch {
      // ignore
    }

    const handleGatewayPacket = (meshPacket: Protobuf.Mesh.MeshPacket) => {
      console.debug("DarkMeshRuntime: gateway packet received", {
        device: selectedDeviceId,
        from: meshPacket.from,
      });
      const myNode = getMyNode();
      if (!myNode || meshPacket.from === myNode.num) {
        return;
      }

      const hopsUsed = Math.max(0, (meshPacket.hopStart ?? 0) - (meshPacket.hopLimit ?? 0));

      if (hopsUsed === 0) {
        const directNode = getNode(meshPacket.from);
        if (!directNode) {
          return;
        }

        useDarkMeshStore.getState().setGateway(selectedDeviceId, {
          nodeNum: directNode.num,
          nodeName: getNodeLongName(directNode) ?? String(directNode?.num ?? ""),
          source: "direct",
          confidence: 100,
          observedAt: Date.now(),
          rxSnr: meshPacket.rxSnr,
          rxRssi: meshPacket.rxRssi,
          deviceMetrics: directNode.deviceMetrics,
        });
        return;
      }

      if (meshPacket.relayNode) {
        const relayCandidate = resolveRelayCandidate(
          meshPacket.relayNode,
          getNodes(() => true, true),
          myNode.num,
        );

        if (!relayCandidate) {
          return;
        }

        useDarkMeshStore.getState().setGateway(selectedDeviceId, {
          nodeNum: relayCandidate.node.num,
          nodeName: getNodeLongName(relayCandidate.node) ?? String(relayCandidate.node?.num ?? ""),
          source: "relay",
          confidence: relayCandidate.confidence,
          observedAt: Date.now(),
          rxSnr: meshPacket.rxSnr,
          rxRssi: meshPacket.rxRssi,
          deviceMetrics: relayCandidate.node.deviceMetrics,
        });
      }
    };

    const handleTracerouteGateway = (
      traceroute: Types.PacketMetadata<Protobuf.Mesh.RouteDiscovery>,
    ) => {
      console.debug("DarkMeshRuntime: traceroute packet received", {
        device: selectedDeviceId,
        from: traceroute.from,
      });
      const firstHop = traceroute.data.route[0];
      if (!firstHop) {
        return;
      }

      const hopNode = getNode(firstHop);
      if (!hopNode) {
        return;
      }

      useDarkMeshStore.getState().setGateway(selectedDeviceId, {
        nodeNum: hopNode.num,
        nodeName: getNodeLongName(hopNode) ?? String(hopNode?.num ?? ""),
        source: "traceroute",
        confidence: traceroute.data.route.length > 1 ? 84 : 92,
        observedAt: Date.now(),
        rxSnr: traceroute.rxSnr,
        rxRssi: traceroute.rxRssi,
        deviceMetrics: hopNode.deviceMetrics,
      });
    };

    const lastLowBatteryNotif = new Map<number, number>();

    const handleHuntPacket = <T,>(packet: Types.PacketMetadata<T>) => {
      console.debug("DarkMeshRuntime: hunt/telemetry packet", {
        device: selectedDeviceId,
        packetType: packet.type,
      });
      const myNode = getMyNode();
      const huntConfig =
        useDarkMeshStore.getState().huntByDevice[selectedDeviceId] ?? defaultHuntConfig;
      const huntMode =
        (huntConfig && (huntConfig as { mode?: typeof defaultHuntConfig.mode }).mode) || "local";
      const needsRemoteConfig = huntMode === "remote" || huntMode === "both";

      if (
        !myNode?.user?.id ||
        !huntConfig.enabled ||
        (needsRemoteConfig && (!huntConfig.endpoint || !huntConfig.token))
      ) {
        return;
      }

      // Low-battery detection: if this is a telemetry packet carrying deviceMetrics
      try {
        const variantCase = (packet as unknown as { data?: { variant?: { case?: string } } }).data
          ?.variant?.case;
        if (variantCase === "deviceMetrics") {
          const deviceMetrics = (packet as unknown as { data?: { variant?: { value?: unknown } } })
            .data?.variant?.value as { batteryLevel?: number; voltage?: number } | undefined;
          const batt =
            typeof deviceMetrics?.batteryLevel === "number"
              ? deviceMetrics.batteryLevel
              : undefined;
          const volt =
            typeof deviceMetrics?.voltage === "number" ? deviceMetrics.voltage : undefined;

          // read current battery monitoring config from store
          const bm = useNotificationsStore.getState().config.batteryMonitoring;
          if (bm?.enabled && batt !== undefined && batt >= 0) {
            let shouldNotify = false;
            // scope check
            if (bm.scope === "all") {
              shouldNotify = true;
            } else if (bm.scope === "selected") {
              shouldNotify = bm.selectedNodeNums.includes(packet.from);
            } else if (bm.scope === "connected_bt") {
              // best-effort: connected_bt behavior not modeled here; assume connected node is myNode
              const myNode = getMyNode();
              shouldNotify = myNode ? packet.from === myNode.num : false;
            }

            // consider per-node override
            const overrides = bm.nodeOverrides ?? {};
            const nodeOverride = overrides[packet.from] ?? undefined;
            if (nodeOverride && nodeOverride.enabled === false) {
              shouldNotify = false;
            }

            const pctThreshold =
              nodeOverride?.batteryPercentThreshold ?? bm.batteryPercentThreshold;
            const voltThreshold = nodeOverride?.voltageThreshold ?? bm.voltageThreshold;
            const cooldown = nodeOverride?.cooldownMs ?? bm.cooldownMs ?? 3600000;

            // threshold checks
            if (shouldNotify && pctThreshold > 0) {
              shouldNotify = batt < pctThreshold;
            }
            if (shouldNotify && voltThreshold > 0 && volt !== undefined) {
              shouldNotify = volt < voltThreshold;
            }

            if (shouldNotify) {
              const last = lastLowBatteryNotif.get(packet.from) ?? 0;
              const now = Date.now();
              if (now - last >= cooldown) {
                try {
                  notify(
                    "low_battery",
                    { nodeNum: packet.from, batteryLevel: batt, voltage: volt },
                    { priority: 5, nodeNum: packet.from },
                  );
                  lastLowBatteryNotif.set(packet.from, now);
                } catch {
                  // ignore notification errors
                }
              }
            }
          }
        }
      } catch {
        // defensive: ignore telemetry parse errors
      }
      void forwardHuntPacket(
        selectedDeviceId,
        myNode.user.id,
        myNode.num,
        huntConfig,
        packet,
      ).catch((error) => {
        useDarkMeshStore
          .getState()
          .setHuntError(
            selectedDeviceId,
            error instanceof Error ? error.message : "Unknown hunt forwarding error",
          );
      });
    };

    connection.events.onMeshPacket.subscribe(handleGatewayPacket);
    connection.events.onTraceRoutePacket.subscribe(handleTracerouteGateway);
    connection.events.onPositionPacket.subscribe(handleHuntPacket);
    connection.events.onTelemetryPacket.subscribe(handleHuntPacket);
    connection.events.onTraceRoutePacket.subscribe(handleHuntPacket);

    return () => {
      connection.events.onMeshPacket.unsubscribe(handleGatewayPacket);
      connection.events.onTraceRoutePacket.unsubscribe(handleTracerouteGateway);
      connection.events.onPositionPacket.unsubscribe(handleHuntPacket);
      connection.events.onTelemetryPacket.unsubscribe(handleHuntPacket);
      connection.events.onTraceRoutePacket.unsubscribe(handleHuntPacket);
    };
  }, [connection, getMyNode, getNode, getNodes, selectedDeviceId]);

  useEffect(() => {
    if (!connection || selectedDeviceId === undefined || !huntEnabled) {
      return;
    }

    if (typeof connection.traceRoute !== "function") {
      useDarkMeshStore
        .getState()
        .setHuntError(selectedDeviceId, "Traceroute is not available on the current connection");
      return;
    }

    let cancelled = false;
    let timeoutId: number | undefined;
    let candidateRound: Protobuf.Mesh.NodeInfo[] = [];
    let candidateIndex = 0;

    const scheduleNext = (delayMs: number) => {
      timeoutId = window.setTimeout(() => {
        void runNextTraceroute();
      }, delayMs);
    };

    const runNextTraceroute = async () => {
      if (cancelled) {
        return;
      }

      const myNode = getMyNode();
      if (!myNode?.num) {
        useDarkMeshStore
          .getState()
          .setHuntStatus(selectedDeviceId, "Waiting for local node before hunt scan");
        scheduleNext(HUNT_SAFE_THROTTLE_MS);
        return;
      }

      if (candidateIndex >= candidateRound.length) {
        candidateRound = getHuntTracerouteCandidates(getNodes(undefined, true), myNode.num);
        candidateIndex = 0;
      }

      const targetNode = candidateRound[candidateIndex];
      if (!targetNode) {
        useDarkMeshStore
          .getState()
          .setHuntStatus(selectedDeviceId, "No nodes available for hunt traceroute");
        scheduleNext(getHuntBackgroundIntervalMs(huntBackgroundMode));
        return;
      }

      candidateIndex += 1;

      const priority = huntTracePriority
        ? Protobuf.Mesh.MeshPacket_Priority.MAX
        : Protobuf.Mesh.MeshPacket_Priority.UNSET;
      const targetName =
        getNodeLongName(targetNode) ?? getNodeDisplayName(targetNode, targetNode.num);

      try {
        const requestId = await connection.traceRoute(targetNode.num, priority);
        const requestSuffix = typeof requestId === "number" ? ` (#${requestId})` : "";
        useDarkMeshStore
          .getState()
          .setHuntStatus(
            selectedDeviceId,
            `Hunt traceroute requested for ${targetName}${requestSuffix}`,
          );
        scheduleNext(getHuntBackgroundIntervalMs(huntBackgroundMode));
      } catch (error) {
        useDarkMeshStore
          .getState()
          .setHuntError(
            selectedDeviceId,
            error instanceof Error ? error.message : "Unknown hunt traceroute error",
          );
        scheduleNext(HUNT_SAFE_THROTTLE_MS);
      }
    };

    useDarkMeshStore.getState().setHuntStatus(selectedDeviceId, "Background hunt scan active");
    scheduleNext(0);

    return () => {
      cancelled = true;
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    };
  }, [
    connection,
    getMyNode,
    getNodes,
    huntBackgroundMode,
    huntEnabled,
    huntTracePriority,
    selectedDeviceId,
  ]);

  useEffect(() => {
    if (!connection || selectedDeviceId === undefined) {
      return;
    }

    let busy = false;

    const processDarkMeshQueues = async () => {
      if (busy) {
        return;
      }

      busy = true;

      try {
        const store = useDarkMeshStore.getState();
        const myNode = getMyNode();
        const dueSchedules = store.schedules
          .filter((schedule) => schedule.deviceId === selectedDeviceId)
          .filter((schedule) => schedule.nextRunAt <= Date.now())
          .sort((left, right) => left.nextRunAt - right.nextRunAt);

        for (const schedule of dueSchedules) {
          try {
            const sendTarget = resolveDestination(schedule.kind, schedule.destination);
            if (schedule.kind === "direct") {
              const keyExchangeStatus = getDirectMessageKeyExchangeStatus(
                getNode(schedule.destination),
                getNodeError(schedule.destination),
              );

              if (keyExchangeStatus !== "ready") {
                throw new Error(getDirectMessageKeyExchangeDescription(keyExchangeStatus));
              }
            }
            await connection.sendText(
              schedule.text,
              sendTarget.destination,
              true,
              sendTarget.channel,
            );
            const nextRunAt = computeNextRunAt(schedule.nextRunAt, schedule.recurrence);
            useDarkMeshStore.getState().markScheduleSent(schedule.id, nextRunAt);

            toast({
              title: `Scheduled message sent to ${schedule.label}`,
            });
            try {
              const nodeNum =
                typeof sendTarget.destination === "number" ? sendTarget.destination : undefined;
              notify(
                "scheduled_send",
                { scheduleId: schedule.id, scheduleLabel: schedule.label, text: schedule.text },
                { priority: 2, nodeNum },
              );
            } catch {
              // ignore
            }
          } catch (error) {
            useDarkMeshStore
              .getState()
              .markScheduleError(
                schedule.id,
                error instanceof Error ? error.message : "Unknown scheduling error",
              );
            try {
              notify(
                "scheduled_failed",
                {
                  scheduleId: schedule.id,
                  error: error instanceof Error ? error.message : String(error),
                },
                { priority: 3 },
              );
            } catch {
              // ignore
            }
          }
        }

        const beaconConfig = store.beaconsByDevice[selectedDeviceId] ?? defaultBeaconConfig;
        const isBeaconDue =
          beaconConfig.enabled &&
          (!beaconConfig.lastSentAt ||
            Date.now() - beaconConfig.lastSentAt >= beaconConfig.intervalSeconds * 1000);

        if (isBeaconDue) {
          try {
            const message = await buildDistressMessage({
              prefix: beaconConfig.prefix,
              text: beaconConfig.text,
              includeName: beaconConfig.includeName,
              includeGps: beaconConfig.includeGps,
              includeTime: beaconConfig.includeTime,
              myName: getNodeLongName(myNode),
            });

            const sendTarget = resolveDestination(beaconConfig.kind, beaconConfig.destination);
            if (beaconConfig.kind === "direct") {
              const keyExchangeStatus = getDirectMessageKeyExchangeStatus(
                getNode(beaconConfig.destination),
                getNodeError(beaconConfig.destination),
              );

              if (keyExchangeStatus !== "ready") {
                throw new Error(getDirectMessageKeyExchangeDescription(keyExchangeStatus));
              }
            }
            await connection.sendText(message, sendTarget.destination, true, sendTarget.channel);
            useDarkMeshStore.getState().markBeaconSent(selectedDeviceId);
            try {
              const nodeNum =
                typeof sendTarget.destination === "number" ? sendTarget.destination : undefined;
              notify(
                "beacon_send",
                { deviceId: selectedDeviceId, text: message },
                { priority: 2, nodeNum },
              );
            } catch {
              // ignore
            }
          } catch (error) {
            useDarkMeshStore
              .getState()
              .markBeaconError(
                selectedDeviceId,
                error instanceof Error ? error.message : "Unknown beacon error",
              );
            try {
              notify(
                "beacon_failed",
                {
                  deviceId: selectedDeviceId,
                  error: error instanceof Error ? error.message : String(error),
                },
                { priority: 3 },
              );
            } catch {
              // ignore
            }
          }
        }
      } finally {
        busy = false;
      }
    };

    void processDarkMeshQueues();
    const intervalId = window.setInterval(() => {
      void processDarkMeshQueues();
    }, 15_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [connection, getMyNode, selectedDeviceId, toast]);

  return null;
}
