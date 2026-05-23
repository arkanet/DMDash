import { messagesWithParamsRoute } from "@app/routes.tsx";
import { GatewayHeader } from "@components/PageComponents/DarkMesh/GatewayHeader.tsx";
import { ChannelChat } from "@components/PageComponents/Messages/ChannelChat.tsx";
import {
  MessageInput,
  type MessageInputHandle,
} from "@components/PageComponents/Messages/MessageInput.tsx";
// mention auto-insert disabled; buildNodeMention intentionally unused
import { PageLayout } from "@components/PageLayout.tsx";
import { Sidebar } from "@components/Sidebar.tsx";
import { Avatar } from "@components/UI/Avatar.tsx";
import { Input } from "@components/UI/Input.tsx";
import { LeftSidebarButton } from "@components/UI/Sidebar/LeftSidebarButton.tsx";
import { MessageSidebarButton } from "@components/UI/Sidebar/MessageSidebarButton.tsx";
import { SidebarSection } from "@components/UI/Sidebar/SidebarSection.tsx";
import { Switch } from "@components/UI/Switch.tsx";
import { useToast } from "@core/hooks/useToast.ts";
import { ToastAction } from "@components/UI/Toast.tsx";
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
import {
  getDirectMessageNavigationBlockDescription,
  getDirectMessageKeyExchangeDescription,
  getDirectMessageKeyExchangeStatus,
  shouldBlockDirectMessageNavigation,
} from "@core/utils/directMessageKeyExchange.ts";
import { cn } from "@core/utils/cn.ts";
import { randId } from "@core/utils/randId.ts";
import { Protobuf, Types, Constants } from "@meshtastic/core";
import { getNodeLongName } from "@app/darkmesh/utils.ts";
import { numberToHexUnpadded } from "@noble/curves/abstract/utils";
import { useNavigate, useParams } from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  FolderArchive,
  HashIcon,
  LockIcon,
  LockOpenIcon,
  UsersIcon,
} from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getChannelName } from "../components/PageComponents/Channels/Channels.tsx";
import type { Message } from "../core/stores/messageStore/types.ts";

type NodeInfoWithUnread = Protobuf.Mesh.NodeInfo & { unreadCount: number };
const UNREAD_SCROLL_SESSION_KEY = "darkmesh-message-unread-scroll";

function getUnreadScrollKey(type: MessageType, id: number) {
  return `${type === MessageType.Direct ? "direct" : "broadcast"}:${id}`;
}

function readUnreadScrollCount(type: MessageType, id: number): number {
  if (typeof window === "undefined") return 0;

  try {
    const raw = window.sessionStorage.getItem(UNREAD_SCROLL_SESSION_KEY);
    const values = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    return Number(values[getUnreadScrollKey(type, id)] ?? 0);
  } catch {
    return 0;
  }
}

function writeUnreadScrollCount(type: MessageType, id: number, count: number) {
  if (typeof window === "undefined" || count <= 0) return;

  try {
    const raw = window.sessionStorage.getItem(UNREAD_SCROLL_SESSION_KEY);
    const values = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    values[getUnreadScrollKey(type, id)] = count;
    window.sessionStorage.setItem(UNREAD_SCROLL_SESSION_KEY, JSON.stringify(values));
  } catch {
    // ignore storage failures
  }
}

function clearUnreadScrollCount(type: MessageType, id: number) {
  if (typeof window === "undefined") return;

  try {
    const raw = window.sessionStorage.getItem(UNREAD_SCROLL_SESSION_KEY);
    const values = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    delete values[getUnreadScrollKey(type, id)];
    window.sessionStorage.setItem(UNREAD_SCROLL_SESSION_KEY, JSON.stringify(values));
  } catch {
    // ignore storage failures
  }
}

function getCompressionPreferenceKey(chatType: MessageType, chatId: number) {
  if (chatType === MessageType.Direct) {
    return `${Types.ChannelNumber.Primary}${chatId}`;
  }

  return `${chatId}${Constants.broadcastNum}`;
}

function getPacketErrorId(error: unknown): number | undefined {
  if (!error || typeof error !== "object" || !("id" in error)) {
    return undefined;
  }

  const id = (error as { id?: unknown }).id;
  return typeof id === "number" ? id : undefined;
}

function getPacketErrorReason(error: unknown): Protobuf.Mesh.Routing_Error | undefined {
  if (!error || typeof error !== "object" || !("error" in error)) {
    return undefined;
  }

  const reason = (error as { error?: unknown }).error;
  return typeof reason === "number" ? (reason as Protobuf.Mesh.Routing_Error) : undefined;
}

function isPrimaryChannel(channel: { index: number; role?: Protobuf.Channel.Channel_Role }) {
  return (
    channel.role === Protobuf.Channel.Channel_Role.PRIMARY ||
    channel.index === Types.ChannelNumber.Primary
  );
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
  const { getNodes, getNode, getMyNode, hasNodeError, getNodeError } = useNodeDB();

  const { setMessageState } = useMessages();
  const { deviceId } = useDeviceContext();
  const messageInputRef = useRef<MessageInputHandle | null>(null);

  const { type, chatId } = useParams({ from: messagesWithParamsRoute.id });

  const navigate = useNavigate();
  const { toast } = useToast();
  const { isCollapsed } = useSidebar();
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [replyTo, setReplyTo] = useState<Message | undefined>();
  const [mentionOpen, setMentionOpen] = useState<boolean>(false);
  const [mobileCompressionEnabled, setMobileCompressionEnabled] = useState(false);
  const [showMobileChannelList, setShowMobileChannelList] = useState(true);
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
  const [unreadAnchorCount, setUnreadAnchorCount] = useState(0);

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

  useEffect(() => {
    const count = readUnreadScrollCount(chatType, numericChatId);
    setUnreadAnchorCount(count);
    if (count > 0) {
      clearUnreadScrollCount(chatType, numericChatId);
      const timeoutId = window.setTimeout(() => {
        resetUnread(numericChatId);
        setUnreadAnchorCount(0);
      }, 350);
      return () => window.clearTimeout(timeoutId);
    }
  }, [chatType, numericChatId, resetUnread]);

  const handleReply = useCallback(
    (message: Message) => {
      setReplyTo(message);
      // focus input so user can start typing immediately
      requestAnimationFrame(() => messageInputRef.current?.focus());
    },
    [setReplyTo],
  );

  const currentChannel = channels.get(numericChatId);
  const otherNode = getNode(numericChatId);
  const myNode = getMyNode();
  const myNodeNum = myNode?.num;

  const isDirect = chatType === MessageType.Direct;
  const isBroadcast = chatType === MessageType.Broadcast;
  const directMessageNodeError = isDirect ? getNodeError(numericChatId) : undefined;
  const directMessageKeyExchangeStatus = getDirectMessageKeyExchangeStatus(
    isDirect ? otherNode : undefined,
    directMessageNodeError,
  );
  const directMessageHasPublicKey = directMessageKeyExchangeStatus === "ready";
  const directMessageBlockDescription = directMessageHasPublicKey
    ? undefined
    : getDirectMessageKeyExchangeDescription(directMessageKeyExchangeStatus);

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
  const directMessageMaps = useMessageStore(
    (s) => s.messageStores.get(deviceId as number)?.messages.direct,
  );

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

  const channelSummaries = useMemo(
    () =>
      filteredChannels.map((channel) => {
        const channelMessages = useMessageStore
          .getState()
          .messageStores.get(deviceId as number)
          ?.messages.broadcast.get(channel.index);
        const latest = channelMessages
          ? Array.from(channelMessages.values()).sort((a, b) => b.date - a.date)[0]
          : undefined;
        const sender = latest ? getNode(latest.from) : undefined;
        const senderName =
          sender?.user?.shortName ??
          (latest ? numberToHexUnpadded(latest.from).slice(-4) : undefined);

        return {
          channel,
          latest,
          senderName,
          unread: getUnreadCount(channel.index) ?? 0,
          label: getChannelName(channel),
        };
      }),
    [deviceId, filteredChannels, getNode, getUnreadCount],
  );

  const directSummaries = useMemo(() => {
    if (myNodeNum === undefined) {
      return [];
    }

    const directEntries = Array.from(directMessageMaps?.entries() ?? []);
    const seen = new Set<number>();
    const summaries = directEntries
      .map(([conversationId, directMessages]) => {
        const nodeNums = conversationId.split(":").map(Number);
        const otherNum = nodeNums.find((nodeNum) => nodeNum !== myNodeNum);
        if (otherNum === undefined || seen.has(otherNum)) {
          return undefined;
        }
        seen.add(otherNum);

        const node = getNode(otherNum);
        const latest = Array.from(directMessages.values()).sort((a, b) => b.date - a.date)[0];

        return {
          nodeNum: otherNum,
          node,
          latest,
          unread: getUnreadCount(otherNum) ?? 0,
          label:
            (node ? getNodeLongName(node) : undefined) ??
            `!${numberToHexUnpadded(otherNum).toUpperCase()}`,
        };
      })
      .filter(
        (
          summary,
        ): summary is {
          nodeNum: number;
          node: Protobuf.Mesh.NodeInfo | undefined;
          latest: Message | undefined;
          unread: number;
          label: string;
        } => Boolean(summary),
      );

    if (isDirect && !seen.has(numericChatId)) {
      const node = getNode(numericChatId);
      summaries.unshift({
        nodeNum: numericChatId,
        node,
        latest: undefined,
        unread: getUnreadCount(numericChatId) ?? 0,
        label:
          (node ? getNodeLongName(node) : undefined) ??
          `!${numberToHexUnpadded(numericChatId).toUpperCase()}`,
      });
    }

    return summaries.sort((a, b) => {
      const latestDiff = (b.latest?.date ?? 0) - (a.latest?.date ?? 0);
      if (latestDiff !== 0) return latestDiff;
      return b.unread - a.unread;
    });
  }, [directMessageMaps, getNode, getUnreadCount, isDirect, myNodeNum, numericChatId]);

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
      const longName = (getNodeLongName(node) ?? "").toLowerCase();
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

  const handleDirectChatClick = useCallback(
    (node: Protobuf.Mesh.NodeInfo) => {
      const nodeError = getNodeError(node.num);
      const navigationBlockDescription = getDirectMessageNavigationBlockDescription(
        node,
        nodeError,
      );

      if (shouldBlockDirectMessageNavigation(node, nodeError) && navigationBlockDescription) {
        toast({
          title: "Unable to open direct message",
          description: navigationBlockDescription,
          variant: "destructive",
        });
        return;
      }

      writeUnreadScrollCount(MessageType.Direct, node.num, getUnreadCount(node.num) ?? 0);
      navigateToChat(MessageType.Direct, node.num.toString());
      resetUnread(node.num);
    },
    [getNodeError, getUnreadCount, navigateToChat, resetUnread, toast],
  );

  const sendText = useCallback(
    async (message: string, opts?: { compress?: boolean }) => {
      if (isDirect && myNodeNum === undefined) {
        toast({
          title: "Unable to resolve the local node for this direct chat",
        });
        return;
      }

      if (isDirect && !directMessageHasPublicKey) {
        // Offer a CTA to request the public key from the remote node instead of a plain block message
        let toastRef: ReturnType<typeof toast> | undefined;
        toastRef = toast({
          title: "Direct messages require a public key",
          description: directMessageBlockDescription,
          variant: "destructive",
          action: (
            <ToastAction
              altText="Request public key"
              onClick={async () => {
                try {
                  toastRef?.dismiss();
                  toast({ title: "Requesting public key..." });

                  if (!connection) throw new Error("No active connection to device");

                  if (typeof connection.sendPacket === "function") {
                    await connection.sendPacket(
                      new Uint8Array(),
                      Protobuf.Portnums.PortNum.NODEINFO_APP,
                      numericChatId,
                      undefined,
                      false,
                      true,
                    );
                  } else if (typeof connection.getMetadata === "function") {
                    await connection.getMetadata(numericChatId);
                  } else {
                    throw new Error("NodeInfo request not available on this connection");
                  }

                  toast({ title: "Request sent" });
                } catch (err) {
                  console.warn("public key request failed", err);
                  toast({ title: "Failed to request public key" });
                }
              }}
            >
              Request public key
            </ToastAction>
          ),
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
          // `sendMessage` was removed from MeshDevice; use `sendText` instead.
          // For compressed messages we still send text to the same destination/channel.
          const sendPromise = connection?.sendText(
            message,
            toValue,
            true,
            channelValue,
            replyTo?.messageId,
            undefined,
            true,
          );
          if (sendPromise) {
            setReplyTo(undefined);
            messageId = await sendPromise;
          }
        } else {
          // If user explicitly disabled compression for this contact, remove stored preference
          try {
            if (typeof window !== "undefined" && window.localStorage) {
              window.localStorage.removeItem(`compressionPrefs:${contactKey}`);
            }
          } catch {
            // ignore
          }
          const sendPromise = connection?.sendText(
            message,
            toValue,
            true,
            channelValue,
            replyTo?.messageId,
            undefined,
            false,
          );
          if (sendPromise) {
            setReplyTo(undefined);
            messageId = await sendPromise;
          }
        }
        if (messageId === undefined) {
          console.warn("sendText completed but messageId is undefined");
        }
      } catch (e: unknown) {
        console.error("Failed to send message:", e);
        const failedId = messageId ?? getPacketErrorId(e) ?? randId();
        const failedState =
          getPacketErrorReason(e) === Protobuf.Mesh.Routing_Error.TIMEOUT
            ? MessageState.Enroute
            : MessageState.Failed;
        if (chatType === MessageType.Broadcast) {
          setMessageState({
            type: MessageType.Broadcast,
            channelId: channelValue,
            messageId: failedId,
            newState: failedState,
          });
        } else if (myNodeNum !== undefined) {
          setMessageState({
            type: MessageType.Direct,
            nodeA: myNodeNum,
            nodeB: numericChatId,
            messageId: failedId,
            newState: failedState,
          });
        }
      }
    },
    [
      chatType,
      connection,
      directMessageBlockDescription,
      directMessageHasPublicKey,
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
        return (
          <ChannelChat
            chatKey={`${chatType}:${numericChatId}`}
            messages={currentMessages}
            unreadAnchorCount={unreadAnchorCount}
            onReply={handleReply}
            onMention={handleMention}
          />
        );
      case MessageType.Direct:
        if (myNodeNum === undefined) {
          return <SelectMessageChat />;
        }
        return (
          <ChannelChat
            chatKey={`${chatType}:${numericChatId}`}
            messages={currentMessages}
            unreadAnchorCount={unreadAnchorCount}
            onReply={handleReply}
            onMention={handleMention}
          />
        );
      default:
        return <SelectMessageChat />;
    }
  };

  const leftSidebar = useMemo(
    () => (
      <Sidebar>
        <SidebarSection label={t("navigation.channels")} className="py-2 px-0">
          {filteredChannels?.map((channel) => (
            <LeftSidebarButton
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
                writeUnreadScrollCount(
                  MessageType.Broadcast,
                  channel.index,
                  getUnreadCount(channel.index) ?? 0,
                );
                navigateToChat(MessageType.Broadcast, channel.index.toString());
                resetUnread(channel.index);
              }}
            >
              <HashIcon size={16} className={cn(isCollapsed ? "mr-0 mt-2" : "mr-2")} />
            </LeftSidebarButton>
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
          <MessageSidebarButton
            key={node.num}
            label={((): string => {
              const long = getNodeLongName(node);
              if (long) return long;
              try {
                return `!${numberToHexUnpadded(node.num).toUpperCase()}`;
              } catch {
                return t("unknown.shortName");
              }
            })()}
            count={node.unreadCount > 0 ? node.unreadCount : undefined}
            active={numericChatId === node.num && chatType === MessageType.Direct}
            onClick={() => handleDirectChatClick(node)}
          >
            <Avatar
              nodeNum={node.num}
              className={cn(hasNodeError(node.num) && "text-red-500")}
              showError={hasNodeError(node.num)}
              showFavorite={node.isFavorite}
              size="sm"
            />
          </MessageSidebarButton>
        ))}
      </div>
    </SidebarSection>
  );

  const openBroadcastChannel = (channelIndex: number) => {
    writeUnreadScrollCount(MessageType.Broadcast, channelIndex, getUnreadCount(channelIndex) ?? 0);
    navigateToChat(MessageType.Broadcast, channelIndex.toString());
    setShowMobileChannelList(false);
  };

  const openDirectChannel = (nodeNum: number) => {
    const node = getNode(nodeNum);
    if (node) {
      writeUnreadScrollCount(MessageType.Direct, nodeNum, getUnreadCount(nodeNum) ?? 0);
      handleDirectChatClick(node);
    } else {
      writeUnreadScrollCount(MessageType.Direct, nodeNum, getUnreadCount(nodeNum) ?? 0);
      navigateToChat(MessageType.Direct, nodeNum.toString());
    }
    setShowMobileChannelList(false);
  };

  const handleMobileCompressionChange = (checked: boolean) => {
    setMobileCompressionEnabled(checked);
    messageInputRef.current?.setCompression(checked);
  };

  useEffect(() => {
    if (type === "direct" && chatId !== undefined) {
      setShowMobileChannelList(false);
    }
  }, [chatId, type]);

  const mobileChannelList = (
    <div className="flex h-full flex-col overflow-y-auto bg-background-primary px-2.5 py-3 text-text-primary md:hidden">
      <div className="space-y-2">
        {directSummaries.map(({ nodeNum, node, latest, unread, label }) => (
          <button
            key={`direct-${nodeNum}`}
            type="button"
            onClick={() => openDirectChannel(nodeNum)}
            className="grid min-h-[4.5rem] w-full grid-cols-[3.25rem_1fr_auto] items-center gap-2 rounded-[1rem] bg-background-secondary px-3 py-2 text-left text-text-primary shadow-[0_2px_8px_rgba(0,0,0,0.2)] dark:bg-[#2f2f2f] dark:shadow-[0_2px_8px_rgba(0,0,0,0.35)]"
          >
            <div className="flex justify-center">
              {node ? (
                <Avatar
                  nodeNum={node.num}
                  showError={hasNodeError(node.num)}
                  showFavorite={node.isFavorite}
                  size="sm"
                />
              ) : (
                <LockIcon className="size-6 text-[#9b1118]" />
              )}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[1.0875rem] leading-tight text-text-primary">
                {label}
              </div>
              {latest ? (
                <div className="mt-1.5 line-clamp-2 text-[0.7875rem] leading-tight text-text-primary">
                  {latest.message}
                </div>
              ) : (
                <div className="mt-1.5 text-[0.7875rem] leading-tight text-text-secondary">
                  Direct Message
                </div>
              )}
            </div>
            <div className="self-start whitespace-nowrap text-[0.825rem] text-text-primary">
              {unread > 0 ? (
                <span className="rounded-full bg-[#8d0606] px-1.5 py-0.5 text-[0.65rem] text-white">
                  {unread}
                </span>
              ) : latest ? (
                new Intl.DateTimeFormat(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(latest.date * 1000))
              ) : (
                ""
              )}
            </div>
          </button>
        ))}
        {channelSummaries.map(({ channel, latest, senderName, unread, label }) => {
          const primaryChannel = isPrimaryChannel(channel);

          return (
            <button
              key={channel.index}
              type="button"
              onClick={() => openBroadcastChannel(channel.index)}
              className="grid min-h-[4.5rem] w-full grid-cols-[3.25rem_1fr_auto] items-center gap-2 rounded-[1rem] bg-background-secondary px-3 py-2 text-left text-text-primary shadow-[0_2px_8px_rgba(0,0,0,0.2)] dark:bg-[#2f2f2f] dark:shadow-[0_2px_8px_rgba(0,0,0,0.35)]"
            >
              <div className="flex justify-center">
                <UsersIcon
                  className={cn("size-6", primaryChannel ? "text-[#00e531]" : "text-[#9b1118]")}
                />
              </div>
              <div className="min-w-0">
                <div className="truncate text-[1.0875rem] leading-tight text-text-primary">
                  {label}
                </div>
                {latest ? (
                  <div className="mt-1.5 line-clamp-2 text-[0.7875rem] leading-tight text-text-primary">
                    {senderName ? `${senderName}: ` : ""}
                    {latest.message}
                  </div>
                ) : null}
              </div>
              <div className="self-start whitespace-nowrap text-[0.825rem] text-text-primary">
                {unread > 0 ? (
                  <span className="rounded-full bg-[#8d0606] px-1.5 py-0.5 text-[0.65rem] text-white">
                    {unread}
                  </span>
                ) : latest ? (
                  new Intl.DateTimeFormat(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(latest.date * 1000))
                ) : (
                  ""
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
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
              ? (getNodeLongName(otherNode) ??
                `!${numberToHexUnpadded(otherNode.num).toUpperCase()}`)
              : t("emptyState.title"),
      })} 
      `}
      rightBar={rightSidebar}
      leftBar={leftSidebar}
      mobileSubNav={undefined}
      headerContent={<GatewayHeader />}
      actions={
        isDirect && otherNode
          ? [
              {
                key: "encryption",
                icon: directMessageHasPublicKey ? LockIcon : LockOpenIcon,
                iconClasses: directMessageHasPublicKey ? "text-green-600" : "text-yellow-300",
                onClick() {
                  if (directMessageHasPublicKey) {
                    toast({
                      title: "This node has a public key for direct messages",
                      variant: "default",
                    });
                    return;
                  }

                  // Offer a CTA to request the public key from the remote node
                  let toastRef: ReturnType<typeof toast> | undefined;
                  toastRef = toast({
                    title: "Direct messages require a public key",
                    description: directMessageBlockDescription,
                    variant: "destructive",
                    action: (
                      <ToastAction
                        altText="Request public key"
                        onClick={async () => {
                          try {
                            toastRef?.dismiss();
                            toast({ title: "Requesting public key..." });

                            if (!connection) throw new Error("No active connection to device");

                            if (typeof connection.sendPacket === "function") {
                              await connection.sendPacket(
                                new Uint8Array(),
                                Protobuf.Portnums.PortNum.NODEINFO_APP,
                                otherNode!.num,
                                undefined,
                                false,
                                true,
                              );
                            } else if (typeof connection.getMetadata === "function") {
                              await connection.getMetadata(otherNode!.num);
                            } else {
                              throw new Error("NodeInfo request not available on this connection");
                            }

                            toast({ title: "Request sent" });
                          } catch (err) {
                            console.warn("public key request failed", err);
                            toast({ title: "Failed to request public key" });
                          }
                        }}
                      >
                        Request public key
                      </ToastAction>
                    ),
                  });
                },
              },
            ]
          : []
      }
    >
      <div className="hidden flex-1 flex-col overflow-hidden md:flex">
        {renderChatContent()}

        <div className="flex-none dark:bg-slate-900 p-2">
          {isBroadcast || isDirect ? (
            <MessageInput
              to={isDirect ? numericChatId : MessageType.Broadcast}
              onSend={sendText}
              maxBytes={200}
              replyTo={replyTo}
              onClearReply={() => setReplyTo(undefined)}
              // forward ref so parent can focus the input when replying
              ref={messageInputRef}
              mentionOpen={mentionOpen}
              onMentionHandled={() => setMentionOpen(false)}
              compressionPreferenceKey={compressionPreferenceKey}
              compressionAutoSignal={compressionAutoSignal}
              onCompressionChange={setMobileCompressionEnabled}
            />
          ) : (
            <div className="p-4 text-center text-slate-400 italic">
              {t("sendMessage.sendButton", { ns: "messages" })}
            </div>
          )}
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:hidden">
        {showMobileChannelList ? (
          mobileChannelList
        ) : (
          <>
            <div className="flex h-12 shrink-0 items-center gap-3 bg-background-primary px-3 text-text-primary dark:bg-[#101010] dark:text-zinc-100">
              <button
                type="button"
                onClick={() => setShowMobileChannelList(true)}
                className="inline-flex size-10 items-center justify-center rounded-full hover:bg-[#2f2f2f]"
                aria-label="Back to messages"
              >
                <ArrowLeftIcon className="size-6" />
              </button>
              <div className="min-w-0 flex-1 truncate text-lg font-semibold">
                {isBroadcast && currentChannel
                  ? getChannelName(currentChannel)
                  : isDirect && otherNode
                    ? (getNodeLongName(otherNode) ??
                      `!${numberToHexUnpadded(otherNode.num).toUpperCase()}`)
                    : t("emptyState.title")}
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-2">
                <FolderArchive className="size-6 text-zinc-400" aria-hidden="true" />
                <Switch
                  checked={mobileCompressionEnabled}
                  onCheckedChange={handleMobileCompressionChange}
                  aria-label={t("sendMessage.compress", { ns: "messages" })}
                  className="data-[state=checked]:border-[#00e531] data-[state=checked]:bg-zinc-500 dark:data-[state=checked]:bg-zinc-500"
                />
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {renderChatContent()}
            </div>
            <div className="flex-none bg-background-primary p-2 dark:bg-[#101010]">
              <MessageInput
                to={isDirect ? numericChatId : MessageType.Broadcast}
                onSend={sendText}
                maxBytes={200}
                replyTo={replyTo}
                onClearReply={() => setReplyTo(undefined)}
                ref={messageInputRef}
                mentionOpen={mentionOpen}
                onMentionHandled={() => setMentionOpen(false)}
                compressionPreferenceKey={compressionPreferenceKey}
                compressionAutoSignal={compressionAutoSignal}
                onCompressionChange={setMobileCompressionEnabled}
              />
            </div>
          </>
        )}
      </div>
    </PageLayout>
  );
};

export default MessagesPage;
