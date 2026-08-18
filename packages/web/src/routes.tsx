import type { useAppStore, useMessageStore } from "@core/stores";
import { Connections } from "@pages/Connections/index.tsx";
import React from "react";
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";
import type { useTranslation } from "react-i18next";
import { App } from "./App.tsx";

const ChannelsPage = React.lazy(() => import("@pages/ChannelsPage.tsx"));
const DarkMeshDashboardPage = React.lazy(() => import("@app/darkmesh/DashboardPage.tsx"));
const DebugPanelPage = React.lazy(() => import("@pages/DebugPanel/index.tsx"));
const DialogManager = React.lazy(() =>
  import("@components/Dialog/DialogManager.tsx").then((module) => ({
    default: module.DialogManager,
  })),
);
const GuidePage = React.lazy(() => import("@pages/Guide/index.tsx"));
const InstallIOSPage =
  import.meta.env.VITE_DARKMESH_NATIVE_APP === "true"
    ? React.lazy(async () => ({ default: () => null }))
    : React.lazy(() => import("@pages/InstallIOS/index.tsx"));
const MapPage = React.lazy(() => import("@pages/Map/index.tsx"));
const MessagesPage = React.lazy(() => import("@pages/Messages.tsx"));
const NodesPage = React.lazy(() => import("@pages/Nodes/index.tsx"));
const RemoteAdminPage = React.lazy(() => import("@pages/RemoteAdmin/index.tsx"));
const ScheduledMessagesPage = React.lazy(
  () => import("@pages/ScheduledMessagesPage/ScheduledMessagesPage.tsx"),
);
const ConfigPage = React.lazy(() => import("@pages/Settings/index.tsx"));

interface AppContext {
  stores: {
    app: ReturnType<typeof useAppStore>;
    message: ReturnType<typeof useMessageStore>;
  };
  i18n: ReturnType<typeof useTranslation>;
}

function parseBoundedIntParam(value: string, label: string, min: number, max: number): number {
  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue < min || numberValue > max) {
    throw new Error(`${label} must be an integer between ${min} and ${max}.`);
  }

  return numberValue;
}

function parseBoundedNumberParam(value: string, label: string, min: number, max: number): number {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue < min || numberValue > max) {
    throw new Error(`${label} must be a number between ${min} and ${max}.`);
  }

  return numberValue;
}

function parseMessageType(value: string): "direct" | "broadcast" {
  if (value === "direct" || value === "broadcast") {
    return value;
  }

  throw new Error('Type must be "direct" or "broadcast".');
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
    type: parseMessageType(params.type),
    chatId: parseBoundedIntParam(params.chatId, "chatId", 0, 4294967294), // max is 0xffffffff - 1
  }),
});

const mapRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/map",
  component: MapPage,
});

export const mapWithParamsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/map/$long/$lat/$zoom",
  component: MapPage,
  parseParams: (params) => ({
    long: parseBoundedNumberParam(params.long, "longitude", -180, 180),
    lat: parseBoundedNumberParam(params.lat, "latitude", -90, 90),
    // Typical web map zoom levels are around 0..22.
    zoom: parseBoundedIntParam(params.zoom, "zoom", 0, 22),
  }),
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
    nodeNum: parseBoundedIntParam(params.nodeNum, "nodeNum", 0, 4294967294),
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

const installIOSRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/install/ios",
  component: InstallIOSPage,
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
  installIOSRoute,
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
