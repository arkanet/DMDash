import type {
  Notification as StoredNotification,
  NotificationType,
} from "@core/stores/notificationsStore/index.ts";
import { getAppServiceWorkerRegistration } from "@core/services/pwa.ts";
import {
  isIosLikeDevice,
  isSecureAppContext,
  isStandalonePwa,
} from "@core/utils/pwaEnvironment.ts";

export type BrowserNotificationPermission = NotificationPermission | "unsupported";
export type BrowserNotificationEventType = "messages" | "nodes" | "distress" | "battery" | "system";
export type BrowserNotificationSound = "chime" | "beep";

type BrowserNotificationOptions = {
  title: string;
  body?: string;
  tag?: string;
  url?: string;
  priority?: number;
};

type WindowWithWebkitAudio = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

const DEFAULT_ICON = "/darkmesh-dashboard-192.png";
const DEFAULT_BADGE = "/darkmesh-dashboard-180.png";
const DEFAULT_SOUND_VOLUME = 0.16;

let notificationAudioContext: AudioContext | undefined;

function hasNotificationSupport(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

function isSecureNotificationContext(): boolean {
  return isSecureAppContext();
}

export function getBrowserNotificationPermission(): BrowserNotificationPermission {
  if (
    !hasNotificationSupport() ||
    !isSecureNotificationContext() ||
    (isIosLikeDevice() && !isStandalonePwa())
  ) {
    return "unsupported";
  }

  return Notification.permission;
}

export async function requestBrowserNotificationPermission(): Promise<BrowserNotificationPermission> {
  const currentPermission = getBrowserNotificationPermission();
  if (currentPermission === "unsupported") {
    return currentPermission;
  }

  const permission = await Notification.requestPermission();

  if (permission === "granted") {
    await registerBrowserNotificationWorker();
  }

  return permission;
}

export async function registerBrowserNotificationWorker(): Promise<
  ServiceWorkerRegistration | undefined
> {
  return getAppServiceWorkerRegistration();
}

function getAudioContextConstructor(): typeof AudioContext | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.AudioContext ?? (window as WindowWithWebkitAudio).webkitAudioContext;
}

async function getNotificationAudioContext(): Promise<AudioContext | undefined> {
  const AudioContextConstructor = getAudioContextConstructor();
  if (!AudioContextConstructor) {
    return undefined;
  }

  notificationAudioContext ??= new AudioContextConstructor();

  if (notificationAudioContext.state === "suspended") {
    await notificationAudioContext.resume();
  }

  return notificationAudioContext;
}

export async function unlockBrowserNotificationSound(): Promise<boolean> {
  try {
    const audioContext = await getNotificationAudioContext();
    return audioContext?.state === "running";
  } catch (error) {
    console.warn("Unable to unlock browser notification sound", error);
    return false;
  }
}

function playTone(
  audioContext: AudioContext,
  {
    frequency,
    startAt,
    duration,
    volume,
    type = "sine",
  }: {
    frequency: number;
    startAt: number;
    duration: number;
    volume: number;
    type?: OscillatorType;
  },
) {
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startAt);

  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.02);

  oscillator.onended = () => {
    oscillator.disconnect();
    gain.disconnect();
  };
}

function playChimeSound(audioContext: AudioContext, priority: number) {
  const startAt = audioContext.currentTime + 0.005;
  const volume = priority >= 4 ? DEFAULT_SOUND_VOLUME * 1.15 : DEFAULT_SOUND_VOLUME;

  playTone(audioContext, {
    frequency: 988,
    startAt,
    duration: 0.18,
    volume,
    type: "sine",
  });
  playTone(audioContext, {
    frequency: 1318.51,
    startAt: startAt + 0.055,
    duration: 0.22,
    volume: volume * 0.82,
    type: "sine",
  });

  if (priority >= 4) {
    playTone(audioContext, {
      frequency: 1760,
      startAt: startAt + 0.18,
      duration: 0.16,
      volume: volume * 0.6,
      type: "triangle",
    });
  }
}

function playBeepSound(audioContext: AudioContext, priority: number) {
  const startAt = audioContext.currentTime;
  const duration = priority >= 4 ? 0.32 : 0.18;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = priority >= 4 ? "square" : "sine";
  oscillator.frequency.setValueAtTime(priority >= 4 ? 880 : 660, startAt);
  if (priority >= 4) {
    oscillator.frequency.setValueAtTime(740, startAt + 0.16);
  }

  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(DEFAULT_SOUND_VOLUME, startAt + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.02);

  oscillator.onended = () => {
    oscillator.disconnect();
    gain.disconnect();
  };
}

export async function playBrowserNotificationSound(
  priority = 1,
  sound: BrowserNotificationSound = "chime",
): Promise<boolean> {
  try {
    const audioContext = await getNotificationAudioContext();
    if (!audioContext || audioContext.state !== "running") {
      return false;
    }

    if (sound === "beep") {
      playBeepSound(audioContext, priority);
    } else {
      playChimeSound(audioContext, priority);
    }

    return true;
  } catch (error) {
    console.warn("Unable to play browser notification sound", error);
    return false;
  }
}

function truncate(value: string, maxLength = 140): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3)}...`;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function formatBatteryBody(notification: StoredNotification): string {
  const batteryLevel = optionalNumber(notification.payload?.batteryLevel);
  const voltage = optionalNumber(notification.payload?.voltage);
  const parts: string[] = [];

  if (batteryLevel !== undefined) {
    parts.push(`${batteryLevel}%`);
  }

  if (voltage !== undefined) {
    parts.push(`${voltage.toFixed(2)} V`);
  }

  return parts.length > 0 ? parts.join(" | ") : "Battery is below the configured threshold.";
}

export function getBrowserNotificationEventType(
  type: NotificationType,
): BrowserNotificationEventType {
  switch (type) {
    case "direct_message":
    case "broadcast_message":
      return "messages";
    case "node_detected":
      return "nodes";
    case "distress_beacon":
    case "beacon_send":
    case "beacon_failed":
      return "distress";
    case "low_battery":
      return "battery";
    default:
      return "system";
  }
}

export function formatBrowserNotification(
  notification: StoredNotification,
): BrowserNotificationOptions {
  const title = optionalString(notification.payload?.title);
  const detail = optionalString(notification.payload?.detail);
  const message = optionalString(notification.payload?.message);
  const sender = optionalString(notification.payload?.senderName);
  const nodeNum = optionalNumber(notification.nodeNum ?? notification.payload?.nodeNum);

  switch (notification.type) {
    case "direct_message":
      return {
        title:
          title ??
          `Direct message from ${sender ?? (nodeNum !== undefined ? `Node ${nodeNum}` : "node")}`,
        body: truncate(message ?? detail ?? "New direct message"),
        tag: `darkmesh-message-direct-${nodeNum ?? notification.id}`,
        url:
          optionalString(notification.payload?.url) ??
          (nodeNum !== undefined ? `/messages/direct/${nodeNum}` : "/messages"),
        priority: notification.priority,
      };

    case "broadcast_message":
      return {
        title:
          title ??
          `Channel message from ${sender ?? (nodeNum !== undefined ? `Node ${nodeNum}` : "node")}`,
        body: truncate(message ?? detail ?? "New broadcast message"),
        tag: `darkmesh-message-broadcast-${optionalNumber(notification.payload?.channel) ?? notification.id}`,
        url: optionalString(notification.payload?.url) ?? "/messages",
        priority: notification.priority,
      };

    case "distress_beacon":
      return {
        title:
          title ??
          `Distress beacon from ${sender ?? (nodeNum !== undefined ? `Node ${nodeNum}` : "node")}`,
        body: truncate(message ?? detail ?? "Distress beacon received"),
        tag: `darkmesh-distress-${nodeNum ?? notification.id}`,
        url: optionalString(notification.payload?.url) ?? "/messages",
        priority: notification.priority,
      };

    case "node_detected":
      return {
        title: title ?? "New Meshtastic node detected",
        body: truncate(
          detail ?? sender ?? (nodeNum !== undefined ? `Node ${nodeNum}` : "A new node was heard"),
        ),
        tag: `darkmesh-node-${nodeNum ?? notification.id}`,
        url: optionalString(notification.payload?.url) ?? "/nodes",
        priority: notification.priority,
      };

    case "low_battery":
      return {
        title: title ?? `Low battery${nodeNum !== undefined ? `: Node ${nodeNum}` : ""}`,
        body: truncate(detail ?? formatBatteryBody(notification)),
        tag: `darkmesh-battery-${nodeNum ?? notification.id}`,
        url: optionalString(notification.payload?.url) ?? "/dashboard",
        priority: notification.priority,
      };

    case "beacon_send":
      return {
        title: title ?? "Distress beacon sent",
        body: truncate(message ?? detail ?? "DarkMesh distress beacon was sent."),
        tag: `darkmesh-beacon-send-${nodeNum ?? notification.id}`,
        url: optionalString(notification.payload?.url) ?? "/dashboard",
        priority: notification.priority,
      };

    case "beacon_failed":
      return {
        title: title ?? "Distress beacon failed",
        body: truncate(
          optionalString(notification.payload?.error) ??
            detail ??
            "DarkMesh distress beacon failed.",
        ),
        tag: `darkmesh-beacon-failed-${notification.id}`,
        url: optionalString(notification.payload?.url) ?? "/dashboard",
        priority: notification.priority,
      };

    default:
      return {
        title: title ?? "DarkMesh notification",
        body: truncate(detail ?? message ?? "New notification"),
        tag: `darkmesh-${notification.type}-${notification.id}`,
        url: optionalString(notification.payload?.url) ?? "/dashboard",
        priority: notification.priority,
      };
  }
}

export async function showBrowserNotification(
  options: BrowserNotificationOptions,
): Promise<boolean> {
  if (getBrowserNotificationPermission() !== "granted") {
    return false;
  }

  const notificationOptions: NotificationOptions & {
    renotify?: boolean;
    vibrate?: VibratePattern;
  } = {
    body: options.body,
    icon: DEFAULT_ICON,
    badge: DEFAULT_BADGE,
    tag: options.tag,
    silent: false,
    renotify: (options.priority ?? 0) >= 4,
    vibrate: (options.priority ?? 0) >= 4 ? [120, 80, 120] : [80],
    data: {
      url: options.url ?? "/",
    },
  };

  const registration = await registerBrowserNotificationWorker();

  if (registration?.showNotification) {
    await registration.showNotification(options.title, notificationOptions);
    return true;
  }

  try {
    const notification = new Notification(options.title, notificationOptions);
    notification.onclick = () => {
      window.focus();
      const targetUrl = options.url;
      if (targetUrl) {
        window.location.href = targetUrl;
      }
      notification.close();
    };
    return true;
  } catch (error) {
    console.warn("Unable to show browser notification", error);
    return false;
  }
}

export async function showStoredBrowserNotification(
  notification: StoredNotification,
): Promise<boolean> {
  return showBrowserNotification(formatBrowserNotification(notification));
}
