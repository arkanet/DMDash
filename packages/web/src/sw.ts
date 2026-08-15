/// <reference lib="webworker" />

import { clientsClaim, setCacheNameDetails } from "workbox-core";
import { ExpirationPlugin } from "workbox-expiration";
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from "workbox-precaching";
import type { PrecacheEntry } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { CacheFirst, StaleWhileRevalidate } from "workbox-strategies";
import { CacheableResponsePlugin } from "workbox-cacheable-response";

type DarkMeshPushPayload = {
  title?: string;
  body?: string;
  tag?: string;
  url?: string;
  icon?: string;
  badge?: string;
  lang?: string;
  timestamp?: number;
  requireInteraction?: boolean;
  silent?: boolean;
  data?: Record<string, unknown>;
};

type DarkMeshNotificationOptions = NotificationOptions & {
  timestamp?: number;
};

declare global {
  interface ServiceWorkerGlobalScope {
    __WB_MANIFEST: Array<PrecacheEntry | string>;
  }

  interface Window {
    __WB_MANIFEST: Array<PrecacheEntry | string>;
  }
}

const sw = self as unknown as ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<PrecacheEntry | string>;
};

const DEFAULT_NOTIFICATION_ICON = "/darkmesh-dashboard-192.png";
const DEFAULT_NOTIFICATION_BADGE = "/darkmesh-dashboard-180.png";
const DEFAULT_NOTIFICATION_URL = "/dashboard";

setCacheNameDetails({
  prefix: "darkmesh-dashboard",
  precache: "precache",
  runtime: "runtime",
});

sw.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

registerRoute(
  ({ request, url }) =>
    url.origin === sw.location.origin &&
    (request.destination === "script" ||
      request.destination === "style" ||
      request.destination === "worker"),
  new StaleWhileRevalidate({
    cacheName: "darkmesh-dashboard-assets",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 80,
        maxAgeSeconds: 30 * 24 * 60 * 60,
        purgeOnQuotaError: true,
      }),
    ],
  }),
);

registerRoute(
  ({ request, url }) =>
    url.origin === sw.location.origin &&
    (request.destination === "image" || request.destination === "font"),
  new CacheFirst({
    cacheName: "darkmesh-dashboard-static",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 160,
        maxAgeSeconds: 90 * 24 * 60 * 60,
        purgeOnQuotaError: true,
      }),
    ],
  }),
);

registerRoute(
  ({ request, url }) =>
    url.origin === sw.location.origin &&
    request.destination === "" &&
    (url.pathname.startsWith("/i18n/") || url.pathname.endsWith(".json")),
  new StaleWhileRevalidate({
    cacheName: "darkmesh-dashboard-data",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 120,
        maxAgeSeconds: 7 * 24 * 60 * 60,
        purgeOnQuotaError: true,
      }),
    ],
  }),
);

registerRoute(
  new NavigationRoute(createHandlerBoundToURL("/index.html"), {
    denylist: [/^\/api\//, /^\/guide\/.*\.html$/],
  }),
);

function parsePushPayload(data: PushMessageData | null): DarkMeshPushPayload {
  if (!data) {
    return {};
  }

  try {
    const parsed = data.json() as DarkMeshPushPayload;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {
      title: "DarkMesh notification",
      body: data.text(),
    };
  }
}

function safeSameOriginUrl(url: string | undefined): string {
  if (!url) {
    return DEFAULT_NOTIFICATION_URL;
  }

  try {
    const target = new URL(url, sw.location.origin);
    return target.origin === sw.location.origin ? target.href : DEFAULT_NOTIFICATION_URL;
  } catch {
    return DEFAULT_NOTIFICATION_URL;
  }
}

function getNotificationOptions(payload: DarkMeshPushPayload): DarkMeshNotificationOptions {
  const targetUrl = safeSameOriginUrl(payload.url ?? String(payload.data?.url ?? ""));

  return {
    body: payload.body,
    icon: payload.icon ?? DEFAULT_NOTIFICATION_ICON,
    badge: payload.badge ?? DEFAULT_NOTIFICATION_BADGE,
    tag: payload.tag,
    lang: payload.lang,
    timestamp: payload.timestamp,
    requireInteraction: payload.requireInteraction,
    silent: payload.silent,
    data: {
      ...(payload.data ?? {}),
      url: targetUrl,
    },
  };
}

sw.addEventListener("push", (event) => {
  const payload = parsePushPayload(event.data);
  const title = payload.title || "DarkMesh notification";

  event.waitUntil(sw.registration.showNotification(title, getNotificationOptions(payload)));
});

sw.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const target = safeSameOriginUrl(
    String(event.notification.data?.url ?? DEFAULT_NOTIFICATION_URL),
  );

  event.waitUntil(
    sw.clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then((clients) => {
        const matchingClient = clients.find((client) => {
          return new URL(client.url).origin === sw.location.origin;
        });

        if (matchingClient) {
          return matchingClient.focus().then((client) => {
            if ("navigate" in client && client.url !== target) {
              return client.navigate(target);
            }

            return client;
          });
        }

        return sw.clients.openWindow(target);
      }),
  );
});

sw.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    void sw.skipWaiting();
  }
});
