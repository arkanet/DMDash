// Central logger for core package
// Usage: import { logger } from "./utils/logger";
const LEVELS = ["debug", "info", "warn", "error", "silent"] as const;
type Level = (typeof LEVELS)[number];

function getDefaultLevel(): Level {
  try {
    // prefer environment override if provided
    const env = (process && (process.env as any)?.DM_LOG_LEVEL) as Level | undefined;
    if (env && LEVELS.includes(env)) return env;
    return (process.env.NODE_ENV === "production" ? "warn" : "debug") as Level;
  } catch {
    return "warn";
  }
}

let currentLevel: Level = getDefaultLevel();

function levelIndex(l: Level) {
  return LEVELS.indexOf(l as Level);
}

function enabled(level: Level) {
  return levelIndex(level) >= levelIndex(currentLevel);
}

export const logger = {
  debug: (...args: any[]) => {
    if (enabled("debug")) console.debug("[DM-core]", ...args);
  },
  info: (...args: any[]) => {
    if (enabled("info")) console.info("[DM-core]", ...args);
  },
  warn: (...args: any[]) => {
    if (enabled("warn")) console.warn("[DM-core]", ...args);
  },
  error: (...args: any[]) => {
    if (enabled("error")) console.error("[DM-core]", ...args);
  },
  setLevel: (l: Level) => {
    currentLevel = LEVELS.includes(l) ? l : currentLevel;
  },
  enabled,
};

export default logger;
