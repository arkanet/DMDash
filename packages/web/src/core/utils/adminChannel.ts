import { Protobuf, Types } from "@meshtastic/core";

type ChannelMap = Map<Types.ChannelNumber, Protobuf.Channel.Channel>;

export function getNamedAdminChannelIndex(channels: ChannelMap): Types.ChannelNumber | undefined {
  const adminChannel = Array.from(channels.values()).find(
    (channel) => channel.settings?.name?.trim().toLowerCase() === "admin",
  );

  return adminChannel?.index as Types.ChannelNumber | undefined;
}

export function resolveAdminChannelIndex(channels: ChannelMap): Types.ChannelNumber {
  return getNamedAdminChannelIndex(channels) ?? Types.ChannelNumber.Primary;
}
