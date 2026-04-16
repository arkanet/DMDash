// Node cleaner utility: remove nodes not seen for a configured retention window

export interface NodeRecord {
  num: number;
  lastSeenMs: number; // epoch ms
  // additional optional fields
  [k: string]: unknown;
}

export type NodesMap = Map<number, NodeRecord>;

/**
 * Remove nodes older than `ageHours` from provided map.
 * Returns number of removed nodes.
 */
export function cleanOldNodes(nodes: NodesMap, ageHours: number): number {
  const now = Date.now();
  const ageMs = ageHours * 60 * 60 * 1000;
  const threshold = now - ageMs;
  let removed = 0;
  for (const [id, rec] of nodes.entries()) {
    if (typeof rec.lastSeenMs !== "number" || rec.lastSeenMs < threshold) {
      nodes.delete(id);
      removed++;
    }
  }
  return removed;
}

/**
 * Helper to schedule periodic cleaning. Returns an abort function to stop the interval.
 * - `getNodes` should return a mutable Map reference used by the app store
 * - `onClean` optional callback receives removed count
 */
export function scheduleNodeCleaner(
  getNodes: () => NodesMap,
  ageHours: number,
  intervalMs = 1000 * 60 * 10, // default 10 minutes
  onClean?: (removed: number) => void,
): { stop: () => void } {
  const id = setInterval(() => {
    try {
      const nodes = getNodes();
      const removed = cleanOldNodes(nodes, ageHours);
      if (removed && onClean) onClean(removed);
    } catch {
      // swallow — caller can log
    }
  }, intervalMs);

  return { stop: () => clearInterval(id) };
}

export default { cleanOldNodes, scheduleNodeCleaner };
