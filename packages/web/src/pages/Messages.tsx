import { messagesWithParamsRoute } from "@app/routes.tsx";
import { GatewayHeader } from "@components/PageComponents/DarkMesh/GatewayHeader.tsx";
import { ChannelChat } from "@components/PageComponents/Messages/ChannelChat.tsx";
import { MessageInput } from "@components/PageComponents/Messages/MessageInput.tsx";
// mention auto-insert disabled; buildNodeMention intentionally unused
import { PageLayout } from "@components/PageLayout.tsx";
import { Sidebar } from "@components/Sidebar.tsx";
import { Avatar } from "@components/UI/Avatar.tsx";
import { Input } from "@components/UI/Input.tsx";
import { SidebarButton } from "@components/UI/Sidebar/SidebarButton.tsx";
import { SidebarSection } from "@components/UI/Sidebar/SidebarSection.tsx";
import { useToast } from "@core/hooks/useToast.ts";
import {
  MessageState,
  MessageType,
  useDevice,
  useNodeDB,
  useSidebar,
  useMessages,
  useMessageStore,
} from "@core/stores";
import { getConversationId } from "@core/stores/messageStore";
import { useDeviceContext } from "@core/hooks/useDeviceContext";
import { cn } from "@core/utils/cn.ts";
import { randId } from "@core/utils/randId.ts";
import { Protobuf, Types, Constants } from "@meshtastic/core";
import { useNavigate, useParams } from "@tanstack/react-router";
import { HashIcon, LockIcon, LockOpenIcon } from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getChannelName } from "../components/PageComponents/Channels/Channels.tsx";
import type { Message } from "../core/stores/messageStore/types.ts";

type NodeInfoWithUnread = Protobuf.Mesh.NodeInfo & { unreadCount: number };

function getCompressionPreferenceKey(chatType: MessageType, chatId: number) {
  if (chatType === MessageType.Direct) {
    return `${Types.ChannelNumber.Primary}${chatId}`;
  }

  return `${chatId}${Constants.broadcastNum}`;
}

function SelectMessageChat() {
  const { t } = useTranslation("messages");
  return (
    <div className="flex-1 flex items-center justify-center text-slate-500 p-4">
      {t("selectChatPrompt.text", { ns: "messages" })}
    </div>
  );
}

export const MessagesPage = () => {
  const { channels, getUnreadCount, resetUnread, connection } = useDevice();
  const { getNodes, getNode, getMyNode, hasNodeError } = useNodeDB();

  const { setMessageState } = useMessages();
  const { deviceId } = useDeviceContext();

  const { type, chatId } = useParams({ from: messagesWithParamsRoute.id });

  const navigate = useNavigate();
  const { toast } = useToast();
  const { isCollapsed } = useSidebar();
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [replyTo, setReplyTo] = useState<Message | undefined>();
  const [mentionOpen, setMentionOpen] = useState<boolean>(false);
  const { t } = useTranslation(["messages", "channels", "ui"]);
  const deferredSearch = useDeferredValue(searchTerm);

  const navigateToChat = useCallback(
    (type: MessageType, id: string) => {
      const typeParam = type === MessageType.Direct ? "direct" : "broadcast";
      navigate({ to: `/messages/${typeParam}/${id}` });
    },
    [navigate],
  );

  const chatType = type === "direct" ? MessageType.Direct : MessageType.Broadcast;
  const numericChatId = Number(chatId);

  const allChannels = Array.from(channels.values());
  const filteredChannels = allChannels.filter(
    (ch) => ch.role !== Protobuf.Channel.Channel_Role.DISABLED,
  );

  useEffect(() => {
    if (!type && !chatId && filteredChannels.length > 0) {
      const defaultChannel = filteredChannels[0];
      navigateToChat(MessageType.Broadcast, defaultChannel?.index.toString() ?? "0");
    }
  }, [type, chatId, filteredChannels, navigateToChat]);

  useEffect(() => {
    setReplyTo(undefined);
  }, [chatType, numericChatId]);

  const currentChannel = channels.get(numericChatId);
  const otherNode = getNode(numericChatId);
  const myNode = getMyNode();
  const myNodeNum = myNode?.num;

  const isDirect = chatType === MessageType.Direct;
  const isBroadcast = chatType === MessageType.Broadcast;

  // Subscribe to the message MAP (stable reference) and derive an array via useMemo.
  const selectedMessageMap = useMessageStore((s) => {
    const ms = s.messageStores.get(deviceId as number);
    if (!ms) return undefined as Map<number, Message> | undefined;

    if (isBroadcast) {
      return ms.messages.broadcast.get(numericChatId) as Map<number, Message> | undefined;
    }

    if (isDirect && myNodeNum !== undefined) {
      const convId = getConversationId(myNodeNum, numericChatId);
      return ms.messages.direct.get(convId) as Map<number, Message> | undefined;
    }

    return undefined;
  });

  const currentMessages = useMemo(() => {
    if (!selectedMessageMap) return [] as Message[];
    const arr = Array.from(selectedMessageMap.values());
    arr.sort(
      (a, b) =>
        (typeof a.date === "number" ? a.date : Date.parse(String(a.date))) -
        (typeof b.date === "number" ? b.date : Date.parse(String(b.date))),
    );
    return arr.reverse();
  }, [selectedMessageMap]);

  const compressionPreferenceKey = useMemo(() => {
    if (!isBroadcast && !isDirect) {
      return undefined;
    }

    return getCompressionPreferenceKey(chatType, numericChatId);
  }, [chatType, isBroadcast, isDirect, numericChatId]);

  const compressionAutoSignal = useMemo(
    () =>
      currentMessages.reduce<number | undefined>((latestMessageId, message) => {
        if (!message.compressed || message.from === myNodeNum) {
          return latestMessageId;
        }

        return latestMessageId === undefined || message.messageId > latestMessageId
          ? message.messageId
          : latestMessageId;
      }, undefined),
    [currentMessages, myNodeNum],
  );

  // replyMentionToken removed: avoid auto-inserting mention tokens when starting a reply

  const filteredNodes = useCallback((): NodeInfoWithUnread[] => {
    const lowerCaseSearchTerm = deferredSearch.toLowerCase();

    return getNodes((node: Protobuf.Mesh.NodeInfo) => {
      const longName = node.user?.longName?.toLowerCase() ?? "";
      const shortName = node.user?.shortName?.toLowerCase() ?? "";
      return longName.includes(lowerCaseSearchTerm) || shortName.includes(lowerCaseSearchTerm);
    }, true)
      .map((node: Protobuf.Mesh.NodeInfo) => ({
        ...node,
        unreadCount: getUnreadCount(node.num) ?? 0,
      }))
      .sort((a: NodeInfoWithUnread, b: NodeInfoWithUnread) => {
        const diff = b.unreadCount - a.unreadCount;
        if (diff !== 0) {
          return diff;
        }
        return Number(b.isFavorite) - Number(a.isFavorite);
      });
  }, [deferredSearch, getNodes, getUnreadCount]);

  const sendText = useCallback(
    async (message: string, opts?: { compress?: boolean }) => {
      if (isDirect && myNodeNum === undefined) {
        toast({
          title: "Unable to resolve the local node for this direct chat",
        });
        return;
      }

      const toValue = isDirect ? numericChatId : MessageType.Broadcast;
      const channelValue = isDirect ? Types.ChannelNumber.Primary : numericChatId;
      const contactKey = getCompressionPreferenceKey(chatType, numericChatId);

      let messageId: number | undefined;

      try {
        if (opts?.compress) {
          try {
            if (typeof window !== "undefined" && window.localStorage) {
              window.localStorage.setItem(`compressionPrefs:${contactKey}`, "true");
            }
          } catch {
            // ignore storage errors
          }
          messageId = await connection?.sendMessage(message, contactKey, replyTo?.messageId);
        } else {
          // If user explicitly disabled compression for this contact, remove stored preference
          try {
            if (typeof window !== "undefined" && window.localStorage) {
              window.localStorage.removeItem(`compressionPrefs:${contactKey}`);
            }
          } catch {
            // ignore
          }
          messageId = await connection?.sendText(
            message,
            toValue,
            true,
            channelValue,
            replyTo?.messageId,
          );
        }
        if (messageId !== undefined) {
          if (chatType === MessageType.Broadcast) {
            setMessageState({
              type: MessageType.Broadcast,
              channelId: channelValue,
              messageId,
              newState: MessageState.Ack,
            });
          } else if (myNodeNum !== undefined) {
            setMessageState({
              type: MessageType.Direct,
              nodeA: myNodeNum,
              nodeB: numericChatId,
              messageId,
              newState: MessageState.Ack,
            });
          }
          setReplyTo(undefined);
        } else {
          console.warn("sendText completed but messageId is undefined");
        }
      } catch (e: unknown) {
        console.error("Failed to send message:", e);
        const failedId = messageId ?? randId();
        if (chatType === MessageType.Broadcast) {
          setMessageState({
            type: MessageType.Broadcast,
            channelId: channelValue,
            messageId: failedId,
            newState: MessageState.Failed,
          });
        } else if (myNodeNum !== undefined) {
          setMessageState({
            type: MessageType.Direct,
            nodeA: myNodeNum,
            nodeB: numericChatId,
            messageId: failedId,
            newState: MessageState.Failed,
          });
        }
      }
    },
    [
      chatType,
      connection,
      isDirect,
      myNodeNum,
      numericChatId,
      replyTo?.messageId,
      setMessageState,
      toast,
    ],
  );

  const renderChatContent = () => {
    switch (chatType) {
      case MessageType.Broadcast:
        return <ChannelChat messages={currentMessages} onReply={setReplyTo} onMention={handleMention} />;
      case MessageType.Direct:
        if (myNodeNum === undefined) {
          return <SelectMessageChat />;
        }
        return <ChannelChat messages={currentMessages} onReply={setReplyTo} onMention={handleMention} />;
      default:
        return <SelectMessageChat />;
    }
  };

  const leftSidebar = useMemo(
    () => (
      <Sidebar>
        <SidebarSection label={t("navigation.channels")} className="py-2 px-0">
          {filteredChannels?.map((channel) => (
            <SidebarButton
              key={channel.index}
              count={getUnreadCount(channel.index)}
              label={
                channel.settings?.name ||
                (channel.index === 0
                  ? t("page.broadcastLabel", { ns: "channels" })
                  : t("page.channelLabel", {
                    index: channel.index,
                    ns: "channels",
                  }))
              }
              active={numericChatId === channel.index && chatType === MessageType.Broadcast}
              onClick={() => {
                navigateToChat(MessageType.Broadcast, channel.index.toString());
                resetUnread(channel.index);
              }}
            >
              <HashIcon size={16} className={cn(isCollapsed ? "mr-0 mt-2" : "mr-2")} />
            </SidebarButton>
          ))}
        </SidebarSection>
      </Sidebar>
    ),
    [
      filteredChannels,
      numericChatId,
      chatType,
      isCollapsed,
      getUnreadCount,
      navigateToChat,
      resetUnread,
      t,
    ],
  );

  const rightSidebar = (
    <SidebarSection label="" className="px-0 flex flex-col h-full overflow-y-auto">
      <label className="p-2 block" htmlFor="nodeSearch">
        <Input
          type="text"
          name="nodeSearch"
          placeholder={t("search.nodes")}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          showClearButton={!!searchTerm}
        />
      </label>
      <div
        className={cn("flex flex-col h-full flex-1 overflow-y-auto gap-2.5 pt-1 ")}
        style={{ contentVisibility: "auto", containIntrinsicSize: "100px" }}
      >
        {filteredNodes()?.map((node) => (
          <SidebarButton
            key={node.num}
            preventCollapse
            label={node.user?.longName ?? t("unknown.shortName")}
            count={node.unreadCount > 0 ? node.unreadCount : undefined}
            active={numericChatId === node.num && chatType === MessageType.Direct}
            onClick={() => {
              navigateToChat(MessageType.Direct, node.num.toString());
              resetUnread(node.num);
            }}
          >
            <Avatar
              nodeNum={node.num}
              className={cn(hasNodeError(node.num) && "text-red-500")}
              showError={hasNodeError(node.num)}
              showFavorite={node.isFavorite}
              size="sm"
            />
          </SidebarButton>
        ))}
      </div>
    </SidebarSection>
  );

  const handleMention = (_msg: Message) => {
    // Open the mention selector in the input; insertion remains manual.
    setMentionOpen(true);
  };

  return (
    <PageLayout
      label={`${t("page.title", {
        interpolation: { escapeValue: false },
        chatName:
          isBroadcast && currentChannel
            ? getChannelName(currentChannel)
            : isDirect && otherNode
              ? (otherNode.user?.longName ?? t("unknown.longName"))
              : t("emptyState.title"),
      })} 
      `}
      rightBar={rightSidebar}
      leftBar={leftSidebar}
      headerContent={<GatewayHeader />}
      actions={
        isDirect && otherNode
          ? [
            {
              key: "encryption",
              icon: otherNode.user?.publicKey?.length ? LockIcon : LockOpenIcon,
              iconClasses: otherNode.user?.publicKey?.length
                ? "text-green-600"
                : "text-yellow-300",
              onClick() {
                toast({
                  title: otherNode.user?.publicKey?.length
                    ? t("toast.messages.pkiEncryption.title")
                    : t("toast.messages.pskEncryption.title"),
                });
              },
            },
          ]
          : []
      }
    >
      <div className="flex flex-1 flex-col overflow-hidden">
        {renderChatContent()}

        <div className="flex-none dark:bg-slate-900 p-2">
          {isBroadcast || isDirect ? (
            <MessageInput
              to={isDirect ? numericChatId : MessageType.Broadcast}
              onSend={sendText}
              maxBytes={200}
              replyTo={replyTo}
              onClearReply={() => setReplyTo(undefined)}
              mentionOpen={mentionOpen}
              onMentionHandled={() => setMentionOpen(false)}
              compressionPreferenceKey={compressionPreferenceKey}
              compressionAutoSignal={compressionAutoSignal}
            />
          ) : (
            <div className="p-4 text-center text-slate-400 italic">
              {t("sendMessage.sendButton", { ns: "messages" })}
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
};

export default MessagesPage;
