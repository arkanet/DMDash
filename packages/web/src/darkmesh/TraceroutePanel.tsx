import { useMemo, useState } from "react";
import { Input } from "@components/UI/Input.tsx";
import { Button } from "@components/UI/Button.tsx";
import useTracerouteStore, { StoredRouteDiscovery } from "@core/stores/tracerouteStore";
import { useDarkMeshStore } from "@app/darkmesh/store.ts";
import { useNodeDB } from "@core/stores";
import { getNodeLongName } from "@app/darkmesh/utils";
import { useNavigate } from "@tanstack/react-router";

export default function TraceroutePanel() {
  const [filterNode, setFilterNode] = useState<string>("");
  const all = useTracerouteStore((s) => s.getTraceroutes());
  const removeById = useTracerouteStore((s) => s.removeById);
  const clear = useTracerouteStore((s) => s.clear);
  const setSelectedTraceRoute = useDarkMeshStore((s) => s.setSelectedTraceRoute);
  const navigate = useNavigate();
  const { getNode } = useNodeDB();

  const filtered = useMemo(() => {
    const q = filterNode.trim();
    if (!q) return all;
    const num = Number(q);
    if (Number.isNaN(num)) return all;
    return all.filter((t) => {
      try {
        const r = (t as StoredRouteDiscovery).data?.route ?? [];
        const rb = (t as StoredRouteDiscovery).data?.routeBack ?? [];
        return r.includes(num) || rb.includes(num) || t.from === num;
      } catch {
        return false;
      }
    });
  }, [all, filterNode]);

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex gap-2">
          <Input
            placeholder="Filter by node number"
            value={filterNode}
            onChange={(e) => setFilterNode(e.target.value)}
          />
          <Button variant="outline" onClick={() => setFilterNode("")}>
            Clear
          </Button>
          <Button variant="ghost" onClick={() => clear()}>
            Clear All
          </Button>
        </div>

        <div className="space-y-2 max-h-64 overflow-y-auto text-sm">
          {filtered.length === 0 ? (
            <div className="text-slate-500">No traceroutes</div>
          ) : (
            filtered.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-md border p-2 bg-slate-50 dark:bg-zinc-900"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium">
                    From {(() => {
                      const n = getNode(t.from as number);
                      return n ? (getNodeLongName(n) ?? t.from) : t.from;
                    })()} • {new Date(t.rxTime).toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-zinc-400">
                    Route:{" "}
                    {((t.data?.route ?? []) as number[]).map((num, idx) => {
                      const n = getNode(num);
                      return (
                        (n ? (getNodeLongName(n) ?? String(num)) : String(num)) +
                        (idx < ((t.data?.route ?? []) as number[]).length - 1 ? " → " : "")
                      );
                    })}
                  </div>
                </div>
                <div className="ml-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setSelectedTraceRoute(t as StoredRouteDiscovery);
                      try {
                        navigate({ to: "/map" });
                      } catch {
                        // ignore
                      }
                    }}
                  >
                    View
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => removeById(String(t.id))}>
                    Remove
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
