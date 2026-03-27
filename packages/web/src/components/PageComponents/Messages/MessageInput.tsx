import { Button } from "@components/UI/Button.tsx";
import { Input } from "@components/UI/Input.tsx";
import { useMessages } from "@core/stores";
import type { Message } from "@core/stores/messageStore/types.ts";
import type { Types } from "@meshtastic/core";
import { ReplyIcon, SendIcon, XIcon } from "lucide-react";
import { startTransition, useState } from "react";
import { useTranslation } from "react-i18next";

export interface MessageInputProps {
  onSend: (message: string) => void;
  to: Types.Destination;
  maxBytes: number;
  replyTo?: Message;
  onClearReply?: () => void;
}

export const MessageInput = ({
  onSend,
  to,
  maxBytes,
  replyTo,
  onClearReply,
}: MessageInputProps) => {
  const { setDraft, getDraft, clearDraft } = useMessages();
  const { t } = useTranslation("messages");

  const calculateBytes = (text: string) => new Blob([text]).size;

  const initialDraft = getDraft(to);
  const [localDraft, setLocalDraft] = useState(initialDraft);
  const [messageBytes, setMessageBytes] = useState(() => calculateBytes(initialDraft));

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const byteLength = calculateBytes(newValue);

    if (byteLength <= maxBytes) {
      setLocalDraft(newValue);
      setMessageBytes(byteLength);
      setDraft(to, newValue);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!localDraft.trim()) {
      return;
    }
    // Reset bytes *before* sending (consider if onSend failure needs different handling)
    setMessageBytes(0);

    startTransition(() => {
      onSend(localDraft.trim());
      setLocalDraft("");
      clearDraft(to);
    });
  };

  return (
    <div className="flex gap-2">
      <form className="w-full" name="messageInput" onSubmit={handleSubmit}>
        {replyTo && (
          <div className="mb-2 flex items-start justify-between rounded-xl border border-slate-300/70 bg-slate-100/80 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900/70">
            <div className="flex min-w-0 gap-2">
              <ReplyIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-500 dark:text-zinc-400" />
              <div className="min-w-0">
                <div className="font-medium text-slate-800 dark:text-zinc-200">Replying</div>
                <div className="truncate text-slate-500 dark:text-zinc-400">{replyTo.message}</div>
              </div>
            </div>
            <button
              type="button"
              className="ml-3 shrink-0 text-slate-500 transition-colors hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white"
              onClick={onClearReply}
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="flex grow gap-1">
          <label className="w-full" htmlFor="messageInput">
            <Input
              minLength={1}
              name="messageInput"
              placeholder={t("sendMessage.placeholder")}
              autoComplete="off"
              value={localDraft}
              onChange={handleInputChange}
            />
          </label>

          <label
            data-testid="byte-counter"
            htmlFor="messageInput"
            className="flex items-center w-20 p-1 text-sm place-content-end"
          >
            {messageBytes}/{maxBytes}
          </label>

          <Button type="submit" variant="default">
            <SendIcon size={16} />
          </Button>
        </div>
      </form>
    </div>
  );
};
