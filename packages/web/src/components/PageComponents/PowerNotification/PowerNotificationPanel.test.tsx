import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import PowerNotificationPanel from "./PowerNotificationPanel";
import { vi } from "vitest";

// Mock stores
vi.mock("@core/stores", () => ({
  useAppStore: (sel: any) => sel({ selectedDeviceId: 1 }),
}));

const addScheduleMock = vi.fn();
const removeScheduleMock = vi.fn();
vi.mock("@app/darkmesh/store.ts", () => ({
  useDarkMeshStore: (sel: any) =>
    sel({
      addSchedule: addScheduleMock,
      removeSchedule: removeScheduleMock,
    }),
}));

describe("PowerNotificationPanel UI", () => {
  beforeEach(() => {
    localStorage.clear();
    addScheduleMock.mockClear();
    removeScheduleMock.mockClear();
  });

  it("renders recurrence selector and destination filter", () => {
    render(
      <PowerNotificationPanel
        destinationOptions={[
          { label: "Primary broadcast", value: "broadcast:0" },
          { label: "Alice", value: "direct:123" },
        ]}
      />,
    );

    expect(screen.getByText("Recurrence")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search channels or contacts")).toBeInTheDocument();
  });

  it("filters destination options via search", () => {
    render(
      <PowerNotificationPanel
        destinationOptions={[
          { label: "Primary broadcast", value: "broadcast:0" },
          { label: "Alice", value: "direct:123" },
        ]}
      />,
    );

    const input = screen.getByPlaceholderText("Search channels or contacts");
    fireEvent.change(input, { target: { value: "alice" } });

    // after filtering, the options should include Alice and not Primary broadcast
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.queryByText("Primary broadcast")).toBeNull();
  });

  it("adds a scheduled message and calls addSchedule", () => {
    render(
      <PowerNotificationPanel
        destinationOptions={[
          { label: "Primary broadcast", value: "broadcast:0" },
          { label: "Alice", value: "direct:123" },
        ]}
      />,
    );

    const textarea = screen.getByLabelText("Message (max 200 chars)");
    const addBtn = screen.getByText("Add rule");

    fireEvent.change(textarea, { target: { value: "Hello world" } });
    fireEvent.click(addBtn);

    // local rules should show up
    expect(screen.getByText("Hello world")).toBeInTheDocument();

    // addSchedule should have been called once
    expect(addScheduleMock).toHaveBeenCalled();
  });

  it("removes a scheduled message after confirmation and calls removeSchedule", () => {
    // mock confirm to true
    const origConfirm = window.confirm;
    window.confirm = () => true;

    render(
      <PowerNotificationPanel
        destinationOptions={[
          { label: "Primary broadcast", value: "broadcast:0" },
          { label: "Alice", value: "direct:123" },
        ]}
      />,
    );

    const textarea = screen.getByLabelText("Message (max 200 chars)");
    const addBtn = screen.getByText("Add rule");

    fireEvent.change(textarea, { target: { value: "To be removed" } });
    fireEvent.click(addBtn);

    const removeBtn = screen.getByText("Remove");
    fireEvent.click(removeBtn);

    expect(removeScheduleMock).toHaveBeenCalled();

    window.confirm = origConfirm;
  });
});
