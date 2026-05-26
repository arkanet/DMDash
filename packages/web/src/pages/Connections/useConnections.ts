import type {
  Connection,
  ConnectionId,
  ConnectionStatus,
  NewConnection,
} from "@app/core/stores/deviceStore/types";
import { TransportTCPBridge } from "@app/pages/Connections/TransportTCPBridge";
import {
  createConnectionFromInput,
  testHttpReachable,
  testTcpReachable,
} from "@app/pages/Connections/utils";
import { useAppStore, useDeviceStore, useMessageStore, useNodeDBStore } from "@core/stores";
import { subscribeAll } from "@core/subscriptions.ts";
import { randId } from "@core/utils/randId.ts";
import { MeshDevice, Types } from "@meshtastic/core";
import { TransportHTTP } from "@meshtastic/transport-http";
import { TransportWebBluetooth } from "@meshtastic/transport-web-bluetooth";
import { TransportWebSerial } from "@meshtastic/transport-web-serial";
import { useCallback, useRef } from "react";

// Local storage for cleanup only (not in Zustand)
const transports = new Map<ConnectionId, BluetoothDevice | SerialPort>();
const heartbeats = new Map<ConnectionId, ReturnType<typeof setInterval>>();
const connectionSubscriptions = new Map<ConnectionId, () => void>();
const connectionReconnectTimers = new Map<ConnectionId, ReturnType<typeof setTimeout>>();
const connectionReconnectAttempts = new Map<ConnectionId, number>();
const connectionReconnectStartedAt = new Map<ConnectionId, number>();
const bluetoothDisconnectListeners = new Map<
  ConnectionId,
  { device: BluetoothDevice; listener: EventListener }
>();
const userDisconnects = new Set<ConnectionId>();
const backgroundReconnects = new Set<ConnectionId>();

const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const CONFIG_HEARTBEAT_INTERVAL_MS = 5000; // 5s during configuration
const CONNECTION_RECONNECT_INITIAL_DELAY_MS = 2500;
const CONNECTION_RECONNECT_MAX_DELAY_MS = 15_000;
const CONNECTION_RECONNECT_JITTER_MS = 750;
const CONNECTION_RECONNECT_TIMEOUT_MS = 3 * 60 * 1000;
const BLUETOOTH_RECONNECT_MESSAGE = "Bluetooth connection dropped. Reconnecting automatically.";
const EXPECTED_RECONNECT_MESSAGE = "Device reboot in progress. Reconnecting automatically.";
const CONNECTION_LOST_MESSAGE = "Connection lost.";

type ConnectOptions = {
  allowPrompt?: boolean;
  background?: boolean;
  reconnect?: boolean;
};

function isExpectedReconnectActive(connection: Connection | undefined): boolean {
  return Boolean(
    connection?.expectedReconnectUntil && connection.expectedReconnectUntil > Date.now(),
  );
}

function shouldAutoReconnect(connection: Connection | undefined): boolean {
  const hasEstablishedBluetoothSession =
    connection?.type === "bluetooth" && Boolean(connection.lastConnectedAt);

  return Boolean(
    connection && (hasEstablishedBluetoothSession || isExpectedReconnectActive(connection)),
  );
}

function getConnectionLostMessage(connection: Connection | undefined): string {
  if (isExpectedReconnectActive(connection)) {
    return EXPECTED_RECONNECT_MESSAGE;
  }

  if (connection?.type === "bluetooth") {
    return BLUETOOTH_RECONNECT_MESSAGE;
  }

  return CONNECTION_LOST_MESSAGE;
}

function clearConnectionReconnect(id: ConnectionId): void {
  const timer = connectionReconnectTimers.get(id);
  if (timer) {
    clearTimeout(timer);
    connectionReconnectTimers.delete(id);
  }
  backgroundReconnects.delete(id);
}

function resetConnectionReconnect(id: ConnectionId): void {
  clearConnectionReconnect(id);
  connectionReconnectAttempts.delete(id);
  connectionReconnectStartedAt.delete(id);
}

function getNextConnectionReconnectDelay(id: ConnectionId): number {
  const attempt = connectionReconnectAttempts.get(id) ?? 0;
  connectionReconnectAttempts.set(id, attempt + 1);

  const backoffDelay = Math.min(
    CONNECTION_RECONNECT_INITIAL_DELAY_MS * 2 ** attempt,
    CONNECTION_RECONNECT_MAX_DELAY_MS,
  );
  const jitter = Math.floor(Math.random() * CONNECTION_RECONNECT_JITTER_MS);

  return backoffDelay + jitter;
}

function startConnectionReconnectWindow(id: ConnectionId): void {
  if (!connectionReconnectStartedAt.has(id)) {
    connectionReconnectStartedAt.set(id, Date.now());
  }
}

function hasConnectionReconnectTimedOut(
  id: ConnectionId,
  connection: Connection | undefined,
): boolean {
  if (!connection || isExpectedReconnectActive(connection)) {
    return false;
  }

  const startedAt = connectionReconnectStartedAt.get(id);
  return Boolean(startedAt && Date.now() - startedAt >= CONNECTION_RECONNECT_TIMEOUT_MS);
}

function getReconnectTimeoutMessage(connection: Connection | undefined): string {
  if (connection?.type === "bluetooth") {
    return "Automatic Bluetooth reconnect timed out. Move closer to the device or re-select it.";
  }

  return "Automatic reconnect timed out.";
}

function isPromptRequiredReconnectError(error: unknown): boolean {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error ?? "");
  return /bluetooth device not available|serial port not available|notfounderror/i.test(message);
}

function removeBluetoothDisconnectListener(id: ConnectionId): void {
  const registered = bluetoothDisconnectListeners.get(id);
  if (!registered) {
    return;
  }

  registered.device.removeEventListener("gattserverdisconnected", registered.listener);
  bluetoothDisconnectListeners.delete(id);
}

function setBluetoothDisconnectListener(
  id: ConnectionId,
  device: BluetoothDevice,
  listener: EventListener,
): void {
  removeBluetoothDisconnectListener(id);
  device.addEventListener("gattserverdisconnected", listener);
  bluetoothDisconnectListeners.set(id, { device, listener });
}

function stopHeartbeat(id: ConnectionId): void {
  const heartbeatId = heartbeats.get(id);
  if (!heartbeatId) {
    return;
  }

  clearInterval(heartbeatId);
  heartbeats.delete(id);
  console.log(`[useConnections] Heartbeat stopped for connection ${id}`);
}

function replaceHeartbeat(id: ConnectionId, heartbeatId: ReturnType<typeof setInterval>): void {
  stopHeartbeat(id);
  heartbeats.set(id, heartbeatId);
}

export function useConnections() {
  const connections = useDeviceStore((s) => s.savedConnections);

  const addSavedConnection = useDeviceStore((s) => s.addSavedConnection);
  const updateSavedConnection = useDeviceStore((s) => s.updateSavedConnection);
  const removeSavedConnectionFromStore = useDeviceStore((s) => s.removeSavedConnection);

  // DeviceStore methods
  const setActiveConnectionId = useDeviceStore((s) => s.setActiveConnectionId);

  const { addDevice } = useDeviceStore();
  const { addNodeDB } = useNodeDBStore();
  const { addMessageStore } = useMessageStore();
  const { setSelectedDevice } = useAppStore();
  const selectedDeviceId = useAppStore((s) => s.selectedDeviceId);
  const connectRef = useRef<((id: ConnectionId, opts?: ConnectOptions) => Promise<boolean>) | null>(
    null,
  );

  const stopConnectionTasks = useCallback((id: ConnectionId) => {
    stopHeartbeat(id);

    const unsubscribeConnectionEvents = connectionSubscriptions.get(id);
    if (unsubscribeConnectionEvents) {
      unsubscribeConnectionEvents();
      connectionSubscriptions.delete(id);
      console.log(`[useConnections] Runtime subscriptions cleaned up for connection ${id}`);
    }
  }, []);

  const updateStatus = useCallback(
    (id: ConnectionId, status: ConnectionStatus, error?: string) => {
      const updates: Partial<Connection> = {
        status,
        error: error || undefined,
        ...(status === "configured" ? { lastConnectedAt: Date.now() } : {}),
        ...(status === "configured"
          ? { expectedReconnectUntil: undefined, expectedReconnectReason: undefined }
          : {}),
      };
      if (status === "configured") {
        resetConnectionReconnect(id);
      }
      updateSavedConnection(id, updates);
    },
    [updateSavedConnection],
  );

  const removeConnection = useCallback(
    async (id: ConnectionId) => {
      userDisconnects.add(id);
      resetConnectionReconnect(id);
      removeBluetoothDisconnectListener(id);

      const conn = useDeviceStore
        .getState()
        .getSavedConnections()
        .find((c) => c.id === id);

      stopConnectionTasks(id);

      // Get device and MeshDevice from Device.connection
      if (conn?.meshDeviceId) {
        const { getDevice, removeDevice } = useDeviceStore.getState();
        const device = getDevice(conn.meshDeviceId);

        if (device?.connection) {
          // Disconnect MeshDevice
          try {
            await device.connection.disconnect();
          } catch {}
        }

        // Close transport if it's BT or Serial
        const transport = transports.get(id);
        if (transport) {
          const bt = transport as BluetoothDevice;
          if (bt.gatt?.connected) {
            try {
              bt.gatt.disconnect();
            } catch {}
          }

          const sp = transport as SerialPort & { close?: () => Promise<void> };
          if (sp.close) {
            try {
              await sp.close();
            } catch {}
          }

          transports.delete(id);
        }

        // Clean up orphaned Device
        try {
          removeDevice(conn.meshDeviceId);
        } catch {}
      }

      removeSavedConnectionFromStore(id);
      userDisconnects.delete(id);
    },
    [removeSavedConnectionFromStore, stopConnectionTasks],
  );

  const setDefaultConnection = useCallback(
    (id: ConnectionId) => {
      for (const connection of connections) {
        if (connection.id === id) {
          updateSavedConnection(connection.id, {
            isDefault: !connection.isDefault,
          });
        }
      }
    },
    [connections, updateSavedConnection],
  );

  const markConnectionLost = useCallback(
    (id: ConnectionId, error = BLUETOOTH_RECONNECT_MESSAGE) => {
      stopConnectionTasks(id);
      const state = useDeviceStore.getState();
      const conn = state.getSavedConnections().find((c) => c.id === id);
      const shouldReconnect = shouldAutoReconnect(conn);

      if (conn?.meshDeviceId) {
        const device = state.getDevice(conn.meshDeviceId);
        device?.setStatus(Types.DeviceStatusEnum.DeviceDisconnected);
        device?.setConnectionPhase("disconnected");
        void device?.connection?.disconnect().catch(() => {
          // The underlying GATT server may already be gone; cleanup is best-effort here.
        });
      }

      if (state.getActiveConnectionId() === id) {
        setActiveConnectionId(null);
      }

      updateSavedConnection(id, {
        status: shouldReconnect ? "reconnecting" : "error",
        error,
      });
    },
    [setActiveConnectionId, stopConnectionTasks, updateSavedConnection],
  );

  const scheduleConnectionReconnect = useCallback(
    (id: ConnectionId) => {
      if (userDisconnects.has(id) || connectionReconnectTimers.has(id)) {
        return;
      }

      startConnectionReconnectWindow(id);

      const queueReconnect = () => {
        const reconnectDelay = getNextConnectionReconnectDelay(id);
        const timer = setTimeout(() => {
          connectionReconnectTimers.delete(id);

          if (userDisconnects.has(id)) {
            return;
          }

          const conn = useDeviceStore
            .getState()
            .getSavedConnections()
            .find((c) => c.id === id);
          if (!conn || !shouldAutoReconnect(conn)) {
            return;
          }

          if (hasConnectionReconnectTimedOut(id, conn)) {
            resetConnectionReconnect(id);
            updateSavedConnection(id, {
              status: "error",
              error: getReconnectTimeoutMessage(conn),
            });
            return;
          }

          const linkedDevice = conn.meshDeviceId
            ? useDeviceStore.getState().getDevice(conn.meshDeviceId)
            : undefined;
          const isRuntimeConnected =
            linkedDevice?.connectionPhase === "configured" &&
            linkedDevice.status !== Types.DeviceStatusEnum.DeviceDisconnected;
          if (isRuntimeConnected) {
            return;
          }

          if (backgroundReconnects.has(id)) {
            queueReconnect();
            return;
          }

          backgroundReconnects.add(id);
          const reconnect = connectRef.current?.(id, {
            allowPrompt: false,
            background: true,
            reconnect: true,
          });
          if (!reconnect) {
            backgroundReconnects.delete(id);
            queueReconnect();
            return;
          }

          void reconnect
            .then((ok) => {
              const currentConnection = useDeviceStore
                .getState()
                .getSavedConnections()
                .find((connection) => connection.id === id);
              if (
                !ok &&
                !userDisconnects.has(id) &&
                shouldAutoReconnect(currentConnection) &&
                !hasConnectionReconnectTimedOut(id, currentConnection)
              ) {
                queueReconnect();
              }
            })
            .finally(() => {
              backgroundReconnects.delete(id);
            });
        }, reconnectDelay);

        connectionReconnectTimers.set(id, timer);
      };

      queueReconnect();
    },
    [connectRef, updateSavedConnection],
  );

  const handleBluetoothGattDisconnect = useCallback(
    (id: ConnectionId) => {
      removeBluetoothDisconnectListener(id);

      if (userDisconnects.has(id)) {
        return;
      }

      const currentConnection = useDeviceStore
        .getState()
        .getSavedConnections()
        .find((connection) => connection.id === id);
      const linkedDevice = currentConnection?.meshDeviceId
        ? useDeviceStore.getState().getDevice(currentConnection.meshDeviceId)
        : undefined;
      const hasConfiguredRuntime =
        currentConnection?.status === "configured" ||
        linkedDevice?.connectionPhase === "configured";

      if (!currentConnection || !hasConfiguredRuntime || !shouldAutoReconnect(currentConnection)) {
        updateSavedConnection(id, {
          status: "error",
          error: CONNECTION_LOST_MESSAGE,
        });
        resetConnectionReconnect(id);
        return;
      }

      markConnectionLost(id, getConnectionLostMessage(currentConnection));
      scheduleConnectionReconnect(id);
    },
    [markConnectionLost, scheduleConnectionReconnect, updateSavedConnection],
  );

  const setupMeshDevice = useCallback(
    (
      id: ConnectionId,
      transport:
        | Awaited<ReturnType<typeof TransportHTTP.create>>
        | Awaited<ReturnType<typeof TransportTCPBridge.create>>
        | Awaited<ReturnType<typeof TransportWebBluetooth.createFromDevice>>
        | Awaited<ReturnType<typeof TransportWebSerial.createFromPort>>,
      btDevice?: BluetoothDevice,
      serialPort?: SerialPort,
      autoReconnectDuringSetup = false,
    ): number => {
      stopConnectionTasks(id);

      // Reuse existing meshDeviceId if available to prevent duplicate nodeDBs,
      // but only if the corresponding nodeDB still exists. Otherwise, generate a new ID.
      const conn = useDeviceStore
        .getState()
        .getSavedConnections()
        .find((c) => c.id === id);
      let deviceId = conn?.meshDeviceId;
      if (deviceId && !useNodeDBStore.getState().getNodeDB(deviceId)) {
        deviceId = undefined;
      }
      deviceId = deviceId ?? randId();
      const linkedDeviceId = deviceId;

      const device = addDevice(deviceId);
      const nodeDB = addNodeDB(deviceId);
      const messageStore = addMessageStore(deviceId);
      const meshDevice = new MeshDevice(transport, deviceId);
      const getCurrentRuntimeState = () => {
        const state = useDeviceStore.getState();
        const currentConnection = state
          .getSavedConnections()
          .find((connection) => connection.id === id);
        const currentDevice = state.getDevice(linkedDeviceId);

        return { currentConnection, currentDevice };
      };
      const isCurrentRuntimeConfigured = () => {
        const { currentConnection, currentDevice } = getCurrentRuntimeState();

        return (
          currentConnection?.status === "configured" ||
          currentDevice?.connectionPhase === "configured"
        );
      };
      const shouldReconnectAfterRuntimeDisconnect = (currentConnection: Connection) =>
        shouldAutoReconnect(currentConnection) &&
        !userDisconnects.has(id) &&
        (autoReconnectDuringSetup || isCurrentRuntimeConfigured());
      const handleRuntimeDisconnect = () => {
        const currentConnection = useDeviceStore
          .getState()
          .getSavedConnections()
          .find((connection) => connection.id === id);

        if (!currentConnection || userDisconnects.has(id)) {
          return;
        }

        const shouldReconnect = shouldReconnectAfterRuntimeDisconnect(currentConnection);
        if (!shouldReconnect && !isCurrentRuntimeConfigured()) {
          device.setConnectionPhase("disconnected");
          updateStatus(id, "error", CONNECTION_LOST_MESSAGE);
          resetConnectionReconnect(id);
          return;
        }

        if (currentConnection.status === "error" || currentConnection.status === "reconnecting") {
          if (shouldReconnect) {
            scheduleConnectionReconnect(id);
          }
          return;
        }

        markConnectionLost(id, getConnectionLostMessage(currentConnection));
        if (shouldReconnect) {
          scheduleConnectionReconnect(id);
        }
      };
      const handleHeartbeatFailure = (error: unknown, label: string) => {
        const currentConnection = useDeviceStore
          .getState()
          .getSavedConnections()
          .find((connection) => connection.id === id);

        if (!currentConnection || userDisconnects.has(id)) {
          return;
        }

        const shouldReconnect = shouldReconnectAfterRuntimeDisconnect(currentConnection);
        if (!shouldReconnect && !isCurrentRuntimeConfigured()) {
          const message = error instanceof Error ? error.message : CONNECTION_LOST_MESSAGE;
          device.setConnectionPhase("disconnected");
          updateStatus(id, "error", message);
          resetConnectionReconnect(id);
          console.warn(`[useConnections] ${label}:`, error);
          return;
        }

        markConnectionLost(id, getConnectionLostMessage(currentConnection));
        if (shouldReconnect) {
          scheduleConnectionReconnect(id);
        }
        console.warn(`[useConnections] ${label}:`, error);
      };

      setSelectedDevice(deviceId);
      device.addConnection(meshDevice); // This stores meshDevice in Device.connection
      subscribeAll(device, meshDevice, messageStore, nodeDB);

      // Store transport locally for cleanup (BT/Serial only)
      const transportHandle = btDevice ?? serialPort;
      if (transportHandle) {
        transports.set(id, transportHandle);
      }

      // Set active connection and link device bidirectionally
      const isReconnectAttempt = conn?.status === "reconnecting";
      setActiveConnectionId(id);
      device.setConnectionId(id);
      device.setConnectionPhase("configuring");
      updateStatus(id, isReconnectAttempt ? "reconnecting" : "configuring");

      // Listen for config complete event (with nonce/ID)
      const unsubConfigComplete = meshDevice.events.onConfigComplete.subscribe(
        (configCompleteId) => {
          console.log(`[useConnections] Configuration complete with ID: ${configCompleteId}`);
          device.setConnectionPhase("configured");
          updateStatus(id, "configured");

          // Switch from fast config heartbeat to slow maintenance heartbeat
          console.log(`[useConnections] Switching to maintenance heartbeat (5 min interval)`);
          replaceHeartbeat(
            id,
            setInterval(() => {
              meshDevice.heartbeat().catch((error) => {
                handleHeartbeatFailure(error, "Heartbeat failed");
              });
            }, HEARTBEAT_INTERVAL_MS),
          );
        },
      );
      const unsubDeviceStatus = meshDevice.events.onDeviceStatus.subscribe((status) => {
        if (status === Types.DeviceStatusEnum.DeviceDisconnected) {
          handleRuntimeDisconnect();
        }
      });
      connectionSubscriptions.set(id, () => {
        unsubConfigComplete();
        unsubDeviceStatus();
      });

      window.setTimeout(() => {
        const currentConnection = useDeviceStore
          .getState()
          .getSavedConnections()
          .find((connection) => connection.id === id);
        if (
          !currentConnection ||
          (currentConnection.status !== "configuring" &&
            currentConnection.status !== "reconnecting")
        ) {
          return;
        }

        console.log("[useConnections] Starting configuration");

        meshDevice
          .configure()
          .then(() => {
            if (userDisconnects.has(id) || isCurrentRuntimeConfigured()) {
              console.log(
                "[useConnections] Configuration request settled after config complete; keeping maintenance heartbeat",
              );
              return;
            }

            console.log(
              "[useConnections] Configuration request settled, starting config heartbeat",
            );
            // Send initial heartbeat after configure completes
            meshDevice
              .heartbeat()
              .then(() => {
                if (userDisconnects.has(id) || isCurrentRuntimeConfigured()) {
                  return;
                }

                // Start fast heartbeat after first successful heartbeat
                replaceHeartbeat(
                  id,
                  setInterval(() => {
                    meshDevice.heartbeat().catch((error) => {
                      handleHeartbeatFailure(error, "Config heartbeat failed");
                    });
                  }, CONFIG_HEARTBEAT_INTERVAL_MS),
                );
                console.log(
                  `[useConnections] Heartbeat started for connection ${id} (5s interval during config)`,
                );
              })
              .catch((error) => {
                handleHeartbeatFailure(error, "Initial heartbeat failed");
              });
          })
          .catch((error) => {
            const currentConnection = useDeviceStore
              .getState()
              .getSavedConnections()
              .find((connection) => connection.id === id);
            if (
              currentConnection &&
              autoReconnectDuringSetup &&
              shouldAutoReconnect(currentConnection) &&
              !userDisconnects.has(id)
            ) {
              handleRuntimeDisconnect();
              return;
            }

            console.error(`[useConnections] Failed to configure:`, error);
            device.setConnectionPhase("disconnected");
            updateStatus(id, "error", error.message);
          });
      }, 0);

      updateSavedConnection(id, { meshDeviceId: deviceId });
      return deviceId;
    },
    [
      addDevice,
      addNodeDB,
      addMessageStore,
      setSelectedDevice,
      setActiveConnectionId,
      stopConnectionTasks,
      markConnectionLost,
      scheduleConnectionReconnect,
      updateSavedConnection,
      updateStatus,
    ],
  );

  const connect = useCallback(
    async (id: ConnectionId, opts?: ConnectOptions) => {
      const conn = useDeviceStore
        .getState()
        .getSavedConnections()
        .find((c) => c.id === id);
      if (!conn) {
        return false;
      }
      const linkedDevice = conn.meshDeviceId
        ? useDeviceStore.getState().getDevice(conn.meshDeviceId)
        : undefined;
      const isRuntimeConnected =
        linkedDevice?.connectionPhase === "configured" &&
        linkedDevice.status !== Types.DeviceStatusEnum.DeviceDisconnected;
      if ((conn.status === "configured" || conn.status === "connected") && isRuntimeConnected) {
        return true;
      }

      userDisconnects.delete(id);
      if (!opts?.background) {
        resetConnectionReconnect(id);
      }
      const nextStatus: ConnectionStatus =
        opts?.reconnect || opts?.background || conn.status === "error"
          ? "reconnecting"
          : "connecting";
      linkedDevice?.setConnectionPhase("connecting");
      updateStatus(id, nextStatus);
      try {
        if (conn.type === "http") {
          const ok = await testHttpReachable(conn.url);
          if (!ok) {
            const url = new URL(conn.url);
            const isHTTPS = url.protocol === "https:";
            const message = isHTTPS
              ? `Cannot reach HTTPS endpoint. If using a self-signed certificate, open ${conn.url} in a new tab, accept the certificate warning, then try connecting again.`
              : "HTTP endpoint not reachable (may be blocked by CORS)";
            throw new Error(message);
          }

          const url = new URL(conn.url);
          const isTLS = url.protocol === "https:";
          const transport = await TransportHTTP.create(url.host, isTLS);
          setupMeshDevice(id, transport, undefined, undefined, opts?.background);
          clearConnectionReconnect(id);
          // Status will be set to "configured" by onConfigComplete event
          return true;
        }

        if (conn.type === "tcp") {
          const transport = await TransportTCPBridge.create(conn.host, conn.port);
          setupMeshDevice(id, transport, undefined, undefined, opts?.background);
          clearConnectionReconnect(id);
          return true;
        }

        if (conn.type === "bluetooth") {
          if (!("bluetooth" in navigator)) {
            throw new Error("Web Bluetooth not supported");
          }
          let bleDevice = transports.get(id) as BluetoothDevice | undefined;
          if (!bleDevice) {
            // Try to recover permitted devices
            const getDevices = (
              navigator.bluetooth as Navigator["bluetooth"] & {
                getDevices?: () => Promise<BluetoothDevice[]>;
              }
            ).getDevices;

            if (getDevices) {
              const known = await getDevices();
              if (known && known.length > 0 && conn.deviceId) {
                bleDevice = known.find((d: BluetoothDevice) => d.id === conn.deviceId);
              }
            }
          }
          if (!bleDevice && opts?.allowPrompt) {
            // Prompt user to reselect (filter by optional service if provided)
            bleDevice = await navigator.bluetooth.requestDevice({
              acceptAllDevices: !conn.gattServiceUUID,
              optionalServices: conn.gattServiceUUID ? [conn.gattServiceUUID] : undefined,
              filters: conn.gattServiceUUID ? [{ services: [conn.gattServiceUUID] }] : undefined,
            });
          }
          if (!bleDevice) {
            throw new Error("Bluetooth device not available. Re-select the device.");
          }

          const transport = await TransportWebBluetooth.createFromDevice(bleDevice);
          setupMeshDevice(id, transport, bleDevice, undefined, opts?.background);
          setBluetoothDisconnectListener(id, bleDevice, () => handleBluetoothGattDisconnect(id));
          clearConnectionReconnect(id);

          // Status will be set to "configured" by onConfigComplete event
          return true;
        }

        if (conn.type === "serial") {
          if (!("serial" in navigator)) {
            throw new Error("Web Serial not supported");
          }
          let port = transports.get(id) as SerialPort | undefined;
          if (!port) {
            // Find a previously granted port by vendor/product
            const ports: SerialPort[] = await (
              navigator as Navigator & {
                serial: { getPorts: () => Promise<SerialPort[]> };
              }
            ).serial.getPorts();
            if (ports && conn.usbVendorId && conn.usbProductId) {
              port = ports.find((p: SerialPort) => {
                const info =
                  (
                    p as SerialPort & {
                      getInfo?: () => {
                        usbVendorId?: number;
                        usbProductId?: number;
                      };
                    }
                  ).getInfo?.() ?? {};
                return (
                  info.usbVendorId === conn.usbVendorId && info.usbProductId === conn.usbProductId
                );
              });
            }
          }
          if (!port && opts?.allowPrompt) {
            port = await (
              navigator as Navigator & {
                serial: {
                  requestPort: (options: Record<string, unknown>) => Promise<SerialPort>;
                };
              }
            ).serial.requestPort({});
          }
          if (!port) {
            throw new Error("Serial port not available. Re-select the port.");
          }

          // Ensure the port is closed before opening it
          const portWithStreams = port as SerialPort & {
            readable: ReadableStream | null;
            writable: WritableStream | null;
            close: () => Promise<void>;
          };
          if (portWithStreams.readable || portWithStreams.writable) {
            try {
              await portWithStreams.close();
              await new Promise((resolve) => setTimeout(resolve, 100));
            } catch (err) {
              console.warn("Error closing port before reconnect:", err);
            }
          }

          const transport = await TransportWebSerial.createFromPort(port);
          setupMeshDevice(id, transport, undefined, port, opts?.background);
          clearConnectionReconnect(id);
          // Status will be set to "configured" by onConfigComplete event
          return true;
        }
      } catch (err: unknown) {
        const isExpectedReconnect = isExpectedReconnectActive(conn);
        const message =
          opts?.background && isExpectedReconnect
            ? EXPECTED_RECONNECT_MESSAGE
            : opts?.background && conn.type === "bluetooth"
              ? BLUETOOTH_RECONNECT_MESSAGE
              : err instanceof Error
                ? err.message
                : String(err);
        const currentConnection =
          useDeviceStore
            .getState()
            .getSavedConnections()
            .find((connection) => connection.id === id) ?? conn;
        const reconnectTimedOut = hasConnectionReconnectTimedOut(id, currentConnection);
        const needsPrompt = isPromptRequiredReconnectError(err);
        const canContinueAutomaticReconnect =
          Boolean(opts?.background) || isExpectedReconnectActive(currentConnection);
        const shouldReconnect =
          canContinueAutomaticReconnect &&
          shouldAutoReconnect(currentConnection) &&
          !userDisconnects.has(id) &&
          !reconnectTimedOut &&
          !needsPrompt;
        updateStatus(
          id,
          shouldReconnect ? "reconnecting" : "error",
          reconnectTimedOut ? getReconnectTimeoutMessage(currentConnection) : message,
        );
        if (shouldReconnect) {
          scheduleConnectionReconnect(id);
        } else {
          resetConnectionReconnect(id);
        }
        return false;
      }
      return false;
    },
    [handleBluetoothGattDisconnect, scheduleConnectionReconnect, setupMeshDevice, updateStatus],
  );
  connectRef.current = connect;

  const disconnect = useCallback(
    async (id: ConnectionId) => {
      const conn = connections.find((c) => c.id === id);
      if (!conn) {
        return;
      }
      userDisconnects.add(id);
      resetConnectionReconnect(id);
      removeBluetoothDisconnectListener(id);

      try {
        stopConnectionTasks(id);

        // Get device and meshDevice from Device.connection
        if (conn.meshDeviceId) {
          const { getDevice } = useDeviceStore.getState();
          const device = getDevice(conn.meshDeviceId);

          if (device?.connection) {
            // Disconnect MeshDevice
            try {
              await device.connection.disconnect();
            } catch {
              // Ignore errors
            }
          }

          // Close transport connections
          const transport = transports.get(id);
          if (transport) {
            if (conn.type === "bluetooth") {
              const dev = transport as BluetoothDevice;
              if (dev.gatt?.connected) {
                dev.gatt.disconnect();
              }
            }
            if (conn.type === "serial") {
              const port = transport as SerialPort & {
                close?: () => Promise<void>;
                readable?: ReadableStream | null;
              };
              if (port.close && port.readable) {
                try {
                  await port.close();
                } catch (err) {
                  console.warn("Error closing serial port:", err);
                }
              }
            }
          }

          // Clear the device's connectionId link
          if (device) {
            device.setConnectionId(null);
            device.setConnectionPhase("disconnected");
            device.setStatus(Types.DeviceStatusEnum.DeviceDisconnected);
          }
        }
      } finally {
        updateSavedConnection(id, {
          status: "disconnected",
          error: undefined,
          expectedReconnectUntil: undefined,
          expectedReconnectReason: undefined,
        });
      }
    },
    [connections, stopConnectionTasks, updateSavedConnection],
  );

  const addConnection = useCallback(
    (input: NewConnection, btDevice?: BluetoothDevice) => {
      const conn = createConnectionFromInput(input);
      addSavedConnection(conn);
      if (btDevice && conn.type === "bluetooth") {
        transports.set(conn.id, btDevice);
      }
      return conn;
    },
    [addSavedConnection],
  );

  const addConnectionAndConnect = useCallback(
    async (input: NewConnection, btDevice?: BluetoothDevice) => {
      const conn = addConnection(input, btDevice);
      await connect(conn.id, { allowPrompt: true });
      // Get updated connection from store after connect
      if (conn.id) {
        return conn;
      }
    },
    [addConnection, connect],
  );

  const refreshStatuses = useCallback(async () => {
    // Check reachability/availability without auto-connecting
    // HTTP: test endpoint reachability
    // TCP: test the local WebSocket bridge to the Meshtastic TCP port
    // Bluetooth/Serial: check permission grants

    // HTTP connections: test reachability if not already connected/configured
    const httpChecks = connections
      .filter(
        (c): c is Connection & { type: "http"; url: string } =>
          c.type === "http" &&
          c.status !== "connected" &&
          c.status !== "configured" &&
          c.status !== "connecting" &&
          c.status !== "reconnecting" &&
          c.status !== "configuring",
      )
      .map(async (c) => {
        const ok = await testHttpReachable(c.url);
        updateSavedConnection(c.id, {
          status: ok ? "online" : "error",
        });
      });

    const tcpChecks = connections
      .filter(
        (c): c is Connection & { type: "tcp"; host: string; port: number } =>
          c.type === "tcp" &&
          c.status !== "connected" &&
          c.status !== "configured" &&
          c.status !== "connecting" &&
          c.status !== "reconnecting" &&
          c.status !== "configuring",
      )
      .map(async (c) => {
        const ok = await testTcpReachable(c.host, c.port);
        updateSavedConnection(c.id, {
          status: ok ? "online" : "error",
        });
      });

    // Bluetooth connections: check permission grants
    const btChecks = connections
      .filter(
        (c): c is Connection & { type: "bluetooth"; deviceId?: string } =>
          c.type === "bluetooth" &&
          c.status !== "connected" &&
          c.status !== "configured" &&
          c.status !== "connecting" &&
          c.status !== "reconnecting" &&
          c.status !== "configuring" &&
          c.status !== "error",
      )
      .map(async (c) => {
        if (!("bluetooth" in navigator)) {
          return;
        }
        try {
          const known = await (
            navigator.bluetooth as Navigator["bluetooth"] & {
              getDevices?: () => Promise<BluetoothDevice[]>;
            }
          ).getDevices?.();
          const hasPermission = known?.some((d: BluetoothDevice) => d.id === c.deviceId);
          updateSavedConnection(c.id, {
            status: hasPermission ? "online" : "disconnected",
          });
        } catch {
          // getDevices not supported or failed
          updateSavedConnection(c.id, { status: "disconnected" });
        }
      });

    // Serial connections: check permission grants
    const serialChecks = connections
      .filter(
        (
          c,
        ): c is Connection & {
          type: "serial";
          usbVendorId?: number;
          usbProductId?: number;
        } =>
          c.type === "serial" &&
          c.status !== "connected" &&
          c.status !== "configured" &&
          c.status !== "connecting" &&
          c.status !== "reconnecting" &&
          c.status !== "configuring",
      )
      .map(async (c) => {
        if (!("serial" in navigator)) {
          return;
        }
        try {
          const ports: SerialPort[] = await (
            navigator as Navigator & {
              serial: { getPorts: () => Promise<SerialPort[]> };
            }
          ).serial.getPorts();
          const hasPermission = ports.some((p: SerialPort) => {
            const info =
              (
                p as SerialPort & {
                  getInfo?: () => {
                    usbVendorId?: number;
                    usbProductId?: number;
                  };
                }
              ).getInfo?.() ?? {};
            return info.usbVendorId === c.usbVendorId && info.usbProductId === c.usbProductId;
          });
          updateSavedConnection(c.id, {
            status: hasPermission ? "online" : "disconnected",
          });
        } catch {
          // getPorts failed
          updateSavedConnection(c.id, { status: "disconnected" });
        }
      });

    await Promise.all([...httpChecks, ...tcpChecks, ...btChecks, ...serialChecks]);
  }, [connections, updateSavedConnection]);

  const syncConnectionStatuses = useCallback(() => {
    // Find which connection corresponds to the currently selected device
    const activeConnection = connections.find((c) => c.meshDeviceId === selectedDeviceId);

    // Update all connection statuses
    connections.forEach((conn) => {
      const shouldBeConnected = activeConnection?.id === conn.id;
      const isConnectedState =
        conn.status === "connected" ||
        conn.status === "configured" ||
        conn.status === "connecting" ||
        conn.status === "reconnecting" ||
        conn.status === "configuring";

      // Update status if it doesn't match reality
      if (!shouldBeConnected && isConnectedState) {
        updateSavedConnection(conn.id, { status: "disconnected" });
      }
      // Don't force status to "connected" if shouldBeConnected - let the connection flow set the proper status
    });
  }, [connections, selectedDeviceId, updateSavedConnection]);

  return {
    connections,
    addConnection,
    addConnectionAndConnect,
    connect,
    disconnect,
    removeConnection,
    setDefaultConnection,
    refreshStatuses,
    syncConnectionStatuses,
  };
}
