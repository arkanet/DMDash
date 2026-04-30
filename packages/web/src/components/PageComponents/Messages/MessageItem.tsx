import { MessageActionsMenu } from "@components/PageComponents/Messages/MessageActionsMenu.tsx";
import {
  splitMessageMentions,
  buildMentionId,
} from "@components/PageComponents/Messages/messageMentions.ts";
import { Avatar } from "@components/UI/Avatar.tsx";
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
import { cn } from "@core/utils/cn.ts";
import { Protobuf } from "@meshtastic/core";
import type { LucideIcon } from "lucide-react";
import { AlertCircle, CheckCircle2, CircleEllipsis, FileArchive } from "lucide-react";
import { Fragment, type ReactNode, useCallback, useMemo } from "react";
import SwipeReplyMessage from "./SwipeReplyMessage";
import { useTranslation } from "react-i18next";
import { getNodeLongName } from "@app/darkmesh/utils.ts";

// Cache for pending promises
const myNodePromises = new Map<string, Promise<Protobuf.Mesh.NodeInfo>>();

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
  const { config, setDialogOpen } = device;
  const { getNode, getNodes } = useNodeDB();
  const setNodeNumDetails = useAppStore((state) => state.setNodeNumDetails);
  const { t, i18n } = useTranslation("messages");

  // This will suspend if myNode is not available yet
  const myNode = useSuspendingMyNode();
  const myNodeNum = myNode.num;

  const MESSAGE_STATUS_MAP = useMemo(
    (): Record<MessageState, MessageStatusInfo> => ({
      [MessageState.Ack]: {
        displayText: t("deliveryStatus.delivered.displayText"),
        icon: CheckCircle2,
        ariaLabel: t("deliveryStatus.delivered.label"),
        iconClassName: "text-green-500",
      },
      [MessageState.Waiting]: {
        displayText: t("deliveryStatus.waiting.displayText"),
        icon: CircleEllipsis,
        ariaLabel: t("deliveryStatus.waiting.label"),
        iconClassName: "text-slate-400",
      },
      [MessageState.Failed]: {
        displayText: t("deliveryStatus.failed.displayText"),
        icon: AlertCircle,
        ariaLabel: t("deliveryStatus.failed.label"),
        iconClassName: "text-red-500 dark:text-red-400",
      },
    }),
    [t],
  );

  const UNKNOWN_STATUS = useMemo(
    (): MessageStatusInfo => ({
      displayText: t("deliveryStatus.unknown.displayText"),
      icon: AlertCircle,
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

  const { displayName, isFavorite, nodeNum } = useMemo(() => {
    const userIdHex = message.from.toString(16).toUpperCase().padStart(2, "0");
    const last4 = userIdHex.slice(-4);
    const fallbackName = t("fallbackName", { last4 });
    const longName = getNodeLongName(messageUser) ?? undefined;
    const derivedShortName = messageUser?.user?.shortName || fallbackName;
    const derivedDisplayName = longName || derivedShortName;
    const isFavorite = messageUser?.num !== myNodeNum && messageUser?.isFavorite;
    return {
      displayName: derivedDisplayName,
      shortName: derivedShortName,
      isFavorite: isFavorite,
      nodeNum: message.from,
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

  const getReactionSenderLabel = useCallback(
    (senderNodeNum: number) => {
      if (senderNodeNum === myNodeNum) {
        return t("message.you", { defaultValue: "You" });
      }

      const senderNode = getNode(senderNodeNum);
      if (getNodeLongName(senderNode)) {
        return getNodeLongName(senderNode) as string;
      }
      if (senderNode?.user?.shortName) {
        return senderNode.user.shortName;
      }

      const senderHex = senderNodeNum.toString(16).toUpperCase().padStart(8, "0");
      return t("fallbackName", { last4: senderHex.slice(-4) });
    },
    [getNode, myNodeNum, t],
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

  const formattedTime = useMemo(
    () =>
      messageDate?.toLocaleTimeString(locale, {
        hour: "numeric",
        minute: "2-digit",
        hour12: config?.display?.use12hClock ?? true,
      }) ?? "",
    [messageDate, locale, config?.display?.use12hClock],
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
  const openMentionedNode = useCallback(
    (nodeNum: number) => {
      setNodeNumDetails(nodeNum);
      setDialogOpen("nodeDetails", true);
    },
    [setDialogOpen, setNodeNumDetails],
  );

  const messageItemWrapperClass = cn(
    "group w-full py-2 relative list-none",
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
  const dateTextStyle = "text-xs text-slate-500 dark:text-slate-400";
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
              (Protobuf.Portnums as unknown as { PortNum: Record<string, number> }).PortNum
                .TEXT_MESSAGE_APP,
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
    <li
      id={`message-${message.messageId}`}
      className={messageItemWrapperClass}
      onDoubleClick={() => {
        if (onMention) onMention(message);
      }}
    >
      <div className="grid grid-cols-[auto_1fr] gap-x-2">
        <button
          type="button"
          onClick={() => {
            setNodeNumDetails(nodeNum);
            setDialogOpen("nodeDetails", true);
          }}
          aria-label={`Open node ${nodeNum} details`}
          className="p-0 m-0"
        >
          <Avatar size="sm" nodeNum={nodeNum} className="pt-0.5" showFavorite={isFavorite} />
        </button>

        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-sm text-slate-900 dark:text-slate-100 truncate mr-1">
              {displayName}
            </span>
            {messageDate && (
              <time dateTime={messageDate.toISOString()} className={dateTextStyle}>
                <span aria-hidden="true">{formattedTime}</span>
                <span className="sr-only">{fullDateTime}</span>
              </time>
            )}
            {message.compressed && (
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      aria-label={t("compressed.label", { defaultValue: "Compressed message" })}
                      className="inline-flex items-center"
                      role="img"
                    >
                      <FileArchive
                        className="size-4 shrink-0 text-sky-700 dark:text-sky-300"
                        aria-hidden="true"
                      />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-800 dark:bg-slate-600 text-white px-4 py-1 rounded text-xs">
                    {t("compressed.title", { defaultValue: "Compressed message" })}
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

          {message?.message && (
            <div className="space-y-1">
              {repliedMessage && (
                <button
                  type="button"
                  onClick={() => onJumpToMessage?.(repliedMessage.messageId)}
                  className="rounded-lg border border-slate-200 bg-slate-100/80 px-2.5 py-2 text-xs text-slate-500 dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-400 cursor-pointer text-left w-full"
                  aria-label={t("jumpToOriginal", { defaultValue: "Jump to original message" })}
                >
                  <div className="font-medium text-slate-700 dark:text-zinc-200">
                    {t("replyingTo", { defaultValue: "Replying to" })}
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
                        onClick={() => openMentionedNode(mentionedNode.num)}
                      >
                        @{mentionLabel}
                      </button>
                    );
                  })}
                </div>
              </SwipeReplyMessage>
              {(hopLabel || reactionEntries.length > 0) && (
                <div className="space-y-2 pt-1">
                  {hopLabel && (
                    <div className="flex justify-end text-xs text-slate-500 dark:text-slate-400">
                      {hopLabel}
                    </div>
                  )}
                  {reactionEntries.length > 0 && (
                    <TooltipProvider delayDuration={200}>
                      <div className="flex flex-wrap gap-1">
                        {reactionEntries.map(([emoji, reaction]) => (
                          <Tooltip key={emoji}>
                            <TooltipTrigger asChild>
                              <div className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-sm dark:bg-zinc-900">
                                <span className="text-lg leading-none">{emoji}</span>
                                {reaction.count > 1 && (
                                  <span className="text-xs text-slate-500 dark:text-zinc-400">
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
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="absolute top-1 right-1">
        <MessageActionsMenu
          onReply={onReply ? () => onReply(message) : undefined}
          showReaction={!isSender}
          reactionPickerPlacement={isLatestReceived ? "above" : "below"}
          onAddReaction={handleAddReaction}
        />
      </div>
    </li>
  );
};
