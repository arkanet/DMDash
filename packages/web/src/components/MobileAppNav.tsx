import { defaultHuntConfig, useDarkMeshStore } from "@app/darkmesh/store.ts";
import LanguageSwitcher from "@components/LanguageSwitcher.tsx";
import ThemeSwitcher from "@components/ThemeSwitcher.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "@components/UI/Popover.tsx";
import { useAppStore, useDevice, useDeviceStore, useNodeDB } from "@core/stores";
import { cn } from "@core/utils/cn.ts";
import { useConnections } from "@pages/Connections/useConnections.ts";
import { useLocation, useNavigate } from "@tanstack/react-router";
import {
  CloudIcon,
  CrosshairIcon,
  MapIcon,
  MessageSquareIcon,
  MoreVerticalIcon,
  RadioTowerIcon,
  SettingsIcon,
  UsersIcon,
} from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

interface MobileAppNavProps {
  subNav?: React.ReactNode;
}

export function MobileAppNav({ subNav }: MobileAppNavProps) {
  const { unreadCounts } = useDevice();
  const { getNodesLength } = useNodeDB();
  const { connect, disconnect } = useConnections();
  const selectedDeviceId = useAppStore((state) => state.selectedDeviceId);
  const setCommandPaletteOpen = useAppStore((state) => state.setCommandPaletteOpen);
  const huntEnabled = useDarkMeshStore((state) =>
    selectedDeviceId === undefined
      ? defaultHuntConfig.enabled
      : (state.huntByDevice[selectedDeviceId] ?? defaultHuntConfig).enabled,
  );
  const navigate = useNavigate({ from: "/" });
  const pathname = useLocation({ select: (location) => location.pathname });
  const { t } = useTranslation("ui");
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [isAutoReconnecting, setIsAutoReconnecting] = useState(false);
  const lastAutoReconnectAtRef = useRef(0);
  const manualDisconnectConnectionIdRef = useRef<number | undefined>(undefined);

  const numUnread = [...unreadCounts.values()].reduce<number>((sum, v) => sum + Number(v || 0), 0);
  const nodeCount = Math.max(getNodesLength() - 1, 0);
  const activeLocalConnection = useDeviceStore((state) => {
    const activeId = state.activeConnectionId;
    const activeConnection = activeId
      ? state.savedConnections.find((connection) => connection.id === activeId)
      : undefined;
    const selectedDeviceConnection =
      selectedDeviceId === undefined
        ? undefined
        : state.savedConnections.find((connection) => connection.meshDeviceId === selectedDeviceId);
    const fallbackConnection = state.savedConnections.find((connection) =>
      ["connected", "configured", "configuring", "connecting"].includes(connection.status),
    );
    const connection = activeConnection ?? selectedDeviceConnection ?? fallbackConnection;
    return connection && connection.type !== "http" ? connection : undefined;
  });
  const localConnectionStatus = activeLocalConnection?.status;
  const isLocalConnectionConnected =
    localConnectionStatus === "connected" ||
    localConnectionStatus === "configured" ||
    localConnectionStatus === "configuring";
  const isLocalConnectionRestoring = isAutoReconnecting || localConnectionStatus === "connecting";

  useEffect(() => {
    setOverflowOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!activeLocalConnection) {
      setIsAutoReconnecting(false);
      return;
    }

    if (activeLocalConnection.type !== "bluetooth" && activeLocalConnection.type !== "serial") {
      return;
    }

    if (localConnectionStatus !== "disconnected" && localConnectionStatus !== "error") {
      if (
        localConnectionStatus === "connecting" &&
        manualDisconnectConnectionIdRef.current === activeLocalConnection.id
      ) {
        manualDisconnectConnectionIdRef.current = undefined;
      }
      setIsAutoReconnecting(false);
      return;
    }

    if (manualDisconnectConnectionIdRef.current === activeLocalConnection.id) {
      setIsAutoReconnecting(false);
      return;
    }

    const now = Date.now();
    if (now - lastAutoReconnectAtRef.current < 15_000) {
      return;
    }

    lastAutoReconnectAtRef.current = now;
    setIsAutoReconnecting(true);

    void connect(activeLocalConnection.id, { allowPrompt: false }).finally(() => {
      setIsAutoReconnecting(false);
    });
  }, [activeLocalConnection, connect, localConnectionStatus]);

  const tabItems = useMemo(
    () => [
      {
        key: "messages",
        label: t("navigation.messages"),
        icon: MessageSquareIcon,
        active: pathname.startsWith("/messages"),
        onClick: () => navigate({ to: "/messages" }),
        count: numUnread || undefined,
      },
      {
        key: "map",
        label: t("navigation.map"),
        icon: MapIcon,
        active: pathname.startsWith("/map"),
        onClick: () => navigate({ to: "/map" }),
      },
      {
        key: "advanced",
        label: "Channels",
        icon: RadioTowerIcon,
        active: pathname.startsWith("/channels"),
        onClick: () => navigate({ to: "/channels" }),
      },
      {
        key: "dashboard",
        label: "Dashboard",
        icon: SettingsIcon,
        active: pathname.startsWith("/dashboard"),
        onClick: () => navigate({ to: "/dashboard" }),
      },
    ],
    [navigate, numUnread, pathname, t],
  );

  const nodeTab = useMemo(
    () => ({
      key: "nodes",
      label: `${t("navigation.nodes")} (${nodeCount})`,
      icon: UsersIcon,
      active: pathname.startsWith("/nodes"),
      onClick: () => navigate({ to: "/nodes" }),
      count: nodeCount || undefined,
    }),
    [navigate, nodeCount, pathname, t],
  );

  const handleManualDisconnect = async () => {
    if (!activeLocalConnection) {
      return;
    }

    manualDisconnectConnectionIdRef.current = activeLocalConnection.id;
    setIsAutoReconnecting(false);
    await disconnect(activeLocalConnection.id);
    setOverflowOpen(false);
  };

  return (
    <div className="shrink-0 md:hidden">
      <div className="h-2 shrink-0 bg-[#8d0606]" />
      <div className="flex min-h-16 shrink-0 items-center gap-3 bg-[#262626] px-4 py-1 text-white">
        <img
          src="/darkmesh-dashboard-logo.png"
          alt="DarkMesh"
          className="size-12 max-h-12 shrink-0 object-contain"
        />
        <div className="min-w-0 flex-1 truncate text-[1.9rem] font-semibold italic leading-none">
          DarkMesh
        </div>
        <span
          role="img"
          className={cn(
            "inline-flex size-11 items-center justify-center",
            huntEnabled ? "text-white" : "text-zinc-600",
          )}
          aria-label={huntEnabled ? "Hunting Forwarder active" : "Hunting Forwarder inactive"}
          title={huntEnabled ? "Hunting Forwarder active" : "Hunting Forwarder inactive"}
        >
          <CrosshairIcon className="size-8" />
        </span>
        <button
          type="button"
          onClick={() => navigate({ to: "/connections" })}
          className={cn(
            "inline-flex size-11 items-center justify-center rounded-full",
            isLocalConnectionConnected ? "text-[#00e531]" : "text-red-500",
            isLocalConnectionRestoring &&
              "animate-pulse border border-red-500/80 shadow-[0_0_0_3px_rgba(239,68,68,0.22),0_0_18px_rgba(239,68,68,0.65)] blur-[0.2px]",
          )}
          aria-label={t("navigation.manageConnections", "Manage connections")}
          title={
            isLocalConnectionRestoring
              ? "Reconnecting to local device"
              : t("navigation.manageConnections", "Manage connections")
          }
        >
          <CloudIcon className="size-8" />
        </button>
        <Popover open={overflowOpen} onOpenChange={setOverflowOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex size-10 items-center justify-center text-zinc-300"
              aria-label="Menu"
            >
              <MoreVerticalIcon className="size-7" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={10}
            className="w-[min(18rem,calc(100vw-1.5rem))] border-zinc-800 bg-[#101010] p-0 text-zinc-100"
          >
            <div className="flex flex-col py-2 text-[1.05rem]">
              <button
                type="button"
                onClick={() => {
                  navigate({ to: "/settings/radio" });
                  setOverflowOpen(false);
                }}
                className="px-5 py-3 text-left hover:bg-[#242424]"
              >
                Settings
              </button>
              <button
                type="button"
                onClick={() => {
                  setCommandPaletteOpen(true);
                  setOverflowOpen(false);
                }}
                className="px-5 py-3 text-left hover:bg-[#242424]"
              >
                Extra Menu
              </button>
              {isLocalConnectionConnected && activeLocalConnection ? (
                <button
                  type="button"
                  onClick={() => void handleManualDisconnect()}
                  className="px-5 py-3 text-left text-red-400 hover:bg-[#242424]"
                >
                  Disconnect
                </button>
              ) : null}
              <div className="px-3 py-1">
                <div className="px-2 pb-1 text-sm text-zinc-500">Themes</div>
                <ThemeSwitcher className="h-11 w-full justify-start rounded-none px-2 text-zinc-100 hover:bg-[#242424]" />
              </div>
              <div className="px-3 py-1">
                <div className="px-2 pb-1 text-sm text-zinc-500">Language</div>
                <LanguageSwitcher className="h-11 w-full justify-start rounded-none px-2 text-zinc-100 hover:bg-[#242424]" />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="shrink-0 bg-[#101010] shadow-[0_10px_16px_rgba(0,0,0,0.28)]">
        <div className="grid h-[5.25rem] grid-cols-5">
          {[tabItems[0], nodeTab, tabItems[1], tabItems[2], tabItems[3]].map((item) => {
            if (!item) return null;
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                onClick={item.onClick}
                className={cn(
                  "relative flex items-center justify-center text-zinc-500 transition-colors",
                  item.active ? "text-[#8d0606]" : "text-zinc-500",
                )}
                aria-label={item.label}
              >
                <Icon className="size-8" strokeWidth={2.2} />
                {"count" in item && typeof item.count === "number" && item.count > 0 ? (
                  <span className="absolute right-3 top-4 rounded-full bg-[#8d0606] px-1.5 text-[0.65rem] leading-4 text-white">
                    {item.count}
                  </span>
                ) : null}
                {item.active ? (
                  <span className="absolute bottom-0 h-1 w-full bg-[#8d0606]" />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {subNav ? (
        <div className="border-t border-zinc-900 bg-[#101010] px-3 py-3">{subNav}</div>
      ) : null}
    </div>
  );
}
