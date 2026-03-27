import { useToast } from "@core/hooks/useToast.ts";
import { useAppStore, useDevice, useNodeDB } from "@core/stores";
import { type Protobuf, type Types } from "@meshtastic/core";
import { useEffect } from "react";
import { defaultBeaconConfig, defaultHuntConfig, useDarkMeshStore } from "./store.ts";
import {
  buildDistressMessage,
  buildHuntPayload,
  computeNextRunAt,
  getNodeDisplayName,
  normalizeHuntEndpoint,
  resolveDestination,
  resolveRelayCandidate,
} from "./utils.ts";

async function forwardHuntPacket<T>(
  deviceId: number,
  hunterId: string,
  huntConfig: typeof defaultHuntConfig,
  packet: Types.PacketMetadata<T>,
) {
  const response = await fetch(`${normalizeHuntEndpoint(huntConfig.endpoint)}/api/mobile`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${huntConfig.token}`,
      "Content-Type": "application/json",
    },
    body: buildHuntPayload(hunterId, packet),
  });

  if (!response.ok) {
    throw new Error(`Hunt endpoint responded with ${response.status}`);
  }

  useDarkMeshStore.getState().markHuntForwarded(deviceId);
}

export function DarkMeshRuntime() {
  const { connection } = useDevice();
  const { getMyNode, getNode, getNodes } = useNodeDB();
  const selectedDeviceId = useAppStore((state) => state.selectedDeviceId);
  const { toast } = useToast();

  useEffect(() => {
    if (!connection || selectedDeviceId === undefined) {
      return;
    }

    const handleGatewayPacket = (meshPacket: Protobuf.Mesh.MeshPacket) => {
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
          nodeName: getNodeDisplayName(directNode, directNode.num),
          source: "direct",
          confidence: 100,
          observedAt: Date.now(),
          rxSnr: meshPacket.rxSnr,
          rxRssi: meshPacket.rxRssi,
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
          nodeName: getNodeDisplayName(relayCandidate.node, relayCandidate.node.num),
          source: "relay",
          confidence: relayCandidate.confidence,
          observedAt: Date.now(),
          rxSnr: meshPacket.rxSnr,
          rxRssi: meshPacket.rxRssi,
        });
      }
    };

    const handleTracerouteGateway = (
      traceroute: Types.PacketMetadata<Protobuf.Mesh.RouteDiscovery>,
    ) => {
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
        nodeName: getNodeDisplayName(hopNode, hopNode.num),
        source: "traceroute",
        confidence: traceroute.data.route.length > 1 ? 84 : 92,
        observedAt: Date.now(),
        rxSnr: traceroute.rxSnr,
        rxRssi: traceroute.rxRssi,
      });
    };

    const handleHuntPacket = <T,>(packet: Types.PacketMetadata<T>) => {
      const myNode = getMyNode();
      const huntConfig =
        useDarkMeshStore.getState().huntByDevice[selectedDeviceId] ?? defaultHuntConfig;

      if (!myNode?.user?.id || !huntConfig.enabled || !huntConfig.endpoint || !huntConfig.token) {
        return;
      }

      void forwardHuntPacket(selectedDeviceId, myNode.user.id, huntConfig, packet).catch(
        (error) => {
          useDarkMeshStore
            .getState()
            .setHuntError(
              selectedDeviceId,
              error instanceof Error ? error.message : "Unknown hunt forwarding error",
            );
        },
      );
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
          } catch (error) {
            useDarkMeshStore
              .getState()
              .markScheduleError(
                schedule.id,
                error instanceof Error ? error.message : "Unknown scheduling error",
              );
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
              myName: myNode?.user?.longName,
            });

            const sendTarget = resolveDestination(beaconConfig.kind, beaconConfig.destination);
            await connection.sendText(message, sendTarget.destination, true, sendTarget.channel);
            useDarkMeshStore.getState().markBeaconSent(selectedDeviceId);
          } catch (error) {
            useDarkMeshStore
              .getState()
              .markBeaconError(
                selectedDeviceId,
                error instanceof Error ? error.message : "Unknown beacon error",
              );
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
