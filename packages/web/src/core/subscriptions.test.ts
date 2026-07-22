import { MessageState, MessageType, useMessageStore } from "@core/stores";
import { Protobuf, Types } from "@meshtastic/core";
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
    onDeviceUiConfigPacket: createEvent<unknown>(),
    onFromRadio: createEvent<unknown>(),
    onLogRecord: createEvent<unknown>(),
    onDeviceDebugLog: createEvent<unknown>(),
    onRoutingPacket: createEvent<unknown>(),
    onQueueStatus: createEvent<unknown>(),
    onTelemetryPacket: createEvent<unknown>(),
    onDeviceStatus: createEvent<unknown>(),
    onWaypointPacket: createEvent<unknown>(),
    onMyNodeInfo: createEvent<unknown>(),
    onUserPacket: createEvent<unknown>(),
    onPositionPacket: createEvent<unknown>(),
    onNodeStatusPacket: createEvent<unknown>(),
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

function createSubscriptionDevice(deviceId: number, myNodeNum = 0) {
  const device = {
    id: deviceId,
    hardware: { myNodeNum },
    refreshKeysNodeNum: undefined as number | undefined,
    addMetadata: vi.fn(),
    setStatus: vi.fn(),
    addWaypoint: vi.fn(),
    addChannel: vi.fn(),
    setConfig: vi.fn(),
    setModuleConfig: vi.fn(),
    setDeviceUiConfig: vi.fn(),
    incrementUnread: vi.fn(),
    addTraceRoute: vi.fn(),
    setPendingSettingsChanges: vi.fn(),
    addClientNotification: vi.fn(),
    setDialogOpen: vi.fn(),
    addNeighborInfo: vi.fn(),
    setRefreshKeysNodeNum: vi.fn((nodeNum: number | undefined) => {
      device.refreshKeysNodeNum = nodeNum;
    }),
    channels: new Map(),
  };

  return device;
}

function createSubscriptionNodeDB() {
  return {
    addTelemetry: vi.fn(),
    updateNodeStatus: vi.fn(),
    addUser: vi.fn(),
    addPosition: vi.fn(),
    addNode: vi.fn(),
    processPacket: vi.fn(),
    setNodeError: vi.fn(),
    clearRecoverableNodeError: vi.fn().mockReturnValue(false),
    getNode: vi.fn().mockReturnValue(undefined),
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
      setDeviceUiConfig: vi.fn(),
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
      clearRecoverableNodeError: vi.fn().mockReturnValue(false),
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
      from: 333,
      to: myNodeNum,
      id: 998,
      requestId: messageId,
      data: {
        variant: {
          case: "errorReason",
          value: Protobuf.Mesh.Routing_Error.NONE,
        },
      },
      type: "direct",
      rxTime: new Date("2026-05-12T08:00:00Z"),
    });
    expect(
      currentStore?.getMessages({
        type: MessageType.Direct,
        nodeA: myNodeNum,
        nodeB: targetNodeNum,
      })[0]?.state,
    ).toBe(MessageState.Delivered);

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

    events.onRoutingPacket.dispatch({
      channel: 0,
      from: 333,
      to: myNodeNum,
      id: 1000,
      requestId: messageId,
      data: {
        variant: {
          case: "errorReason",
          value: Protobuf.Mesh.Routing_Error.MAX_RETRANSMIT,
        },
      },
      type: "direct",
      rxTime: new Date("2026-05-12T08:00:02Z"),
    });
    const confirmedMessage = currentStore?.getMessages({
      type: MessageType.Direct,
      nodeA: myNodeNum,
      nodeB: targetNodeNum,
    })[0];
    expect(confirmedMessage?.state).toBe(MessageState.Received);
    expect(confirmedMessage?.routingError).toBe(Protobuf.Mesh.Routing_Error.NONE);
  });

  it("maps broadcast ACKs to delivered instead of recipient-confirmed", () => {
    const deviceId = 9004;
    const myNodeNum = 111;
    const messageId = 54321;
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
      setDeviceUiConfig: vi.fn(),
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
      clearRecoverableNodeError: vi.fn().mockReturnValue(false),
    };

    subscribeAll(device as never, { events } as never, messageStore, nodeDB as never);

    events.onMyNodeInfo.dispatch({ myNodeNum });
    events.onMessagePacket.dispatch({
      channel: 0,
      to: 0xffffffff,
      from: myNodeNum,
      id: messageId,
      data: "hello channel",
      type: "broadcast",
      rxTime: new Date("2026-05-12T08:00:00Z"),
    });

    events.onRoutingPacket.dispatch({
      channel: 0,
      from: 222,
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

    const currentStore = useMessageStore.getState().getMessageStore(deviceId);
    const [message] =
      currentStore?.getMessages({
        type: MessageType.Broadcast,
        channelId: 0,
      }) ?? [];

    expect(message?.state).toBe(MessageState.Delivered);
    expect(message?.routingError).toBe(Protobuf.Mesh.Routing_Error.NONE);
  });

  it("marks the connection phase disconnected when the device disconnects", () => {
    const events = createConnectionEvents();
    const messageStore = useMessageStore.getState().addMessageStore(9002);
    const device = {
      id: 9002,
      hardware: { myNodeNum: 0 },
      addMetadata: vi.fn(),
      setStatus: vi.fn(),
      setConnectionPhase: vi.fn(),
      addWaypoint: vi.fn(),
      addChannel: vi.fn(),
      setConfig: vi.fn(),
      setModuleConfig: vi.fn(),
      setDeviceUiConfig: vi.fn(),
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
      clearRecoverableNodeError: vi.fn().mockReturnValue(false),
    };

    subscribeAll(device as never, { events } as never, messageStore, nodeDB as never);

    events.onDeviceStatus.dispatch(Types.DeviceStatusEnum.DeviceDisconnected);

    expect(device.setStatus).toHaveBeenCalledWith(Types.DeviceStatusEnum.DeviceDisconnected);
    expect(device.setConnectionPhase).toHaveBeenCalledWith("disconnected");
  });

  it("updates node status from NODE_STATUS_APP packets", () => {
    const events = createConnectionEvents();
    const messageStore = useMessageStore.getState().addMessageStore(9003);
    const device = {
      id: 9003,
      hardware: { myNodeNum: 0 },
      addMetadata: vi.fn(),
      setStatus: vi.fn(),
      addWaypoint: vi.fn(),
      addChannel: vi.fn(),
      setConfig: vi.fn(),
      setModuleConfig: vi.fn(),
      setDeviceUiConfig: vi.fn(),
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
      clearRecoverableNodeError: vi.fn().mockReturnValue(false),
    };

    subscribeAll(device as never, { events } as never, messageStore, nodeDB as never);

    events.onNodeStatusPacket.dispatch({
      from: 123,
      data: { status: "In movimento" },
    });

    expect(nodeDB.updateNodeStatus).toHaveBeenCalledWith(123, "In movimento");
  });

  it("passes hop metadata from mesh packets to the node DB", () => {
    const events = createConnectionEvents();
    const messageStore = useMessageStore.getState().addMessageStore(9005);
    const device = {
      id: 9005,
      hardware: { myNodeNum: 0 },
      addMetadata: vi.fn(),
      setStatus: vi.fn(),
      addWaypoint: vi.fn(),
      addChannel: vi.fn(),
      setConfig: vi.fn(),
      setModuleConfig: vi.fn(),
      setDeviceUiConfig: vi.fn(),
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
      clearRecoverableNodeError: vi.fn().mockReturnValue(false),
    };

    subscribeAll(device as never, { events } as never, messageStore, nodeDB as never);

    events.onMeshPacket.dispatch({
      from: 123,
      rxSnr: 11.25,
      rxTime: 1_778_888_111,
      rxRssi: -98,
      hopStart: 4,
      hopLimit: 4,
    });

    expect(nodeDB.processPacket).toHaveBeenCalledWith({
      from: 123,
      snr: 11.25,
      time: 1_778_888_111,
      rxRssi: -98,
      hopStart: 4,
      hopLimit: 4,
    });
  });

  it.each([
    {
      name: "metadata",
      dispatch: (events: ReturnType<typeof createConnectionEvents>) =>
        events.onDeviceMetadataPacket.dispatch({
          from: 123,
          type: "direct",
          data: { firmwareVersion: "2.7.21" },
        }),
    },
    {
      name: "telemetry",
      dispatch: (events: ReturnType<typeof createConnectionEvents>) =>
        events.onTelemetryPacket.dispatch({
          from: 123,
          type: "direct",
          rxTime: new Date("2026-05-12T08:00:00Z"),
          data: { variant: { case: "environmentMetrics", value: {} } },
        }),
    },
    {
      name: "user node info",
      dispatch: (events: ReturnType<typeof createConnectionEvents>) =>
        events.onUserPacket.dispatch({
          from: 123,
          type: "direct",
          data: { longName: "node-123" },
        }),
    },
    {
      name: "node info",
      dispatch: (events: ReturnType<typeof createConnectionEvents>) =>
        events.onNodeInfoPacket.dispatch({ num: 123 }),
    },
    {
      name: "position",
      dispatch: (events: ReturnType<typeof createConnectionEvents>) =>
        events.onPositionPacket.dispatch({
          from: 123,
          type: "direct",
          data: { latitudeI: 1, longitudeI: 2 },
        }),
    },
    {
      name: "node status",
      dispatch: (events: ReturnType<typeof createConnectionEvents>) =>
        events.onNodeStatusPacket.dispatch({
          from: 123,
          type: "direct",
          data: { status: "online" },
        }),
    },
    {
      name: "traceroute",
      dispatch: (events: ReturnType<typeof createConnectionEvents>) =>
        events.onTraceRoutePacket.dispatch({
          from: 123,
          type: "direct",
          data: {},
        }),
    },
    {
      name: "neighbor info",
      dispatch: (events: ReturnType<typeof createConnectionEvents>) =>
        events.onNeighborInfoPacket.dispatch({
          from: 123,
          type: "direct",
          data: { neighbors: [] },
        }),
    },
    {
      name: "direct message",
      dispatch: (events: ReturnType<typeof createConnectionEvents>) =>
        events.onMessagePacket.dispatch({
          channel: 0,
          from: 123,
          to: 0,
          id: 444,
          data: "hello",
          type: "direct",
          rxTime: new Date("2026-05-12T08:00:00Z"),
        }),
    },
  ])("does not open refresh keys for PKI_UNKNOWN after a recent $name response", ({ dispatch }) => {
    const events = createConnectionEvents();
    const messageStore = useMessageStore.getState().addMessageStore(9006);
    const device = createSubscriptionDevice(9006);
    const nodeDB = createSubscriptionNodeDB();

    subscribeAll(device as never, { events } as never, messageStore, nodeDB as never);

    dispatch(events);
    events.onRoutingPacket.dispatch({
      channel: 0,
      from: 123,
      to: 0,
      id: 999,
      data: {
        variant: {
          case: "errorReason",
          value: Protobuf.Mesh.Routing_Error.PKI_UNKNOWN_PUBKEY,
        },
      },
      type: "direct",
      rxTime: new Date("2026-05-12T08:00:01Z"),
    });

    expect(nodeDB.clearRecoverableNodeError).toHaveBeenCalledWith(123);
    expect(nodeDB.setNodeError).not.toHaveBeenCalled();
    expect(device.setRefreshKeysNodeNum).not.toHaveBeenCalled();
    expect(device.setDialogOpen).not.toHaveBeenCalledWith("refreshKeys", true);
  });

  it("closes refresh keys when a later metadata response clears PKI_UNKNOWN", () => {
    const events = createConnectionEvents();
    const messageStore = useMessageStore.getState().addMessageStore(9007);
    const device = createSubscriptionDevice(9007);
    const nodeDB = createSubscriptionNodeDB();
    device.refreshKeysNodeNum = 123;
    nodeDB.clearRecoverableNodeError.mockReturnValueOnce(true);

    subscribeAll(device as never, { events } as never, messageStore, nodeDB as never);

    events.onDeviceMetadataPacket.dispatch({
      from: 123,
      type: "direct",
      data: { firmwareVersion: "2.7.21" },
    });

    expect(nodeDB.clearRecoverableNodeError).toHaveBeenCalledWith(123);
    expect(device.setDialogOpen).toHaveBeenCalledWith("refreshKeys", false);
    expect(device.setRefreshKeysNodeNum).toHaveBeenCalledWith(undefined);
    expect(device.addMetadata).toHaveBeenCalledWith(123, { firmwareVersion: "2.7.21" });
  });

  it("stores device UI config packets", () => {
    const events = createConnectionEvents();
    const messageStore = useMessageStore.getState().addMessageStore(9008);
    const device = createSubscriptionDevice(9008);
    const nodeDB = createSubscriptionNodeDB();
    const deviceUiConfig = {
      gpsFormat: Protobuf.DeviceUI.DeviceUIConfig_GpsCoordinateFormat.MGRS,
    };

    subscribeAll(device as never, { events } as never, messageStore, nodeDB as never);

    events.onDeviceUiConfigPacket.dispatch({
      from: 0,
      type: "direct",
      data: deviceUiConfig,
    });

    expect(device.setDeviceUiConfig).toHaveBeenCalledWith(deviceUiConfig);
  });

  it("does not suppress PKI_UNKNOWN after a broadcast telemetry packet", () => {
    const events = createConnectionEvents();
    const messageStore = useMessageStore.getState().addMessageStore(9009);
    const device = createSubscriptionDevice(9009);
    const nodeDB = createSubscriptionNodeDB();

    subscribeAll(device as never, { events } as never, messageStore, nodeDB as never);

    events.onTelemetryPacket.dispatch({
      from: 123,
      type: "broadcast",
      rxTime: new Date("2026-05-12T08:00:00Z"),
      data: { variant: { case: "environmentMetrics", value: {} } },
    });
    events.onRoutingPacket.dispatch({
      channel: 0,
      from: 123,
      to: 0,
      id: 999,
      data: {
        variant: {
          case: "errorReason",
          value: Protobuf.Mesh.Routing_Error.PKI_UNKNOWN_PUBKEY,
        },
      },
      type: "direct",
      rxTime: new Date("2026-05-12T08:00:01Z"),
    });

    expect(nodeDB.setNodeError).toHaveBeenCalledWith(
      123,
      Protobuf.Mesh.Routing_Error.PKI_UNKNOWN_PUBKEY,
    );
    expect(device.setRefreshKeysNodeNum).toHaveBeenCalledWith(123);
    expect(device.setDialogOpen).toHaveBeenCalledWith("refreshKeys", true);
  });

  it("does not open refresh keys for NO_CHANNEL routing errors", () => {
    const events = createConnectionEvents();
    const messageStore = useMessageStore.getState().addMessageStore(9008);
    const device = createSubscriptionDevice(9008);
    const nodeDB = createSubscriptionNodeDB();

    subscribeAll(device as never, { events } as never, messageStore, nodeDB as never);

    events.onRoutingPacket.dispatch({
      channel: 0,
      from: 123,
      to: 0,
      id: 999,
      data: {
        variant: {
          case: "errorReason",
          value: Protobuf.Mesh.Routing_Error.NO_CHANNEL,
        },
      },
      type: "direct",
      rxTime: new Date("2026-05-12T08:00:01Z"),
    });

    expect(nodeDB.setNodeError).toHaveBeenCalledWith(123, Protobuf.Mesh.Routing_Error.NO_CHANNEL);
    expect(device.setRefreshKeysNodeNum).not.toHaveBeenCalled();
    expect(device.setDialogOpen).not.toHaveBeenCalledWith("refreshKeys", true);
  });
});
