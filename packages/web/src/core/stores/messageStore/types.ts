import type { MessageState, MessageType } from "@core/stores";
import type { Types } from "@meshtastic/core";

type NodeNum = number;
type MessageId = number;
type ChannelId = Types.ChannelNumber;
type ConversationId = string;
type MessageLogMap = Map<MessageId, Message>;
interface MessageReaction {
  count: number;
  senders: NodeNum[];
}
type MessageReactions = Record<string, MessageReaction>;

interface MessageBase {
  channel: Types.ChannelNumber;
  to: number;
  from: number;
  date: number;
  messageId: number;
  state: MessageState;
  message: string;
  replyId?: number;
  hopsAway?: number;
  compressed?: boolean;
  reactions?: MessageReactions;
}

interface GenericMessage<T extends MessageType> extends MessageBase {
  type: T;
}

type Message = GenericMessage<MessageType.Direct> | GenericMessage<MessageType.Broadcast>;

type GetMessagesParams =
  | { type: MessageType.Direct; nodeA: NodeNum; nodeB: NodeNum }
  | { type: MessageType.Broadcast; channelId: ChannelId };

type SetMessageStateParams =
  | {
      type: MessageType.Direct;
      nodeA: NodeNum;
      nodeB: NodeNum;
      messageId: MessageId; // ID of the message within that chat
      newState?: MessageState; // Optional new state, defaults to Ack
    }
  | {
      type: MessageType.Broadcast;
      channelId: ChannelId;
      messageId: MessageId;
      newState?: MessageState; // Optional new state, defaults to Ack
    };

type ClearMessageParams =
  | {
      type: MessageType.Direct;
      nodeA: NodeNum;
      nodeB: NodeNum;
      messageId: MessageId;
    }
  | {
      type: MessageType.Broadcast;
      channelId: ChannelId;
      messageId: MessageId;
    };

function normalizeReaction(
  reaction: MessageReaction | number | undefined,
): MessageReaction | undefined {
  if (reaction === undefined) {
    return undefined;
  }

  if (typeof reaction === "number") {
    return {
      count: reaction,
      senders: [],
    };
  }

  const senders = Array.from(new Set(reaction.senders ?? []));

  return {
    count: Math.max(reaction.count ?? 0, senders.length),
    senders,
  };
}

function normalizeMessageReactions(
  reactions: Record<string, MessageReaction | number> | undefined,
): MessageReactions | undefined {
  if (!reactions) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(reactions)
      .map(([emoji, reaction]) => [emoji, normalizeReaction(reaction)])
      .filter((entry): entry is [string, MessageReaction] => entry[1] !== undefined),
  );
}

export type {
  ChannelId,
  ClearMessageParams,
  ConversationId,
  GetMessagesParams,
  Message,
  MessageId,
  MessageLogMap,
  MessageReaction,
  MessageReactions,
  NodeNum,
  SetMessageStateParams,
};
export { normalizeMessageReactions, normalizeReaction };
