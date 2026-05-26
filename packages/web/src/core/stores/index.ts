import { useDeviceContext } from "@core/hooks/useDeviceContext.ts";
import { type Device, useDeviceStore } from "@core/stores/deviceStore/index.ts";
import { type MessageStore, useMessageStore } from "@core/stores/messageStore/index.ts";
import { type NodeDB, useNodeDBStore } from "@core/stores/nodeDBStore/index.ts";
import { bindStoreToDevice } from "@core/stores/utils/bindStoreToDevice.ts";
import { clear as clearIdbKeyval } from "idb-keyval";

export {
  CurrentDeviceContext,
  type DeviceContext,
  useDeviceContext,
} from "@core/hooks/useDeviceContext";
export { useAppStore } from "@core/stores/appStore/index.ts";
export {
  MAX_DEBUG_LOGS,
  type DebugLogEntry,
  type DebugLogKind,
  useDebugStore,
} from "@core/stores/debugStore/index.ts";
export { type Device, useDeviceStore } from "@core/stores/deviceStore/index.ts";
export {
  useActiveConnection,
  useActiveConnectionId,
  useAddSavedConnection,
  useConnectionError,
  useConnectionForDevice,
  useConnectionStatus,
  useDefaultConnection,
  useDeviceForConnection,
  useFirstSavedConnection,
  useIsConnected,
  useIsConnecting,
  useRemoveSavedConnection,
  useSavedConnections,
  useUpdateSavedConnection,
} from "@core/stores/deviceStore/selectors.ts";
export type {
  Page,
  ValidConfigType,
  ValidModuleConfigType,
  WaypointWithMetadata,
} from "@core/stores/deviceStore/types.ts";
export {
  MessageState,
  type MessageStore,
  MessageType,
  useMessageStore,
} from "@core/stores/messageStore";
export { type NodeDB, useNodeDBStore } from "@core/stores/nodeDBStore/index.ts";
export type { NodeErrorType } from "@core/stores/nodeDBStore/types.ts";
export {
  SidebarProvider,
  useSidebar, // TODO: Bring hook into this file
} from "@core/stores/sidebarStore/index.tsx";

function clearDocumentCookies(): void {
  if (typeof document === "undefined") {
    return;
  }

  for (const cookie of document.cookie.split(";")) {
    const name = cookie.split("=")[0]?.trim();
    if (!name) {
      continue;
    }
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
}

export async function clearAllStores(): Promise<void> {
  const cleanupTasks: Promise<void>[] = [clearIdbKeyval()];

  if (typeof window !== "undefined") {
    try {
      window.localStorage.clear();
    } catch (error) {
      console.warn("Failed to clear localStorage", error);
    }

    try {
      window.sessionStorage.clear();
    } catch (error) {
      console.warn("Failed to clear sessionStorage", error);
    }
  }

  if (typeof caches !== "undefined") {
    cleanupTasks.push(
      caches
        .keys()
        .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
        .then(() => undefined),
    );
  }

  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    cleanupTasks.push(
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          Promise.all(registrations.map((registration) => registration.unregister())),
        )
        .then(() => undefined),
    );
  }

  clearDocumentCookies();
  await Promise.all(cleanupTasks);
}

// Define hooks to access the stores
export const useNodeDB = bindStoreToDevice(
  useNodeDBStore,
  (s, deviceId): NodeDB => s.getNodeDB(deviceId) ?? s.addNodeDB(deviceId),
);

export const useDevice = (): Device => {
  const { deviceId } = useDeviceContext();

  const device = useDeviceStore((s) => s.getDevice(deviceId) ?? s.addDevice(deviceId));
  return device;
};

export const useMessages = (): MessageStore => {
  const { deviceId } = useDeviceContext();

  const device = useMessageStore((s) => s.getMessageStore(deviceId) ?? s.addMessageStore(deviceId));
  return device;
};
