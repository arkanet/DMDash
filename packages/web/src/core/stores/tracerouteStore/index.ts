import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Types, Protobuf } from "@meshtastic/core";
import { getPacketRxTimeMs } from "@app/darkmesh/utils.ts";

export type StoredRouteDiscovery = Types.PacketMetadata<Protobuf.Mesh.RouteDiscovery> & {
  id: string | number;
  /** stable content hash to dedupe similar traceroutes */
  hash?: string;
  /** source of the traceroute (manual, device, hunt) */
  source?: "manual" | "device" | "hunt" | string;
  /** number of times this same traceroute was observed (dedup counter) */
  count?: number;
  /** timestamp when first added to store */
  addedAt?: number;
  /** derived per-hop links with snr and direction info */
  derivedLinks?: Array<{
    from: number;
    to: number;
    snrForward?: number; // SNR when traffic goes from->to
    snrBackward?: number; // SNR when traffic goes to->from
    direction?: "forward" | "backward" | "both" | "unknown";
  }>;
};

interface TraceroutePersistedState {
  traceroutes: StoredRouteDiscovery[];
}

interface TracerouteState extends TraceroutePersistedState {
  addTraceroute: (
    deviceId: number,
    pkt: Types.PacketMetadata<Protobuf.Mesh.RouteDiscovery>,
    opts?: { source?: "manual" | "device" | "hunt" | string },
  ) => void;
  getTraceroutes: () => StoredRouteDiscovery[];
  findByNode: (nodeNum: number) => StoredRouteDiscovery[];
  findByPair: (a: number, b: number) => StoredRouteDiscovery[];
  removeById: (id: string) => void;
  removeOlderThan: (ms: number) => void;
  clear: () => void;
}

export const useTracerouteStore = create<TracerouteState>()(
  persist(
    (set, get) => ({
      traceroutes: [],
      addTraceroute: (deviceId, pkt, opts) => {
        try {
          const now = Date.now();
          // create a stable string to hash for deduplication
          const route = (pkt.data?.route ?? []) as number[];
          const routeBack = (pkt.data?.routeBack ?? []) as number[];
          const base = `${pkt.from}|${pkt.to}|${route.join(",")}|${routeBack.join(",")}`;

          // simple deterministic hash (djb2) to avoid async crypto calls
          let h = 5381;
          for (let i = 0; i < base.length; i++) {
            // eslint-disable-next-line no-bitwise
            h = (h * 33) ^ base.charCodeAt(i);
          }
          const hash = (h >>> 0).toString(16);

          // check for existing entry with same hash
          const existingIndex = get().traceroutes.findIndex((t) => t.hash === hash);
          if (existingIndex !== -1) {
            // bump count and update last-seen rxTime
            set((s) => {
              const copy = s.traceroutes.slice();
              const ex: StoredRouteDiscovery = { ...copy[existingIndex] } as StoredRouteDiscovery;
              ex.count = (ex.count ?? 1) + 1;
              ex.rxTime = pkt.rxTime;
              ex.addedAt = ex.addedAt ?? now;
              copy[existingIndex] = ex;
              return { traceroutes: copy };
            });
            return;
          }

          const id = `${deviceId}-${pkt.from}-${getPacketRxTimeMs(pkt.rxTime)}`;
          // compute per-hop derived links including snr info from packet
          const snrTowards = (pkt.data?.snrTowards ?? []).map((s: number) => s / 4);
          const snrBack = (pkt.data?.snrBack ?? []).map((s: number) => s / 4);
          const forward = [pkt.to, ...(pkt.data?.route ?? []), pkt.from] as number[];
          const backward = [pkt.from, ...(pkt.data?.routeBack ?? []), pkt.to] as number[];

          const derivedLinks: StoredRouteDiscovery["derivedLinks"] = [];

          // helper to push links from a path and snr array
          const pushPath = (
            path: number[],
            snrs: number[] | undefined,
            dirName: "forward" | "backward",
          ) => {
            for (let i = 0; i < path.length - 1; i++) {
              const a = Number(path[i]);
              const b = Number(path[i + 1]);
              // snr index corresponds to hop index (between nodes)
              const idx = i - 0; // 0-based
              const existing = derivedLinks.find((l) => l.from === a && l.to === b);
              if (existing) {
                if (dirName === "forward") existing.snrForward = snrs?.[idx];
                else existing.snrBackward = snrs?.[idx];
                existing.direction =
                  existing.snrForward && existing.snrBackward
                    ? "both"
                    : (existing.direction ?? dirName);
                continue;
              }

              const link: {
                from: number;
                to: number;
                snrForward?: number;
                snrBackward?: number;
                direction?: "forward" | "backward" | "both" | "unknown";
              } = { from: a, to: b };
              if (dirName === "forward") link.snrForward = snrs?.[idx];
              else link.snrBackward = snrs?.[idx];
              link.direction = dirName;
              derivedLinks.push(link);
            }
          };

          pushPath(forward, snrTowards, "forward");
          if ((pkt.data?.routeBack ?? []).length > 0) {
            pushPath(backward, snrBack, "backward");
          }

          // normalize directions where both ways exist
          for (const l of derivedLinks) {
            if (l.snrForward !== undefined && l.snrBackward !== undefined) {
              l.direction = "both";
            }
          }

          const record = {
            ...(pkt as unknown as Record<string, unknown>),
            id,
            hash,
            source: opts?.source ?? "hunt",
            count: 1,
            addedAt: now,
            derivedLinks,
          } as unknown as StoredRouteDiscovery;

          set((state) => ({ traceroutes: [record, ...state.traceroutes].slice(0, 500) }));
        } catch (e) {
          // swallow
          console.warn("tracerouteStore.addTraceroute failed", e);
        }
      },
      getTraceroutes: () => get().traceroutes,
      findByNode: (nodeNum: number) =>
        get().traceroutes.filter((t) => {
          try {
            const r = (t as StoredRouteDiscovery).data?.route ?? [];
            const rb = (t as StoredRouteDiscovery).data?.routeBack ?? [];
            return r.includes(nodeNum) || rb.includes(nodeNum) || t.from === nodeNum;
          } catch {
            return false;
          }
        }),
      findByPair: (a: number, b: number) =>
        get()
          .traceroutes.filter((t) => {
            try {
              const r = (t as StoredRouteDiscovery).data?.route ?? [];
              const rb = (t as StoredRouteDiscovery).data?.routeBack ?? [];
              const pair = (arr: number[]) => arr && arr.includes(a) && arr.includes(b);
              return pair(r) || pair(rb);
            } catch {
              return false;
            }
          })
          .slice(0, 200),
      removeById: (id: string | number) =>
        set((s) => ({ traceroutes: s.traceroutes.filter((t) => t.id !== id) })),
      removeOlderThan: (ms: number) =>
        set((s) => ({
          traceroutes: s.traceroutes.filter((t) => Date.now() - getPacketRxTimeMs(t.rxTime) <= ms),
        })),
      clear: () => set(() => ({ traceroutes: [] })),
    }),
    {
      name: "traceroute-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ traceroutes: s.traceroutes }),
    },
  ),
);

export default useTracerouteStore;
