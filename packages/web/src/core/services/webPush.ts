import { getAppServiceWorkerRegistration } from "@core/services/pwa.ts";
import {
  isIosLikeDevice,
  isSecureAppContext,
  isStandalonePwa,
} from "@core/utils/pwaEnvironment.ts";

export type WebPushState =
  | "unsupported"
  | "requires-install"
  | "missing-public-key"
  | "missing-subscribe-endpoint"
  | "permission-denied"
  | "ready"
  | "subscribed";

export type WebPushStatus = {
  state: WebPushState;
  subscription?: PushSubscription;
};

const WEB_PUSH_PUBLIC_KEY = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY?.trim() ?? "";
const WEB_PUSH_SUBSCRIBE_URL = import.meta.env.VITE_WEB_PUSH_SUBSCRIBE_URL?.trim() ?? "";
const WEB_PUSH_UNSUBSCRIBE_URL = import.meta.env.VITE_WEB_PUSH_UNSUBSCRIBE_URL?.trim() ?? "";

function hasWebPushSupport(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    "Notification" in window &&
    "PushManager" in window &&
    "serviceWorker" in navigator &&
    isSecureAppContext()
  );
}

function urlBase64ToArrayBuffer(value: string): ArrayBuffer {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output = new Uint8Array(new ArrayBuffer(rawData.length));

  for (let index = 0; index < rawData.length; index += 1) {
    output[index] = rawData.charCodeAt(index);
  }

  return output.buffer;
}

function serializeSubscription(subscription: PushSubscription) {
  return {
    subscription: subscription.toJSON(),
    userAgent: navigator.userAgent,
    app: "DMDash",
    createdAt: new Date().toISOString(),
  };
}

async function postSubscription(url: string, subscription: PushSubscription): Promise<void> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(serializeSubscription(subscription)),
  });

  if (!response.ok) {
    throw new Error(`Push subscription endpoint returned ${response.status}`);
  }
}

export async function getWebPushStatus(): Promise<WebPushStatus> {
  if (isIosLikeDevice() && !isStandalonePwa()) {
    return { state: "requires-install" };
  }

  if (!hasWebPushSupport()) {
    return { state: "unsupported" };
  }

  if (!WEB_PUSH_PUBLIC_KEY) {
    return { state: "missing-public-key" };
  }

  if (!WEB_PUSH_SUBSCRIBE_URL) {
    return { state: "missing-subscribe-endpoint" };
  }

  if (Notification.permission === "denied") {
    return { state: "permission-denied" };
  }

  const registration = await getAppServiceWorkerRegistration();
  const subscription = await registration?.pushManager.getSubscription();

  return subscription ? { state: "subscribed", subscription } : { state: "ready" };
}

export async function subscribeToWebPush(): Promise<PushSubscription> {
  const status = await getWebPushStatus();

  if (status.state === "subscribed" && status.subscription) {
    return status.subscription;
  }

  if (status.state !== "ready") {
    throw new Error(`Web Push is not ready: ${status.state}`);
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(`Notification permission is ${permission}`);
  }

  const registration = await getAppServiceWorkerRegistration();
  if (!registration) {
    throw new Error("DarkMesh service worker is not available");
  }

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToArrayBuffer(WEB_PUSH_PUBLIC_KEY),
  });

  try {
    await postSubscription(WEB_PUSH_SUBSCRIBE_URL, subscription);
  } catch (error) {
    await subscription.unsubscribe();
    throw error;
  }

  return subscription;
}

export async function unsubscribeFromWebPush(): Promise<void> {
  const registration = await getAppServiceWorkerRegistration();
  const subscription = await registration?.pushManager.getSubscription();

  if (!subscription) {
    return;
  }

  if (WEB_PUSH_UNSUBSCRIBE_URL) {
    try {
      await postSubscription(WEB_PUSH_UNSUBSCRIBE_URL, subscription);
    } catch (error) {
      console.warn("Unable to notify Web Push unsubscribe endpoint", error);
    }
  }

  await subscription.unsubscribe();
}
