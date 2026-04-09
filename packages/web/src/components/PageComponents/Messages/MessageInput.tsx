import { Button } from "@components/UI/Button.tsx";
import { Input } from "@components/UI/Input.tsx";
import { useMessages } from "@core/stores";
import type { Message } from "@core/stores/messageStore/types.ts";
import type { Types } from "@meshtastic/core";
import { ReplyIcon, SendIcon, XIcon } from "lucide-react";
import { startTransition, useEffect, useRef, useState } from "react";
import EmojiPicker, { EmojiClickData, EmojiStyle } from "emoji-picker-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "@core/hooks/useTheme.ts";

const calculateBytes = (text: string) => new Blob([text]).size;

export interface MessageInputProps {
  onSend: (message: string, opts?: { compress?: boolean }) => void;
  to: Types.Destination;
  maxBytes: number;
  replyTo?: Message;
  replyMentionToken?: string;
  onClearReply?: () => void;
  compressionPreferenceKey?: string;
  compressionAutoSignal?: number;
}

export const MessageInput = ({
  onSend,
  to,
  maxBytes,
  replyTo,
  replyMentionToken,
  onClearReply,
  compressionPreferenceKey,
  compressionAutoSignal,
}: MessageInputProps) => {
  const { setDraft, getDraft, clearDraft } = useMessages();
  const { t } = useTranslation("messages");
  const autoInsertedMentionRef = useRef<string | undefined>(undefined);

  const initialDraft = getDraft(to);
  const [localDraft, setLocalDraft] = useState(initialDraft);
  const [messageBytes, setMessageBytes] = useState(() => calculateBytes(initialDraft));
  const [compress, setCompress] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { theme, preference } = useTheme();
  const isLightTheme = theme === "light";
  const outerBg = isLightTheme ? undefined : "var(--gateway-bg, #222)";
  const midBg = isLightTheme ? undefined : "rgba(255,255,255,0.03)";
  const searchBg = isLightTheme ? undefined : "rgba(255,255,255,0.06)";
  // Dark-theme CSS variable fallbacks used by emoji-picker-react when forcing dark mode
  const darkOuterBg = "var(--gateway-bg, #222)";
  const darkMidBg = "rgba(255,255,255,0.03)";
  const darkSearchBg = "rgba(255,255,255,0.06)";
  const pickerThemeClass =
    theme === "dark" ? "epr-dark-theme" : preference === "system" ? "epr-auto-theme" : "";

  // If the EmojiPicker renders into a portal (body), ensure the theme class and
  // CSS variables are available globally so the picker's internal selectors work.
  useEffect(() => {
    if (!showPicker) return;

    const root = document.documentElement;
    const appliedClass = pickerThemeClass || (isLightTheme ? "" : "epr-dark-theme");

    if (appliedClass) root.classList.add(appliedClass);

    // Set dark fallback variables on root so picker sees them regardless of mount point
    root.style.setProperty("--epr-dark-bg-color", darkOuterBg);
    root.style.setProperty("--epr-dark-reactions-bg-color", darkMidBg);
    root.style.setProperty("--epr-dark-search-input-bg-color", darkSearchBg);

    // Also try to find the picker root element (portal) and apply the same
    // variables and class inline so the picker will immediately reflect
    // dark values even if global CSS isn't applied yet or is overridden.
    try {
      const pickerRoot = document.querySelector<HTMLElement>(
        ".EmojiPickerReact, .epr-main, .EmojiPickerReactRoot",
      );
      if (pickerRoot) {
        if (appliedClass) pickerRoot.classList.add(appliedClass);
        pickerRoot.style.setProperty("--epr-bg-color", darkOuterBg);
        pickerRoot.style.setProperty("--epr-reactions-bg-color", darkMidBg);
        pickerRoot.style.setProperty("--epr-search-input-bg-color", darkSearchBg);
        pickerRoot.style.setProperty("--epr-category-label-bg-color", darkMidBg);
        pickerRoot.style.setProperty("--epr-picker-border-color", "#2b2b2b");
        // debug info in console to help diagnosis
        // eslint-disable-next-line no-console
        console.debug("EmojiPicker root found; applied dark vars and class", {
          appliedClass,
          pickerRoot,
        });
      } else {
        // eslint-disable-next-line no-console
        console.debug("EmojiPicker root not found yet; will rely on document root variables");
      }
    } catch {
      // ignore DOM errors
    }

    // Diagnostic logging to help determine why emoji glyphs may be missing.
    try {
      // list stylesheet hrefs and detect any emoji-picker matches
      const links = Array.from(document.querySelectorAll<HTMLLinkElement>("link[rel=stylesheet]"));
      const linkInfo = links.map((l) => ({ href: l.href, id: l.id || null }));
      // Try to access cssRules for same-origin stylesheets; cross-origin will throw
      const cssRuleCounts = links.map((l) => {
        try {
          // @ts-ignore access may throw
          return {
            href: l.href,
            rules: (l.sheet && (l.sheet as CSSStyleSheet).cssRules?.length) || 0,
          };
        } catch {
          return { href: l.href, rules: "cross-origin" };
        }
      });

      // Inspect a sample emoji element if present
      const sample = document.querySelector<HTMLElement>(
        ".epr-emoji, .epr-emoji-item, .epr-emoji-button, button[aria-label^=emoji]",
      );
      let sampleInfo: Record<string, unknown> | null = null;
      if (sample) {
        const cs = window.getComputedStyle(sample);
        const rect = sample.getBoundingClientRect();
        sampleInfo = {
          text: (sample.textContent || "").slice(0, 40),
          width: rect.width,
          height: rect.height,
          backgroundImage: cs.backgroundImage,
          fontFamily: cs.fontFamily,
          color: cs.color,
          display: cs.display,
        };
      }

      // eslint-disable-next-line no-console
      console.debug("EmojiPicker diagnostics", { linkInfo, cssRuleCounts, sampleInfo });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.debug("EmojiPicker diagnostics failed", e);
    }

    return () => {
      if (appliedClass) root.classList.remove(appliedClass);
      root.style.removeProperty("--epr-dark-bg-color");
      root.style.removeProperty("--epr-dark-reactions-bg-color");
      root.style.removeProperty("--epr-dark-search-input-bg-color");
    };
  }, [showPicker, pickerThemeClass, darkOuterBg, darkMidBg, darkSearchBg, isLightTheme]);

  // Ensure global dark vars/class are present when the app theme is dark so
  // the picker will render correctly even if it mounts before this component
  // (portal) or when it's open later. Keep these in sync with `theme`.
  useEffect(() => {
    const root = document.documentElement;
    const isDark = theme === "dark";
    const autoClass = "epr-auto-theme";
    const darkClass = "epr-dark-theme";

    if (isDark) {
      root.classList.add(darkClass);
      root.classList.remove(autoClass);
    } else {
      // For non-dark (light), remove any picker theme classes so defaults apply
      root.classList.remove(darkClass);
      root.classList.remove(autoClass);
    }

    // Set a small set of dark variables the picker expects. These are safe
    // defaults and won't affect light theme since they're only used by the
    // picker's dark-mode mapping.
    if (isDark) {
      root.style.setProperty("--epr-dark-bg-color", darkOuterBg);
      root.style.setProperty("--epr-dark-reactions-bg-color", darkMidBg);
      root.style.setProperty("--epr-dark-search-input-bg-color", darkSearchBg);
      root.style.setProperty("--epr-dark-picker-border-color", "#2b2b2b");
      root.style.setProperty("--epr-dark-text-color", "#d0d0d0");
      root.style.setProperty("--epr-dark-hover-bg-color", "rgba(255,255,255,0.02)");
      root.style.setProperty("--epr-dark-focus-bg-color", "rgba(255,255,255,0.03)");
      // Also set the main variables to dark values so portaled picker uses them
      root.style.setProperty("--epr-bg-color", darkOuterBg);
      root.style.setProperty("--epr-reactions-bg-color", darkMidBg);
      root.style.setProperty("--epr-search-input-bg-color", darkSearchBg);
      root.style.setProperty("--epr-category-label-bg-color", darkMidBg);
      root.style.setProperty("--epr-picker-border-color", "#2b2b2b");
      root.style.setProperty("--epr-text-color", "#d0d0d0");
    } else {
      root.style.removeProperty("--epr-dark-bg-color");
      root.style.removeProperty("--epr-dark-reactions-bg-color");
      root.style.removeProperty("--epr-dark-search-input-bg-color");
      root.style.removeProperty("--epr-dark-picker-border-color");
      root.style.removeProperty("--epr-dark-text-color");
      root.style.removeProperty("--epr-dark-hover-bg-color");
      root.style.removeProperty("--epr-dark-focus-bg-color");
      root.style.removeProperty("--epr-bg-color");
      root.style.removeProperty("--epr-reactions-bg-color");
      root.style.removeProperty("--epr-search-input-bg-color");
      root.style.removeProperty("--epr-category-label-bg-color");
      root.style.removeProperty("--epr-picker-border-color");
      root.style.removeProperty("--epr-text-color");
    }

    return () => {
      root.classList.remove(darkClass);
      root.classList.remove(autoClass);
      root.style.removeProperty("--epr-dark-bg-color");
      root.style.removeProperty("--epr-dark-reactions-bg-color");
      root.style.removeProperty("--epr-dark-search-input-bg-color");
      root.style.removeProperty("--epr-dark-picker-border-color");
      root.style.removeProperty("--epr-dark-text-color");
      root.style.removeProperty("--epr-dark-hover-bg-color");
      root.style.removeProperty("--epr-dark-focus-bg-color");
      root.style.removeProperty("--epr-bg-color");
      root.style.removeProperty("--epr-reactions-bg-color");
      root.style.removeProperty("--epr-search-input-bg-color");
      root.style.removeProperty("--epr-category-label-bg-color");
      root.style.removeProperty("--epr-picker-border-color");
      root.style.removeProperty("--epr-text-color");
    };
  }, [theme, darkOuterBg, darkMidBg, darkSearchBg]);

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    const emojiChar = (emojiData && emojiData.emoji) || "";
    // Insert emoji at cursor position
    const inputEl = inputRef.current;
    if (!inputEl) {
      // fallback: append
      const next = `${localDraft}${emojiChar}`;
      setLocalDraft(next);
      setDraft(to, next);
      setMessageBytes(calculateBytes(next));
      return;
    }

    const start = inputEl.selectionStart ?? localDraft.length;
    const end = inputEl.selectionEnd ?? localDraft.length;
    const next = `${localDraft.slice(0, start)}${emojiChar}${localDraft.slice(end)}`;
    setLocalDraft(next);
    setDraft(to, next);
    setMessageBytes(calculateBytes(next));

    // move cursor after inserted emoji
    requestAnimationFrame(() => {
      inputEl.focus();
      const pos = start + emojiChar.length;
      inputEl.setSelectionRange(pos, pos);
    });
  };

  // If the Input component is mocked in tests (not forwarding refs), fall back
  // to querying the DOM for the input element by test id or name.
  useEffect(() => {
    if (inputRef.current) return;
    const el = document.querySelector<HTMLInputElement>(
      '[data-testid="message-input-field"], input[name="messageInput"]',
    );
    if (el) inputRef.current = el;
  }, []);

  useEffect(() => {
    const nextDraft = getDraft(to);
    setLocalDraft(nextDraft);
    setMessageBytes(calculateBytes(nextDraft));
    autoInsertedMentionRef.current = undefined;

    let nextCompress = false;
    if (compressionPreferenceKey && typeof window !== "undefined" && window.localStorage) {
      try {
        nextCompress =
          window.localStorage.getItem(`compressionPrefs:${compressionPreferenceKey}`) === "true";
      } catch {
        nextCompress = false;
      }
    }

    setCompress(nextCompress);
  }, [compressionPreferenceKey, getDraft, to]);

  useEffect(() => {
    if (compressionAutoSignal === undefined) {
      return;
    }

    setCompress(true);
  }, [compressionAutoSignal]);

  useEffect(() => {
    if (!replyMentionToken) {
      return;
    }

    setLocalDraft((currentDraft) => {
      const previousAutoMention = autoInsertedMentionRef.current;
      const previousPrefix = previousAutoMention ? `${previousAutoMention} ` : undefined;
      const draftWithoutPreviousAutoMention =
        previousPrefix && currentDraft.startsWith(previousPrefix)
          ? currentDraft.slice(previousPrefix.length)
          : currentDraft;

      if (draftWithoutPreviousAutoMention.includes(replyMentionToken)) {
        autoInsertedMentionRef.current = replyMentionToken;
        return currentDraft;
      }

      const nextDraft =
        draftWithoutPreviousAutoMention.length > 0
          ? `${replyMentionToken} ${draftWithoutPreviousAutoMention}`
          : `${replyMentionToken} `;

      setDraft(to, nextDraft);
      setMessageBytes(calculateBytes(nextDraft));
      autoInsertedMentionRef.current = replyMentionToken;
      return nextDraft;
    });
  }, [replyMentionToken, replyTo?.messageId, setDraft, to]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const byteLength = calculateBytes(newValue);

    if (byteLength <= maxBytes) {
      const previousAutoMention = autoInsertedMentionRef.current;
      if (previousAutoMention && !newValue.startsWith(`${previousAutoMention} `)) {
        autoInsertedMentionRef.current = undefined;
      }

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
      if (compress) {
        onSend(localDraft.trim(), { compress });
      } else {
        onSend(localDraft.trim());
      }
      setLocalDraft("");
      autoInsertedMentionRef.current = undefined;
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
                <div className="font-medium text-slate-800 dark:text-zinc-200">
                  {t("replyPreview.title", { defaultValue: "Replying" })}
                </div>
                <div className="truncate text-slate-500 dark:text-zinc-400">{replyTo.message}</div>
              </div>
            </div>
            <button
              type="button"
              aria-label={t("replyPreview.clear", { defaultValue: "Clear reply" })}
              className="ml-3 shrink-0 text-slate-500 transition-colors hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white"
              onClick={onClearReply}
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="flex grow gap-1 items-center relative">
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

          <label className="flex items-center gap-2 text-sm pr-2">
            <input
              type="checkbox"
              checked={compress}
              onChange={(e) => setCompress(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="select-none">
              {t("sendMessage.compress", { defaultValue: "Compress" })}
            </span>
          </label>

          <div className="relative">
            <button
              type="button"
              aria-label={t("openEmojiPicker", { defaultValue: "Open emoji picker" })}
              aria-expanded={showPicker}
              onClick={() => setShowPicker((s) => !s)}
              className="inline-flex items-center justify-center px-2.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus:outline-none dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200 cursor-pointer rounded"
            >
              <span aria-hidden="true">😊</span>
            </button>

            {showPicker && (
              <div className="absolute right-0 bottom-12 z-50">
                <div
                  // apply emoji-picker theme class so internal dark-mode selectors apply
                  className={
                    "emoji-picker-wrapper border border-slate-200 dark:border-zinc-700 rounded-xl shadow-md p-2 backdrop-blur-sm " +
                    (pickerThemeClass || "")
                  }
                  style={(() => {
                    const pickerVars = {
                      minWidth: "320px",
                      minHeight: "300px",
                      // emoji-picker-react CSS variables to create layered backgrounds
                      ["--epr-bg-color"]: outerBg ?? undefined,
                      ["--epr-reactions-bg-color"]: midBg ?? undefined,
                      ["--epr-search-input-bg-color"]: searchBg ?? undefined,
                      ["--epr-search-input-bg-color-active"]: searchBg ?? undefined,
                      ["--epr-category-label-bg-color"]: midBg ?? undefined,
                      // also expose the dark-specific variables the picker expects when forcing dark
                      ["--epr-dark-bg-color"]: darkOuterBg,
                      ["--epr-dark-reactions-bg-color"]: darkMidBg,
                      ["--epr-dark-search-input-bg-color"]: darkSearchBg,
                    } as unknown as React.CSSProperties;

                    return pickerVars;
                  })()}
                >
                  <EmojiPicker
                    onEmojiClick={handleEmojiClick}
                    previewConfig={{ showPreview: false }}
                    // force native emoji rendering to avoid external CDN image loads
                    emojiStyle={EmojiStyle.NATIVE}
                  />
                </div>
              </div>
            )}
          </div>

          <Button type="submit" variant="default">
            <SendIcon size={16} />
          </Button>
        </div>
      </form>
    </div>
  );
};

// Inline fallback removed — rely on emoji-picker-react to render glyphs.
