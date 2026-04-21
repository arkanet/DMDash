// Central logger for web package
// Usage: import { logger } from "@core/utils/logger";
// To enable verbose logs in dev, set localStorage.setItem('DM_LOG_LEVEL','debug')
const LEVELS = ["debug", "info", "warn", "error", "silent"] as const;
type Level = (typeof LEVELS)[number];

function getDefaultLevel(): Level {
  try {
    if (typeof window !== "undefined") {
      const v = window.localStorage.getItem("DM_LOG_LEVEL");
      if (v && LEVELS.includes(v as Level)) return v as Level;
      // default: debug in non-production, warn in production
      // import.meta.env may not exist in all environments; fall back to NODE_ENV
      let mode: string | undefined;
      try {
        const meta = import.meta as unknown as { env?: { MODE?: string } } | undefined;
        mode = meta?.env?.MODE;
      } catch {
        // ignore
      }
      mode = mode ?? process.env.NODE_ENV;
      return mode === "production" ? "warn" : "debug";
    }
  } catch {}
  return "warn";
}

let currentLevel: Level = getDefaultLevel();

function levelIndex(l: Level) {
  return LEVELS.indexOf(l as Level);
}

function enabled(level: Level) {
  return levelIndex(level) >= levelIndex(currentLevel);
}

export const logger = {
  debug: (...args: unknown[]) => {
    if (enabled("debug")) console.debug("[DM]", ...(args as unknown[]));
  },
  info: (...args: unknown[]) => {
    if (enabled("info")) console.info("[DM]", ...(args as unknown[]));
  },
  warn: (...args: unknown[]) => {
    if (enabled("warn")) console.warn("[DM]", ...(args as unknown[]));
  },
  error: (...args: unknown[]) => {
    if (enabled("error")) console.error("[DM]", ...(args as unknown[]));
  },
  setLevel: (l: Level) => {
    currentLevel = LEVELS.includes(l) ? l : currentLevel;
    try {
      if (typeof window !== "undefined") window.localStorage.setItem("DM_LOG_LEVEL", currentLevel);
    } catch {}
  },
  enabled,
};

export default logger;
