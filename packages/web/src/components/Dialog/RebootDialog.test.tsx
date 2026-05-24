import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ButtonHTMLAttributes, ClassAttributes, InputHTMLAttributes, ReactNode } from "react";
import type { JSX } from "react/jsx-runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RebootDialog } from "./RebootDialog.tsx";

const rebootMock = vi.fn();
const rebootOtaMock = vi.fn();
const updateSavedConnectionMock = vi.fn();
let mockConnection:
  | {
      rebootOta: (delay: number) => Promise<number>;
      reboot: (delay: number) => Promise<number>;
    }
  | undefined = {
  reboot: rebootMock,
  rebootOta: rebootOtaMock,
};
let mockConnectionId: number | null = 42;

vi.mock("@core/stores", () => ({
  useDevice: () => ({
    connection: mockConnection,
    connectionId: mockConnectionId,
  }),
}));

vi.mock("@core/stores/deviceStore/index.ts", () => ({
  useDeviceStore: {
    getState: () => ({
      updateSavedConnection: updateSavedConnectionMock,
    }),
  },
}));

vi.mock("@components/UI/Button.tsx", async () => {
  const actual = await vi.importActual("@components/UI/Button.tsx");
  return {
    ...actual,
    Button: (
      props: JSX.IntrinsicAttributes &
        ClassAttributes<HTMLButtonElement> &
        ButtonHTMLAttributes<HTMLButtonElement>,
    ) => <button {...props} />,
  };
});

vi.mock("@components/UI/Input.tsx", async () => {
  const actual = await vi.importActual("@components/UI/Input.tsx");
  return {
    ...actual,
    Input: (
      props: JSX.IntrinsicAttributes &
        ClassAttributes<HTMLInputElement> &
        InputHTMLAttributes<HTMLInputElement>,
    ) => <input {...props} />,
  };
});

vi.mock("@components/UI/Dialog.tsx", () => {
  return {
    Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children: ReactNode }) => <h1>{children}</h1>,
    DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
    DialogClose: () => null,
  };
});

describe("RebootDialog", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    rebootMock.mockReset();
    rebootOtaMock.mockReset();
    updateSavedConnectionMock.mockReset();
    rebootMock.mockResolvedValue(1);
    rebootOtaMock.mockResolvedValue(1);
    mockConnection = { reboot: rebootMock, rebootOta: rebootOtaMock };
    mockConnectionId = 42;
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("renders dialog with default input value", () => {
    render(<RebootDialog open onOpenChange={() => {}} />);
    expect(screen.getByPlaceholderText(/enter delay/i)).toHaveValue(5);
    expect(screen.getByRole("heading", { name: /reboot device/i, level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reboot now/i })).toBeInTheDocument();
  });

  it("calls correct reboot function based on OTA checkbox state", () => {
    render(<RebootDialog open onOpenChange={() => {}} />);

    // Schedule non-OTA reboot
    act(() => {
      fireEvent.click(screen.getByTestId("scheduleRebootBtn"));
    });
    expect(rebootMock).toHaveBeenCalledWith(5);
    expect(rebootOtaMock).not.toHaveBeenCalled();

    rebootMock.mockClear();
    rebootOtaMock.mockClear();

    // Cancel scheduled
    act(() => {
      fireEvent.click(screen.getByTestId("cancelRebootBtn"));
    });
    expect(rebootMock).toHaveBeenCalledWith(-1);
    expect(rebootOtaMock).not.toHaveBeenCalled();

    rebootMock.mockClear();
    rebootOtaMock.mockClear();

    // Schedule OTA reboot
    act(() => {
      fireEvent.click(screen.getByText(/reboot into ota mode/i));
    });
    act(() => {
      fireEvent.click(screen.getByTestId("scheduleRebootBtn"));
    });
    expect(rebootOtaMock).toHaveBeenCalledWith(5);
    expect(rebootMock).not.toHaveBeenCalled();
  });

  it("schedules a reboot with delay and calls rebootOta", async () => {
    const onOpenChangeMock = vi.fn();
    render(<RebootDialog open onOpenChange={onOpenChangeMock} />);

    act(() => {
      fireEvent.change(screen.getByPlaceholderText(/enter delay/i), {
        target: { value: "3" },
      });
    });

    act(() => {
      fireEvent.click(screen.getByTestId("scheduleRebootBtn"));
    });

    expect(rebootMock).toHaveBeenCalledWith(3);

    expect(screen.getByText(/reboot has been scheduled/i)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(onOpenChangeMock).toHaveBeenCalledWith(false);
  });

  it("triggers a reboot-now request with the firmware-safe delay", async () => {
    const onOpenChangeMock = vi.fn();
    render(<RebootDialog open onOpenChange={onOpenChangeMock} />);

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /reboot now/i }));
    });

    expect(rebootMock).toHaveBeenCalledWith(5);
    expect(onOpenChangeMock).toHaveBeenCalledWith(false);
  });

  it("marks expected reconnect when rebooting and clears it when cancelling", async () => {
    vi.setSystemTime(new Date("2026-05-24T12:00:00.000Z"));
    const onOpenChangeMock = vi.fn();
    render(<RebootDialog open onOpenChange={onOpenChangeMock} />);

    act(() => {
      fireEvent.change(screen.getByPlaceholderText(/enter delay/i), {
        target: { value: "4" },
      });
    });
    act(() => {
      fireEvent.click(screen.getByTestId("scheduleRebootBtn"));
    });

    expect(updateSavedConnectionMock).toHaveBeenLastCalledWith(42, {
      expectedReconnectUntil: Date.now() + 4_000 + 60_000,
      expectedReconnectReason: "device-reboot",
    });

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    });

    expect(updateSavedConnectionMock).toHaveBeenLastCalledWith(42, {
      expectedReconnectUntil: undefined,
      expectedReconnectReason: undefined,
    });
  });

  it("does not report expected connection-loss errors during reboot", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    rebootMock.mockRejectedValue(new Error("Bluetooth GATT Server disconnected"));

    try {
      render(<RebootDialog open onOpenChange={() => {}} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /reboot now/i }));
        await Promise.resolve();
      });

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("does not call reboot if connection is undefined", async () => {
    const onOpenChangeMock = vi.fn();

    mockConnection = undefined;

    render(<RebootDialog open onOpenChange={onOpenChangeMock} />);

    act(() => {
      fireEvent.click(screen.getByTestId("scheduleRebootBtn"));
    });

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(rebootMock).not.toHaveBeenCalled();
    expect(rebootOtaMock).not.toHaveBeenCalled();
    expect(onOpenChangeMock).not.toHaveBeenCalled();
    expect(screen.queryByText(/reboot has been scheduled/i)).not.toBeInTheDocument();
  });

  it("cancels a scheduled reboot and calls rebootOta with -1", async () => {
    const onOpenChangeMock = vi.fn();
    render(<RebootDialog open onOpenChange={onOpenChangeMock} />);

    act(() => {
      fireEvent.change(screen.getByPlaceholderText(/enter delay/i), {
        target: { value: "4" },
      });
    });
    act(() => {
      fireEvent.click(screen.getByTestId("scheduleRebootBtn"));
    });
    expect(rebootMock).toHaveBeenCalledWith(4);

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    });
    expect(rebootMock).toHaveBeenCalledWith(-1);
    expect(screen.queryByText(/reboot has been scheduled/i)).not.toBeInTheDocument();
  });
});
