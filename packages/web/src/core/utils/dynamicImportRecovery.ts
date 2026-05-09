const DYNAMIC_IMPORT_ERROR_PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /error loading dynamically imported module/i,
];

const RECOVERY_STORAGE_PREFIX = "darkmesh-dynamic-import-recovery";

function getBuildKey(): string {
  return [
    import.meta.env.VITE_COMMIT_HASH ?? "unknown",
    import.meta.env.VITE_VERSION ?? "unknown",
  ].join(":");
}

function getRecoveryStorageKey(): string {
  return `${RECOVERY_STORAGE_PREFIX}:${getBuildKey()}`;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return `${error.message}\n${error.stack ?? ""}`;
  }

  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message);
  }

  return String(error ?? "");
}

export function isDynamicImportError(error: unknown): boolean {
  const message = getErrorMessage(error);
  return DYNAMIC_IMPORT_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

export function recoverFromDynamicImportError(error: unknown): boolean {
  if (!isDynamicImportError(error) || typeof window === "undefined") {
    return false;
  }

  const storageKey = getRecoveryStorageKey();
  const alreadyRetried = window.sessionStorage.getItem(storageKey) === "1";

  if (alreadyRetried) {
    return false;
  }

  window.sessionStorage.setItem(storageKey, "1");

  void navigator.serviceWorker?.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      void registration.update();
    }
  });

  window.setTimeout(() => {
    window.location.reload();
  }, 50);

  return true;
}

export function installDynamicImportRecovery(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.addEventListener("error", (event) => {
    if (recoverFromDynamicImportError(event.error ?? event.message)) {
      event.preventDefault();
    }
  });

  window.addEventListener("unhandledrejection", (event) => {
    if (recoverFromDynamicImportError(event.reason)) {
      event.preventDefault();
    }
  });
}
