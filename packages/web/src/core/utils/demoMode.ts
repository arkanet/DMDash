export function isDemoModeEnabled(): boolean {
  if (import.meta.env.DEV) {
    return true;
  }

  if (typeof window === "undefined") {
    return false;
  }

  const host = window.location.hostname.toLowerCase();
  return host === "dmdemo.arkantiko.com";
}
