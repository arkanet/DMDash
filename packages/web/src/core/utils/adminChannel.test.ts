import { create } from "@bufbuild/protobuf";
import { Protobuf, Types } from "@meshtastic/core";
import { describe, expect, it } from "vitest";
import { getNamedAdminChannelIndex, resolveAdminChannelIndex } from "./adminChannel.ts";

function channel(index: Types.ChannelNumber, name: string): Protobuf.Channel.Channel {
  return create(Protobuf.Channel.ChannelSchema, {
    index,
    role: Protobuf.Channel.Channel_Role.SECONDARY,
    settings: create(Protobuf.Channel.ChannelSettingsSchema, {
      name,
    }),
  });
}

describe("adminChannel utilities", () => {
  it("returns the configured admin channel index", () => {
    const channels = new Map<Types.ChannelNumber, Protobuf.Channel.Channel>([
      [Types.ChannelNumber.Primary, channel(Types.ChannelNumber.Primary, "LongFast")],
      [Types.ChannelNumber.Channel2, channel(Types.ChannelNumber.Channel2, " Admin ")],
    ]);

    expect(getNamedAdminChannelIndex(channels)).toBe(Types.ChannelNumber.Channel2);
    expect(resolveAdminChannelIndex(channels)).toBe(Types.ChannelNumber.Channel2);
  });

  it("falls back to primary when no admin channel exists", () => {
    const channels = new Map<Types.ChannelNumber, Protobuf.Channel.Channel>([
      [Types.ChannelNumber.Channel1, channel(Types.ChannelNumber.Channel1, "secondary")],
    ]);

    expect(getNamedAdminChannelIndex(channels)).toBeUndefined();
    expect(resolveAdminChannelIndex(channels)).toBe(Types.ChannelNumber.Primary);
  });
});
