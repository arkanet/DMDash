import React, { useMemo, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNodeDB, useDevice } from "@core/stores";
import {
  buildNodeMention,
  buildMentionId,
} from "@components/PageComponents/Messages/messageMentions.ts";

interface MentionAutocompleteProps {
  query: string;
  onInsert: (mentionToken: string) => void;
  anchorEl?: HTMLElement | null;
}

export const MentionAutocomplete: React.FC<MentionAutocompleteProps> = ({
  query,
  onInsert,
  anchorEl,
}) => {
  const { getNodes } = useNodeDB();
  const nodeDB = useNodeDB();
  const [pos, setPos] = useState<{ left: number; bottom: number; width: number } | null>(null);

  const device = useDevice();

  const list = useMemo(() => {
    const rawQ = query ?? "";
    const q = rawQ.toLowerCase().replace(/^!/, "");
    const localNodeNum = nodeDB?.myNodeNum ?? device?.myNodeNum ?? device?.hardware?.myNodeNum;
    const localHex = localNodeNum
      ? localNodeNum.toString(16).padStart(8, "0").toLowerCase()
      : undefined;
    // (previously normalizedQueryMention was used for stricter matching; not needed for option B)
    return getNodes(undefined, true)
      .filter((n) => {
        const longName = n.user?.longName ?? "";
        const shortName = n.user?.shortName ?? "";
        const mentionIdRaw = buildMentionId(n) ?? ""; // returns !HEX
        const mentionHex = mentionIdRaw.replace(/^!/, "").toLowerCase();

        const isMatch =
          longName.toLowerCase().includes(q) ||
          shortName.toLowerCase().includes(q) ||
          (q.length > 0 && mentionHex.includes(q)) ||
          q.length === 0;

        // Option B: exclude the local node from the final matched results.
        if (isMatch && localHex && mentionHex === localHex) {
          return false;
        }

        return isMatch;
      })
      .slice(0, 6);
  }, [getNodes, query, device, nodeDB?.myNodeNum]);

  useEffect(() => {
    if (!anchorEl) return;
    const update = () => {
      const r = anchorEl.getBoundingClientRect();
      setPos({ left: r.left, bottom: Math.max(0, window.innerHeight - r.top), width: r.width });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [anchorEl]);

  if (query === undefined || query === null) return null;

  const noMatches = (
    <div className="rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-zinc-700 shadow-sm text-sm text-slate-700 dark:text-slate-200">
      <div className="px-3 py-2">No matches</div>
    </div>
  );

  const content = (
    <div className="rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-zinc-700 shadow-sm text-sm text-slate-700 dark:text-slate-200">
      {list.map((n) => {
        const label = n.user?.longName || n.user?.shortName || buildNodeMention(n) || "Unknown";
        const token = (
          buildNodeMention(n) || `@!${n.num.toString(16).padStart(8, "0")}`
        ).toLowerCase();
        return (
          <button
            key={n.num}
            type="button"
            className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-zinc-700"
            onClick={() => onInsert(token)}
          >
            <div className="font-medium">{label}</div>
            <div className="text-xs text-slate-500 dark:text-zinc-400">{token}</div>
          </button>
        );
      })}
    </div>
  );

  // If anchored and position calculated, render portal above (using bottom)
  if (anchorEl && pos) {
    // If empty list, show noMatches in same container
    const inner = list.length === 0 ? noMatches : content;
    return createPortal(
      <div
        style={{
          position: "absolute",
          left: pos.left,
          bottom: pos.bottom,
          width: pos.width,
          zIndex: 9999,
        }}
      >
        <div className="mb-1">{inner}</div>
      </div>,
      document.body,
    );
  }

  // Inline fallback (below input)
  return <div className="absolute z-40 mt-1 w-full">{list.length === 0 ? noMatches : content}</div>;
};

export default MentionAutocomplete;
