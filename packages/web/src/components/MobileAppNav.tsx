import { defaultHuntConfig, useDarkMeshStore } from "@app/darkmesh/store.ts";
import LanguageSwitcher from "@components/LanguageSwitcher.tsx";
import ThemeSwitcher from "@components/ThemeSwitcher.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "@components/UI/Popover.tsx";
import { Spinner } from "@components/UI/Spinner.tsx";
import { useAppStore, useDevice, useDeviceStore, useNodeDB } from "@core/stores";
import { cn } from "@core/utils/cn.ts";
import { useConnections } from "@pages/Connections/useConnections.ts";
import { useLocation, useNavigate } from "@tanstack/react-router";
import {
  BookOpenIcon,
  CloudIcon,
  CrosshairIcon,
  MapIcon,
  MessageSquareIcon,
  MoreVerticalIcon,
  RadioTowerIcon,
  UsersIcon,
} from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

type MobileNavIcon = React.ElementType<{
  className?: string;
  strokeWidth?: number;
}>;

interface MobileActionItem {
  key: string;
  icon?: MobileNavIcon;
  iconClasses?: string;
  onClick?: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  ariaLabel?: string;
  label?: string;
  className?: string;
  subActions?: MobileActionItem[];
}

interface MobileAppNavProps {
  actions?: MobileActionItem[];
  subNav?: React.ReactNode;
}

const GaugeHighIcon = ({ className }: { className?: string }) => (
  <svg
    aria-hidden="true"
    focusable="false"
    viewBox="0 0 512 512"
    className={className}
    fill="currentColor"
  >
    <path d="M0 256a256 256 0 1 1 512 0 256 256 0 1 1 -512 0zM288 96a32 32 0 1 0 -64 0 32 32 0 1 0 64 0zM256 416c35.3 0 64-28.7 64-64 0-16.2-6-31.1-16-42.3l69.5-138.9c5.9-11.9 1.1-26.3-10.7-32.2s-26.3-1.1-32.2 10.7L261.1 288.2c-1.7-.1-3.4-.2-5.1-.2-35.3 0-64 28.7-64 64s28.7 64 64 64zM176 144a32 32 0 1 0 -64 0 32 32 0 1 0 64 0zM96 288a32 32 0 1 0 0-64 32 32 0 1 0 0 64zm352-32a32 32 0 1 0 -64 0 32 32 0 1 0 64 0z" />
  </svg>
);

export function MobileAppNav({ actions, subNav }: MobileAppNavProps) {
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
  const [actionPopoverOpen, setActionPopoverOpen] = useState<string | undefined>();
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
      ["connected", "configured", "configuring", "connecting", "reconnecting"].includes(
        connection.status,
      ),
    );
    const connection = activeConnection ?? selectedDeviceConnection ?? fallbackConnection;
    return connection && connection.type !== "http" ? connection : undefined;
  });
  const localConnectionStatus = activeLocalConnection?.status;
  const isLocalConnectionConnected =
    localConnectionStatus === "connected" ||
    localConnectionStatus === "configured" ||
    localConnectionStatus === "configuring";
  const isLocalConnectionRestoring =
    isAutoReconnecting ||
    localConnectionStatus === "connecting" ||
    localConnectionStatus === "reconnecting";

  useEffect(() => {
    setOverflowOpen(false);
    setActionPopoverOpen(undefined);
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
        (localConnectionStatus === "connecting" || localConnectionStatus === "reconnecting") &&
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

    void connect(activeLocalConnection.id, {
      allowPrompt: false,
      reconnect: true,
    }).finally(() => {
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
        icon: GaugeHighIcon,
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

  const mobileActions = useMemo(
    () =>
      (actions ?? []).filter((action) => {
        if (action.className?.includes("opacity-0")) {
          return false;
        }
        if (action.key === "save" && action.disabled && !action.isLoading) {
          return false;
        }
        return true;
      }),
    [actions],
  );

  return (
    <div className="shrink-0 md:hidden">
      <div className="h-2 shrink-0 bg-[#8d0606]" />
      <div className="flex min-h-16 shrink-0 items-center gap-3 border-b border-slate-300 bg-background-secondary px-4 py-1 text-text-primary shadow-[0_10px_16px_rgba(15,23,42,0.08)] dark:border-zinc-900 dark:bg-[#262626] dark:text-white dark:shadow-[0_10px_16px_rgba(0,0,0,0.28)]">
        <img
          src="/darkmesh-dashboard-logo.png"
          alt="DarkMesh"
          className="size-12 max-h-12 shrink-0 rounded-xl border border-white/10 bg-black/80 object-contain p-1 shadow-[0_0_18px_rgba(0,0,0,0.18)]"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="truncate text-[1.9rem] font-semibold italic leading-none">
              DarkMesh
            </span>
            <img src="/logo_web.svg" alt="WEB" className="h-6 w-auto shrink-0 object-contain" />
          </div>
        </div>
        <span
          role="img"
          className={cn(
            "inline-flex size-11 items-center justify-center",
            huntEnabled ? "text-text-primary dark:text-white" : "text-slate-400 dark:text-zinc-600",
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
              className="inline-flex size-10 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
              aria-label="Menu"
            >
              <MoreVerticalIcon className="size-7" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={10}
            className="w-[min(18rem,calc(100vw-1.5rem))] border-slate-200 bg-white p-0 text-slate-900 shadow-xl dark:border-zinc-800 dark:bg-[#101010] dark:text-zinc-100"
          >
            <div className="flex flex-col py-2 text-[1.05rem]">
              <button
                type="button"
                onClick={() => {
                  navigate({ to: "/guide" });
                  setOverflowOpen(false);
                }}
                className="flex items-center gap-3 px-5 py-3 text-left text-slate-800 hover:bg-slate-100 dark:text-zinc-100 dark:hover:bg-[#242424]"
              >
                <BookOpenIcon className="size-5" />
                GUIDE
              </button>
              <button
                type="button"
                onClick={() => {
                  navigate({ to: "/settings/radio" });
                  setOverflowOpen(false);
                }}
                className="px-5 py-3 text-left text-slate-800 hover:bg-slate-100 dark:text-zinc-100 dark:hover:bg-[#242424]"
              >
                Settings
              </button>
              <button
                type="button"
                onClick={() => {
                  setCommandPaletteOpen(true);
                  setOverflowOpen(false);
                }}
                className="px-5 py-3 text-left text-slate-800 hover:bg-slate-100 dark:text-zinc-100 dark:hover:bg-[#242424]"
              >
                Extra Menu
              </button>
              {isLocalConnectionConnected && activeLocalConnection ? (
                <button
                  type="button"
                  onClick={() => void handleManualDisconnect()}
                  className="px-5 py-3 text-left text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-[#242424]"
                >
                  Disconnect
                </button>
              ) : null}
              <div className="px-3 py-1">
                <ThemeSwitcher className="h-11 w-full justify-start rounded-none px-2 text-slate-800 hover:bg-slate-100 dark:text-zinc-100 dark:hover:bg-[#242424]" />
              </div>
              <div className="px-3 py-1">
                <LanguageSwitcher className="h-11 w-full justify-start rounded-none px-2 text-slate-800 hover:bg-slate-100 dark:text-zinc-100 dark:hover:bg-[#242424]" />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="shrink-0 border-b border-slate-300 bg-background-secondary shadow-[0_10px_16px_rgba(15,23,42,0.08)] dark:border-zinc-900 dark:bg-[#101010] dark:shadow-[0_10px_16px_rgba(0,0,0,0.28)]">
        <div className="grid h-[3.5rem] grid-cols-5">
          {[tabItems[0], nodeTab, tabItems[1], tabItems[2], tabItems[3]].map((item) => {
            if (!item) return null;
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                onClick={item.onClick}
                className={cn(
                  "relative flex items-center justify-center text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-slate-900 dark:text-zinc-500 dark:hover:bg-zinc-900 dark:hover:text-zinc-100",
                  item.active
                    ? "text-[#8d0606] dark:text-[#b91c1c]"
                    : "text-slate-500 dark:text-zinc-500",
                )}
                aria-label={item.label}
              >
                <Icon className="size-8" strokeWidth={2.2} />
                {"count" in item && typeof item.count === "number" && item.count > 0 ? (
                  <span className="relative right-2 top-2 rounded-full bg-[#8d0606] px-1.5 text-[0.65rem] leading-4 text-white">
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
        <div className="border-t border-slate-300 bg-background-secondary px-3 py-3 dark:border-zinc-900 dark:bg-[#101010]">
          {subNav}
        </div>
      ) : null}

      {mobileActions.length > 0 ? (
        <div className="border-t border-slate-300 bg-background-secondary px-3 py-2 dark:border-zinc-900 dark:bg-[#101010]">
          <div className="flex items-center gap-2 overflow-x-auto">
            {mobileActions.map((action) => {
              const Icon = action.icon;
              const isDisabled = action.disabled || action.isLoading;

              if (action.subActions?.length) {
                return (
                  <Popover
                    key={action.key}
                    open={actionPopoverOpen === action.key}
                    onOpenChange={(open) => setActionPopoverOpen(open ? action.key : undefined)}
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        disabled={isDisabled}
                        aria-label={action.ariaLabel || action.label || `Action ${action.key}`}
                        aria-disabled={action.disabled}
                        aria-busy={action.isLoading}
                        className={cn(
                          "inline-flex h-10 shrink-0 items-center gap-2 rounded-md border border-slate-300 bg-background-primary px-3 text-sm font-medium text-text-primary",
                          "disabled:cursor-not-allowed disabled:opacity-50",
                          "hover:bg-slate-200 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900",
                          action.className,
                        )}
                      >
                        {Icon ? (
                          action.isLoading ? (
                            <Spinner size="sm" />
                          ) : (
                            <Icon className={cn("size-4", action.iconClasses)} />
                          )
                        ) : null}
                        {action.label ? (
                          <span className="whitespace-nowrap">{action.label}</span>
                        ) : null}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="end"
                      sideOffset={8}
                      className="w-[min(18rem,calc(100vw-1.5rem))] border-slate-200 bg-white p-1 text-slate-900 shadow-xl dark:border-zinc-800 dark:bg-[#101010] dark:text-zinc-100"
                    >
                      <div className="flex flex-col py-1">
                        {action.subActions.map((subAction) => {
                          const SubIcon = subAction.icon;
                          return (
                            <button
                              key={subAction.key}
                              type="button"
                              disabled={subAction.disabled || subAction.isLoading}
                              onClick={() => {
                                subAction.onClick?.();
                                setActionPopoverOpen(undefined);
                              }}
                              className={cn(
                                "flex items-center gap-2 rounded-sm px-3 py-2 text-left text-sm font-medium",
                                "disabled:cursor-not-allowed disabled:opacity-50",
                                "hover:bg-slate-100 dark:hover:bg-[#242424]",
                                subAction.className,
                              )}
                            >
                              {SubIcon ? (
                                subAction.isLoading ? (
                                  <Spinner size="sm" />
                                ) : (
                                  <SubIcon className={cn("size-4", subAction.iconClasses)} />
                                )
                              ) : null}
                              {subAction.label ? (
                                <span className="min-w-0 truncate">{subAction.label}</span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>
                );
              }

              return (
                <button
                  key={action.key}
                  type="button"
                  disabled={isDisabled}
                  onClick={action.onClick}
                  aria-label={action.ariaLabel || action.label || `Action ${action.key}`}
                  aria-disabled={action.disabled}
                  aria-busy={action.isLoading}
                  className={cn(
                    "inline-flex h-10 shrink-0 items-center gap-2 rounded-md border border-slate-300 bg-background-primary px-3 text-sm font-medium text-text-primary",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    "hover:bg-slate-200 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900",
                    action.key === "unsavedChanges" &&
                      "border-blue-500/60 bg-blue-500 text-slate-950 hover:bg-blue-500",
                    action.className,
                  )}
                >
                  {Icon ? (
                    action.isLoading ? (
                      <Spinner size="sm" />
                    ) : (
                      <Icon className={cn("size-4", action.iconClasses)} />
                    )
                  ) : null}
                  {action.label ? <span className="whitespace-nowrap">{action.label}</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
