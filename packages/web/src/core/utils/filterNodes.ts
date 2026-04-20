export type NodeLike = {
  num: number;
  user?: { shortName?: string; longName?: string; nameHex?: string } | null;
  // Some codepaths may expose hex/id fields at the top-level
  nameHex?: string | null;
  nodeId?: string | number | null;
  nodeID?: string | number | null;
};

import { numberToHexUnpadded } from "@noble/curves/abstract/utils";

export function filterNodesByQuery<T extends NodeLike>(nodes: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;
  return nodes.filter((n) => {
    const rawLong =
      n.user?.longName ??
      (() => {
        const nameHex = n.user?.nameHex ?? n.nameHex;
        if (nameHex && nameHex.length > 0) return `Meshtastic ${nameHex.slice(-4)}`;
        if (n.num !== undefined) return `Meshtastic ${numberToHexUnpadded(n.num).slice(-4)}`;
        return "";
      })();
    const longName = rawLong.toLowerCase();
    const shortName = (n.user?.shortName ?? "").toLowerCase();
    const nameHex = (n.user?.nameHex ?? n.nameHex ?? "").toLowerCase();
    const nodeIdStr = String(n.nodeId ?? n.nodeID ?? n.num);
    const idStr = String(n.num);
    return (
      longName.includes(q) ||
      shortName.includes(q) ||
      nameHex.includes(q) ||
      nodeIdStr.toLowerCase().includes(q) ||
      idStr.includes(q)
    );
  });
}

export function highlightMatch(text: string, q: string): { parts: string[]; index: number } {
  const lc = text.toLowerCase();
  const qi = q.trim().toLowerCase();
  const idx = qi ? lc.indexOf(qi) : -1;
  if (idx === -1) return { parts: [text], index: -1 };
  return {
    parts: [text.slice(0, idx), text.slice(idx, idx + qi.length), text.slice(idx + qi.length)],
    index: idx,
  };
}
