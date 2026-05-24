import { MessageActionsMenu } from "@components/PageComponents/Messages/MessageActionsMenu.tsx";
import {
  splitMessageMentions,
  buildMentionId,
} from "@components/PageComponents/Messages/messageMentions.ts";
import { MobileNodeInfoDialog } from "../../../pages/Nodes/index.tsx";
import { useDarkMeshStore } from "@app/darkmesh/store.ts";
import { Avatar } from "@components/UI/Avatar.tsx";
import { Dialog, DialogContent } from "@components/UI/Dialog.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "@components/UI/Popover.tsx";
import { create, toBinary } from "@bufbuild/protobuf";
import { useFavoriteNode } from "@core/hooks/useFavoriteNode.ts";
import { useIgnoreNode } from "@core/hooks/useIgnoreNode.ts";
import { useToast } from "@core/hooks/useToast.ts";
import { requestNeighborInfo, startVisualTraceroute } from "@core/services/darkmesh/nodeActions.ts";
import {
  Tooltip,
  TooltipArrow,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@components/UI/Tooltip.tsx";
import {
  MessageState,
  MessageType,
  useAppStore,
  useDevice,
  useMessages,
  useNodeDB,
} from "@core/stores";
import type { Message } from "@core/stores/messageStore/types.ts";
import { resolveAdminChannelIndex } from "@core/utils/adminChannel.ts";
import { cn } from "@core/utils/cn.ts";
import {
  getDirectMessageNavigationBlockDescription,
  shouldBlockDirectMessageNavigation,
} from "@core/utils/directMessageKeyExchange.ts";
import { normalizeNodeStatus } from "@core/utils/nodeStatus.ts";
import { Protobuf, Types, Utils } from "@meshtastic/core";
import { useNavigate } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
  Cloud,
  CloudCheck,
  CloudOff,
  CloudUpload,
  FolderArchive,
  TriangleAlert,
  UserCheck,
} from "lucide-react";
import { Fragment, type ReactNode, useCallback, useMemo, useState } from "react";
import SwipeReplyMessage from "./SwipeReplyMessage";
import { useTranslation } from "react-i18next";
import { getNodeLongName, getNodeShortName } from "@app/darkmesh/utils.ts";

// Cache for pending promises
const myNodePromises = new Map<string, Promise<Protobuf.Mesh.NodeInfo>>();
const MESSAGE_NODE_MENU_ITEM_CLASS =
  "px-5 py-3 text-left text-slate-900 hover:bg-slate-100 dark:text-zinc-100 dark:hover:bg-[#242424]";

function isPacketError(error: unknown): error is Types.PacketError {
  return (
    typeof error === "object" &&
    error !== null &&
    "id" in error &&
    "error" in error &&
    typeof (error as Types.PacketError).id === "number"
  );
}

function formatNodeActionError(error: unknown, includePacketId = true): string {
  if (isPacketError(error)) {
    const routingError = Utils.getRoutingErrorName(error.error);
    return includePacketId ? `Pacchetto ${error.id}: ${routingError}` : routingError;
  }

  return error instanceof Error ? error.message : String(error);
}

// Hook that suspends when myNode is not available
function useSuspendingMyNode() {
  const { getMyNode } = useNodeDB();
  const selectedDeviceId = useAppStore((s) => s.selectedDeviceId);
  const myNode = getMyNode();

  if (!myNode) {
    // Use the selected device ID to cache promises per device
    const deviceKey = `device-${selectedDeviceId}`;

    if (!myNodePromises.has(deviceKey)) {
      const promise = new Promise<Protobuf.Mesh.NodeInfo>((resolve) => {
        // Poll for myNode to become available
        const checkInterval = setInterval(() => {
          const node = getMyNode();
          if (node) {
            console.log("[MessageItem] myNode now available, resolving promise");
            clearInterval(checkInterval);
            myNodePromises.delete(deviceKey);
            resolve(node);
          }
        }, 100);

        setTimeout(() => {
          clearInterval(checkInterval);
          myNodePromises.delete(deviceKey);
        }, 10000);
      });

      myNodePromises.set(deviceKey, promise);
    }

    // Throw the promise to trigger Suspense
    throw myNodePromises.get(deviceKey);
  }

  return myNode;
}

// import { MessageActionsMenu } from "@components/PageComponents/Messages/MessageActionsMenu.tsx"; // TODO: Uncomment when actions menu is implemented

interface MessageStatusInfo {
  displayText: string;
  icon: LucideIcon;
  ariaLabel: string;
  iconClassName?: string;
}

const StatusTooltip = ({
  statusInfo,
  children,
}: {
  statusInfo: MessageStatusInfo;
  children: ReactNode;
}) => (
  <TooltipProvider delayDuration={300}>
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent className="bg-slate-800 dark:bg-slate-600 text-white px-4 py-1 rounded text-xs">
        {statusInfo.displayText}
        <TooltipArrow className="fill-slate-800" />
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

interface MessageItemProps {
  message: Message;
  repliedMessage?: Message;
  onReply?: (message: Message) => void;
  onMention?: (message: Message) => void;
  onAddReaction?: (emoji: string, message: Message) => void;
  isReplyTarget?: boolean;
  isHighlighted?: boolean;
  isLatestReceived?: boolean;
  onJumpToMessage?: (messageId: number) => void;
}

export const MessageItem = ({
  message,
  repliedMessage,
  onReply,
  onMention,
  onAddReaction,
  isReplyTarget,
  isHighlighted,
  isLatestReceived,
  onJumpToMessage,
}: MessageItemProps) => {
  const device = useDevice();
  const messages = useMessages();
  const { setDialogOpen } = device;
  const { getNode, getNodeError, getNodes, removeNode } = useNodeDB();
  const setNodeNumDetails = useAppStore((state) => state.setNodeNumDetails);
  const identiconsEnabled = useAppStore((state) => state.identiconsEnabled);
  const { t, i18n } = useTranslation("messages");
  const navigate = useNavigate();
  const { updateFavorite } = useFavoriteNode();
  const { updateIgnored } = useIgnoreNode();
  const { toast } = useToast();
  const [avatarActionOpen, setAvatarActionOpen] = useState(false);
  const [moreNodeInfoNode, setMoreNodeInfoNode] = useState<number | undefined>();
  const neighborDiscoveryRecordsByNode =
    useDarkMeshStore((s) => s.neighborDiscoveryByDevice?.[device.id]) ?? {};

  // This will suspend if myNode is not available yet
  const myNode = useSuspendingMyNode();
  const myNodeNum = myNode.num;

  const MESSAGE_STATUS_MAP = useMemo(
    (): Record<MessageState, MessageStatusInfo> => ({
      [MessageState.Ack]: {
        displayText: t("deliveryStatus.delivered.displayText", {
          defaultValue: "Message delivered to the mesh",
        }),
        icon: CloudCheck,
        ariaLabel: t("deliveryStatus.delivered.label", {
          defaultValue: "Message delivered",
        }),
        iconClassName: "text-green-500",
      },
      [MessageState.Waiting]: {
        displayText: t("deliveryStatus.enroute.displayText", {
          defaultValue: "Waiting for acknowledgement",
        }),
        icon: Cloud,
        ariaLabel: t("deliveryStatus.enroute.label", {
          defaultValue: "Message enroute",
        }),
        iconClassName: "text-slate-400",
      },
      [MessageState.Failed]: {
        displayText: t("deliveryStatus.failed.displayText", {
          defaultValue: "Delivery failed",
        }),
        icon: CloudOff,
        ariaLabel: t("deliveryStatus.failed.label", {
          defaultValue: "Message delivery failed",
        }),
        iconClassName: "text-red-500 dark:text-red-400",
      },
      [MessageState.Queued]: {
        displayText: t("deliveryStatus.queued.displayText", {
          defaultValue: "Queued for radio",
        }),
        icon: CloudUpload,
        ariaLabel: t("deliveryStatus.queued.label", {
          defaultValue: "Message queued",
        }),
        iconClassName: "text-slate-400",
      },
      [MessageState.Enroute]: {
        displayText: t("deliveryStatus.enroute.displayText", {
          defaultValue: "Waiting for acknowledgement",
        }),
        icon: Cloud,
        ariaLabel: t("deliveryStatus.enroute.label", {
          defaultValue: "Message enroute",
        }),
        iconClassName: "text-sky-500 dark:text-sky-300",
      },
      [MessageState.Delivered]: {
        displayText: t("deliveryStatus.delivered.displayText", {
          defaultValue: "Message delivered to the mesh",
        }),
        icon: CloudCheck,
        ariaLabel: t("deliveryStatus.delivered.label", {
          defaultValue: "Message delivered",
        }),
        iconClassName: "text-green-500",
      },
      [MessageState.Received]: {
        displayText: t("deliveryStatus.received.displayText", {
          defaultValue: "Acknowledged by recipient",
        }),
        icon: UserCheck,
        ariaLabel: t("deliveryStatus.received.label", {
          defaultValue: "Message received",
        }),
        iconClassName: "text-[#00e531]",
      },
    }),
    [t],
  );

  const UNKNOWN_STATUS = useMemo(
    (): MessageStatusInfo => ({
      displayText: t("deliveryStatus.unknown.displayText"),
      icon: TriangleAlert,
      ariaLabel: t("deliveryStatus.unknown.label"),
      iconClassName: "text-red-500 dark:text-red-400",
    }),
    [t],
  );

  const getMessageStatusInfo = useMemo(
    () =>
      (state: MessageState): MessageStatusInfo =>
        MESSAGE_STATUS_MAP[state] ?? UNKNOWN_STATUS,
    [MESSAGE_STATUS_MAP, UNKNOWN_STATUS],
  );

  const messageUser: Protobuf.Mesh.NodeInfo | undefined = useMemo(() => {
    return message.from != null ? getNode(message.from) : undefined;
  }, [getNode, message.from]);

  const getNodeDisplayName = useCallback(
    (nodeNum: number, options?: { useSelfLabel?: boolean }) => {
      if (options?.useSelfLabel && nodeNum === myNodeNum) {
        return t("message.you", { defaultValue: "You" });
      }

      const node = nodeNum === myNodeNum ? myNode : getNode(nodeNum);
      const longName = getNodeLongName(node) ?? undefined;
      if (longName) {
        return longName;
      }
      if (node?.user?.shortName) {
        return node.user.shortName;
      }

      const senderHex = nodeNum.toString(16).toUpperCase().padStart(8, "0");
      return t("fallbackName", { last4: senderHex.slice(-4) });
    },
    [getNode, myNode, myNodeNum, t],
  );

  const { displayName, isFavorite, isIgnored, nodeNum, nodeStatus, shortName } = useMemo(() => {
    const userIdHex = message.from.toString(16).toUpperCase().padStart(2, "0");
    const last4 = userIdHex.slice(-4);
    const fallbackName = t("fallbackName", { last4 });
    const longName = getNodeLongName(messageUser) ?? undefined;
    const derivedShortName = getNodeShortName(messageUser) ?? last4;
    const derivedDisplayName = longName || fallbackName;
    const isFavorite = messageUser?.num !== myNodeNum && messageUser?.isFavorite;
    const isIgnored = Boolean(messageUser?.isIgnored);
    const nodeStatus = normalizeNodeStatus(
      (messageUser as (Protobuf.Mesh.NodeInfo & { nodeStatus?: string }) | undefined)?.nodeStatus,
    );
    return {
      displayName: derivedDisplayName,
      isFavorite: isFavorite,
      isIgnored,
      nodeNum: message.from,
      nodeStatus,
      shortName: derivedShortName,
    };
  }, [messageUser, message.from, t, myNodeNum]);

  const messageStatusInfo = getMessageStatusInfo(message.state);
  const StatusIconComponent = messageStatusInfo.icon;
  const mentionNodes = new Map<string, Protobuf.Mesh.NodeInfo>();
  for (const node of getNodes(undefined, true)) {
    const userId = node.user?.id?.toUpperCase();
    if (userId) {
      mentionNodes.set(userId, node);
    }
    const built = buildMentionId(node);
    if (built) {
      mentionNodes.set(built.toUpperCase(), node);
    }
  }
  const messageFragments = useMemo(() => splitMessageMentions(message.message), [message.message]);

  const myMentionId = buildMentionId(myNode)?.toLowerCase();
  const isMentioningMe = useMemo(
    () =>
      messageFragments.some(
        (f) => f.type === "mention" && f.mentionId?.toLowerCase() === myMentionId,
      ),
    [messageFragments, myMentionId],
  );

  const reactionEntries = useMemo(
    () => Object.entries(message.reactions ?? {}).slice(0, 6),
    [message.reactions],
  );
  const moreNodeInfo = moreNodeInfoNode !== undefined ? getNode(moreNodeInfoNode) : undefined;
  const repliedMessageSenderName = useMemo(
    () => (repliedMessage ? getNodeDisplayName(repliedMessage.from) : undefined),
    [getNodeDisplayName, repliedMessage],
  );

  const getReactionSenderLabel = useCallback(
    (senderNodeNum: number) => {
      return getNodeDisplayName(senderNodeNum, { useSelfLabel: true });
    },
    [getNodeDisplayName],
  );

  // Split plain text fragments further into URL parts so links become clickable.
  // Plus Codes (Open Location Codes) are handled separately.
  const splitTextByUrl = useCallback((text: string) => {
    const parts: Array<{ type: "text" | "url"; value: string }> = [];
    if (!text) return parts;
    // Match only http(s)://, ftp:// or www. style links to avoid matching single-char schemes like "T:"
    const schemeOrWww = /\b((?:https?:\/\/|ftp:\/\/|www\.)[^\s<>]*)/gi;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    // eslint-disable-next-line no-cond-assign
    while ((match = schemeOrWww.exec(text)) !== null) {
      const idx = match.index;
      const url = match[0];
      if (idx > lastIndex) {
        parts.push({ type: "text", value: text.slice(lastIndex, idx) });
      }
      parts.push({ type: "url", value: url });
      lastIndex = idx + url.length;
    }
    if (lastIndex < text.length) {
      parts.push({ type: "text", value: text.slice(lastIndex) });
    }
    return parts;
  }, []);

  // Split plain text for Plus Codes (e.g. "8FVC9G8F+6X") and return parts
  const splitPlusCodes = useCallback((text: string) => {
    const parts: Array<{ type: "text" | "plus"; value: string }> = [];
    if (!text) return parts;
    const plusRegex = /[23456789CFGHJMPQRVWX]{4,}\+[23456789CFGHJMPQRVWX]{2,6}/gi;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    // eslint-disable-next-line no-cond-assign
    while ((match = plusRegex.exec(text)) !== null) {
      const idx = match.index;
      const code = match[0];
      if (idx > lastIndex) {
        parts.push({ type: "text", value: text.slice(lastIndex, idx) });
      }
      parts.push({ type: "plus", value: code });
      lastIndex = idx + code.length;
    }
    if (lastIndex < text.length) {
      parts.push({ type: "text", value: text.slice(lastIndex) });
    }
    return parts;
  }, []);

  const messageDate = useMemo(() => (message.date ? new Date(message.date) : null), [message.date]);
  const locale = i18n.language;

  const formattedIndicatorTime = useMemo(
    () =>
      messageDate?.toLocaleTimeString(locale, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }) ?? "",
    [messageDate, locale],
  );

  const fullDateTime = useMemo(
    () =>
      messageDate?.toLocaleString(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }) ?? "",
    [messageDate, locale],
  );

  const isSender = myNodeNum !== undefined && message.from === myNodeNum;
  // Show status icon for any message we sent (direct or broadcast)
  const shouldShowStatusIcon = isSender;
  const hopLabel = useMemo(() => {
    if (isSender || typeof message.hopsAway !== "number") {
      return undefined;
    }

    if (message.hopsAway === 0) {
      return t("message.direct", { defaultValue: "Direct" });
    }

    return t("message.hops", {
      defaultValue: "Hops: {{count}}",
      count: message.hopsAway,
    });
  }, [isSender, message.hopsAway, t]);
  const openNodeDetails = useCallback(
    (nodeNum: number) => {
      setNodeNumDetails(nodeNum);
      setDialogOpen("nodeDetails", true);
    },
    [setDialogOpen, setNodeNumDetails],
  );
  const runNodeAction = useCallback(
    async (
      successTitle: string,
      action: () => Promise<unknown> | unknown,
      options?: { errorTitle?: string; includePacketIdInError?: boolean },
    ) => {
      try {
        await action();
        toast({ title: successTitle });
      } catch (error) {
        toast({
          title: options?.errorTitle ?? "Azione non riuscita",
          description: formatNodeActionError(error, options?.includePacketIdInError),
          variant: "destructive",
        });
      }
    },
    [toast],
  );
  const requestNodeInfo = useCallback(
    async (targetNodeNum: number) => {
      const connection = device.connection;
      if (!connection) {
        throw new Error("Nessuna connessione disponibile");
      }
      if (typeof connection.sendPacket === "function") {
        await connection.sendPacket(
          new Uint8Array(),
          Protobuf.Portnums.PortNum.NODEINFO_APP,
          targetNodeNum,
          undefined,
          false,
          true,
        );
      } else if (typeof connection.getMetadata === "function") {
        await connection.getMetadata(targetNodeNum);
      } else {
        throw new Error("Richiesta informazioni non disponibile sulla connessione corrente");
      }
    },
    [device.connection],
  );
  const requestDeviceMetadata = useCallback(
    async (targetNodeNum: number) => {
      const connection = device.connection;
      if (!connection || typeof connection.sendPacket !== "function") {
        throw new Error("Metadata non disponibile sulla connessione corrente");
      }

      const message = create(Protobuf.Admin.AdminMessageSchema, {
        payloadVariant: {
          case: "getDeviceMetadataRequest",
          value: true,
        },
      });
      const adminChannel = resolveAdminChannelIndex(device.channels);

      await connection.sendPacket(
        toBinary(Protobuf.Admin.AdminMessageSchema, message),
        Protobuf.Portnums.PortNum.ADMIN_APP,
        targetNodeNum,
        adminChannel,
        true,
        true,
      );
    },
    [device.channels, device.connection],
  );
  const openDirectMessage = useCallback(
    (targetNodeNum: number) => {
      const node = getNode(targetNodeNum);
      const nodeError = getNodeError(targetNodeNum);
      const description = getDirectMessageNavigationBlockDescription(node, nodeError);
      if (shouldBlockDirectMessageNavigation(node, nodeError) && description) {
        toast({
          title: "Unable to open direct message",
          description,
          variant: "destructive",
        });
        return;
      }

      navigate({
        to: "/messages/$type/$chatId",
        params: {
          type: "direct",
          chatId: String(targetNodeNum),
        },
      });
    },
    [getNode, getNodeError, navigate, toast],
  );

  const messageItemWrapperClass = cn(
    "group w-full py-2 relative list-none max-md:py-1.5",
    "rounded-md",
    // reply target highlight (subtle)
    isReplyTarget ? "bg-slate-100/80 dark:bg-zinc-900/70" : "",
    // mention-to-me highlight (accent)
    isMentioningMe ? "bg-sky-100 dark:bg-sky-900/30" : "",
    // jumped-to highlight (stronger ring)
    isHighlighted ? "ring-2 ring-sky-300/40 dark:ring-sky-700/30" : "",
    "hover:bg-slate-300/15 dark:hover:bg-slate-600/20",
    "transition-colors duration-100 ease-in-out",
  );
  const handleAddReaction = useCallback(
    async (emoji?: string) => {
      if (!emoji) {
        return;
      }

      try {
        if (device.connection && typeof device.connection.sendPacket === "function") {
          const encoder = new TextEncoder();
          const emojiBytes = encoder.encode(emoji);

          await device.connection.sendPacket(
            emojiBytes,
            Number(
              (
                Protobuf.Portnums as unknown as {
                  PortNum: Record<string, number>;
                }
              ).PortNum.TEXT_MESSAGE_APP,
            ),
            message.to,
            message.channel,
            true,
            false,
            false,
            message.messageId,
            1,
          );

          if (message.type === MessageType.Direct) {
            messages.addReaction({
              type: MessageType.Direct,
              nodeA: message.from,
              nodeB: message.to,
              messageId: message.messageId,
              emoji,
              sender: myNodeNum,
            });
          } else {
            messages.addReaction({
              type: MessageType.Broadcast,
              channelId: message.channel,
              messageId: message.messageId,
              emoji,
              sender: myNodeNum,
            });
          }

          onAddReaction?.(emoji, message);
        } else {
          console.warn("No connection available to send reaction");
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("Failed to send reaction", e);
      }
    },
    [device.connection, message, messages, myNodeNum, onAddReaction],
  );

  return (
    <>
      <li
        id={`message-${message.messageId}`}
        className={messageItemWrapperClass}
        onDoubleClick={() => {
          if (onMention) onMention(message);
        }}
      >
        <div
          className={cn(
            "grid gap-x-2",
            isSender
              ? "grid-cols-[minmax(0,1fr)_auto] pl-12"
              : "grid-cols-[auto_minmax(0,1fr)_auto]",
          )}
        >
          <Popover open={avatarActionOpen} onOpenChange={setAvatarActionOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={`Open node ${nodeNum} actions`}
                className={cn(
                  "m-0 flex w-12 flex-col items-center gap-1 self-start p-0 text-center",
                  isSender && "hidden",
                )}
              >
                <Avatar
                  size="sm"
                  nodeNum={nodeNum}
                  className="pt-0.5"
                  showFavorite={isFavorite}
                  showStatusIndicator={false}
                />
                {identiconsEnabled ? (
                  <span className="block max-w-12 truncate text-[0.68rem] font-semibold leading-none text-slate-500 dark:text-zinc-300">
                    {shortName}
                  </span>
                ) : null}
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              side="right"
              sideOffset={8}
              className="w-[min(18rem,calc(100vw-2rem))] border-slate-200 bg-white p-0 text-slate-900 shadow-xl dark:border-zinc-800 dark:bg-[#101010] dark:text-zinc-100"
            >
              <div className="flex max-h-[70vh] flex-col overflow-y-auto py-2 text-lg">
                <button
                  className={MESSAGE_NODE_MENU_ITEM_CLASS}
                  type="button"
                  onClick={() => {
                    setAvatarActionOpen(false);
                    openDirectMessage(nodeNum);
                  }}
                >
                  Messaggio diretto
                </button>
                <button
                  className={MESSAGE_NODE_MENU_ITEM_CLASS}
                  type="button"
                  onClick={() => {
                    setAvatarActionOpen(false);
                    void runNodeAction("Richiesta info inviata", () => requestNodeInfo(nodeNum));
                  }}
                >
                  Richiedi informazioni utente
                </button>
                <button
                  className={MESSAGE_NODE_MENU_ITEM_CLASS}
                  type="button"
                  onClick={() => {
                    setAvatarActionOpen(false);
                    void runNodeAction(
                      "Richiesta metadata inviata",
                      () => requestDeviceMetadata(nodeNum),
                      {
                        errorTitle: "Error Metadata request",
                        includePacketIdInError: false,
                      },
                    );
                  }}
                >
                  Request user metadata
                </button>
                <button
                  className={MESSAGE_NODE_MENU_ITEM_CLASS}
                  type="button"
                  onClick={() => {
                    setAvatarActionOpen(false);
                    void runNodeAction("Richiesta posizione inviata", () => {
                      if (typeof device.connection?.requestPosition !== "function") {
                        throw new Error(
                          "Richiesta posizione non disponibile sulla connessione corrente",
                        );
                      }
                      return device.connection.requestPosition(nodeNum);
                    });
                  }}
                >
                  Richiedi posizione
                </button>
                <button
                  className={MESSAGE_NODE_MENU_ITEM_CLASS}
                  type="button"
                  onClick={() => {
                    setAvatarActionOpen(false);
                    void runNodeAction("Traceroute avviato", () =>
                      startVisualTraceroute(device.id, device.connection, nodeNum),
                    );
                  }}
                >
                  Traceroute
                </button>
                <button
                  className={MESSAGE_NODE_MENU_ITEM_CLASS}
                  type="button"
                  onClick={() => {
                    setAvatarActionOpen(false);
                    void runNodeAction("Neighbor discovery avviata", () =>
                      requestNeighborInfo(device.connection, nodeNum),
                    );
                  }}
                >
                  Neighbor Discovery
                </button>
                <button
                  className={MESSAGE_NODE_MENU_ITEM_CLASS}
                  type="button"
                  onClick={() => {
                    setAvatarActionOpen(false);
                    updateFavorite({
                      nodeNum,
                      isFavorite: !isFavorite,
                    });
                  }}
                >
                  Set Favorite
                </button>
                <button
                  className={MESSAGE_NODE_MENU_ITEM_CLASS}
                  type="button"
                  onClick={() => {
                    setAvatarActionOpen(false);
                    updateIgnored({
                      nodeNum,
                      isIgnored: !isIgnored,
                    });
                  }}
                >
                  Ignora
                </button>
                <button
                  className={MESSAGE_NODE_MENU_ITEM_CLASS}
                  type="button"
                  onClick={() => {
                    setAvatarActionOpen(false);
                    removeNode(nodeNum);
                    toast({ title: "Nodo eliminato" });
                  }}
                >
                  Elimina
                </button>
                <div className="my-2 border-t border-slate-200 dark:border-zinc-800" />
                <button
                  className={MESSAGE_NODE_MENU_ITEM_CLASS}
                  type="button"
                  onClick={() => {
                    setAvatarActionOpen(false);
                    setMoreNodeInfoNode(nodeNum);
                  }}
                >
                  More Node Info
                </button>
                <button
                  className={MESSAGE_NODE_MENU_ITEM_CLASS}
                  type="button"
                  onClick={() => {
                    setAvatarActionOpen(false);
                    openNodeDetails(nodeNum);
                  }}
                >
                  Plus Node Info
                </button>
              </div>
            </PopoverContent>
          </Popover>

          <div
            className={cn(
              "flex min-w-0 max-w-[min(42rem,100%)] flex-col gap-0.5 rounded-xl px-3 py-2 shadow-[0_2px_8px_rgba(0,0,0,0.24)]",
              "bg-slate-100 dark:bg-[#2f2f2f]",
              isSender && "justify-self-end rounded-tr bg-slate-200 dark:bg-[#292929]",
            )}
          >
            <div
              className={cn(
                "flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5",
                isSender && "hidden",
              )}
            >
              <span className="font-medium text-sm text-slate-900 dark:text-slate-100 truncate mr-1">
                {displayName}
              </span>
              {nodeStatus && (
                <span className="min-w-0 break-words text-sm font-normal italic text-slate-600 dark:text-slate-300">
                  {nodeStatus}
                </span>
              )}
            </div>

            {message?.message && (
              <div className="space-y-1">
                {repliedMessage && (
                  <button
                    type="button"
                    onClick={() => onJumpToMessage?.(repliedMessage.messageId)}
                    className="rounded-lg border border-slate-200 bg-slate-100/80 px-2.5 py-2 text-xs text-slate-500 dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-400 cursor-pointer text-left w-full"
                    aria-label={t("jumpToOriginal", {
                      defaultValue: "Jump to original message",
                    })}
                  >
                    <div className="font-medium text-slate-700 dark:text-zinc-200">
                      {repliedMessageSenderName}
                    </div>
                    <div className="line-clamp-2 whitespace-pre-wrap break-words">
                      {repliedMessage.message}
                    </div>
                  </button>
                )}
                <SwipeReplyMessage onReply={onReply ? () => onReply(message) : undefined}>
                  <div className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words">
                    {messageFragments.map((fragment, index) => {
                      if (fragment.type === "text") {
                        const pieces = splitTextByUrl(fragment.value);
                        if (pieces.length === 0) {
                          return (
                            <Fragment key={`text-${message.messageId}-${index}`}>
                              {fragment.value}
                            </Fragment>
                          );
                        }

                        return (
                          <Fragment key={`text-${message.messageId}-${index}`}>
                            {pieces.map((p, pi) => {
                              if (p.type === "text") {
                                const inner = splitPlusCodes(p.value);
                                if (inner.length === 0) {
                                  return <Fragment key={`t-${index}-${pi}`}>{p.value}</Fragment>;
                                }
                                return (
                                  <Fragment key={`t-${index}-${pi}`}>
                                    {inner.map((ip, ipi) =>
                                      ip.type === "text" ? (
                                        <Fragment key={`it-${index}-${pi}-${ipi}`}>
                                          {ip.value}
                                        </Fragment>
                                      ) : (
                                        <a
                                          key={`plus-${index}-${pi}-${ipi}`}
                                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                            ip.value,
                                          )}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          style={{ color: "#00BCD4" }}
                                          className="underline decoration-sky-400 underline-offset-2"
                                        >
                                          {ip.value}
                                        </a>
                                      ),
                                    )}
                                  </Fragment>
                                );
                              }

                              // url piece
                              const href = p.value.includes(":") ? p.value : `http://${p.value}`;
                              return (
                                <a
                                  key={`u-${index}-${pi}`}
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ color: "#00BCD4" }}
                                  className="underline decoration-sky-400 underline-offset-2"
                                >
                                  {p.value}
                                </a>
                              );
                            })}
                          </Fragment>
                        );
                      }

                      const mentionedNode = mentionNodes.get(fragment.mentionId?.toUpperCase());
                      const mentionLabel =
                        getNodeLongName(mentionedNode as unknown as Protobuf.Mesh.NodeInfo) ||
                        mentionedNode?.user?.shortName ||
                        fragment.mentionId;

                      if (!mentionedNode) {
                        // Render the raw token (e.g. @!06f57578) when node not found
                        return (
                          <span
                            key={`mention-${message.messageId}-${fragment.mentionId}-${index}`}
                            className="font-medium text-sky-700 dark:text-sky-300"
                          >
                            {fragment.value}
                          </span>
                        );
                      }

                      return (
                        <button
                          key={`mention-${message.messageId}-${fragment.mentionId}-${index}`}
                          type="button"
                          className="inline rounded px-0.5 font-medium text-sky-700 underline decoration-sky-400 underline-offset-2 transition-colors hover:text-sky-900 dark:text-sky-300 dark:hover:text-sky-100"
                          onClick={() => openNodeDetails(mentionedNode.num)}
                        >
                          @{mentionLabel}
                        </button>
                      );
                    })}
                  </div>
                </SwipeReplyMessage>
                <div className="flex items-center justify-end gap-2 pt-1 text-xs leading-none text-slate-500 dark:text-zinc-200">
                  {hopLabel && <span>{hopLabel}</span>}
                  {messageDate && (
                    <time dateTime={messageDate.toISOString()}>
                      <span aria-hidden="true">{formattedIndicatorTime}</span>
                      <span className="sr-only">{fullDateTime}</span>
                    </time>
                  )}
                  {message.compressed && (
                    <TooltipProvider delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            aria-label={t("compressed.label", {
                              defaultValue: "Compressed message",
                            })}
                            className="inline-flex items-center"
                            role="img"
                          >
                            <FolderArchive
                              className="size-4 shrink-0 text-zinc-500 dark:text-zinc-200"
                              aria-hidden="true"
                            />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="bg-slate-800 dark:bg-slate-600 text-white px-4 py-1 rounded text-xs">
                          {t("compressed.title", {
                            defaultValue: "Compressed message",
                          })}
                          <TooltipArrow className="fill-slate-800" />
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  {shouldShowStatusIcon && (
                    <StatusTooltip statusInfo={messageStatusInfo}>
                      <span aria-label={messageStatusInfo.ariaLabel} role="img">
                        <StatusIconComponent
                          className={cn("size-4 shrink-0", messageStatusInfo.iconClassName)}
                          aria-hidden="true"
                        />
                      </span>
                    </StatusTooltip>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-start justify-center">
            <MessageActionsMenu
              layout="mobile-column"
              onReply={onReply ? () => onReply(message) : undefined}
              showReaction={!isSender}
              reactionPickerPlacement={isLatestReceived ? "above" : "below"}
              onAddReaction={handleAddReaction}
            />
          </div>
        </div>
        {reactionEntries.length > 0 && (
          <TooltipProvider delayDuration={200}>
            <div
              className={cn(
                "flex flex-wrap gap-1 pt-1",
                isSender ? "justify-end pr-3 md:pr-10" : "justify-start pl-3 md:pl-12",
              )}
            >
              {reactionEntries.map(([emoji, reaction]) => (
                <Tooltip key={emoji}>
                  <TooltipTrigger asChild>
                    <div className="inline-flex items-center gap-1 rounded-full bg-black/10 px-2 py-0.5 text-sm dark:bg-black/20">
                      <span className="text-base leading-none">{emoji}</span>
                      {reaction.count > 1 && (
                        <span className="text-xs text-slate-500 dark:text-zinc-300">
                          {reaction.count}
                        </span>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-800 dark:bg-slate-600 text-white px-3 py-2 rounded text-xs">
                    <div className="flex flex-col gap-0.5">
                      {reaction.senders.length > 0 ? (
                        reaction.senders.map((senderNodeNum) => (
                          <span key={`${emoji}-${senderNodeNum}`}>
                            {getReactionSenderLabel(senderNodeNum)}
                          </span>
                        ))
                      ) : (
                        <span>
                          {t("message.reactionUnknown", {
                            defaultValue: "Unknown sender",
                          })}
                        </span>
                      )}
                    </div>
                    <TooltipArrow className="fill-slate-800" />
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </TooltipProvider>
        )}
      </li>
      <Dialog
        open={moreNodeInfoNode !== undefined}
        onOpenChange={(open) => {
          if (!open) {
            setMoreNodeInfoNode(undefined);
          }
        }}
      >
        <DialogContent
          aria-describedby={undefined}
          className="inset-0 h-dvh max-h-dvh w-screen max-w-none rounded-none bg-[#111] p-0 text-zinc-100 dark:bg-[#111] sm:max-w-none sm:rounded-none"
        >
          {moreNodeInfo ? (
            <MobileNodeInfoDialog
              node={moreNodeInfo}
              neighborRecords={neighborDiscoveryRecordsByNode[moreNodeInfo.num] ?? []}
              onClose={() => setMoreNodeInfoNode(undefined)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
};
