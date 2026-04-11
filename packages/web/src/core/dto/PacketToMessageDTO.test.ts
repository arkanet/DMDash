import { MessageState, MessageType } from "@core/stores";
import type { Types } from "@meshtastic/core";
import { describe, expect, it } from "vitest";
import PacketToMessageDTO from "./PacketToMessageDTO.ts";

describe("PacketToMessageDTO", () => {
  it("preserves compressed packets and derives hop count", () => {
    const rxTime = new Date("2026-04-11T12:00:00Z");
    const packet = {
      channel: 0,
      to: 0xffffffff,
      from: 222,
      id: 12345,
      data: "Compressed hello",
      type: "broadcast",
      rxTime,
      compressed: true,
      hopStart: 4,
      hopLimit: 1,
    } as Types.PacketMetadata<string>;

    const message = new PacketToMessageDTO(packet, 111).toMessage();

    expect(message).toMatchObject({
      channel: 0,
      to: 0xffffffff,
      from: 222,
      messageId: 12345,
      message: "Compressed hello",
      type: MessageType.Broadcast,
      state: MessageState.Ack,
      compressed: true,
      hopsAway: 3,
    });
    expect(message.date).toBe(rxTime.getTime());
  });
});
