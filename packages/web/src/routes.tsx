import { DialogManager } from "@components/Dialog/DialogManager.tsx";
import type { useAppStore, useMessageStore } from "@core/stores";
import DarkMeshDashboardPage from "@app/darkmesh/DashboardPage.tsx";
import { Connections } from "@pages/Connections/index.tsx";
import DebugPanelPage from "@pages/DebugPanel/index.tsx";
import ChannelsPage from "@pages/ChannelsPage.tsx";
import GuidePage from "@pages/Guide/index.tsx";
import React from "react";
const MapPage = React.lazy(() => import("@pages/Map/index.tsx"));
import MessagesPage from "@pages/Messages.tsx";
import NodesPage from "@pages/Nodes/index.tsx";
import RemoteAdminPage from "@pages/RemoteAdmin/index.tsx";
import ScheduledMessagesPage from "@pages/ScheduledMessagesPage/ScheduledMessagesPage.tsx";
import ConfigPage from "@pages/Settings/index.tsx";
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";
import type { useTranslation } from "react-i18next";
import { z } from "zod/v4";
import { App } from "./App.tsx";

interface AppContext {
  stores: {
    app: ReturnType<typeof useAppStore>;
    message: ReturnType<typeof useMessageStore>;
  };
  i18n: ReturnType<typeof useTranslation>;
}

export const rootRoute = createRootRouteWithContext<AppContext>()({
  component: () => <App />,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Connections,
  loader: () => {
    return redirect({ to: "/connections", replace: true });
  },
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dashboard",
  component: DarkMeshDashboardPage,
});

const messagesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/messages",
  component: MessagesPage,
  beforeLoad: ({ params }) => {
    const DEFAULT_CHANNEL = 0;

    if (Object.values(params).length === 0) {
      throw redirect({
        to: `/messages/broadcast/${DEFAULT_CHANNEL}`,
        replace: true,
      });
    }
  },
});

export const messagesWithParamsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/messages/$type/$chatId",
  component: MessagesPage,
  parseParams: (params) => ({
    type: z
      .enum(["direct", "broadcast"])
      .refine((val) => val === "direct" || val === "broadcast", {
        message: 'Type must be "direct" or "broadcast".',
      })
      .parse(params.type),
    chatId: z.coerce.number().int().min(0).max(4294967294).parse(params.chatId), // max is 0xffffffff - 1
  }),
});

const mapRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/map",
  component: MapPage,
});

const coordParamsSchema = z.object({
  // Accept "strings" from the URL, coerce to number, then validate
  long: z.coerce
    .number()
    .refine((n) => Number.isFinite(n) && n >= -180 && n <= 180, "Invalid longitude (-180..180)."),
  lat: z.coerce
    .number()
    .refine((n) => Number.isFinite(n) && n >= -90 && n <= 90, "Invalid latitude (-90..90)."),
  // Typical web map zoom levels ~0..22 (adjust if your map lib differs)
  zoom: z.coerce.number().int().min(0, "Zoom too small.").max(22, "Zoom too large."),
});

export const mapWithParamsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/map/$long/$lat/$zoom",
  component: MapPage,
  parseParams: (raw) => coordParamsSchema.parse(raw),
  // // This controls how params are serialized when you navigate/link
  // stringifyParams: (p) => ({
  //   long: String(p.long),
  //   lat: String(p.lat),
  //   zoom: String(p.zoom),
  // }),
});

export const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: ConfigPage,
  // beforeLoad: () => {
  //   throw redirect({
  //     to: "/settings/radio",
  //     replace: true,
  //   });
  // },
});

export const radioRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "radio",
  component: ConfigPage,
});

export const deviceRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "device",
  component: ConfigPage,
});

export const moduleRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "module",
  component: ConfigPage,
});

export const remoteAdminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/remote-admin/$nodeNum",
  component: RemoteAdminPage,
  parseParams: (params) => ({
    nodeNum: z.coerce.number().int().min(0).max(4294967294).parse(params.nodeNum),
  }),
});

export const remoteAdminRadioRoute = createRoute({
  getParentRoute: () => remoteAdminRoute,
  path: "radio",
  component: RemoteAdminPage,
});

export const remoteAdminDeviceRoute = createRoute({
  getParentRoute: () => remoteAdminRoute,
  path: "device",
  component: RemoteAdminPage,
});

export const remoteAdminModuleRoute = createRoute({
  getParentRoute: () => remoteAdminRoute,
  path: "module",
  component: RemoteAdminPage,
});

const nodesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/nodes",
  component: NodesPage,
});

const scheduledMessagesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/scheduled-messages",
  component: ScheduledMessagesPage,
});

const debugPanelRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/debug",
  component: DebugPanelPage,
});

const channelsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/channels",
  component: ChannelsPage,
});

const dialogWithParamsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dialog/$dialogId",
  component: DialogManager,
});

const connectionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/connections",
  component: Connections,
});

const guideRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/guide",
  component: () => <GuidePage variant="landing" />,
});

const guideIndexHtmlRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/guide/index.html",
  component: () => <GuidePage variant="landing" />,
});

const guideEnglishRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/guide/en",
  component: () => <GuidePage variant="en" />,
});

const guideEnglishIndexHtmlRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/guide/en/index.html",
  component: () => <GuidePage variant="en" />,
});

const guideItalianRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/guide/it",
  component: () => <GuidePage variant="it" />,
});

const guideItalianIndexHtmlRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/guide/it/index.html",
  component: () => <GuidePage variant="it" />,
});

export const routeTree = rootRoute.addChildren([
  indexRoute,
  dashboardRoute,
  messagesRoute,
  messagesWithParamsRoute,
  mapRoute,
  mapWithParamsRoute,
  settingsRoute.addChildren([radioRoute, deviceRoute, moduleRoute]),
  remoteAdminRoute.addChildren([
    remoteAdminRadioRoute,
    remoteAdminDeviceRoute,
    remoteAdminModuleRoute,
  ]),
  nodesRoute,
  scheduledMessagesRoute,
  debugPanelRoute,
  channelsRoute,
  dialogWithParamsRoute,
  connectionsRoute,
  guideRoute,
  guideIndexHtmlRoute,
  guideEnglishRoute,
  guideEnglishIndexHtmlRoute,
  guideItalianRoute,
  guideItalianIndexHtmlRoute,
]);

const router = createRouter({
  routeTree,
  context: {
    stores: {
      app: {} as ReturnType<typeof useAppStore>,
      message: {} as ReturnType<typeof useMessageStore>,
    },
    i18n: {} as ReturnType<typeof import("react-i18next").useTranslation>,
  },
});
export { router };
