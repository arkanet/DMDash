import { deviceRoute, moduleRoute, radioRoute } from "@app/routes";
import { create, toBinary } from "@bufbuild/protobuf";
import { PageLayout } from "@components/PageLayout.tsx";
import { Sidebar } from "@components/Sidebar.tsx";
import { LeftSidebarButton } from "@components/UI/Sidebar/LeftSidebarButton.tsx";
import { SidebarSection } from "@components/UI/Sidebar/SidebarSection.tsx";
import { useConfigTarget } from "@core/hooks/useConfigTarget.tsx";
import { useToast } from "@core/hooks/useToast.ts";
import {
  type ValidConfigType,
  type ValidModuleConfigType,
  useDevice,
  useDeviceStore,
  useMessageStore,
  useMessages,
  useNodeDB,
  useNodeDBStore,
} from "@core/stores";
import { cn } from "@core/utils/cn.ts";
import {
  isExpectedRebootDisconnectError,
  markExpectedDeviceReconnect,
} from "@core/utils/rebootReconnect.ts";
import {
  getSettingsMetadata,
  isConfigTabSupported,
  isModuleConfigTabSupported,
} from "@core/utils/settingsCapabilities.ts";
import { Protobuf, Types } from "@meshtastic/core";
import { DeviceConfig } from "@pages/Settings/DeviceConfig.tsx";
import { ModuleConfig } from "@pages/Settings/ModuleConfig.tsx";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ActivityIcon,
  ArrowLeftIcon,
  BellIcon,
  BluetoothIcon,
  ChevronRightIcon,
  CloudIcon,
  DatabaseIcon,
  ForwardIcon,
  GaugeIcon,
  LayersIcon,
  LightbulbIcon,
  ListIcon,
  MapPinIcon,
  MessageSquareIcon,
  MonitorIcon,
  PowerIcon,
  PlugIcon,
  RadioTowerIcon,
  RefreshCwIcon,
  RouterIcon,
  SaveIcon,
  SaveOff,
  ServerCogIcon,
  ShieldIcon,
  Trash2Icon,
  UsbIcon,
  UserIcon,
  UsersIcon,
  Volume2Icon,
  WifiIcon,
  type LucideIcon,
} from "lucide-react";
import {
  type ComponentType,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { RadioConfig } from "./RadioConfig.tsx";

type LocalConfigSection = "radio" | "device" | "module";
type LocalRadioTab = "lora" | "channels" | "security";
type LocalDeviceTab =
  | "user"
  | "device"
  | "position"
  | "power"
  | "network"
  | "display"
  | "bluetooth";
type LocalConfigPanelTab = LocalRadioTab | LocalDeviceTab | ValidModuleConfigType;
type LocalDeviceAction = "reboot" | "hibernate" | "factoryResetDevice" | "nodeDbReset";
type LocalConfigPanelItem = {
  key: string;
  section: LocalConfigSection;
  tab: LocalConfigPanelTab;
  label: string;
  icon: LucideIcon;
};
type LocalConfigPanelOperationItem = {
  action: LocalDeviceAction;
  label: string;
  icon: LucideIcon;
};
type LocalConfigPanelComponentProps = {
  onFormInit: <T extends object>(methods: UseFormReturn<T>) => void;
  activeTab?: string;
  onTabChange?: (value: string) => void;
  loadedTabs?: ReadonlySet<string>;
  loadingTabs?: ReadonlySet<string>;
  hideTabs?: boolean;
};

const LOCAL_DEVICE_PANEL_MENU_ITEMS: LocalConfigPanelItem[] = [
  {
    key: "user",
    section: "device",
    tab: "user",
    label: "User",
    icon: UserIcon,
  },
  {
    key: "channels",
    section: "radio",
    tab: "channels",
    label: "Channels",
    icon: ListIcon,
  },
  {
    key: "device",
    section: "device",
    tab: "device",
    label: "Device",
    icon: RouterIcon,
  },
  {
    key: "position",
    section: "device",
    tab: "position",
    label: "Position",
    icon: MapPinIcon,
  },
  {
    key: "power",
    section: "device",
    tab: "power",
    label: "Power",
    icon: PlugIcon,
  },
  {
    key: "network",
    section: "device",
    tab: "network",
    label: "Network",
    icon: WifiIcon,
  },
  {
    key: "display",
    section: "device",
    tab: "display",
    label: "Display",
    icon: MonitorIcon,
  },
  {
    key: "lora",
    section: "radio",
    tab: "lora",
    label: "LoRa",
    icon: RadioTowerIcon,
  },
  {
    key: "bluetooth",
    section: "device",
    tab: "bluetooth",
    label: "Bluetooth",
    icon: BluetoothIcon,
  },
  {
    key: "security",
    section: "radio",
    tab: "security",
    label: "Security",
    icon: ShieldIcon,
  },
];

const LOCAL_MODULE_PANEL_MENU_ITEMS: LocalConfigPanelItem[] = [
  {
    key: "mqtt",
    section: "module",
    tab: "mqtt",
    label: "MQTT",
    icon: CloudIcon,
  },
  {
    key: "serial",
    section: "module",
    tab: "serial",
    label: "Serial",
    icon: UsbIcon,
  },
  {
    key: "externalNotification",
    section: "module",
    tab: "externalNotification",
    label: "External Notification",
    icon: BellIcon,
  },
  {
    key: "storeForward",
    section: "module",
    tab: "storeForward",
    label: "Store & Forward",
    icon: ForwardIcon,
  },
  {
    key: "rangeTest",
    section: "module",
    tab: "rangeTest",
    label: "Range Test",
    icon: GaugeIcon,
  },
  {
    key: "telemetry",
    section: "module",
    tab: "telemetry",
    label: "Telemetry",
    icon: ActivityIcon,
  },
  {
    key: "cannedMessage",
    section: "module",
    tab: "cannedMessage",
    label: "Canned Message",
    icon: MessageSquareIcon,
  },
  {
    key: "audio",
    section: "module",
    tab: "audio",
    label: "Audio",
    icon: Volume2Icon,
  },
  {
    key: "remoteHardware",
    section: "module",
    tab: "remoteHardware",
    label: "Remote Hardware",
    icon: ServerCogIcon,
  },
  {
    key: "neighborInfo",
    section: "module",
    tab: "neighborInfo",
    label: "Neighbor Info",
    icon: UsersIcon,
  },
  {
    key: "ambientLighting",
    section: "module",
    tab: "ambientLighting",
    label: "Ambient Lighting",
    icon: LightbulbIcon,
  },
  {
    key: "detectionSensor",
    section: "module",
    tab: "detectionSensor",
    label: "Detection Sensor",
    icon: RadioTowerIcon,
  },
  {
    key: "paxcounter",
    section: "module",
    tab: "paxcounter",
    label: "Paxcounter",
    icon: ShieldIcon,
  },
  {
    key: "statusmessage",
    section: "module",
    tab: "statusmessage",
    label: "Status Message",
    icon: MessageSquareIcon,
  },
  {
    key: "trafficManagement",
    section: "module",
    tab: "trafficManagement",
    label: "Traffic Management",
    icon: ActivityIcon,
  },
];

const LOCAL_NODE_ACTION_DELAY_SECONDS = 5;

function getPositionAdminPayload(
  message: Protobuf.Admin.AdminMessage,
): Protobuf.Mesh.Position | undefined {
  if (message.payloadVariant.case === "setFixedPosition") {
    return message.payloadVariant.value;
  }

  if (message.payloadVariant.case === "removeFixedPosition") {
    return createEmptyPosition();
  }

  return undefined;
}

function getDeviceUiAdminPayload(
  message: Protobuf.Admin.AdminMessage,
): Protobuf.DeviceUI.DeviceUIConfig | undefined {
  if (message.payloadVariant.case === "storeUiConfig") {
    return message.payloadVariant.value;
  }

  return undefined;
}

function createEmptyPosition(): Protobuf.Mesh.Position {
  return create(Protobuf.Mesh.PositionSchema, {
    latitudeI: 0,
    longitudeI: 0,
    altitude: 0,
    time: Math.floor(Date.now() / 1000),
  });
}

const ConfigPage = () => {
  const {
    getAllConfigChanges,
    getAllModuleConfigChanges,
    getAllChannelChanges,
    getAllQueuedAdminMessages,
    connection,
    connectionId,
    clearAllChanges,
    setConfig,
    setModuleConfig,
    setDeviceUiConfig,
    addChannel,
    getChange,
    getConfigChangeCount,
    getModuleConfigChangeCount,
    getChannelChangeCount,
    getAdminMessageChangeCount,
    hasUserChange,
    setDialogOpen,
    targetNodeNum,
    isRemote,
  } = useConfigTarget();
  const nodeDB = useNodeDB();
  const device = useDevice();
  const messages = useMessages();

  const [isSaving, setIsSaving] = useState(false);
  const [rhfState, setRhfState] = useState({ isDirty: false, isValid: true });
  const unsubRef = useRef<(() => void) | null>(null);
  const [formMethods, setFormMethods] = useState<UseFormReturn | null>(null);
  const [mobilePanelItem, setMobilePanelItem] = useState<LocalConfigPanelItem | undefined>();
  const [localActionBusy, setLocalActionBusy] = useState<LocalDeviceAction | undefined>();
  const { toast } = useToast();
  const navigate = useNavigate();
  const routerState = useRouterState();
  const { t } = useTranslation("config");

  const configChangeCount = getConfigChangeCount();
  const moduleConfigChangeCount = getModuleConfigChangeCount();
  const channelChangeCount = getChannelChangeCount();
  const adminMessageChangeCount = getAdminMessageChangeCount();
  const hasUserDraft = hasUserChange();

  const sections = useMemo(
    () => [
      {
        key: "radio",
        route: radioRoute,
        label: t("navigation.radioConfig"),
        icon: RadioTowerIcon,
        changeCount: configChangeCount,
        component: RadioConfig,
      },
      {
        key: "device",
        route: deviceRoute,
        label: t("navigation.deviceConfig"),
        icon: RouterIcon,
        changeCount: moduleConfigChangeCount,
        component: DeviceConfig,
      },
      {
        key: "module",
        route: moduleRoute,
        label: t("navigation.moduleConfig"),
        icon: LayersIcon,
        changeCount: channelChangeCount,
        component: ModuleConfig,
      },
    ],
    [t, configChangeCount, moduleConfigChangeCount, channelChangeCount],
  );

  const activeSection =
    sections.find((section) =>
      routerState.location.pathname.includes(`/settings/${section.key}`),
    ) ?? sections[0];
  const localTargetMetadata = useMemo(
    () => getSettingsMetadata(device.metadata, targetNodeNum, isRemote),
    [device.metadata, isRemote, targetNodeNum],
  );
  const supportedLocalDevicePanelMenuItems = useMemo(
    () =>
      LOCAL_DEVICE_PANEL_MENU_ITEMS.filter((item) =>
        item.section === "device"
          ? isConfigTabSupported(item.tab as ValidConfigType | "user", localTargetMetadata)
          : true,
      ),
    [localTargetMetadata],
  );
  const supportedLocalModulePanelMenuItems = useMemo(
    () =>
      LOCAL_MODULE_PANEL_MENU_ITEMS.filter((item) =>
        isModuleConfigTabSupported(item.tab as ValidModuleConfigType, localTargetMetadata),
      ),
    [localTargetMetadata],
  );
  const mobileLoadedTabs = useMemo(
    () => (mobilePanelItem ? new Set<string>([mobilePanelItem.tab]) : undefined),
    [mobilePanelItem],
  );
  const mobileLoadingTabs = useMemo(() => new Set<string>(), []);
  const mobilePanelSection = mobilePanelItem
    ? sections.find((section) => section.key === mobilePanelItem.section)
    : undefined;
  const MobilePanelComponent = mobilePanelSection?.component;
  const localNode = nodeDB.getMyNode();
  const localPanelTitle =
    localNode?.user?.longName ?? localNode?.user?.shortName ?? t("navigation.deviceConfig");
  const getLocalDeviceActionLabel = useCallback((action: LocalDeviceAction) => {
    switch (action) {
      case "reboot":
        return "Riavvio";
      case "hibernate":
        return "Hibernate Device";
      case "factoryResetDevice":
        return "Factory Settings";
      case "nodeDbReset":
        return "NodeDB Reset";
    }
  }, []);
  const localOperationItems = useMemo<LocalConfigPanelOperationItem[]>(
    () => [
      {
        action: "reboot",
        label: getLocalDeviceActionLabel("reboot"),
        icon: RefreshCwIcon,
      },
      {
        action: "hibernate",
        label: getLocalDeviceActionLabel("hibernate"),
        icon: PowerIcon,
      },
      {
        action: "factoryResetDevice",
        label: getLocalDeviceActionLabel("factoryResetDevice"),
        icon: Trash2Icon,
      },
      {
        action: "nodeDbReset",
        label: getLocalDeviceActionLabel("nodeDbReset"),
        icon: DatabaseIcon,
      },
    ],
    [getLocalDeviceActionLabel],
  );

  const handleMobilePanelMenuItem = useCallback(
    (item: LocalConfigPanelItem) => {
      setMobilePanelItem(item);
      const section = sections.find((candidate) => candidate.key === item.section);
      if (section) {
        navigate({ to: section.route.to });
      }
    },
    [navigate, sections],
  );

  const handleMobilePanelBack = useCallback(() => {
    if (mobilePanelItem) {
      setMobilePanelItem(undefined);
      return;
    }

    navigate({ to: "/nodes" });
  }, [mobilePanelItem, navigate]);

  const handleLocalDeviceAction = useCallback(
    async (action: LocalDeviceAction) => {
      const label = getLocalDeviceActionLabel(action);
      const confirmed =
        typeof window === "undefined" ||
        window.confirm(`Inviare il comando "${label}" al nodo locale?`);

      if (!confirmed) {
        return;
      }

      if (!device.connection) {
        toast({
          title: "Nessuna connessione attiva al nodo locale",
          variant: "destructive",
        });
        return;
      }

      setLocalActionBusy(action);
      try {
        switch (action) {
          case "reboot":
            if (device.connectionId) {
              markExpectedDeviceReconnect(
                device.connectionId,
                LOCAL_NODE_ACTION_DELAY_SECONDS * 1000,
              );
            }

            try {
              await device.connection.reboot(LOCAL_NODE_ACTION_DELAY_SECONDS);
            } catch (error) {
              if (!isExpectedRebootDisconnectError(error)) {
                throw error;
              }
            }
            break;
          case "hibernate":
            await device.connection.shutdown(LOCAL_NODE_ACTION_DELAY_SECONDS);
            break;
          case "factoryResetDevice":
            void device.connection.factoryResetDevice().catch((error) => {
              console.error("Failed to factory reset device:", error);
            });
            useDeviceStore.getState().removeDevice(device.id);
            useMessageStore.getState().removeMessageStore(device.id);
            useNodeDBStore.getState().removeNodeDB(device.id);
            window.location.href = "/";
            return;
          case "nodeDbReset":
            await device.connection.resetNodes();
            messages.deleteAllMessages();
            nodeDB.removeAllNodeErrors();
            nodeDB.removeAllNodes(true);
            break;
        }

        toast({
          title: "Comando inviato al nodo locale",
          description: label,
        });
      } catch (error) {
        console.warn(`local node ${action} failed`, error);
        toast({
          title: "Comando locale non riuscito",
          description: error instanceof Error ? error.message : label,
          variant: "destructive",
        });
      } finally {
        setLocalActionBusy(undefined);
      }
    },
    [
      device.connection,
      device.connectionId,
      device.id,
      getLocalDeviceActionLabel,
      messages,
      nodeDB,
      toast,
    ],
  );

  const onFormInit = useCallback(<T extends FieldValues>(methods: UseFormReturn<T>) => {
    setFormMethods(methods as UseFormReturn);

    setRhfState({
      // Assume defailt on init, changes will be caught by subscription
      isDirty: false,
      isValid: true,
    });

    // Unsubscribe from previous subscriptions & subscribe to form changes
    unsubRef.current?.();
    unsubRef.current = methods.subscribe({
      formState: { isDirty: true, isValid: true },
      callback: ({ isValid, isDirty }) => {
        setRhfState({
          isDirty: isDirty ?? false,
          isValid: isValid ?? true,
        });
      },
    });
  }, []);

  useEffect(() => {
    return () => unsubRef.current?.();
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);

    try {
      const channelChanges = getAllChannelChanges();
      const configChanges = getAllConfigChanges();
      const moduleConfigChanges = getAllModuleConfigChanges();
      const adminMessages = getAllQueuedAdminMessages();
      const userChange = getChange({ type: "user" }) as Protobuf.Mesh.User | undefined;

      if (userChange) {
        await connection?.setOwner(userChange);
        nodeDB.addUser({
          id: Date.now(),
          rxTime: new Date(),
          type: "direct",
          from: targetNodeNum,
          to: targetNodeNum,
          channel: Types.ChannelNumber.Primary,
          data: userChange,
        });
      }

      await Promise.all(
        channelChanges.map((channel) =>
          connection?.setChannel(channel).then(() => {
            toast({
              title: t("toast.savedChannel.title", {
                ns: "ui",
                channelName: channel.settings?.name,
              }),
            });
          }),
        ),
      );

      await Promise.all(
        configChanges.map((newConfig) =>
          connection?.setConfig(newConfig).then(() => {
            toast({
              title: t("toast.saveSuccess.title"),
              description: t("toast.saveSuccess.description", {
                case: newConfig.payloadVariant.case,
              }),
            });
          }),
        ),
      );

      await Promise.all(
        moduleConfigChanges.map((newModuleConfig) =>
          connection?.setModuleConfig(newModuleConfig).then(() =>
            toast({
              title: t("toast.saveSuccess.title"),
              description: t("toast.saveSuccess.description", {
                case: newModuleConfig.payloadVariant.case,
              }),
            }),
          ),
        ),
      );

      const shouldCommitSettings = configChanges.length > 0 || moduleConfigChanges.length > 0;
      const shouldCommitInBackground = shouldCommitSettings && !isRemote && Boolean(connectionId);

      // Fixed position is a separate admin command in firmware. Send it before
      // commitEditSettings, because the commit may reboot/disconnect BLE.
      for (const message of adminMessages) {
        await connection?.sendPacket(
          toBinary(Protobuf.Admin.AdminMessageSchema, message),
          Protobuf.Portnums.PortNum.ADMIN_APP,
          "self",
        );

        const positionPayload = getPositionAdminPayload(message);
        if (positionPayload) {
          nodeDB.addPosition({
            id: Date.now(),
            rxTime: new Date(),
            type: "direct",
            from: targetNodeNum,
            to: targetNodeNum,
            channel: Types.ChannelNumber.Primary,
            data: positionPayload,
          });
        }

        const deviceUiPayload = getDeviceUiAdminPayload(message);
        if (deviceUiPayload) {
          setDeviceUiConfig(deviceUiPayload);
        }
      }

      if (shouldCommitSettings) {
        if (!isRemote && connectionId) {
          markExpectedDeviceReconnect(connectionId);
        }

        const commitPromise = connection?.commitEditSettings();
        if (shouldCommitInBackground) {
          void commitPromise?.catch((error) => {
            if (!isExpectedRebootDisconnectError(error)) {
              console.warn("commitEditSettings failed after scheduling reconnect", error);
            }
          });
        } else {
          await commitPromise;
        }
      }

      channelChanges.forEach((newChannel) => {
        addChannel(newChannel);
      });
      configChanges.forEach((newConfig) => {
        setConfig(newConfig);
      });
      moduleConfigChanges.forEach((newModuleConfig) => {
        setModuleConfig(newModuleConfig);
      });

      clearAllChanges();

      if (formMethods) {
        formMethods.reset(formMethods.getValues(), {
          keepDirty: false,
          keepErrors: false,
          keepTouched: false,
        });
        setRhfState((current) => ({ ...current, isDirty: false }));

        formMethods.trigger();
      }

      toast({
        title: t("toast.saveAllSuccess.title"),
        description: t("toast.saveAllSuccess.description"),
      });
    } catch {
      toast({
        title: t("toast.configSaveError.title"),
        description: t("toast.configSaveError.description"),
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    toast,
    t,
    getAllConfigChanges,
    connection,
    getAllModuleConfigChanges,
    getAllChannelChanges,
    getAllQueuedAdminMessages,
    getChange,
    formMethods,
    addChannel,
    connectionId,
    setConfig,
    setModuleConfig,
    setDeviceUiConfig,
    clearAllChanges,
    isRemote,
    nodeDB,
    targetNodeNum,
  ]);

  const handleReset = useCallback(() => {
    if (formMethods) {
      formMethods.reset();
    }
    clearAllChanges();
  }, [formMethods, clearAllChanges]);

  const leftSidebar = useMemo(
    () => (
      <Sidebar>
        <SidebarSection label={t("sidebar.label")} className="py-2 px-0">
          {sections.map((section) => (
            <LeftSidebarButton
              key={section.key}
              label={section.label}
              active={activeSection?.key === section.key}
              onClick={() => navigate({ to: section.route.to })}
              Icon={section.icon}
              isDirty={section.changeCount > 0}
              count={section.changeCount}
            />
          ))}
          {!isRemote && (
            <LeftSidebarButton
              key="nodeImport"
              label={t("navigation.nodeImport", "Node Import")}
              active={false}
              onClick={() => setDialogOpen("nodeImport", true)}
              Icon={RefreshCwIcon}
            />
          )}
        </SidebarSection>
      </Sidebar>
    ),
    [sections, activeSection?.key, navigate, t, setDialogOpen, isRemote],
  );

  const hasDrafts =
    getConfigChangeCount() > 0 ||
    getModuleConfigChangeCount() > 0 ||
    getChannelChangeCount() > 0 ||
    hasUserDraft ||
    adminMessageChangeCount > 0;
  const hasPending = hasDrafts || rhfState.isDirty;
  const buttonOpacity = hasPending ? "opacity-100" : "opacity-0";
  const saveDisabled = isSaving || !rhfState.isValid || !hasPending;

  const actions = useMemo(
    () => [
      {
        key: "unsavedChanges",
        label: t("common:formValidation.unsavedChanges"),
        onClick: () => {},
        className: cn([
          "bg-blue-500 text-slate-900 hover:bg-initial",
          "transition-colors duration-200",
          buttonOpacity,
          "transition-opacity",
          "max-md:hidden",
        ]),
      },
      {
        key: "reset",
        icon: RefreshCwIcon,
        label: t("common:button.reset"),
        onClick: handleReset,
        className: cn([
          buttonOpacity,
          "transition-opacity hover:bg-slate-200 disabled:hover:bg-white",
          "hover:dark:bg-slate-300  hover:dark:text-black cursor-pointer",
          "max-md:hidden",
        ]),
      },
      {
        key: "save",
        icon: !hasPending ? SaveOff : SaveIcon,
        isLoading: isSaving,
        disabled: saveDisabled,
        iconClasses:
          !rhfState.isValid && hasPending ? "text-red-400 cursor-not-allowed" : "cursor-pointer",
        className: cn([
          "transition-opacity hover:bg-slate-200 disabled:hover:bg-white",
          "hover:dark:bg-slate-300 hover:dark:text-black",
          "disabled:hover:cursor-not-allowed cursor-pointer",
          "max-md:hidden",
        ]),
        onClick: handleSave,
        label: t("common:button.save"),
      },
    ],
    [
      isSaving,
      hasPending,
      rhfState.isValid,
      saveDisabled,
      buttonOpacity,
      handleReset,
      handleSave,
      t,
    ],
  );

  const ActiveComponent = activeSection?.component;

  return (
    <PageLayout
      contentClassName="route-content-mb-10 overflow-hidden max-md:px-0 md:overflow-auto"
      leftBar={leftSidebar}
      label={activeSection?.label ?? ""}
      actions={actions}
    >
      <div className="hidden min-h-0 flex-1 flex-col overflow-auto md:flex">
        {ActiveComponent && <ActiveComponent onFormInit={onFormInit} />}
      </div>
      <LocalConfigMobilePanel
        activeItem={mobilePanelItem}
        title={localPanelTitle}
        deviceItems={supportedLocalDevicePanelMenuItems}
        moduleItems={supportedLocalModulePanelMenuItems}
        operationItems={localOperationItems}
        ActiveComponent={MobilePanelComponent}
        loadedTabs={mobileLoadedTabs}
        loadingTabs={mobileLoadingTabs}
        hasPending={hasPending}
        isSaving={isSaving}
        saveDisabled={saveDisabled}
        localActionBusy={localActionBusy}
        localActionsDisabled={!device.connection || isSaving || localActionBusy !== undefined}
        onFormInit={onFormInit}
        onBack={handleMobilePanelBack}
        onItemClick={handleMobilePanelMenuItem}
        onOperationClick={handleLocalDeviceAction}
        onCancel={handleReset}
        onSend={handleSave}
      />
    </PageLayout>
  );
};

function LocalConfigMobilePanel({
  activeItem,
  title,
  deviceItems,
  moduleItems,
  operationItems,
  ActiveComponent,
  loadedTabs,
  loadingTabs,
  hasPending,
  isSaving,
  saveDisabled,
  localActionBusy,
  localActionsDisabled,
  onFormInit,
  onBack,
  onItemClick,
  onOperationClick,
  onCancel,
  onSend,
}: {
  activeItem?: LocalConfigPanelItem;
  title: string;
  deviceItems: LocalConfigPanelItem[];
  moduleItems: LocalConfigPanelItem[];
  operationItems: LocalConfigPanelOperationItem[];
  ActiveComponent?: ComponentType<LocalConfigPanelComponentProps>;
  loadedTabs?: ReadonlySet<string>;
  loadingTabs: ReadonlySet<string>;
  hasPending: boolean;
  isSaving: boolean;
  saveDisabled: boolean;
  localActionBusy?: LocalDeviceAction;
  localActionsDisabled: boolean;
  onFormInit: <T extends object>(methods: UseFormReturn<T>) => void;
  onBack: () => void;
  onItemClick: (item: LocalConfigPanelItem) => void;
  onOperationClick: (action: LocalDeviceAction) => void | Promise<void>;
  onCancel: () => void;
  onSend: () => void | Promise<void>;
}) {
  const menuOpen = activeItem === undefined;

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#111] text-zinc-100 md:hidden">
      <div className="flex items-center gap-3 border-b border-zinc-800 bg-[#202020] px-4 py-3">
        <button
          type="button"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-blue-500 text-zinc-100 shadow-[0_0_0_2px_rgba(255,255,255,0.85)] hover:bg-white/10"
          onClick={onBack}
          aria-label={menuOpen ? "Back to nodes" : "Back to settings menu"}
        >
          <ArrowLeftIcon className="size-6" />
        </button>
        <div className="min-w-0">
          <div className="truncate text-xl font-semibold text-zinc-100">{title}</div>
          <div className="truncate text-sm text-zinc-300">
            {menuOpen ? "Local Settings" : activeItem.label}
          </div>
        </div>
      </div>

      {menuOpen ? (
        <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-4 py-5">
          {deviceItems.length > 0 ? (
            <LocalConfigPanelSection title="Impostazioni dispositivo">
              {deviceItems.map((item) => (
                <LocalConfigPanelMenuRow
                  key={item.key}
                  item={item}
                  onClick={() => onItemClick(item)}
                />
              ))}
            </LocalConfigPanelSection>
          ) : null}

          {moduleItems.length > 0 ? (
            <LocalConfigPanelSection title="Impostazioni moduli">
              {moduleItems.map((item) => (
                <LocalConfigPanelMenuRow
                  key={item.key}
                  item={item}
                  onClick={() => onItemClick(item)}
                />
              ))}
            </LocalConfigPanelSection>
          ) : null}

          <LocalConfigPanelSection title="Node Operations">
            {operationItems.map((item) => (
              <LocalConfigPanelOperationButton
                key={item.action}
                item={item}
                disabled={localActionsDisabled}
                busy={localActionBusy === item.action}
                onClick={() => {
                  void onOperationClick(item.action);
                }}
              />
            ))}
          </LocalConfigPanelSection>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col px-4 py-5">
          <h2 className="mb-4 shrink-0 truncate text-2xl font-semibold text-zinc-100">
            {activeItem.label}
          </h2>
          <div className="darkmesh-config-panel min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain pr-1">
            {ActiveComponent ? (
              <ActiveComponent
                onFormInit={onFormInit}
                activeTab={activeItem.tab}
                loadedTabs={loadedTabs}
                loadingTabs={loadingTabs}
                hideTabs
              />
            ) : null}
          </div>
          <LocalConfigPanelActionBar
            hasPending={hasPending}
            isSaving={isSaving}
            saveDisabled={saveDisabled}
            onCancel={onCancel}
            onSend={onSend}
          />
        </div>
      )}
    </div>
  );
}

function LocalConfigPanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-7">
      <h2 className="mb-3 text-xl font-semibold text-zinc-100">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function LocalConfigPanelMenuRow({
  item,
  onClick,
}: {
  item: LocalConfigPanelItem;
  onClick: () => void;
}) {
  const Icon = item.icon;

  return (
    <button
      type="button"
      className="flex w-full items-center justify-between rounded-md bg-[#252525] px-4 py-3 text-left text-lg font-medium text-zinc-100 hover:bg-[#303030]"
      onClick={onClick}
    >
      <span className="flex min-w-0 items-center gap-3">
        <Icon className="size-6 shrink-0" />
        <span className="truncate">{item.label}</span>
      </span>
      <ChevronRightIcon className="size-5 shrink-0" />
    </button>
  );
}

function LocalConfigPanelOperationButton({
  item,
  disabled,
  busy,
  onClick,
}: {
  item: LocalConfigPanelOperationItem;
  disabled: boolean;
  busy: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;

  return (
    <button
      type="button"
      className="flex w-full items-center justify-center gap-3 rounded-md bg-[#8d0606] px-4 py-3 text-base font-semibold tracking-wide text-white hover:bg-[#a30b0b] disabled:cursor-not-allowed disabled:opacity-45"
      onClick={onClick}
      disabled={disabled}
    >
      <Icon className={cn("size-5 shrink-0", busy && "animate-spin")} />
      <span className="truncate">{item.label}</span>
    </button>
  );
}

function LocalConfigPanelActionBar({
  hasPending,
  isSaving,
  saveDisabled,
  onCancel,
  onSend,
}: {
  hasPending: boolean;
  isSaving: boolean;
  saveDisabled: boolean;
  onCancel: () => void;
  onSend: () => void | Promise<void>;
}) {
  return (
    <div className="mt-4 grid shrink-0 grid-cols-2 gap-3 border-t border-zinc-800 pt-4">
      <button
        type="button"
        className={cn(
          "h-14 rounded-md border text-lg font-medium transition-colors disabled:cursor-not-allowed",
          hasPending
            ? "border-red-700 bg-[#8d0606] text-white hover:bg-[#a30b0b]"
            : "border-[#4a4a4a] bg-[#2f2f2f] text-zinc-500",
        )}
        onClick={onCancel}
        disabled={!hasPending}
      >
        Annulla
      </button>
      <button
        type="button"
        className={cn(
          "h-14 rounded-md border text-lg font-medium transition-colors disabled:cursor-not-allowed",
          hasPending && !saveDisabled
            ? "border-red-700 bg-[#8d0606] text-white hover:bg-[#a30b0b]"
            : "border-[#4a4a4a] bg-[#2f2f2f] text-zinc-500",
        )}
        onClick={onSend}
        disabled={saveDisabled}
      >
        {isSaving ? "Invio..." : "Invia"}
      </button>
    </div>
  );
}

export default ConfigPage;
