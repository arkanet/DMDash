import { useCallback, useEffect, useState } from "react";
import { filterNodesByQuery } from "@core/utils/filterNodes.ts";
import { Button } from "@components/UI/Button.tsx";
import {
  loadScheduledMessages,
  saveScheduledMessages,
  addScheduledMessage,
  removeScheduledMessageByKey,
} from "@core/services/scheduledMessages";
import type { ScheduledMessage } from "@core/models/scheduledMessage";
import { parseLine } from "@core/models/scheduledMessage";
import { useAppStore } from "@core/stores";
import { useDarkMeshStore } from "@app/darkmesh/store.ts";

const DAYS = ["LUN", "MAR", "MER", "GIO", "VEN", "SAB", "DOM"];

export default function PowerNotificationPanel({
  destinationOptions,
  nodeOptions: _nodeOptions,
}: {
  destinationOptions: { label: string; value: string }[];
  nodeOptions?: { num: number; shortName?: string; longName?: string }[];
}) {
  const [selectedDest, setSelectedDest] = useState<string>(destinationOptions[0]?.value ?? "");
  const [day, setDay] = useState<string>(DAYS[0] ?? "LUN");
  const [time, setTime] = useState<string>("12:00");
  const [recurrence, setRecurrence] = useState<"once" | "daily" | "weekly">("weekly");
  const [msg, setMsg] = useState<string>("");
  const [rules, setRules] = useState<ScheduledMessage[]>([]);
  const [filter, setFilter] = useState<string>("");

  const selectedDeviceId = useAppStore((s) => s.selectedDeviceId ?? -1);
  const addSchedule = useDarkMeshStore((s) => s.addSchedule);
  const removeSchedule = useDarkMeshStore((s) => s.removeSchedule);

  const destToNodeId = useCallback(
    (value: string) => {
      // value is encoded as "broadcast:idx" or "direct:num"
      const [kind, raw] = value.split(":");
      if (kind === "broadcast") {
        const idx = Number(raw);
        const label = destinationOptions.find((d) => d.value === value)?.label ?? `Channel ${idx}`;
        return `${idx}^all^${label}`; // approximate Android broadcast key
      }
      return raw; // direct node num as string
    },
    [destinationOptions],
  );

  useEffect(() => {
    if (!selectedDest) return;
    const nodeId = destToNodeId(selectedDest);
    const nodeIdStr = String(nodeId);
    setRules(loadScheduledMessages(nodeIdStr));
  }, [selectedDest, destToNodeId]);

  const filteredDestinationOptions = (() => {
    const q = filter.trim();
    const direct = destinationOptions.filter((o) => o.value.startsWith("direct:"));
    const broadcasts = destinationOptions.filter((o) => o.value.startsWith("broadcast:"));

    if (!q) return [...broadcasts, ...direct];

    const ql = q.toLowerCase();
    // match broadcasts by label
    const matchedBroadcasts = broadcasts.filter((b) => (b.label || "").toLowerCase().includes(ql));

    // match direct nodes using existing node filter helper
    const nodes = direct.map((o) => ({
      num: Number(o.value.split(":")[1]),
      user: { shortName: o.label, longName: o.label },
    }));
    const matchedNodes = filterNodesByQuery(nodes, q);
    const matchedSet = new Set(matchedNodes.map((n) => n.num));

    const out: { label: string; value: string }[] = [];
    for (const b of matchedBroadcasts) out.push(b);
    for (const d of direct) if (matchedSet.has(Number(d.value.split(":")[1]))) out.push(d);
    return out;
  })();

  function handleAdd() {
    if (!selectedDest) return;
    if (!msg.trim()) return;
    if (msg.length > 200) return;
    const nodeId = destToNodeId(selectedDest);
    const nodeIdStr = String(nodeId);
    const sched: ScheduledMessage = { nodeId: nodeIdStr, day, time, msg };
    addScheduledMessage(nodeIdStr, sched);
    setRules(loadScheduledMessages(nodeIdStr));
    setMsg("");
    // also add to global schedules so runtime can send it
    try {
      const { kind, destination } = parseDestValue(selectedDest);
      const label = destinationOptions.find((d) => d.value === selectedDest)?.label ?? "";
      const nextRunAt = computeInitialRunAt(day, time, recurrence);
      const id = makeScheduleId(selectedDeviceId, kind, destination, day, time, msg);
      addSchedule({
        id,
        deviceId: selectedDeviceId,
        label,
        kind: kind === "direct" ? "direct" : "broadcast",
        destination,
        text: msg,
        nextRunAt: nextRunAt ?? Date.now(),
        recurrence,
      });
    } catch {
      // best effort
    }
  }

  function handleSave() {
    if (!selectedDest) return;
    const nodeId = destToNodeId(selectedDest);
    const nodeIdStr = String(nodeId);
    saveScheduledMessages(nodeIdStr, rules);
    // sync saved rules to global store
    try {
      const { kind, destination } = parseDestValue(selectedDest);
      const label = destinationOptions.find((d) => d.value === selectedDest)?.label ?? "";
      // replace schedules for this device/destination by adding entries (store will keep ordering)
      for (const r of rules) {
        const nextRunAt = computeInitialRunAt(r.day, r.time, recurrence);
        const id = makeScheduleId(selectedDeviceId, kind, destination, r.day, r.time, r.msg);
        addSchedule({
          id,
          deviceId: selectedDeviceId,
          label,
          kind: kind === "direct" ? "direct" : "broadcast",
          destination,
          text: r.msg,
          nextRunAt: nextRunAt ?? Date.now(),
          recurrence,
        });
      }
    } catch {
      // ignore
    }
  }

  function handleRemove(lineKey: string) {
    if (!selectedDest) return;
    const nodeId = destToNodeId(selectedDest);
    if (!window.confirm || !window.confirm(`Remove scheduled message "${lineKey}"?`)) return;
    const nodeIdStr = String(nodeId);
    removeScheduledMessageByKey(nodeIdStr, lineKey);
    setRules(loadScheduledMessages(nodeIdStr));
    // also remove from global schedules
    try {
      const parsed = parseLine(nodeIdStr, lineKey);
      if (parsed) {
        const { kind, destination } = parseDestValue(selectedDest);
        const id = makeScheduleId(
          selectedDeviceId,
          kind,
          destination,
          parsed.day,
          parsed.time,
          parsed.msg,
        );
        removeSchedule(id);
      }
    } catch {
      // ignore
    }
  }

  function parseDestValue(value: string): { kind: string; destination: number } {
    const [kind, raw] = value.split(":");
    return { kind: kind === "direct" ? "direct" : "broadcast", destination: Number(raw) };
  }

  function makeScheduleId(
    deviceId: number,
    kind: string,
    destination: number,
    day: string,
    time: string,
    text: string,
  ) {
    const safeText = encodeURIComponent(text).slice(0, 60);
    return `sched:${deviceId}:${kind}:${destination}:${day}@${time}:${safeText}`;
  }

  function computeInitialRunAt(
    dayStr: string,
    timeStr: string,
    recurrence: "once" | "daily" | "weekly",
  ) {
    // parse time
    const [hhStr, mmStr] = timeStr.split(":");
    const hh = Number(hhStr || "0");
    const mm = Number(mmStr || "0");

    const now = new Date();
    const candidate = new Date(now.getTime());
    candidate.setHours(hh, mm, 0, 0);

    if (recurrence === "daily") {
      if (candidate.getTime() <= Date.now()) candidate.setDate(candidate.getDate() + 1);
      return candidate.getTime();
    }

    // weekly: dayStr is one of DAYS
    const dayMap: Record<string, number> = {
      LUN: 1,
      MAR: 2,
      MER: 3,
      GIO: 4,
      VEN: 5,
      SAB: 6,
      DOM: 0,
    };
    const targetDow = dayMap[dayStr] ?? candidate.getDay();
    // set candidate to target dow
    let diff = targetDow - candidate.getDay();
    if (diff < 0) diff += 7;
    if (diff === 0 && candidate.getTime() <= Date.now()) diff = 7;
    candidate.setDate(candidate.getDate() + diff);
    return candidate.getTime();
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm">
          <div className="mb-1 text-slate-500">Filter destinations</div>
          <input
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            placeholder="Search channels or contacts"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </label>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-sm">
          <div className="mb-1 text-slate-500">Destination</div>
          <select
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            value={selectedDest}
            onChange={(e) => setSelectedDest(e.target.value)}
          >
            {filteredDestinationOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <div className="mb-1 text-slate-500">Recurrence</div>
          <select
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            value={recurrence}
            onChange={(e) => setRecurrence(e.target.value as "once" | "daily" | "weekly")}
          >
            <option value="once">Once</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
        </label>
        <label className="text-sm">
          <div className="mb-1 text-slate-500">Day</div>
          <select
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            value={day}
            onChange={(e) => setDay(e.target.value)}
          >
            {DAYS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <div className="mb-1 text-slate-500">Time</div>
          <input
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </label>
      </div>

      <label className="text-sm block">
        <div className="mb-1 text-slate-500">Message (max 200 chars)</div>
        <textarea
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          maxLength={200}
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          rows={3}
        />
      </label>

      <div className="flex gap-2">
        <Button onClick={handleAdd}>Add rule</Button>
        <Button variant="outline" onClick={handleSave}>
          Save rules
        </Button>
      </div>

      <div className="space-y-2">
        {rules.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-500">
            No rules for selected destination.
          </div>
        ) : (
          rules.map((r) => (
            <div
              key={`${r.day}-${r.time}-${r.msg}`}
              className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2 flex items-center justify-between"
            >
              <div className="text-sm">
                <div className="font-medium">{`${r.day} ${r.time}`}</div>
                <div className="text-slate-600 text-sm">{r.msg}</div>
              </div>
              <div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleRemove(`${r.day} ${r.time} — ${r.msg}`)}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
