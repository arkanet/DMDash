export const APP_SERVICE_WORKER_URL = "/sw.js";
export const APP_SERVICE_WORKER_SCOPE = "/";

export async function registerAppServiceWorker(): Promise<ServiceWorkerRegistration | undefined> {
  if (
    typeof navigator === "undefined" ||
    !("serviceWorker" in navigator) ||
    typeof window === "undefined" ||
    !window.isSecureContext
  ) {
    return undefined;
  }

  try {
    const existing = await navigator.serviceWorker.getRegistration(APP_SERVICE_WORKER_SCOPE);
    if (existing) {
      return existing;
    }

    return await navigator.serviceWorker.register(APP_SERVICE_WORKER_URL, {
      scope: APP_SERVICE_WORKER_SCOPE,
    });
  } catch (error) {
    console.warn("Unable to register DarkMesh service worker", error);
    return undefined;
  }
}

export async function getAppServiceWorkerRegistration(): Promise<
  ServiceWorkerRegistration | undefined
> {
  const registration = await registerAppServiceWorker();

  if (!registration) {
    return undefined;
  }

  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return registration;
  }
}
