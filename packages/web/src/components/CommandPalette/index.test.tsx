import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommandPalette } from "./index.tsx";

const mockSetCommandPaletteOpen = vi.fn();
const mockSetDialogOpen = vi.fn();
const mockTogglePinnedItem = vi.fn();

vi.mock("@core/stores", () => ({
  useAppStore: () => ({
    commandPaletteOpen: true,
    setCommandPaletteOpen: mockSetCommandPaletteOpen,
  }),
  useDevice: () => ({
    setDialogOpen: mockSetDialogOpen,
  }),
}));

vi.mock("@core/hooks/usePinnedItems.ts", () => ({
  usePinnedItems: () => ({
    pinnedItems: [],
    togglePinnedItem: mockTogglePinnedItem,
  }),
}));

describe("CommandPalette", () => {
  beforeEach(() => {
    mockSetCommandPaletteOpen.mockReset();
    mockSetDialogOpen.mockReset();
    mockTogglePinnedItem.mockReset();
  });

  it("shows only the contextual section with the requested commands", () => {
    render(<CommandPalette />);

    expect(screen.getByText("Contextual")).toBeInTheDocument();
    expect(screen.getByText("Node Import")).toBeInTheDocument();
    expect(screen.getByText("Schedule Shutdown")).toBeInTheDocument();
    expect(screen.getByText("Reboot Device")).toBeInTheDocument();
    expect(screen.getByText("Reset Node DB")).toBeInTheDocument();
    expect(screen.getByText("Factory Reset Device")).toBeInTheDocument();
    expect(screen.getByText("Factory Reset Config")).toBeInTheDocument();

    expect(screen.queryByText("Goto")).not.toBeInTheDocument();
    expect(screen.queryByText("Manage")).not.toBeInTheDocument();
    expect(screen.queryByText("Debug")).not.toBeInTheDocument();
    expect(screen.queryByText("QR Code")).not.toBeInTheDocument();
    expect(screen.queryByText("Enter DFU Mode")).not.toBeInTheDocument();
    expect(screen.queryByText("Disconnect")).not.toBeInTheDocument();
  });

  it("opens the node import dialog from the contextual section", () => {
    render(<CommandPalette />);

    fireEvent.click(screen.getByText("Node Import"));

    expect(mockSetDialogOpen).toHaveBeenCalledWith("nodeImport", true);
    expect(mockSetCommandPaletteOpen).toHaveBeenCalledWith(false);
  });
});
