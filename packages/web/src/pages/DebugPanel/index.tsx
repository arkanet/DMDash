import { PageLayout } from "@components/PageLayout.tsx";
import { MAX_DEBUG_LOGS, type DebugLogEntry, useDebugStore, useDevice } from "@core/stores";
import { cn } from "@core/utils/cn.ts";
import { Protobuf } from "@meshtastic/core";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeftIcon, SearchIcon, TrashIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

function formatTimestamp(value: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  }).format(value);
}

function getEntryTone(entry: DebugLogEntry): string {
  switch (entry.level) {
    case Protobuf.Mesh.LogRecord_Level.CRITICAL:
    case Protobuf.Mesh.LogRecord_Level.ERROR:
      return "border-red-300 bg-red-50 text-red-950 dark:border-red-500/40 dark:bg-red-950/20 dark:text-red-100";
    case Protobuf.Mesh.LogRecord_Level.WARNING:
      return "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/20 dark:text-amber-100";
    case Protobuf.Mesh.LogRecord_Level.INFO:
      return "border-sky-300 bg-sky-50 text-sky-950 dark:border-sky-500/35 dark:bg-sky-950/15 dark:text-sky-100";
    case Protobuf.Mesh.LogRecord_Level.DEBUG:
    case Protobuf.Mesh.LogRecord_Level.TRACE:
      return "border-slate-300 bg-white text-slate-950 dark:border-zinc-700/80 dark:bg-zinc-950/40 dark:text-zinc-100";
    default:
      return entry.kind === "fromRadio"
        ? "border-slate-300 bg-slate-50 text-slate-950 dark:border-slate-700/80 dark:bg-slate-950/35 dark:text-slate-100"
        : "border-slate-300 bg-background-secondary text-text-primary dark:border-zinc-700/80 dark:bg-black/30 dark:text-zinc-100";
  }
}

function getBadgeTone(entry: DebugLogEntry): string {
  switch (entry.level) {
    case Protobuf.Mesh.LogRecord_Level.CRITICAL:
    case Protobuf.Mesh.LogRecord_Level.ERROR:
      return "bg-red-100 text-red-700 ring-red-300 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-500/30";
    case Protobuf.Mesh.LogRecord_Level.WARNING:
      return "bg-amber-100 text-amber-700 ring-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30";
    case Protobuf.Mesh.LogRecord_Level.INFO:
      return "bg-sky-100 text-sky-700 ring-sky-300 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30";
    case Protobuf.Mesh.LogRecord_Level.DEBUG:
    case Protobuf.Mesh.LogRecord_Level.TRACE:
      return "bg-zinc-100 text-zinc-700 ring-zinc-300 dark:bg-zinc-500/15 dark:text-zinc-300 dark:ring-zinc-500/30";
    default:
      return "bg-slate-100 text-slate-700 ring-slate-300 dark:bg-slate-500/15 dark:text-slate-300 dark:ring-slate-500/30";
  }
}

function matchesFilter(entry: DebugLogEntry, filter: string): boolean {
  if (!filter) {
    return true;
  }

  const haystack = [entry.title, entry.source, entry.kind, entry.message].join("\n").toLowerCase();
  return haystack.includes(filter);
}

function DebugLogRow({ entry }: { entry: DebugLogEntry }) {
  const timestamp = formatTimestamp(entry.deviceTime ?? entry.receivedAt);
  const receivedTimestamp =
    entry.deviceTime && entry.deviceTime !== entry.receivedAt
      ? formatTimestamp(entry.receivedAt)
      : undefined;

  return (
    <article className={cn("rounded-md border px-3 py-2 shadow-sm", getEntryTone(entry))}>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <span
          className={cn(
            "rounded px-2 py-1 font-semibold uppercase tracking-[0.08em] ring-1",
            getBadgeTone(entry),
          )}
        >
          {entry.title}
        </span>
        {entry.source ? (
          <span className="rounded bg-slate-200 px-2 py-1 font-mono text-slate-700 dark:bg-black/20 dark:text-zinc-300">
            {entry.source}
          </span>
        ) : null}
        <span className="ml-auto font-mono text-slate-500 dark:text-zinc-400">{timestamp}</span>
        {receivedTimestamp ? (
          <span className="font-mono text-slate-400 dark:text-zinc-500">
            rx {receivedTimestamp}
          </span>
        ) : null}
      </div>
      <pre className="select-text whitespace-pre-wrap break-words font-mono text-[0.78rem] leading-5 text-inherit">
        {entry.message}
      </pre>
    </article>
  );
}

export default function DebugPanelPage() {
  const navigate = useNavigate({ from: "/" });
  const device = useDevice();
  const allEntries = useDebugStore((state) => state.entries);
  const clearLogs = useDebugStore((state) => state.clear);
  const [search, setSearch] = useState("");
  const [showDesktopDebugApiHelp, setShowDesktopDebugApiHelp] = useState(false);
  const [showMobileDebugApiHelp, setShowMobileDebugApiHelp] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const entries = useMemo(
    () => allEntries.filter((entry) => entry.deviceId === device.id),
    [allEntries, device.id],
  );
  const filter = search.trim().toLowerCase();
  const filteredEntries = useMemo(
    () => entries.filter((entry) => matchesFilter(entry, filter)),
    [entries, filter],
  );
  const debugLogApiEnabled = device.config.security?.debugLogApiEnabled ?? false;
  const debugLogApiTitle = debugLogApiEnabled
    ? "Firmware Debug Log API enabled: firmware LogRecord output can be streamed into this panel."
    : "Firmware Debug Log API disabled: enable it from Settings > Radio > Security > Logging Settings.";
  const debugApiInstructions =
    "Enable/disable: Settings -> Radio -> Security -> Logging Settings -> Enable Debug Log API";
  const debugApiIndicatorClasses = cn(
    "inline-flex w-fit items-center rounded-md px-3 py-2 text-sm font-semibold ring-1",
    debugLogApiEnabled
      ? "bg-emerald-50 text-emerald-700 ring-emerald-300 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30"
      : "bg-amber-50 text-amber-700 ring-amber-300 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30",
  );
  const clearButtonClasses =
    "inline-flex h-10 shrink-0 items-center gap-2 rounded-md border border-slate-300 bg-background-secondary px-3 text-sm font-semibold text-text-primary transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900";

  const handleClearLogs = () => clearLogs(device.id);

  const handleBack = () => {
    if (globalThis.history.length > 1) {
      globalThis.history.back();
      return;
    }

    void navigate({ to: "/map" });
  };

  useEffect(() => {
    const list = listRef.current;
    if (!list || list.scrollTop > 96) {
      return;
    }

    list.scrollTo({ top: 0 });
  }, [entries.length]);

  return (
    <PageLayout
      label="Debug Panel"
      noPadding
      headerContent={
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex h-10 w-fit shrink-0 items-center gap-2 rounded-md border border-slate-300 bg-background-secondary px-3 text-sm font-semibold text-text-primary transition-colors hover:bg-slate-200 dark:border-slate-700 dark:hover:bg-slate-900"
            >
              <ArrowLeftIcon className="size-4" />
              <span>Back</span>
            </button>

            <span className="min-w-0 truncate text-center text-lg font-semibold tracking-[0.08em] uppercase text-text-primary">
              Debug Panel
            </span>

            <div className="flex min-w-0 items-center justify-end gap-2">
              <button
                type="button"
                aria-expanded={showDesktopDebugApiHelp}
                aria-controls="debug-log-api-desktop-help"
                title={debugLogApiTitle}
                onClick={() => setShowDesktopDebugApiHelp((visible) => !visible)}
                className={debugApiIndicatorClasses}
              >
                Debug Log API {debugLogApiEnabled ? "enabled" : "disabled"}
              </button>
              <button
                type="button"
                disabled={entries.length === 0}
                onClick={handleClearLogs}
                className={clearButtonClasses}
              >
                <TrashIcon className="size-4 text-slate-700 dark:text-zinc-100" />
                <span>Clear</span>
              </button>
            </div>
          </div>

          {showDesktopDebugApiHelp ? (
            <p
              id="debug-log-api-desktop-help"
              className="text-right text-xs leading-5 text-text-secondary"
            >
              {debugApiInstructions}
            </p>
          ) : null}
        </div>
      }
      mobileSubNav={
        <div className="space-y-2">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2">
            <span className="min-w-0 truncate text-sm font-semibold tracking-[0.08em] uppercase text-text-primary">
              Debug Panel
            </span>
            <button
              type="button"
              aria-expanded={showMobileDebugApiHelp}
              aria-controls="debug-log-api-mobile-help"
              title={debugLogApiTitle}
              onClick={() => setShowMobileDebugApiHelp((visible) => !visible)}
              className={cn(
                debugApiIndicatorClasses,
                "max-w-[9.75rem] overflow-hidden px-2 py-1 text-[0.68rem]",
              )}
            >
              <span className="truncate">
                Debug Log API {debugLogApiEnabled ? "enabled" : "disabled"}
              </span>
            </button>
            <button
              type="button"
              disabled={entries.length === 0}
              onClick={handleClearLogs}
              className={cn(clearButtonClasses, "h-9 px-2 text-xs")}
            >
              <TrashIcon className="size-4 text-slate-700 dark:text-zinc-100" />
              <span>Clear</span>
            </button>
          </div>

          {showMobileDebugApiHelp ? (
            <p id="debug-log-api-mobile-help" className="text-xs leading-5 text-text-secondary">
              {debugApiInstructions}
            </p>
          ) : null}
        </div>
      }
      contentClassName="bg-background-primary text-text-primary"
    >
      <section className="flex h-full min-h-0 flex-col text-text-primary">
        <div className="shrink-0 border-b border-slate-300 bg-background-primary px-4 py-3 dark:border-slate-800">
          <p className="hidden text-sm text-text-secondary md:block">
            {MAX_DEBUG_LOGS} last messages - {entries.length} captured
          </p>

          <div className="relative max-w-xl md:mt-3">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500 dark:text-zinc-500" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filter debug output"
              className="h-10 w-full rounded-md border border-slate-300 bg-background-secondary py-2 pl-9 pr-3 text-sm text-text-primary outline-none placeholder:text-slate-500 focus:border-slate-500 focus:ring-1 focus:ring-slate-500 dark:border-slate-700 dark:bg-zinc-950 dark:placeholder:text-zinc-500"
            />
          </div>
        </div>

        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-3 md:px-4">
          {filteredEntries.length === 0 ? (
            <div className="flex h-full min-h-[18rem] items-center justify-center text-center">
              <div className="max-w-lg rounded-md border border-slate-300 bg-background-secondary/80 px-6 py-5 dark:border-slate-800 dark:bg-black/40">
                <p className="text-base font-semibold text-text-primary">
                  No debug output captured.
                </p>
                <p className="mt-2 text-sm leading-6 text-text-secondary">
                  Enable Debug Log API in Security settings and keep the device connected. Firmware
                  LogRecord entries and raw FromRadio traffic will appear here.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2 pb-4">
              {filteredEntries.map((entry) => (
                <DebugLogRow key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </div>
      </section>
    </PageLayout>
  );
}
