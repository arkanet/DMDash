import {
  Tooltip,
  TooltipArrow,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@components/UI/Tooltip.tsx";
import { cn } from "@core/utils/cn.ts";
import { Reply, SmilePlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useState, useRef, useEffect } from "react";

interface MessageActionsMenuProps {
  onAddReaction?: (emoji?: string) => void;
  onReply?: () => void;
}

export const MessageActionsMenu = ({ onAddReaction, onReply }: MessageActionsMenuProps) => {
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);

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
  const { t } = useTranslation();
  const hoverIconBarClass = cn(
    "absolute top-2 right-2",
    "flex items-center gap-x-1",
    "bg-white dark:bg-zinc-800",
    "border border-gray-200 dark:border-zinc-600",
    "rounded-md shadow-sm p-1",
    "opacity-0 group-hover:opacity-100",
    "transition-opacity duration-100 ease-in-out",
    "z-10",
  );

  const hoverIconButtonClass = cn(
    "p-1 rounded",
    "text-gray-500 dark:text-gray-400",
    "hover:text-gray-700 dark:hover:text-gray-300",
    "hover:bg-gray-100 dark:hover:bg-zinc-700",
    "cursor-pointer",
  );

  const iconSizeClass = "size-4";

  return (
    <div className={cn(hoverIconBarClass)}>
      <TooltipProvider delayDuration={300}>
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

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={t("messages_actionsMenu_replyLabel")}
              onClick={(e) => {
                e.stopPropagation();
                if (onReply) {
                  onReply();
                }
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
        {/* mention button removed — mentions activated by typing '@' in the input */}
      </TooltipProvider>

      {showPicker && (
        <div
          ref={pickerRef}
          role="dialog"
          aria-label={t("messages_actionsMenu_addReactionLabel")}
          className="absolute -bottom-12 right-0 z-20 rounded bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 shadow-md p-2 flex gap-1"
          onClick={(e) => e.stopPropagation()}
          tabIndex={-1}
          onKeyDown={(e) => {
            // ensure keyboard events inside the dialog don't bubble up
            e.stopPropagation();
          }}
        >
          {["👍", "❤️", "😂", "😮", "😢", "👏"].map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="px-2 py-1 text-lg hover:bg-slate-100 dark:hover:bg-zinc-700 rounded"
              onClick={() => {
                if (onAddReaction) onAddReaction(emoji);
                setShowPicker(false);
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
