import { useCallback, useSyncExternalStore } from "react";

type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

interface ThemeSnapshot {
  preference: Theme;
  theme: ResolvedTheme;
}

const THEME_STORAGE_KEY = "theme";
const THEME_CHANGE_EVENT = "theme-preference-change";
const themeSnapshotCache = new Map<string, ThemeSnapshot>();

function getSystemTheme() {
  return globalThis.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getStoredPreference(): Theme {
  if (typeof window === "undefined") {
    return "light";
  }

  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
}

function getCachedThemeSnapshot(preference: Theme, theme: ResolvedTheme): ThemeSnapshot {
  const cacheKey = `${preference}:${theme}`;
  const cached = themeSnapshotCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const snapshot = { preference, theme };
  themeSnapshotCache.set(cacheKey, snapshot);
  return snapshot;
}

function getThemeSnapshot(): ThemeSnapshot {
  const preference = getStoredPreference();
  const theme: ResolvedTheme = preference === "system" ? getSystemTheme() : preference;

  return getCachedThemeSnapshot(preference, theme);
}

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const media = globalThis.matchMedia("(prefers-color-scheme: dark)");

  const handleThemeChange = () => onStoreChange();
  const handleStorageChange = (event: StorageEvent) => {
    if (event.key === null || event.key === THEME_STORAGE_KEY) {
      onStoreChange();
    }
  };
  const handleSystemThemeChange = () => {
    if (getStoredPreference() === "system") {
      onStoreChange();
    }
  };

  window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange);
  window.addEventListener("storage", handleStorageChange);
  media.addEventListener("change", handleSystemThemeChange);

  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange);
    window.removeEventListener("storage", handleStorageChange);
    media.removeEventListener("change", handleSystemThemeChange);
  };
}

export function useTheme() {
  const { theme, preference } = useSyncExternalStore(subscribe, getThemeSnapshot, () =>
    getCachedThemeSnapshot("light", "light"),
  );

  const setPreferenceValue = useCallback((newPreference: Theme) => {
    if (getStoredPreference() === newPreference) {
      return;
    }

    localStorage.setItem(THEME_STORAGE_KEY, newPreference);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }, []);

  return { theme, preference, setPreference: setPreferenceValue };
}
