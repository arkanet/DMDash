import { useEffect, useMemo, useRef, useState } from "react";
import { filterNodesByQuery, highlightMatch } from "@core/utils/filterNodes.ts";

export type NodeOption = {
  num: number;
  shortName?: string;
  longName?: string;
};

export default function NodeSelector({
  nodes,
  placeholder = "Filter by name or ID",
  value,
  onChange,
}: {
  nodes: NodeOption[];
  placeholder?: string;
  value?: number | null;
  onChange: (nodeNum: number | null) => void;
}) {
  const [filter, setFilter] = useState("");
  const [debouncedFilter, setDebouncedFilter] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedFilter(filter.trim()), 300);
    return () => clearTimeout(id);
  }, [filter]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setShowDropdown(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filtered = useMemo(() => {
    const mapped = nodes.map((n) => ({
      num: n.num,
      user: { shortName: n.shortName, longName: n.longName },
    }));
    return filterNodesByQuery(mapped, debouncedFilter);
  }, [nodes, debouncedFilter]);

  function renderHighlighted(text: string, q: string) {
    if (!q) return text;
    const { parts, index } = highlightMatch(text, q);
    if (index === -1) return text;
    return (
      <>
        {parts[0]}
        <mark className="bg-yellow-200 dark:bg-yellow-600">{parts[1]}</mark>
        {parts[2]}
      </>
    );
  }

  const selectedLabel = (() => {
    if (!value) return undefined;
    const sel = nodes.find((n) => n.num === value);
    return sel ? (sel.shortName ?? `!${sel.num}`) : undefined;
  })();

  return (
    <div ref={wrapperRef}>
      <div className="flex gap-2">
        <input
          className="h-10 w-1/3 rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          placeholder={placeholder}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          onFocus={() => setShowDropdown(true)}
        />
        <div
          className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm flex items-center dark:border-zinc-700 dark:bg-zinc-900 cursor-pointer"
          onClick={() => setShowDropdown((s) => !s)}
        >
          <div className="truncate">{selectedLabel ?? "-- choose node --"}</div>
        </div>
      </div>

      {showDropdown && (
        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-auto rounded-md border bg-white dark:bg-slate-800">
          {filtered.length === 0 && (
            <div className="p-2 text-sm text-text-secondary">No matches</div>
          )}
          {filtered.map((n) => (
            <div
              key={n.num}
              className="px-3 py-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(n.num);
                setShowDropdown(false);
              }}
            >
              <div className="flex flex-col">
                <div className="truncate">
                  {renderHighlighted(n.user?.shortName ?? `!${n.num}`, debouncedFilter)}
                  <span className="text-xs text-text-secondary"> {` (${n.num}) `}</span>
                </div>
                <div className="text-xs text-text-secondary">
                  {renderHighlighted(n.user?.longName ?? "", debouncedFilter)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
