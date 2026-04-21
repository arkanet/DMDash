import { useCallback, useEffect, useRef, useState } from "react";
import { logger } from "../utils/logger";

interface UseCopyToClipboardProps {
  timeout?: number;
}

export function useCopyToClipboard({ timeout = 2000 }: UseCopyToClipboardProps = {}) {
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const timeoutRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        globalThis.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const copy = useCallback(
    async (text: string) => {
      if (!navigator?.clipboard) {
        /*
         Silenced non-blocking warning: Clipboard API missing
         Original line (commented):
         // console.warn("Clipboard API not available");
        */
        logger.warn?.("Clipboard API not available");
        setIsCopied(false);
        return false;
      }

      if (timeoutRef.current) {
        globalThis.clearTimeout(timeoutRef.current);
      }

      try {
        await navigator.clipboard.writeText(text);
        setIsCopied(true);

        timeoutRef.current = globalThis.setTimeout(() => {
          setIsCopied(false);
          timeoutRef.current = null;
        }, timeout);

        return true;
      } catch (error) {
        /*
         Transformed non-blocking error to conditional logger.error
         Original line (commented):
         // console.error("Failed to copy text to clipboard:", error);
        */
        logger.error?.("Failed to copy text to clipboard:", error);
        setIsCopied(false);
        return false;
      }
    },
    [timeout],
  );

  return { isCopied, copy };
}
