import { useDarkMeshStore } from "@app/darkmesh/store.ts";
import PacketToMessageDTO from "@core/dto/PacketToMessageDTO.ts";
import { useNewNodeNum } from "@core/hooks/useNewNodeNum";
import {
  type Device,
  type MessageStore,
  MessageType,
  MessageState,
  type NodeDB,
} from "@core/stores";
import { type MeshDevice, Protobuf } from "@meshtastic/core";
export const subscribeAll = (
  device: Device,
  connection: MeshDevice,
  messageStore: MessageStore,
  nodeDB: NodeDB,
) => {
  let myNodeNum = 0;

  connection.events.onDeviceMetadataPacket.subscribe((metadataPacket) => {
    device.addMetadata(metadataPacket.from, metadataPacket.data);
  });

  connection.events.onRoutingPacket.subscribe((routingPacket) => {
    // Handle routing variant cases and map ACK/NAK to message state updates
    switch (routingPacket.data.variant.case) {
      case "errorReason": {
        // If there's a requestId, map ack/nak to a stored message (if present)
        const maybeRouting = routingPacket as unknown as { requestId?: number | undefined };
        const requestId =
          typeof maybeRouting.requestId === "number" ? maybeRouting.requestId : undefined;
        const isAck = routingPacket.data.variant.value === Protobuf.Mesh.Routing_Error.NONE;

        if (typeof requestId === "number" && requestId !== 0) {
          // search direct conversations
          for (const [convId, map] of messageStore.messages.direct) {
            if (map.has(requestId)) {
              const [aStr, bStr] = convId.split(":");
              const nodeA = Number(aStr);
              const nodeB = Number(bStr);
              messageStore.setMessageState({
                type: MessageType.Direct,
                nodeA,
                nodeB,
                messageId: requestId,
                newState: isAck ? MessageState.Ack : MessageState.Failed,
              });
              return;
            }
          }

          // search broadcast channels
          for (const [channelId, map] of messageStore.messages.broadcast) {
            if (map.has(requestId)) {
              messageStore.setMessageState({
                type: MessageType.Broadcast,
                channelId: Number(channelId),
                messageId: requestId,
                newState: isAck ? MessageState.Ack : MessageState.Failed,
              });
              return;
            }
          }
        }

        if (!isAck) {
          console.info(`Routing Error: ${routingPacket.data.variant.value}`);
        }
        break;
      }
      case "routeReply": {
        console.info(`Route Reply: ${routingPacket.data.variant.value}`);
        break;
      }
      case "routeRequest": {
        console.info(`Route Request: ${routingPacket.data.variant.value}`);
        break;
      }
    }
  });

  connection.events.onTelemetryPacket.subscribe((telemetryPacket) => {
    nodeDB.addTelemetry(telemetryPacket);
  });

  connection.events.onDeviceStatus.subscribe((status) => {
    device.setStatus(status);
  });

  connection.events.onWaypointPacket.subscribe((waypoint) => {
    const { data, channel, from, rxTime } = waypoint;
    device.addWaypoint(data, channel, from, rxTime);
  });

  connection.events.onMyNodeInfo.subscribe((nodeInfo) => {
    useNewNodeNum(device.id, nodeInfo);
    myNodeNum = nodeInfo.myNodeNum;
  });

  connection.events.onUserPacket.subscribe((user) => {
    nodeDB.addUser(user);
  });

  connection.events.onPositionPacket.subscribe((position) => {
    nodeDB.addPosition(position);
  });

  // NOTE: Node handling is managed by the nodeDB
  // Nodes are added via subscriptions.ts and stored in nodeDB
  // Configuration is handled directly by meshDevice.configure() in useConnections
  connection.events.onNodeInfoPacket.subscribe((nodeInfo) => {
    nodeDB.addNode(nodeInfo);
  });

  connection.events.onChannelPacket.subscribe((channel) => {
    device.addChannel(channel);
  });
  connection.events.onConfigPacket.subscribe((config) => {
    device.setConfig(config);
  });
  connection.events.onModuleConfigPacket.subscribe((moduleConfig) => {
    device.setModuleConfig(moduleConfig);
  });

  connection.events.onMessagePacket.subscribe((messagePacket) => {
    // incoming and outgoing messages are handled by this event listener
    if (
      messagePacket.emoji &&
      typeof messagePacket.replyId === "number" &&
      messagePacket.data.trim().length > 0
    ) {
      if (messagePacket.type === "direct") {
        messageStore.addReaction({
          type: MessageType.Direct,
          nodeA: messagePacket.from,
          nodeB: messagePacket.to,
          messageId: messagePacket.replyId,
          emoji: messagePacket.data,
          sender: messagePacket.from,
        });
      } else {
        messageStore.addReaction({
          type: MessageType.Broadcast,
          channelId: messagePacket.channel,
          messageId: messagePacket.replyId,
          emoji: messagePacket.data,
          sender: messagePacket.from,
        });
      }
      return;
    }

    const dto = new PacketToMessageDTO(messagePacket, myNodeNum);
    const message = dto.toMessage();
    messageStore.saveMessage(message);

    if (message.type === MessageType.Direct) {
      if (message.to === myNodeNum) {
        device.incrementUnread(messagePacket.from);
      }
    } else if (message.type === MessageType.Broadcast) {
      if (message.from !== myNodeNum) {
        device.incrementUnread(message.channel);
      }
    }
  });

  connection.events.onTraceRoutePacket.subscribe((traceRoutePacket) => {
    device.addTraceRoute({ ...traceRoutePacket });
    const darkMeshState = useDarkMeshStore.getState();
    const pendingRequestId = darkMeshState.pendingTraceRouteRequestByDevice[device.id];
    const pendingTarget = darkMeshState.pendingTraceRouteTargetByDevice[device.id];

    // Prefer matching by requestId when available (robust for 0-hop responses)
    const maybeTrace = traceRoutePacket as unknown as { requestId?: number | undefined };
    if (pendingRequestId !== undefined && typeof maybeTrace.requestId === "number") {
      if (maybeTrace.requestId === pendingRequestId) {
        darkMeshState.setSelectedTraceRoute({ ...traceRoutePacket });
        darkMeshState.setPendingTraceRouteTarget(device.id, undefined);
        darkMeshState.setPendingTraceRouteRequest(device.id, undefined);
        return;
      }
    }

    // Fallback: match by node number (legacy behavior)
    if (pendingTarget !== undefined && traceRoutePacket.from === pendingTarget) {
      darkMeshState.setSelectedTraceRoute({ ...traceRoutePacket });
      darkMeshState.setPendingTraceRouteTarget(device.id, undefined);
      darkMeshState.setPendingTraceRouteRequest(device.id, undefined);
    }
  });

  connection.events.onPendingSettingsChange.subscribe((state) => {
    device.setPendingSettingsChanges(state);
  });

  connection.events.onMeshPacket.subscribe((meshPacket) => {
    nodeDB.processPacket({
      from: meshPacket.from,
      snr: meshPacket.rxSnr,
      time: meshPacket.rxTime,
      rxRssi: meshPacket.rxRssi,
    });
  });

  connection.events.onClientNotificationPacket.subscribe((clientNotificationPacket) => {
    device.addClientNotification(clientNotificationPacket);
    device.setDialogOpen("clientNotification", true);
  });

  connection.events.onNeighborInfoPacket.subscribe((neighborInfo) => {
    device.addNeighborInfo(neighborInfo.from, neighborInfo.data);
  });

  connection.events.onRoutingPacket.subscribe((routingPacket) => {
    if (routingPacket.data.variant.case === "errorReason") {
      switch (routingPacket.data.variant.value) {
        case Protobuf.Mesh.Routing_Error.MAX_RETRANSMIT:
          console.error(`Routing Error: ${routingPacket.data.variant.value}`);
          break;
        case Protobuf.Mesh.Routing_Error.NO_CHANNEL:
          console.error(`Routing Error: ${routingPacket.data.variant.value}`);
          nodeDB.setNodeError(routingPacket.from, routingPacket?.data?.variant?.value);
          device.setDialogOpen("refreshKeys", true);
          break;
        case Protobuf.Mesh.Routing_Error.PKI_UNKNOWN_PUBKEY:
          console.error(`Routing Error: ${routingPacket.data.variant.value}`);
          nodeDB.setNodeError(routingPacket.from, routingPacket?.data?.variant?.value);
          device.setDialogOpen("refreshKeys", true);
          break;
        default: {
          break;
        }
      }
    }
  });
};
