import { useDarkMeshStore } from "@app/darkmesh/store.ts";
import PacketToMessageDTO from "@core/dto/PacketToMessageDTO.ts";
import { useNewNodeNum } from "@core/hooks/useNewNodeNum";
import { type Device, type MessageStore, MessageType, type NodeDB } from "@core/stores";
import { Constants, type MeshDevice, Protobuf, Types } from "@meshtastic/core";
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
    switch (routingPacket.data.variant.case) {
      case "errorReason": {
        if (routingPacket.data.variant.value === Protobuf.Mesh.Routing_Error.NONE) {
          return;
        }
        console.info(`Routing Error: ${routingPacket.data.variant.value}`);
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
    // Handle reactions (TEXT_MESSAGE_APP with emoji flag) separately so they
    // are not stored as normal messages.
    if (messagePacket.emoji === 1 && messagePacket.replyId !== undefined) {
      const emoji = messagePacket.data as string;
      const messageId = messagePacket.replyId as number;

      if (messagePacket.type === "direct") {
        // For direct messages, reaction targets the conversation between us and the sender
        if (myNodeNum !== undefined) {
          messageStore.addReaction({
            type: MessageType.Direct,
            nodeA: myNodeNum,
            nodeB: messagePacket.from,
            messageId,
            emoji,
          });
        }
      } else {
        // Broadcast message reaction
        messageStore.addReaction({
          type: MessageType.Broadcast,
          channelId: messagePacket.channel,
          messageId,
          emoji,
        });
      }

      return; // don't treat reaction packets as normal messages
    }

    // incoming and outgoing messages are handled by this event listener
    const dto = new PacketToMessageDTO(messagePacket, myNodeNum);
    const message = dto.toMessage();

    // Avoid saving duplicate messages (same messageId) if already present
    let alreadyExists = false;
    try {
      if (message.type === MessageType.Direct) {
        if (myNodeNum !== undefined) {
          const existing = messageStore.getMessages({
            type: MessageType.Direct,
            nodeA: myNodeNum,
            nodeB: message.from,
          });
          alreadyExists = existing.some((m) => m.messageId === message.messageId);
        }
      } else {
        const existing = messageStore.getMessages({
          type: MessageType.Broadcast,
          channelId: message.channel,
        });
        alreadyExists = existing.some((m) => m.messageId === message.messageId);
      }
    } catch {
      // If store read fails for any reason, fall back to saving the message
      alreadyExists = false;
    }

    if (!alreadyExists) {
      messageStore.saveMessage(message);
    }

    if (
      typeof window !== "undefined" &&
      message.compressed &&
      message.from !== myNodeNum &&
      window.localStorage
    ) {
      const contactKey =
        message.type === MessageType.Direct
          ? `${Types.ChannelNumber.Primary}${message.from}`
          : `${message.channel}${Constants.broadcastNum}`;

      try {
        window.localStorage.setItem(`compressionPrefs:${contactKey}`, "true");
      } catch {
        // ignore localStorage write failures
      }
    }

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
    device.addTraceRoute({
      ...traceRoutePacket,
    });

    const darkMeshState = useDarkMeshStore.getState();
    const pendingTarget = darkMeshState.pendingTraceRouteTargetByDevice[device.id];
    if (pendingTarget !== undefined && traceRoutePacket.from === pendingTarget) {
      darkMeshState.setSelectedTraceRoute({
        ...traceRoutePacket,
      });
      darkMeshState.setPendingTraceRouteTarget(device.id, undefined);
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
