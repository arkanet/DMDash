type CapacitorRuntime = {
  getPlatform?: () => string;
  isNativePlatform?: () => boolean;
};

const NATIVE_APP_BUILD = import.meta.env.VITE_DARKMESH_NATIVE_APP === "true";

function getCapacitorRuntime(): CapacitorRuntime | undefined {
  return (
    globalThis as typeof globalThis & {
      Capacitor?: CapacitorRuntime;
    }
  ).Capacitor;
}

export function isNativeAppShell(): boolean {
  if (NATIVE_APP_BUILD) {
    return true;
  }

  const capacitor = getCapacitorRuntime();
  if (typeof capacitor?.isNativePlatform === "function") {
    return capacitor.isNativePlatform();
  }

  const platform =
    typeof capacitor?.getPlatform === "function" ? capacitor.getPlatform() : undefined;
  return platform === "ios" || platform === "android";
}

export function getNativeAppPlatform(): string | undefined {
  const capacitor = getCapacitorRuntime();
  if (typeof capacitor?.getPlatform === "function") {
    return capacitor.getPlatform();
  }

  return NATIVE_APP_BUILD ? "ios" : undefined;
}
