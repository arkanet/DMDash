export type SignalTone = {
  background: string;
  label: string;
  value: string;
};

export function getMissingMetricTone(isDarkTheme: boolean): SignalTone {
  if (isDarkTheme) {
    return {
      background: "rgba(255,255,255,0.08)",
      label: "rgba(228,228,231,0.7)",
      value: "rgba(244,244,245,0.92)",
    };
  }

  return {
    background: "rgb(0 0 0 / 0.1)",
    label: "rgba(24, 24, 27, 0.72)",
    value: "rgba(24, 24, 27, 0.95)",
  };
}

export function getTraceroutePanelTheme(isDarkTheme: boolean) {
  return {
    containerClass: isDarkTheme
      ? "border border-white/10 bg-[#222] text-zinc-100"
      : "border border-black/10 bg-[#f1f1f1] text-gray-800",
    titleClass: isDarkTheme ? "text-zinc-100" : "text-gray-800",
    mutedTextClass: isDarkTheme ? "text-zinc-400" : "text-gray-600",
    routeInfoChipClass: isDarkTheme
      ? "text-zinc-400"
      : "rounded-xl border border-black/50 bg-black/[0.15] px-3 py-2 text-gray-700",
    nodeButtonClass: isDarkTheme
      ? "border border-white/10 bg-white/5 text-zinc-100"
      : "border border-black/50 bg-black/10 text-gray-800",
    nodeHexClass: isDarkTheme ? "text-zinc-400" : "text-gray-600",
    tracePriorityLabelClass: isDarkTheme ? "text-zinc-400" : "text-gray-600",
    tracePriorityOffClass: isDarkTheme
      ? "border border-slate-400 bg-transparent text-zinc-100"
      : "border border-black/50 bg-black/[0.15] text-gray-800",
    actionButtonClass: isDarkTheme
      ? "border-white/20 bg-white/5 text-zinc-100 hover:bg-white/10 hover:text-zinc-100"
      : "border-black/50 bg-black/10 text-gray-800 hover:bg-black/[0.15] hover:text-gray-800",
  };
}
