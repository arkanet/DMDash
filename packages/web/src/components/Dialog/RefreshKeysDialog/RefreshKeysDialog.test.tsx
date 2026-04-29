import { CurrentDeviceContext, useDeviceStore } from "@core/stores";
import { render } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { RefreshKeysDialog } from "./RefreshKeysDialog.tsx";
import { useRefreshKeysDialog } from "./useRefreshKeysDialog.ts";

vi.mock("./useRefreshKeysDialog");

const mockUseRefreshKeysDialog = vi.mocked(useRefreshKeysDialog);

const getInitialState = () =>
  useDeviceStore.getInitialState?.() ?? {
    devices: new Map(),
    remoteDevices: new Map(),
  };

beforeEach(() => {
  useDeviceStore.setState(getInitialState(), true);
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

test("does not render dialog if no error exists for the refresh-keys target node", () => {
  const deviceId = 1;
  const refreshKeysNodeNum = 54321;

  const device = useDeviceStore.getState().addDevice(deviceId);
  device.setRefreshKeysNodeNum(refreshKeysNodeNum);

  mockUseRefreshKeysDialog.mockReturnValue({
    handleCloseDialog: vi.fn(),
    handleNodeRemove: vi.fn(),
  });

  const { container } = render(
    <CurrentDeviceContext.Provider value={{ deviceId }}>
      <RefreshKeysDialog open onOpenChange={vi.fn()} />
    </CurrentDeviceContext.Provider>,
  );

  expect(container.firstChild).toBeNull();
});
