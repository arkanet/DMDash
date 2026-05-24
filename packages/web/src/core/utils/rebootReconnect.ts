import { EXPECTED_DEVICE_RECONNECT_TIMEOUT_MS } from "@core/constants/connection.ts";
import { useDeviceStore } from "@core/stores/deviceStore/index.ts";
import type { ConnectionId } from "@core/stores/deviceStore/types.ts";

const EXPECTED_REBOOT_DISCONNECT_ERROR_PATTERN =
  /bluetooth|gatt|disconnect|disconnected|closed|networkerror|notsupportederror|timeout|packet does not exist/i;

export function isExpectedRebootDisconnectError(error: unknown): boolean {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error ?? "");

  return EXPECTED_REBOOT_DISCONNECT_ERROR_PATTERN.test(message);
}

export function markExpectedDeviceReconnect(connectionId: ConnectionId, delayMs = 0): void {
  useDeviceStore.getState().updateSavedConnection(connectionId, {
    expectedReconnectUntil:
      Date.now() + Math.max(0, delayMs) + EXPECTED_DEVICE_RECONNECT_TIMEOUT_MS,
    expectedReconnectReason: "device-reboot",
  });
}

export function clearExpectedDeviceReconnect(connectionId: ConnectionId): void {
  useDeviceStore.getState().updateSavedConnection(connectionId, {
    expectedReconnectUntil: undefined,
    expectedReconnectReason: undefined,
  });
}
