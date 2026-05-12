import {
  Tooltip,
  TooltipArrow,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@components/UI/Tooltip.tsx";
import { cn } from "@core/utils/cn.ts";
import { Reply, SmilePlus } from "lucide-react";
import EmojiPicker, {
  EmojiClickData,
  EmojiStyle,
  Theme as EmojiPickerTheme,
} from "emoji-picker-react";
import { useTheme } from "@core/hooks/useTheme.ts";
import { useTranslation } from "react-i18next";
import { useState, useRef, useEffect } from "react";
import { useMobileEmojiPicker } from "./useMobileEmojiPicker.ts";

interface MessageActionsMenuProps {
  onAddReaction?: (emoji?: string) => void;
  onReply?: () => void;
  showReaction?: boolean;
  reactionPickerPlacement?: "above" | "below";
  layout?: "floating" | "mobile-column";
}

export const MessageActionsMenu = ({
  onAddReaction,
  onReply,
  showReaction = true,
  reactionPickerPlacement = "below",
  layout = "floating",
}: MessageActionsMenuProps) => {
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const { theme, preference } = useTheme();
  const isMobileEmojiPicker = useMobileEmojiPicker();
  const pickerThemeClass =
    theme === "dark" ? "epr-dark-theme" : preference === "system" ? "epr-auto-theme" : "";
  const pickerTheme =
    theme === "dark"
      ? EmojiPickerTheme.DARK
      : preference === "system"
        ? EmojiPickerTheme.AUTO
        : EmojiPickerTheme.LIGHT;
  const isLightTheme = theme === "light";
  const outerBg = isLightTheme ? undefined : "var(--gateway-bg, #222)";
  const midBg = isLightTheme ? undefined : "rgba(255,255,255,0.03)";
  const searchBg = isLightTheme ? undefined : "rgba(255,255,255,0.06)";
  const darkOuterBg = "var(--gateway-bg, #222)";
  const darkMidBg = "rgba(255,255,255,0.03)";
  const darkSearchBg = "rgba(255,255,255,0.06)";
  const isMobileColumn = layout === "mobile-column";

  // Close picker when clicking outside
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!pickerRef.current) return;
      if (!pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    }
    if (showPicker) {
      document.addEventListener("click", onDocClick);
      return () => document.removeEventListener("click", onDocClick);
    }
    return;
  }, [showPicker]);
  const { t } = useTranslation("messages");
  const hoverIconBarClass = isMobileColumn
    ? cn("relative z-10 flex flex-col items-center gap-1 bg-transparent p-0 opacity-100")
    : cn(
        "absolute top-2 right-2",
        "flex items-center gap-x-1",
        "bg-white dark:bg-zinc-800",
        "border border-gray-200 dark:border-zinc-600",
        "rounded-md shadow-sm p-1",
        "opacity-0 group-hover:opacity-100",
        "max-md:opacity-100",
        "transition-opacity duration-100 ease-in-out",
        "z-10",
      );

  const hoverIconButtonClass = isMobileColumn
    ? cn(
        "inline-flex size-8 items-center justify-center rounded-full",
        "text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-100",
        "cursor-pointer",
      )
    : cn(
        "p-1 rounded",
        "text-gray-500 dark:text-gray-400",
        "hover:text-gray-700 dark:hover:text-gray-300",
        "hover:bg-gray-100 dark:hover:bg-zinc-700",
        "cursor-pointer",
      );

  const iconSizeClass = "size-4";

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    if (onAddReaction) {
      onAddReaction(emojiData.emoji);
    }
    setShowPicker(false);
  };

  if (!showReaction && !onReply) {
    return null;
  }

  return (
    <div className={cn(hoverIconBarClass)}>
      <TooltipProvider delayDuration={300}>
        {showReaction && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={t("messages_actionsMenu_addReactionLabel")}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPicker((s) => !s);
                }}
                className={hoverIconButtonClass}
              >
                <SmilePlus className={iconSizeClass} aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="bg-gray-800 text-white px-2 py-1 rounded text-xs">
              {t("messages_actionsMenu_addReactionLabel")}
              <TooltipArrow className="fill-gray-800" />
            </TooltipContent>
          </Tooltip>
        )}

        {onReply && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={t("messages_actionsMenu_replyLabel")}
                onClick={(e) => {
                  e.stopPropagation();
                  onReply();
                }}
                className={hoverIconButtonClass}
              >
                <Reply className={iconSizeClass} aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="bg-gray-800 text-white px-2 py-1 rounded text-xs">
              {t("messages_actionsMenu_replyLabel")}
              <TooltipArrow className="fill-gray-800" />
            </TooltipContent>
          </Tooltip>
        )}
        {/* mention button removed — mentions activated by typing '@' in the input */}
      </TooltipProvider>

      {showReaction && showPicker && (
        <div
          ref={pickerRef}
          role="dialog"
          aria-label={t("messages_actionsMenu_addReactionLabel")}
          className={cn(
            "emoji-picker-wrapper message-emoji-picker-shell message-emoji-picker-popover absolute right-0 z-20 rounded-xl border border-slate-200 p-2 shadow-md backdrop-blur-sm dark:border-zinc-700",
            pickerThemeClass,
            isMobileColumn
              ? "top-full mt-2 md:fixed md:right-4 md:bottom-[5.75rem] md:top-auto md:z-[60] md:mt-0"
              : reactionPickerPlacement === "above"
                ? "bottom-full mb-2"
                : "top-full mt-2",
          )}
          style={
            {
              ["--epr-bg-color"]: outerBg ?? undefined,
              ["--epr-reactions-bg-color"]: midBg ?? undefined,
              ["--epr-search-input-bg-color"]: searchBg ?? undefined,
              ["--epr-search-input-bg-color-active"]: searchBg ?? undefined,
              ["--epr-category-label-bg-color"]: midBg ?? undefined,
              ["--epr-dark-bg-color"]: darkOuterBg,
              ["--epr-dark-reactions-bg-color"]: darkMidBg,
              ["--epr-dark-search-input-bg-color"]: darkSearchBg,
            } as React.CSSProperties
          }
          onClick={(e) => e.stopPropagation()}
          tabIndex={-1}
          onKeyDown={(e) => {
            // ensure keyboard events inside the dialog don't bubble up
            e.stopPropagation();
          }}
        >
          <EmojiPicker
            onEmojiClick={handleEmojiClick}
            autoFocusSearch={false}
            searchDisabled={isMobileEmojiPicker}
            previewConfig={{ showPreview: false }}
            emojiStyle={EmojiStyle.NATIVE}
            theme={pickerTheme}
            className="message-emoji-picker-compact"
          />
        </div>
      )}
    </div>
  );
};
