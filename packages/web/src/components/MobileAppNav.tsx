import LanguageSwitcher from "@components/LanguageSwitcher.tsx";
import ThemeSwitcher from "@components/ThemeSwitcher.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "@components/UI/Popover.tsx";
import { useAppStore, useDevice, useNodeDB } from "@core/stores";
import { cn } from "@core/utils/cn.ts";
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
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

interface MobileAppNavProps {
  subNav?: React.ReactNode;
}

export function MobileAppNav({ subNav }: MobileAppNavProps) {
  const { unreadCounts } = useDevice();
  const { getNodesLength } = useNodeDB();
  const { setCommandPaletteOpen } = useAppStore();
  const navigate = useNavigate({ from: "/" });
  const pathname = useLocation({ select: (location) => location.pathname });
  const { t } = useTranslation("ui");
  const [overflowOpen, setOverflowOpen] = useState(false);

  const numUnread = [...unreadCounts.values()].reduce<number>((sum, v) => sum + Number(v || 0), 0);
  const nodeCount = Math.max(getNodesLength() - 1, 0);

  const openHuntingForwarder = () => {
    navigate({ to: "/dashboard" });
    window.setTimeout(() => {
      const target = document.getElementById("hunting-forwarder");
      target?.scrollIntoView({ block: "start", behavior: "smooth" });
      if (target) {
        window.history.replaceState(null, "", "/dashboard#hunting-forwarder");
      }
    }, 80);
  };

  useEffect(() => {
    setOverflowOpen(false);
  }, [pathname]);

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

  return (
    <div className="md:hidden">
      <div className="h-2 bg-[#8d0606]" />
      <div className="flex h-16 items-center gap-3 bg-[#262626] px-4 text-white">
        <img
          src="/darkmesh-dashboard-logo.png"
          alt="DarkMesh"
          className="size-12 shrink-0 object-contain"
        />
        <div className="min-w-0 flex-1 text-[1.9rem] font-semibold italic leading-none">
          DarkMesh
        </div>
        <button
          type="button"
          onClick={openHuntingForwarder}
          className="inline-flex size-11 items-center justify-center text-white"
          aria-label="Hunting Forwarder"
        >
          <CrosshairIcon className="size-8" />
        </button>
        <button
          type="button"
          onClick={() => navigate({ to: "/connections" })}
          className="inline-flex size-11 items-center justify-center text-[#00e531]"
          aria-label={t("navigation.manageConnections", "Manage connections")}
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

      <div className="bg-[#101010] shadow-[0_10px_16px_rgba(0,0,0,0.28)]">
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
