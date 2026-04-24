import { create } from "@bufbuild/protobuf";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Protobuf } from "@meshtastic/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NodeImportDialog } from "./NodeImportDialog.tsx";

const mockSendAdminMessage = vi.fn();
const mockAddNode = vi.fn();
const mockToast = vi.fn();
const mockParseSharedContactUrl = vi.fn();
const mockParseDmdbContents = vi.fn();
const mockCreateNodeInfoFromSharedContact = vi.fn();

vi.mock("@core/stores", () => ({
  useDevice: () => ({
    sendAdminMessage: mockSendAdminMessage,
  }),
  useNodeDB: () => ({
    addNode: mockAddNode,
  }),
}));

vi.mock("@core/hooks/useToast.ts", () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

vi.mock("../../darkmesh/utils.ts", () => ({
  parseSharedContactUrl: (...args: unknown[]) => mockParseSharedContactUrl(...args),
  parseDmdbContents: (...args: unknown[]) => mockParseDmdbContents(...args),
  createNodeInfoFromSharedContact: (...args: unknown[]) =>
    mockCreateNodeInfoFromSharedContact(...args),
}));

describe("NodeImportDialog", () => {
  const mockOnOpenChange = vi.fn();

  beforeEach(() => {
    mockOnOpenChange.mockReset();
    mockSendAdminMessage.mockReset();
    mockAddNode.mockReset();
    mockToast.mockReset();
    mockParseDmdbContents.mockReset();
    mockCreateNodeInfoFromSharedContact.mockReset();

    mockParseSharedContactUrl.mockImplementation((value: string) => {
      if (!value) {
        throw new Error("Missing input");
      }

      return create(Protobuf.Admin.SharedContactSchema, {
        nodeNum: 42,
        user: create(Protobuf.Mesh.UserSchema, {
          id: "!0000002a",
          longName: "Test Contact",
          shortName: "TC",
        }),
      });
    });

    mockCreateNodeInfoFromSharedContact.mockReturnValue(
      create(Protobuf.Mesh.NodeInfoSchema, {
        num: 42,
      }),
    );
  });

  it("shows a success toast after importing a shared contact", async () => {
    render(<NodeImportDialog open onOpenChange={mockOnOpenChange} />);

    fireEvent.change(screen.getByPlaceholderText("Insert URL"), {
      target: { value: "https://meshtastic.org/v/#mock" },
    });

    const applyButton = screen.getByRole("button", { name: "Apply" });

    await waitFor(() => {
      expect(applyButton).toBeEnabled();
    });

    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(mockSendAdminMessage).toHaveBeenCalledTimes(1);
      expect(mockAddNode).toHaveBeenCalledTimes(1);
      expect(mockToast).toHaveBeenCalledWith({
        title: "Contact imported",
        description: "The contact is now available in your node list.",
      });
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
