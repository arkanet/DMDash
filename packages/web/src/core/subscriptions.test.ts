import { MessageState, MessageType, useMessageStore } from "@core/stores";
import { Protobuf } from "@meshtastic/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { subscribeAll } from "./subscriptions.ts";

function createEvent<T>() {
  const subscribers = new Set<(payload: T) => void>();

  return {
    subscribe: (handler: (payload: T) => void) => {
      subscribers.add(handler);
    },
    unsubscribe: (handler: (payload: T) => void) => {
      subscribers.delete(handler);
    },
    dispatch: (payload: T) => {
      subscribers.forEach((handler) => handler(payload));
    },
  };
}

function createConnectionEvents() {
  return {
    onDeviceMetadataPacket: createEvent<unknown>(),
    onRoutingPacket: createEvent<unknown>(),
    onQueueStatus: createEvent<unknown>(),
    onTelemetryPacket: createEvent<unknown>(),
    onDeviceStatus: createEvent<unknown>(),
    onWaypointPacket: createEvent<unknown>(),
    onMyNodeInfo: createEvent<unknown>(),
    onUserPacket: createEvent<unknown>(),
    onPositionPacket: createEvent<unknown>(),
    onNodeInfoPacket: createEvent<unknown>(),
    onChannelPacket: createEvent<unknown>(),
    onConfigPacket: createEvent<unknown>(),
    onModuleConfigPacket: createEvent<unknown>(),
    onMessagePacket: createEvent<unknown>(),
    onTraceRoutePacket: createEvent<unknown>(),
    onPendingSettingsChange: createEvent<unknown>(),
    onMeshPacket: createEvent<unknown>(),
    onClientNotificationPacket: createEvent<unknown>(),
    onNeighborInfoPacket: createEvent<unknown>(),
  };
}

describe("subscribeAll message status updates", () => {
  beforeEach(() => {
    useMessageStore.setState({ messageStores: new Map() });
  });

  it("updates a freshly saved outgoing direct message through queued, enroute, and recipient ACK states", () => {
    const deviceId = 9001;
    const myNodeNum = 111;
    const targetNodeNum = 222;
    const messageId = 12345;
    const events = createConnectionEvents();
    const messageStore = useMessageStore.getState().addMessageStore(deviceId);
    const device = {
      id: deviceId,
      hardware: { myNodeNum },
      addMetadata: vi.fn(),
      setStatus: vi.fn(),
      addWaypoint: vi.fn(),
      addChannel: vi.fn(),
      setConfig: vi.fn(),
      setModuleConfig: vi.fn(),
      incrementUnread: vi.fn(),
      addTraceRoute: vi.fn(),
      setPendingSettingsChanges: vi.fn(),
      addClientNotification: vi.fn(),
      setDialogOpen: vi.fn(),
      addNeighborInfo: vi.fn(),
      setRefreshKeysNodeNum: vi.fn(),
    };
    const nodeDB = {
      addTelemetry: vi.fn(),
      updateNodeStatus: vi.fn(),
      addUser: vi.fn(),
      addPosition: vi.fn(),
      addNode: vi.fn(),
      processPacket: vi.fn(),
      setNodeError: vi.fn(),
    };

    subscribeAll(device as never, { events } as never, messageStore, nodeDB as never);

    events.onMyNodeInfo.dispatch({ myNodeNum });
    events.onMessagePacket.dispatch({
      channel: 0,
      to: targetNodeNum,
      from: myNodeNum,
      id: messageId,
      data: "hello",
      type: "direct",
      rxTime: new Date("2026-05-12T08:00:00Z"),
    });

    const currentStore = useMessageStore.getState().getMessageStore(deviceId);
    expect(
      currentStore?.getMessages({
        type: MessageType.Direct,
        nodeA: myNodeNum,
        nodeB: targetNodeNum,
      })[0]?.state,
    ).toBe(MessageState.Queued);

    events.onQueueStatus.dispatch({
      meshPacketId: messageId,
      res: 0,
      free: 1,
    });
    expect(
      currentStore?.getMessages({
        type: MessageType.Direct,
        nodeA: myNodeNum,
        nodeB: targetNodeNum,
      })[0]?.state,
    ).toBe(MessageState.Enroute);

    events.onRoutingPacket.dispatch({
      channel: 0,
      from: targetNodeNum,
      to: myNodeNum,
      id: 999,
      requestId: messageId,
      data: {
        variant: {
          case: "errorReason",
          value: Protobuf.Mesh.Routing_Error.NONE,
        },
      },
      type: "direct",
      rxTime: new Date("2026-05-12T08:00:01Z"),
    });
    expect(
      currentStore?.getMessages({
        type: MessageType.Direct,
        nodeA: myNodeNum,
        nodeB: targetNodeNum,
      })[0]?.state,
    ).toBe(MessageState.Received);
  });
});
