import { CommandDialog, CommandGroup, CommandItem, CommandList } from "@components/UI/Command.tsx";
import { usePinnedItems } from "@core/hooks/usePinnedItems.ts";
import { useAppStore, useDevice } from "@core/stores";
import { cn } from "@core/utils/cn.ts";
import { useCommandState } from "cmdk";
import {
  BarChart2Icon,
  BatteryWarningIcon,
  BoxSelectIcon,
  BugIcon,
  FactoryIcon,
  HardDriveUpload,
  InfoIcon,
  type LucideIcon,
  Pin,
  PowerIcon,
  RadioTowerIcon,
  RefreshCwIcon,
  TrashIcon,
} from "lucide-react";
import type { ReactElement } from "react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";

export interface Group {
  id: string;
  label: string;
  icon: LucideIcon;
  commands: Command[];
}
export interface Command {
  label: string;
  icon: LucideIcon;
  action?: () => void;
  subItems?: SubItem[];
  tags?: string[];
}
export interface SubItem {
  label: string;
  icon: ReactElement | null;
  action: () => void;
}

export const CommandPalette = () => {
  const { commandPaletteOpen, setCommandPaletteOpen } = useAppStore();
  const { setDialogOpen } = useDevice();
  const navigate = useNavigate({ from: "/" });
  const { pinnedItems, togglePinnedItem } = usePinnedItems({
    storageName: "pinnedCommandMenuGroups",
  });
  const { t } = useTranslation("commandPalette");

  const groups: Group[] = [
    {
      id: "darkmeshGroup",
      label: t("darkmesh.label", "DarkMesh"),
      icon: RadioTowerIcon,
      commands: [
        {
          label: t("darkmesh.command.batteryAlerts", "Battery Alerts"),
          icon: BatteryWarningIcon,
          action() {
            setDialogOpen("batteryAlerts", true);
          },
        },
        {
          label: t("darkmesh.command.meshStats", "Mesh Stats"),
          icon: BarChart2Icon,
          action() {
            setDialogOpen("meshStats", true);
          },
        },
        {
          label: t("darkmesh.command.information", "Information"),
          icon: InfoIcon,
          action() {
            setDialogOpen("appInformation", true);
          },
        },
      ],
    },
    {
      id: "contextualGroup",
      label: t("contextual.label"),
      icon: BoxSelectIcon,
      commands: [
        {
          label: t("contextual.command.debugPanel", "Debug Panel"),
          icon: BugIcon,
          action() {
            void navigate({ to: "/debug" });
          },
        },
        {
          label: t("contextual.command.nodeImport", "Node Import"),
          icon: HardDriveUpload,
          action() {
            setDialogOpen("nodeImport", true);
          },
        },
        {
          label: t("contextual.command.scheduleShutdown"),
          icon: PowerIcon,
          action() {
            setDialogOpen("shutdown", true);
          },
        },
        {
          label: t("contextual.command.scheduleReboot"),
          icon: RefreshCwIcon,
          action() {
            setDialogOpen("reboot", true);
          },
        },
        {
          label: t("contextual.command.resetNodeDb"),
          icon: TrashIcon,
          action() {
            setDialogOpen("resetNodeDb", true);
          },
        },
        {
          label: t("contextual.command.factoryResetDevice"),
          icon: FactoryIcon,
          action() {
            setDialogOpen("factoryResetDevice", true);
          },
        },
        {
          label: t("contextual.command.factoryResetConfig"),
          icon: FactoryIcon,
          action() {
            setDialogOpen("factoryResetConfig", true);
          },
        },
      ],
    },
  ];

  const sortedGroups = [...groups].sort((a, b) => {
    const aPinned = pinnedItems.includes(a.id) ? 1 : 0;
    const bPinned = pinnedItems.includes(b.id) ? 1 : 0;
    return bPinned - aPinned;
  });

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };

    globalThis.addEventListener("keydown", handleKeydown);
    return () => globalThis.removeEventListener("keydown", handleKeydown);
  }, [setCommandPaletteOpen]);

  return (
    <CommandDialog open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen}>
      <CommandList>
        {sortedGroups.map((group) => (
          <CommandGroup
            key={group.label}
            heading={
              <div className="flex items-center justify-between">
                <span>{group.label}</span>
                <button
                  type="button"
                  onClick={() => togglePinnedItem(group.id)}
                  className={cn(
                    "transition-all duration-300 scale-100 cursor-pointer p-2 focus:*:data-label:opacity-100",
                  )}
                >
                  <span
                    data-label
                    className="transition-all block absolute w-full mb-auto mt-auto ml-0 mr-0 text-xs left-0 -top-5 opacity-0 rounded-lg"
                  />
                  <Pin
                    size={16}
                    className={cn(
                      "transition-opacity",
                      pinnedItems.includes(group.id)
                        ? "opacity-100 text-red-500"
                        : "opacity-40 hover:opacity-70",
                    )}
                  />
                </button>
              </div>
            }
          >
            {group.commands.map((command) => (
              <div key={command.label}>
                <CommandItem
                  onSelect={() => {
                    command.action?.();
                    setCommandPaletteOpen(false);
                  }}
                >
                  <command.icon size={16} className="mr-2" />
                  {command.label}
                </CommandItem>
                {command.subItems?.map((subItem) => (
                  <SubItem
                    key={subItem.label}
                    label={subItem.label}
                    icon={subItem.icon}
                    action={subItem.action}
                  />
                ))}
              </div>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
};

const SubItem = ({
  label,
  icon,
  action,
}: {
  label: string;
  icon: ReactElement | null;
  action: () => void;
}) => {
  const search = useCommandState((state) => state.search);
  if (!search) {
    return null;
  }

  return (
    <CommandItem onSelect={action}>
      {icon as never}
      {label}
    </CommandItem>
  );
};
