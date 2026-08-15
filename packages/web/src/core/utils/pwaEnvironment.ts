type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

export function isIosLikeDevice(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  const userAgent = navigator.userAgent;
  const platform = navigator.platform;

  return (
    /iPad|iPhone|iPod/.test(userAgent) || (platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function isStandalonePwa(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as NavigatorWithStandalone).standalone === true
  );
}

export function isSecureAppContext(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return window.isSecureContext;
}
