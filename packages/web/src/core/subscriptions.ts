import { useDarkMeshStore } from "@app/darkmesh/store.ts";
import PacketToMessageDTO from "@core/dto/PacketToMessageDTO.ts";
import { useNewNodeNum } from "@core/hooks/useNewNodeNum";
import {
  type Device,
  type MessageStore,
  MessageType,
  MessageState,
  type NodeDB,
  useDebugStore,
  useMessageStore,
} from "@core/stores";
import type { Message } from "@core/stores/messageStore/types.ts";
import useNotificationsStore from "@core/stores/notificationsStore/index.ts";
import { type MeshDevice, Protobuf, type Types, Types as CoreTypes } from "@meshtastic/core";

const RECENT_NODE_RESPONSE_PKI_SUPPRESSION_MS = 10_000;

function getNodeDisplayName(nodeDB: NodeDB, nodeNum: number): string {
  const node = nodeDB.getNode(nodeNum);

  return (
    node?.user?.longName?.trim() ||
    node?.user?.shortName?.trim() ||
    (node?.user as { id?: string | undefined } | undefined)?.id ||
    `!${nodeNum.toString(16).toUpperCase()}`
  );
}

function getChannelDisplayName(device: Device, channel: number): string {
  return device.channels.get(channel)?.settings?.name?.trim() || `Channel ${channel}`;
}

function isDistressBeaconMessage(messagePacket: Types.PacketMetadata<string>): boolean {
  return (
    messagePacket.portNum === Protobuf.Portnums.PortNum.ALERT_APP ||
    /^\s*(\[SOS\]|\[DISTRESS\]|SOS\b|MAYDAY\b|DISTRESS\b|EMERGENCY\b)/i.test(messagePacket.data)
  );
}

export const subscribeAll = (
  device: Device,
  connection: MeshDevice,
  messageStore: MessageStore,
  nodeDB: NodeDB,
) => {
  let myNodeNum = 0;
  const recentNodeResponseAt = new Map<number, number>();

  const dismissRecoveredPkiDialog = (nodeNum: number) => {
    const cleared = nodeDB.clearRecoverableNodeError(nodeNum);
    if (cleared && device.refreshKeysNodeNum === nodeNum) {
      device.setDialogOpen("refreshKeys", false);
      device.setRefreshKeysNodeNum(undefined);
    }
  };

  const recordNodeResponse = (nodeNum: number) => {
    recentNodeResponseAt.set(nodeNum, Date.now());
    dismissRecoveredPkiDialog(nodeNum);
  };

  const recordDirectNodeResponse = ({ from, type }: { from: number; type?: string }) => {
    if (type === "direct") {
      recordNodeResponse(from);
    }
  };

  const hasRecentNodeResponse = (nodeNum: number) => {
    const lastSeenAt = recentNodeResponseAt.get(nodeNum);
    return (
      lastSeenAt !== undefined && Date.now() - lastSeenAt <= RECENT_NODE_RESPONSE_PKI_SUPPRESSION_MS
    );
  };

  const isQueuePendingState = (state: MessageState) =>
    state === MessageState.Waiting ||
    state === MessageState.Queued ||
    state === MessageState.Enroute;

  const updateMessageStateByPacketId = (
    messageId: number,
    resolveState: (message: Message) => MessageState | undefined,
    routingError?: Protobuf.Mesh.Routing_Error,
  ): boolean => {
    const currentMessageStore =
      useMessageStore.getState().getMessageStore(messageStore.id) ?? messageStore;

    for (const [convId, map] of currentMessageStore.messages.direct) {
      const message = map.get(messageId);
      if (!message) {
        continue;
      }

      const newState = resolveState(message);
      if (!newState) {
        return false;
      }

      const [aStr, bStr] = convId.split(":");
      currentMessageStore.setMessageState({
        type: MessageType.Direct,
        nodeA: Number(aStr),
        nodeB: Number(bStr),
        messageId,
        newState,
        routingError,
      });
      return true;
    }

    for (const [channelId, map] of currentMessageStore.messages.broadcast) {
      const message = map.get(messageId);
      if (!message) {
        continue;
      }

      const newState = resolveState(message);
      if (!newState) {
        return false;
      }

      currentMessageStore.setMessageState({
        type: MessageType.Broadcast,
        channelId: Number(channelId),
        messageId,
        newState,
        routingError,
      });
      return true;
    }

    return false;
  };

  connection.events.onDeviceMetadataPacket.subscribe((metadataPacket) => {
    recordDirectNodeResponse(metadataPacket);
    device.addMetadata(metadataPacket.from, metadataPacket.data);
  });

  connection.events.onFromRadio.subscribe((fromRadio) => {
    useDebugStore.getState().addFromRadio(device.id, fromRadio);
  });

  connection.events.onLogRecord.subscribe((logRecord) => {
    useDebugStore.getState().addLogRecord(device.id, logRecord);
  });

  connection.events.onDeviceDebugLog.subscribe((debugLog) => {
    useDebugStore.getState().addSerialDebugLog(device.id, debugLog);
  });

  connection.events.onRoutingPacket.subscribe((routingPacket) => {
    // Handle routing variant cases and map ACK/NAK to message state updates
    switch (routingPacket.data.variant.case) {
      case "errorReason": {
        // If there's a requestId, map ack/nak to a stored message (if present)
        const maybeRouting = routingPacket as unknown as {
          requestId?: number | undefined;
        };
        const requestId =
          typeof maybeRouting.requestId === "number" ? maybeRouting.requestId : undefined;
        const routingError = routingPacket.data.variant.value;
        const isAck = routingError === Protobuf.Mesh.Routing_Error.NONE;

        if (typeof requestId === "number" && requestId !== 0) {
          const updated = updateMessageStateByPacketId(
            requestId,
            (message) => {
              if (!isAck) {
                return MessageState.Failed;
              }

              if (message.type === MessageType.Direct) {
                return routingPacket.from === message.to
                  ? MessageState.Received
                  : MessageState.Delivered;
              }

              return MessageState.Delivered;
            },
            routingError,
          );

          if (updated) {
            return;
          }
        }

        if (!isAck) {
          console.info(`Routing Error: ${routingError}`);
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

  connection.events.onQueueStatus.subscribe((queueStatus) => {
    const messageId = queueStatus.meshPacketId;
    if (messageId === 0) {
      return;
    }

    updateMessageStateByPacketId(messageId, (message) => {
      if (!isQueuePendingState(message.state)) {
        return undefined;
      }

      return queueStatus.res === 0 ? MessageState.Enroute : MessageState.Failed;
    });
  });

  connection.events.onTelemetryPacket.subscribe((telemetryPacket) => {
    nodeDB.addTelemetry(telemetryPacket);
    recordDirectNodeResponse(telemetryPacket);
  });

  connection.events.onDeviceStatus.subscribe((status) => {
    device.setStatus(status);
    if (status === CoreTypes.DeviceStatusEnum.DeviceDisconnected) {
      device.setConnectionPhase("disconnected");
    }
  });

  connection.events.onWaypointPacket.subscribe((waypoint) => {
    const { data, channel, from, rxTime } = waypoint;
    recordDirectNodeResponse(waypoint);
    device.addWaypoint(data, channel, from, rxTime);
  });

  connection.events.onMyNodeInfo.subscribe((nodeInfo) => {
    useNewNodeNum(device.id, nodeInfo);
    myNodeNum = nodeInfo.myNodeNum;
  });

  connection.events.onUserPacket.subscribe((user) => {
    nodeDB.addUser(user);
    recordDirectNodeResponse(user);
  });

  connection.events.onPositionPacket.subscribe((position) => {
    nodeDB.addPosition(position);
    recordDirectNodeResponse(position);
  });

  connection.events.onNodeStatusPacket.subscribe((statusPacket) => {
    nodeDB.updateNodeStatus(statusPacket.from, statusPacket.data.status);
    recordDirectNodeResponse(statusPacket);
  });

  // NOTE: Node handling is managed by the nodeDB
  // Nodes are added via subscriptions.ts and stored in nodeDB
  // Configuration is handled directly by meshDevice.configure() in useConnections
  connection.events.onNodeInfoPacket.subscribe((nodeInfo) => {
    nodeDB.addNode(nodeInfo);
    recordNodeResponse(nodeInfo.num);
  });

  connection.events.onChannelPacket.subscribe((channel) => {
    device.addChannel(channel);
  });
  connection.events.onConfigPacket.subscribe((config) => {
    device.setConfig(config);
  });
  connection.events.onModuleConfigPacket.subscribe((moduleConfig) => {
    device.setModuleConfig(moduleConfig);

    if (moduleConfig.payloadVariant.case === "statusmessage") {
      const targetNodeNum = myNodeNum || device.hardware.myNodeNum;

      if (typeof targetNodeNum === "number" && targetNodeNum > 0) {
        nodeDB.updateNodeStatus(targetNodeNum, moduleConfig.payloadVariant.value.nodeStatus);
      }
    }
  });

  connection.events.onMessagePacket.subscribe((messagePacket) => {
    // incoming and outgoing messages are handled by this event listener
    if (
      messagePacket.emoji &&
      typeof messagePacket.replyId === "number" &&
      messagePacket.data.trim().length > 0
    ) {
      if (messagePacket.type === "direct") {
        recordNodeResponse(messagePacket.from);
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
      recordNodeResponse(message.from);
      if (message.to === myNodeNum) {
        device.incrementUnread(messagePacket.from);
        const senderName = getNodeDisplayName(nodeDB, message.from);
        const distress = isDistressBeaconMessage(messagePacket);
        useNotificationsStore.getState().add({
          type: distress ? "distress_beacon" : "direct_message",
          priority: distress ? 5 : 3,
          nodeNum: message.from,
          payload: {
            title: distress
              ? `Distress beacon from ${senderName}`
              : `Direct message from ${senderName}`,
            detail: message.message,
            message: message.message,
            senderName,
            url: `/messages/direct/${message.from}`,
          },
        });
      }
    } else if (message.type === MessageType.Broadcast) {
      if (message.from !== myNodeNum) {
        device.incrementUnread(message.channel);
        const senderName = getNodeDisplayName(nodeDB, message.from);
        const channelName = getChannelDisplayName(device, message.channel);
        const distress = isDistressBeaconMessage(messagePacket);
        useNotificationsStore.getState().add({
          type: distress ? "distress_beacon" : "broadcast_message",
          priority: distress ? 5 : 2,
          nodeNum: message.from,
          payload: {
            title: distress
              ? `Distress beacon from ${senderName}`
              : `${channelName}: ${senderName}`,
            detail: message.message,
            message: message.message,
            senderName,
            channel: message.channel,
            channelName,
            url: `/messages/broadcast/${message.channel}`,
          },
        });
      }
    }
  });

  connection.events.onTraceRoutePacket.subscribe((traceRoutePacket) => {
    recordDirectNodeResponse(traceRoutePacket);
    device.addTraceRoute({ ...traceRoutePacket });
    const darkMeshState = useDarkMeshStore.getState();
    const pendingRequestId = darkMeshState.pendingTraceRouteRequestByDevice[device.id];
    const pendingTarget = darkMeshState.pendingTraceRouteTargetByDevice[device.id];

    // Prefer matching by requestId when available (robust for 0-hop responses)
    const maybeTrace = traceRoutePacket as unknown as {
      requestId?: number | undefined;
    };
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
      hopStart: meshPacket.hopStart,
      hopLimit: meshPacket.hopLimit,
    });
  });

  connection.events.onClientNotificationPacket.subscribe((clientNotificationPacket) => {
    device.addClientNotification(clientNotificationPacket);
    device.setDialogOpen("clientNotification", true);
  });

  connection.events.onNeighborInfoPacket.subscribe((neighborInfo) => {
    recordDirectNodeResponse(neighborInfo);
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
          break;
        case Protobuf.Mesh.Routing_Error.PKI_UNKNOWN_PUBKEY:
          console.error(`Routing Error: ${routingPacket.data.variant.value}`);
          if (hasRecentNodeResponse(routingPacket.from)) {
            dismissRecoveredPkiDialog(routingPacket.from);
            break;
          }
          nodeDB.setNodeError(routingPacket.from, routingPacket?.data?.variant?.value);
          device.setRefreshKeysNodeNum(routingPacket.from);
          device.setDialogOpen("refreshKeys", true);
          break;
        default: {
          break;
        }
      }
    }
  });
};
