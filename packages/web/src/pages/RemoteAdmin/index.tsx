import {
  remoteAdminRoute,
  remoteAdminDeviceRoute,
  remoteAdminModuleRoute,
  remoteAdminRadioRoute,
} from "@app/routes";
import { create, fromBinary, toBinary } from "@bufbuild/protobuf";
import { PageLayout } from "@components/PageLayout.tsx";
import { Sidebar } from "@components/Sidebar.tsx";
import { LeftSidebarButton } from "@components/UI/Sidebar/LeftSidebarButton.tsx";
import { SidebarSection } from "@components/UI/Sidebar/SidebarSection.tsx";
import { ConfigTargetProvider, type ConfigTarget } from "@core/hooks/useConfigTarget.tsx";
import { useToast } from "@core/hooks/useToast.ts";
import {
  createChangeRegistry,
  getAdminMessageChangeCount as getAdminMessageDraftCount,
  getAllAdminMessages,
  getAllChannelChanges as getAllChannelChangeEntries,
  getAllConfigChanges as getAllConfigChangeEntries,
  getAllModuleConfigChanges as getAllModuleConfigChangeEntries,
  getChannelChangeCount,
  getConfigChangeCount,
  getModuleConfigChangeCount,
  hasChannelChange,
  hasConfigChange,
  hasModuleConfigChange,
  hasUserChange,
  serializeKey,
  type ChangeRegistry,
  type ConfigChangeKey,
  type ValidConfigType,
  type ValidModuleConfigType,
} from "@core/stores/deviceStore/changeRegistry.ts";
import { useDevice, useNodeDB } from "@core/stores";
import { cn } from "@core/utils/cn.ts";
import { resolveAdminChannelIndex } from "@core/utils/adminChannel.ts";
import {
  getSettingsMetadata,
  isConfigTabSupported,
  isModuleConfigTabSupported,
} from "@core/utils/settingsCapabilities.ts";
import { DeviceConfig } from "@pages/Settings/DeviceConfig.tsx";
import { ModuleConfig } from "@pages/Settings/ModuleConfig.tsx";
import { Protobuf, Types } from "@meshtastic/core";
import { RadioConfig } from "@pages/Settings/RadioConfig.tsx";
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
import { useNavigate, useParams, useRouterState } from "@tanstack/react-router";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { getNodeLongName } from "@app/darkmesh/utils.ts";

type RemoteAdminSection = "radio" | "device" | "module";
type RemoteRadioTab = "lora" | "channels" | "security";
type RemoteDeviceTab =
  | "user"
  | "device"
  | "position"
  | "power"
  | "network"
  | "display"
  | "bluetooth";
type RemoteModuleTab = ValidModuleConfigType;
type RemoteAdminTab = RemoteRadioTab | RemoteDeviceTab | RemoteModuleTab;
type RemoteDeviceAction = "reboot" | "hibernate" | "factoryResetDevice" | "nodeDbReset";
type RemoteAdminDisplayMode = "page" | "panel";
type RemoteAdminContentProps = {
  nodeNum: number;
  mode?: RemoteAdminDisplayMode;
  onClose?: () => void;
};
type RemoteAdminPanelMenuItem = {
  key: string;
  section: RemoteAdminSection;
  tab: RemoteAdminTab;
  label: string;
  icon: LucideIcon;
};
type RemoteAdminPanelOperationItem = {
  action: RemoteDeviceAction;
  label: string;
  icon: LucideIcon;
};

const DEVICE_PANEL_MENU_ITEMS: RemoteAdminPanelMenuItem[] = [
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

const MODULE_PANEL_MENU_ITEMS: RemoteAdminPanelMenuItem[] = [
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

const PANEL_MENU_ITEMS = [...DEVICE_PANEL_MENU_ITEMS, ...MODULE_PANEL_MENU_ITEMS];

const REMOTE_RESPONSE_TIMEOUT_MS = 8000;
const REMOTE_REBOOT_DELAY_SECONDS = 5;
const REMOTE_HIBERNATE_DELAY_SECONDS = 2;

function isRemotePanelMenuItemSupported(
  item: RemoteAdminPanelMenuItem,
  metadata?: Protobuf.Mesh.DeviceMetadata,
) {
  if (item.section === "module") {
    return isModuleConfigTabSupported(item.tab as ValidModuleConfigType, metadata);
  }

  return isConfigTabSupported(item.tab as ValidConfigType | "user" | "channels", metadata);
}

function getRemoteDeviceActionPayload(
  action: RemoteDeviceAction,
): Protobuf.Admin.AdminMessage["payloadVariant"] {
  switch (action) {
    case "reboot":
      return {
        case: "rebootSeconds",
        value: REMOTE_REBOOT_DELAY_SECONDS,
      };
    case "hibernate":
      return {
        case: "shutdownSeconds",
        value: REMOTE_HIBERNATE_DELAY_SECONDS,
      };
    case "factoryResetDevice":
      return {
        case: "factoryResetDevice",
        value: 1,
      };
    case "nodeDbReset":
      return {
        case: "nodedbReset",
        value: true,
      };
  }
}

function getPositionAdminPayload(
  message: Protobuf.Admin.AdminMessage,
): Protobuf.Mesh.Position | undefined {
  if (message.payloadVariant.case === "setFixedPosition") {
    return message.payloadVariant.value;
  }

  if (message.payloadVariant.case === "removeFixedPosition") {
    return create(Protobuf.Mesh.PositionSchema, {
      latitudeI: 0,
      longitudeI: 0,
      altitude: 0,
      time: Math.floor(Date.now() / 1000),
    });
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

const isRemoteAdminAckTimeoutError = (
  error: unknown,
): error is { id: number; error: Protobuf.Mesh.Routing_Error } => {
  if (!error || typeof error !== "object" || !("error" in error)) {
    return false;
  }

  return error.error === Protobuf.Mesh.Routing_Error.TIMEOUT;
};

const REMOTE_CONFIG_TAB_REQUESTS: Partial<
  Record<RemoteAdminTab, Protobuf.Admin.AdminMessage_ConfigType>
> = {
  device: Protobuf.Admin.AdminMessage_ConfigType.DEVICE_CONFIG,
  position: Protobuf.Admin.AdminMessage_ConfigType.POSITION_CONFIG,
  power: Protobuf.Admin.AdminMessage_ConfigType.POWER_CONFIG,
  network: Protobuf.Admin.AdminMessage_ConfigType.NETWORK_CONFIG,
  display: Protobuf.Admin.AdminMessage_ConfigType.DISPLAY_CONFIG,
  bluetooth: Protobuf.Admin.AdminMessage_ConfigType.BLUETOOTH_CONFIG,
  lora: Protobuf.Admin.AdminMessage_ConfigType.LORA_CONFIG,
  security: Protobuf.Admin.AdminMessage_ConfigType.SECURITY_CONFIG,
};

const REMOTE_MODULE_TAB_REQUESTS: Partial<
  Record<RemoteAdminTab, Protobuf.Admin.AdminMessage_ModuleConfigType>
> = {
  mqtt: Protobuf.Admin.AdminMessage_ModuleConfigType.MQTT_CONFIG,
  serial: Protobuf.Admin.AdminMessage_ModuleConfigType.SERIAL_CONFIG,
  externalNotification: Protobuf.Admin.AdminMessage_ModuleConfigType.EXTNOTIF_CONFIG,
  storeForward: Protobuf.Admin.AdminMessage_ModuleConfigType.STOREFORWARD_CONFIG,
  rangeTest: Protobuf.Admin.AdminMessage_ModuleConfigType.RANGETEST_CONFIG,
  telemetry: Protobuf.Admin.AdminMessage_ModuleConfigType.TELEMETRY_CONFIG,
  cannedMessage: Protobuf.Admin.AdminMessage_ModuleConfigType.CANNEDMSG_CONFIG,
  audio: Protobuf.Admin.AdminMessage_ModuleConfigType.AUDIO_CONFIG,
  remoteHardware: Protobuf.Admin.AdminMessage_ModuleConfigType.REMOTEHARDWARE_CONFIG,
  neighborInfo: Protobuf.Admin.AdminMessage_ModuleConfigType.NEIGHBORINFO_CONFIG,
  ambientLighting: Protobuf.Admin.AdminMessage_ModuleConfigType.AMBIENTLIGHTING_CONFIG,
  detectionSensor: Protobuf.Admin.AdminMessage_ModuleConfigType.DETECTIONSENSOR_CONFIG,
  paxcounter: Protobuf.Admin.AdminMessage_ModuleConfigType.PAXCOUNTER_CONFIG,
  statusmessage: Protobuf.Admin.AdminMessage_ModuleConfigType.STATUSMESSAGE_CONFIG,
  trafficManagement: Protobuf.Admin.AdminMessage_ModuleConfigType.TRAFFICMANAGEMENT_CONFIG,
};

const applyConfigMessage = (
  previous: Protobuf.LocalOnly.LocalConfig,
  config: Protobuf.Config.Config,
): Protobuf.LocalOnly.LocalConfig => {
  const next = create(Protobuf.LocalOnly.LocalConfigSchema, previous);

  switch (config.payloadVariant.case) {
    case "device":
      next.device = config.payloadVariant.value;
      break;
    case "position":
      next.position = config.payloadVariant.value;
      break;
    case "power":
      next.power = config.payloadVariant.value;
      break;
    case "network":
      next.network = config.payloadVariant.value;
      break;
    case "display":
      next.display = config.payloadVariant.value;
      break;
    case "lora":
      next.lora = config.payloadVariant.value;
      break;
    case "bluetooth":
      next.bluetooth = config.payloadVariant.value;
      break;
    case "security":
      next.security = config.payloadVariant.value;
      break;
  }

  return next;
};

const applyModuleConfigMessage = (
  previous: Protobuf.LocalOnly.LocalModuleConfig,
  config: Protobuf.ModuleConfig.ModuleConfig,
): Protobuf.LocalOnly.LocalModuleConfig => {
  const next = create(Protobuf.LocalOnly.LocalModuleConfigSchema, previous);

  switch (config.payloadVariant.case) {
    case "mqtt":
      next.mqtt = config.payloadVariant.value;
      break;
    case "serial":
      next.serial = config.payloadVariant.value;
      break;
    case "externalNotification":
      next.externalNotification = config.payloadVariant.value;
      break;
    case "storeForward":
      next.storeForward = config.payloadVariant.value;
      break;
    case "rangeTest":
      next.rangeTest = config.payloadVariant.value;
      break;
    case "telemetry":
      next.telemetry = config.payloadVariant.value;
      break;
    case "cannedMessage":
      next.cannedMessage = config.payloadVariant.value;
      break;
    case "audio":
      next.audio = config.payloadVariant.value;
      break;
    case "remoteHardware":
      next.remoteHardware = config.payloadVariant.value;
      break;
    case "neighborInfo":
      next.neighborInfo = config.payloadVariant.value;
      break;
    case "ambientLighting":
      next.ambientLighting = config.payloadVariant.value;
      break;
    case "detectionSensor":
      next.detectionSensor = config.payloadVariant.value;
      break;
    case "paxcounter":
      next.paxcounter = config.payloadVariant.value;
      break;
    case "statusmessage":
      next.statusmessage = config.payloadVariant.value;
      break;
    case "trafficManagement":
      next.trafficManagement = config.payloadVariant.value;
      break;
  }

  return next;
};

const resolveRemoteAdminSection = (pathname: string, nodeNum: number): RemoteAdminSection => {
  if (pathname.includes(`/remote-admin/${nodeNum}/device`)) {
    return "device";
  }

  if (pathname.includes(`/remote-admin/${nodeNum}/module`)) {
    return "module";
  }

  return "radio";
};

const RemoteAdminPage = () => {
  const { nodeNum } = useParams({ from: remoteAdminRoute.id });

  return <RemoteAdminContent nodeNum={nodeNum} />;
};

export function RemoteAdminPanel({ nodeNum, onClose }: { nodeNum: number; onClose: () => void }) {
  return <RemoteAdminContent nodeNum={nodeNum} mode="panel" onClose={onClose} />;
}

function RemoteAdminContent({ nodeNum, mode = "page", onClose }: RemoteAdminContentProps) {
  const localDevice = useDevice();
  const nodeDB = useNodeDB();
  const { toast } = useToast();
  const navigate = useNavigate();
  const routerState = useRouterState();
  const { t } = useTranslation("config");

  const [config, setConfigState] = useState(() => create(Protobuf.LocalOnly.LocalConfigSchema));
  const [moduleConfig, setModuleConfigState] = useState(() =>
    create(Protobuf.LocalOnly.LocalModuleConfigSchema),
  );
  const [deviceUiConfig, setDeviceUiConfigState] = useState(() =>
    create(Protobuf.DeviceUI.DeviceUIConfigSchema),
  );
  const [channels, setChannelsState] = useState<Map<Types.ChannelNumber, Protobuf.Channel.Channel>>(
    () => new Map(),
  );
  const [changeRegistry, setChangeRegistry] = useState<ChangeRegistry>(() =>
    createChangeRegistry(),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [remoteActionBusy, setRemoteActionBusy] = useState<RemoteDeviceAction>();
  const [rhfState, setRhfState] = useState({ isDirty: false, isValid: true });
  const [formMethods, setFormMethods] = useState<UseFormReturn | null>(null);
  const [activeTabs, setActiveTabs] = useState<Partial<Record<RemoteAdminSection, RemoteAdminTab>>>(
    {},
  );
  const [panelSectionKey, setPanelSectionKey] = useState<RemoteAdminSection>("device");
  const [panelMenuOpen, setPanelMenuOpen] = useState(true);
  const [loadedTabs, setLoadedTabs] = useState<Set<RemoteAdminTab>>(() => new Set());
  const [loadingTabs, setLoadingTabs] = useState<Set<RemoteAdminTab>>(() => new Set());
  const unsubRef = useRef<(() => void) | null>(null);
  const sessionPasskeyRef = useRef<Uint8Array>(new Uint8Array());
  const pendingAdminResponseResolversRef = useRef(new Set<() => void>());
  const pendingTabResponseResolversRef = useRef(new Map<RemoteAdminTab, Set<() => void>>());
  const loadedTabsRef = useRef<Set<RemoteAdminTab>>(new Set());
  const loadingTabsRef = useRef<Set<RemoteAdminTab>>(new Set());
  const remoteTabTimeoutsRef = useRef<Map<RemoteAdminTab, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const targetNode = nodeDB.getNode(nodeNum);
  const adminChannel = resolveAdminChannelIndex(localDevice.channels);
  const maxChannels = 8;
  const routeSectionKey = useMemo<RemoteAdminSection>(
    () => resolveRemoteAdminSection(routerState.location.pathname, nodeNum),
    [nodeNum, routerState.location.pathname],
  );
  const activeSectionKey = mode === "panel" ? panelSectionKey : routeSectionKey;
  const activeTab = activeTabs[activeSectionKey];
  const targetMetadata = useMemo(
    () => getSettingsMetadata(localDevice.metadata, nodeNum, true),
    [localDevice.metadata, nodeNum],
  );
  // Public key checks removed for now — PKC admin path unused in this build

  const setConfig = useCallback((newConfig: Protobuf.Config.Config) => {
    setConfigState((current) => applyConfigMessage(current, newConfig));
  }, []);

  const setModuleConfig = useCallback((newConfig: Protobuf.ModuleConfig.ModuleConfig) => {
    setModuleConfigState((current) => applyModuleConfigMessage(current, newConfig));
  }, []);

  const setDeviceUiConfig = useCallback((newConfig: Protobuf.DeviceUI.DeviceUIConfig) => {
    setDeviceUiConfigState(newConfig);
  }, []);

  const addChannel = useCallback((channel: Protobuf.Channel.Channel) => {
    setChannelsState((current) => {
      const next = new Map(current);
      next.set(channel.index, channel);
      return next;
    });
  }, []);

  const setChange = useCallback((key: ConfigChangeKey, value: unknown, originalValue?: unknown) => {
    setChangeRegistry((current) => {
      const next = new Map(current.changes);
      next.set(serializeKey(key), {
        key,
        value,
        originalValue,
        timestamp: Date.now(),
      });
      return { changes: next };
    });
  }, []);

  const removeChange = useCallback((key: ConfigChangeKey) => {
    setChangeRegistry((current) => {
      const next = new Map(current.changes);
      next.delete(serializeKey(key));
      return { changes: next };
    });
  }, []);

  const getChange = useCallback(
    (key: ConfigChangeKey) => changeRegistry.changes.get(serializeKey(key))?.value,
    [changeRegistry],
  );

  const clearAllChanges = useCallback(() => {
    setChangeRegistry(createChangeRegistry());
  }, []);

  const getEffectiveConfig = useCallback(
    <K extends ValidConfigType>(
      payloadVariant: K,
    ): Protobuf.LocalOnly.LocalConfig[K] | undefined => {
      const workingValue = changeRegistry.changes.get(
        serializeKey({ type: "config", variant: payloadVariant }),
      )?.value as Protobuf.LocalOnly.LocalConfig[K] | undefined;

      return {
        ...config[payloadVariant],
        ...workingValue,
      };
    },
    [changeRegistry, config],
  );

  const getEffectiveModuleConfig = useCallback(
    <K extends ValidModuleConfigType>(
      payloadVariant: K,
    ): Protobuf.LocalOnly.LocalModuleConfig[K] | undefined => {
      const workingValue = changeRegistry.changes.get(
        serializeKey({ type: "moduleConfig", variant: payloadVariant }),
      )?.value as Protobuf.LocalOnly.LocalModuleConfig[K] | undefined;

      return {
        ...moduleConfig[payloadVariant],
        ...workingValue,
      };
    },
    [changeRegistry, moduleConfig],
  );

  const queueAdminMessage = useCallback((message: Protobuf.Admin.AdminMessage) => {
    const variant =
      message.payloadVariant.case === "setFixedPosition"
        ? "setFixedPosition"
        : message.payloadVariant.case === "removeFixedPosition"
          ? "removeFixedPosition"
          : message.payloadVariant.case === "storeUiConfig"
            ? "storeUiConfig"
            : "other";
    const messageId =
      variant === "other" ? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` : variant;

    setChangeRegistry((current) => {
      const next = new Map(current.changes);
      if (variant === "setFixedPosition" || variant === "removeFixedPosition") {
        for (const [keyStr, entry] of next.entries()) {
          if (
            entry.key.type === "adminMessage" &&
            (entry.key.variant === "setFixedPosition" ||
              entry.key.variant === "removeFixedPosition")
          ) {
            next.delete(keyStr);
          }
        }
      }
      if (variant === "storeUiConfig") {
        for (const [keyStr, entry] of next.entries()) {
          if (entry.key.type === "adminMessage" && entry.key.variant === "storeUiConfig") {
            next.delete(keyStr);
          }
        }
      }
      next.set(serializeKey({ type: "adminMessage", variant, id: messageId }), {
        key: { type: "adminMessage", variant, id: messageId },
        value: message,
        timestamp: Date.now(),
      });
      return { changes: next };
    });
  }, []);

  const getAllConfigChanges = useCallback(() => {
    return getAllConfigChangeEntries(changeRegistry)
      .map((entry) => {
        if (entry.key.type !== "config" || !entry.value) {
          return null;
        }
        return create(Protobuf.Config.ConfigSchema, {
          payloadVariant: {
            case: entry.key.variant,
            value: entry.value,
          },
        });
      })
      .filter((entry): entry is Protobuf.Config.Config => entry !== null);
  }, [changeRegistry]);

  const getAllModuleConfigChanges = useCallback(() => {
    return getAllModuleConfigChangeEntries(changeRegistry)
      .map((entry) => {
        if (entry.key.type !== "moduleConfig" || !entry.value) {
          return null;
        }
        return create(Protobuf.ModuleConfig.ModuleConfigSchema, {
          payloadVariant: {
            case: entry.key.variant,
            value: entry.value,
          },
        });
      })
      .filter((entry): entry is Protobuf.ModuleConfig.ModuleConfig => entry !== null);
  }, [changeRegistry]);

  const getAllChannelChanges = useCallback(() => {
    return getAllChannelChangeEntries(changeRegistry)
      .map((entry) => entry.value as Protobuf.Channel.Channel)
      .filter((entry): entry is Protobuf.Channel.Channel => entry !== undefined);
  }, [changeRegistry]);

  const getAllQueuedAdminMessages = useCallback(() => {
    return getAllAdminMessages(changeRegistry)
      .map((entry) => entry.value as Protobuf.Admin.AdminMessage)
      .filter((entry): entry is Protobuf.Admin.AdminMessage => entry !== undefined);
  }, [changeRegistry]);

  useEffect(() => {
    loadedTabsRef.current = loadedTabs;
  }, [loadedTabs]);

  useEffect(() => {
    loadingTabsRef.current = loadingTabs;
  }, [loadingTabs]);

  const waitForRemoteAdminResponse = useCallback((timeoutMs = 2500) => {
    return new Promise<void>((resolve) => {
      const resolveAndCleanup = () => {
        pendingAdminResponseResolversRef.current.delete(resolveAndCleanup);
        clearTimeout(timeoutId);
        resolve();
      };

      const timeoutId = setTimeout(resolveAndCleanup, timeoutMs);
      pendingAdminResponseResolversRef.current.add(resolveAndCleanup);
    });
  }, []);

  const resolveRemoteTabWaiters = useCallback((tab: RemoteAdminTab) => {
    const resolvers = pendingTabResponseResolversRef.current.get(tab);
    if (!resolvers) {
      return;
    }

    pendingTabResponseResolversRef.current.delete(tab);
    Array.from(resolvers).forEach((resolve) => resolve());
  }, []);

  const waitForRemoteTabResponse = useCallback((tab: RemoteAdminTab, timeoutMs = 9000) => {
    if (!loadingTabsRef.current.has(tab)) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      const cleanup = () => {
        clearTimeout(timeoutId);
        const resolvers = pendingTabResponseResolversRef.current.get(tab);
        if (!resolvers) {
          resolve();
          return;
        }

        resolvers.delete(cleanup);
        if (resolvers.size === 0) {
          pendingTabResponseResolversRef.current.delete(tab);
        }
        resolve();
      };

      const timeoutId = setTimeout(cleanup, timeoutMs);
      const resolvers = pendingTabResponseResolversRef.current.get(tab) ?? new Set<() => void>();
      resolvers.add(cleanup);
      pendingTabResponseResolversRef.current.set(tab, resolvers);
    });
  }, []);

  const clearRemoteTabTimeout = useCallback((tab: RemoteAdminTab) => {
    const timeoutId = remoteTabTimeoutsRef.current.get(tab);
    if (timeoutId) {
      clearTimeout(timeoutId);
      remoteTabTimeoutsRef.current.delete(tab);
    }
  }, []);

  const setRemoteTabLoading = useCallback((tab: RemoteAdminTab, isLoading: boolean) => {
    setLoadingTabs((current) => {
      const next = new Set(current);
      if (isLoading) {
        next.add(tab);
      } else {
        next.delete(tab);
      }
      loadingTabsRef.current = next;
      return next;
    });
  }, []);

  const setRemoteTabLoaded = useCallback((tab: RemoteAdminTab, isLoaded: boolean) => {
    setLoadedTabs((current) => {
      const next = new Set(current);
      if (isLoaded) {
        next.add(tab);
      } else {
        next.delete(tab);
      }
      loadedTabsRef.current = next;
      return next;
    });
  }, []);

  const markRemoteTabFailed = useCallback(
    (tab: RemoteAdminTab) => {
      clearRemoteTabTimeout(tab);
      setRemoteTabLoading(tab, false);
      setRemoteTabLoaded(tab, false);
      resolveRemoteTabWaiters(tab);
    },
    [clearRemoteTabTimeout, resolveRemoteTabWaiters, setRemoteTabLoaded, setRemoteTabLoading],
  );

  const markRemoteTabLoaded = useCallback(
    (tab: RemoteAdminTab) => {
      clearRemoteTabTimeout(tab);
      setRemoteTabLoading(tab, false);
      setRemoteTabLoaded(tab, true);
      resolveRemoteTabWaiters(tab);
    },
    [clearRemoteTabTimeout, resolveRemoteTabWaiters, setRemoteTabLoaded, setRemoteTabLoading],
  );

  const startRemoteTabTimeout = useCallback(
    (tab: RemoteAdminTab) => {
      clearRemoteTabTimeout(tab);
      const timeoutId = setTimeout(() => {
        markRemoteTabFailed(tab);
        toast({
          title: t("remoteAdmin.toast.loadError.title", "Unable to load remote settings"),
          description: t(
            "remoteAdmin.toast.loadError.description",
            "The remote node did not return its configuration.",
          ),
        });
      }, REMOTE_RESPONSE_TIMEOUT_MS);
      remoteTabTimeoutsRef.current.set(tab, timeoutId);
    },
    [clearRemoteTabTimeout, markRemoteTabFailed, t, toast],
  );

  const clearAllRemoteTabTimeouts = useCallback(() => {
    remoteTabTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    remoteTabTimeoutsRef.current.clear();
  }, []);

  const sendRemoteAdmin = useCallback(
    async (
      payloadVariant: Protobuf.Admin.AdminMessage["payloadVariant"],
      options?: { wantResponse?: boolean; includeSessionPasskey?: boolean },
    ) => {
      if (!localDevice.connection) {
        throw new Error("No active device connection");
      }

      const includeSessionPasskey =
        options?.includeSessionPasskey ?? sessionPasskeyRef.current.length > 0;

      const message = create(Protobuf.Admin.AdminMessageSchema, {
        sessionPasskey: includeSessionPasskey ? sessionPasskeyRef.current : undefined,
        payloadVariant,
      });

      return localDevice.connection.sendPacket(
        toBinary(Protobuf.Admin.AdminMessageSchema, message),
        Protobuf.Portnums.PortNum.ADMIN_APP,
        nodeNum,
        adminChannel,
        true,
        options?.wantResponse ?? false,
        false,
        undefined,
        undefined,
      );
    },
    [adminChannel, localDevice.connection, nodeNum],
  );

  const createRemoteAdminSendFailurePromise = useCallback(
    (
      payloadVariant: Protobuf.Admin.AdminMessage["payloadVariant"],
      options?: {
        includeSessionPasskey?: boolean;
        tolerateAckTimeout?: boolean;
      },
    ) =>
      new Promise<never>((_resolve, reject) => {
        void sendRemoteAdmin(payloadVariant, {
          wantResponse: true,
          includeSessionPasskey: options?.includeSessionPasskey,
        }).catch((error) => {
          if (options?.tolerateAckTimeout && isRemoteAdminAckTimeoutError(error)) {
            return;
          }

          reject(error);
        });
      }),
    [sendRemoteAdmin],
  );

  const ensureRemoteSession = useCallback(async () => {
    if (sessionPasskeyRef.current.length > 0) {
      return;
    }

    const waitForSession = waitForRemoteAdminResponse();
    const sendFailure = createRemoteAdminSendFailurePromise(
      {
        case: "getDeviceMetadataRequest",
        value: true,
      },
      { tolerateAckTimeout: true },
    );

    await Promise.race([waitForSession, sendFailure]);
  }, [createRemoteAdminSendFailurePromise, waitForRemoteAdminResponse]);

  const requestRemoteTab = useCallback(
    async (tab: RemoteAdminTab, options?: { force?: boolean; awaitResult?: boolean }) => {
      if (!localDevice.connection) {
        return;
      }

      if (!options?.force && (loadedTabsRef.current.has(tab) || loadingTabsRef.current.has(tab))) {
        return;
      }

      setRemoteTabLoaded(tab, false);
      setRemoteTabLoading(tab, true);
      startRemoteTabTimeout(tab);

      try {
        await ensureRemoteSession();

        let sendFailure: Promise<never> | undefined;
        const extraSendFailures: Promise<never>[] = [];

        if (tab === "user") {
          sendFailure = createRemoteAdminSendFailurePromise(
            {
              case: "getOwnerRequest",
              value: true,
            },
            { tolerateAckTimeout: true },
          );
        } else if (tab === "channels") {
          sendFailure = createRemoteAdminSendFailurePromise(
            {
              case: "getChannelRequest",
              value: 1,
            },
            { tolerateAckTimeout: true },
          );
        } else if (REMOTE_CONFIG_TAB_REQUESTS[tab] !== undefined) {
          sendFailure = createRemoteAdminSendFailurePromise(
            {
              case: "getConfigRequest",
              value: REMOTE_CONFIG_TAB_REQUESTS[tab],
            },
            { tolerateAckTimeout: true },
          );
          if (tab === "display") {
            extraSendFailures.push(
              createRemoteAdminSendFailurePromise(
                {
                  case: "getUiConfigRequest",
                  value: true,
                },
                { tolerateAckTimeout: true },
              ),
            );
          }
        } else if (REMOTE_MODULE_TAB_REQUESTS[tab] !== undefined) {
          sendFailure = createRemoteAdminSendFailurePromise(
            {
              case: "getModuleConfigRequest",
              value: REMOTE_MODULE_TAB_REQUESTS[tab],
            },
            { tolerateAckTimeout: true },
          );
        }

        const sendFailures = sendFailure ? [sendFailure, ...extraSendFailures] : extraSendFailures;

        if (options?.awaitResult && sendFailures.length > 0) {
          await Promise.race([waitForRemoteTabResponse(tab), ...sendFailures]);
        } else {
          sendFailures.forEach((failure) => {
            void failure.catch((error) => {
              console.warn(`remote admin ${tab} request failed`, error);
              markRemoteTabFailed(tab);
            });
          });
        }
      } catch (error) {
        console.warn(`remote admin ${tab} request failed`, error);
        markRemoteTabFailed(tab);
        throw error;
      }
    },
    [
      createRemoteAdminSendFailurePromise,
      ensureRemoteSession,
      localDevice.connection,
      markRemoteTabFailed,
      setRemoteTabLoaded,
      setRemoteTabLoading,
      startRemoteTabTimeout,
      waitForRemoteTabResponse,
    ],
  );

  const handleRemoteTabChange = useCallback(
    (value: string) => {
      const tab = value as RemoteAdminTab;
      setActiveTabs((current) => ({
        ...current,
        [activeSectionKey]: tab,
      }));
      void requestRemoteTab(tab).catch((error) => {
        console.warn(`remote admin ${tab} request failed`, error);
      });
    },
    [activeSectionKey, requestRemoteTab],
  );

  const handlePanelMenuItem = useCallback(
    (item: RemoteAdminPanelMenuItem) => {
      setPanelSectionKey(item.section);
      setActiveTabs((current) => ({
        ...current,
        [item.section]: item.tab,
      }));
      setPanelMenuOpen(false);
      void requestRemoteTab(item.tab).catch((error) => {
        console.warn(`remote admin ${item.tab} request failed`, error);
      });
    },
    [requestRemoteTab],
  );

  const handlePanelBack = useCallback(() => {
    if (!panelMenuOpen) {
      setPanelMenuOpen(true);
      return;
    }

    onClose?.();
  }, [onClose, panelMenuOpen]);

  useEffect(() => {
    if (mode !== "panel" || !panelMenuOpen || targetMetadata || !localDevice.connection) {
      return;
    }

    void ensureRemoteSession().catch((error) => {
      console.warn("remote admin metadata request failed", error);
    });
  }, [ensureRemoteSession, localDevice.connection, mode, panelMenuOpen, targetMetadata]);

  useEffect(() => {
    if (!localDevice.connection) {
      return;
    }

    const pendingAdminResponseResolvers = pendingAdminResponseResolversRef.current;
    const pendingTabResponseResolvers = pendingTabResponseResolversRef.current;

    const handleMeshPacket = (packet: Protobuf.Mesh.MeshPacket) => {
      if (packet.from !== nodeNum || packet.payloadVariant.case !== "decoded") {
        return;
      }

      const data = packet.payloadVariant.value;
      if (data.portnum !== Protobuf.Portnums.PortNum.ADMIN_APP) {
        return;
      }

      const adminMessage = fromBinary(Protobuf.Admin.AdminMessageSchema, data.payload);

      const pendingResolvers = Array.from(pendingAdminResponseResolvers);
      pendingAdminResponseResolvers.clear();
      pendingResolvers.forEach((resolve) => resolve());

      if (adminMessage.sessionPasskey && adminMessage.sessionPasskey.length > 0) {
        sessionPasskeyRef.current = new Uint8Array(adminMessage.sessionPasskey);
      }

      switch (adminMessage.payloadVariant.case) {
        case "getOwnerResponse":
          markRemoteTabLoaded("user");
          break;
        case "getConfigResponse": {
          setConfig(adminMessage.payloadVariant.value);
          const configTab = adminMessage.payloadVariant.value.payloadVariant.case as RemoteAdminTab;
          if (configTab) {
            markRemoteTabLoaded(configTab);
          }
          break;
        }
        case "getUiConfigResponse":
          setDeviceUiConfig(adminMessage.payloadVariant.value);
          markRemoteTabLoaded("display");
          break;
        case "getModuleConfigResponse": {
          setModuleConfig(adminMessage.payloadVariant.value);
          if (adminMessage.payloadVariant.value.payloadVariant.case === "statusmessage") {
            nodeDB.updateNodeStatus(
              nodeNum,
              adminMessage.payloadVariant.value.payloadVariant.value.nodeStatus,
            );
          }
          const moduleTab = adminMessage.payloadVariant.value.payloadVariant.case as RemoteAdminTab;
          if (moduleTab) {
            markRemoteTabLoaded(moduleTab);
          }
          break;
        }
        case "getChannelResponse": {
          const channel = adminMessage.payloadVariant.value;
          addChannel(channel);

          if (
            channel.role !== Protobuf.Channel.Channel_Role.DISABLED &&
            channel.index + 1 < maxChannels
          ) {
            startRemoteTabTimeout("channels");
            const sendFailure = createRemoteAdminSendFailurePromise(
              {
                case: "getChannelRequest",
                value: channel.index + 2,
              },
              { tolerateAckTimeout: true },
            );
            void sendFailure.catch((error) => {
              console.warn("remote admin channel fetch failed", error);
              markRemoteTabFailed("channels");
            });
          } else {
            markRemoteTabLoaded("channels");
          }
          break;
        }
      }
    };

    localDevice.connection.events.onMeshPacket.subscribe(handleMeshPacket);

    return () => {
      const pendingResolvers = Array.from(pendingAdminResponseResolvers);
      pendingAdminResponseResolvers.clear();
      pendingResolvers.forEach((resolve) => resolve());
      pendingTabResponseResolvers.forEach((resolvers) =>
        Array.from(resolvers).forEach((resolve) => resolve()),
      );
      pendingTabResponseResolvers.clear();
      localDevice.connection?.events.onMeshPacket.unsubscribe(handleMeshPacket);
    };
  }, [
    addChannel,
    localDevice.connection,
    markRemoteTabFailed,
    markRemoteTabLoaded,
    maxChannels,
    nodeNum,
    nodeDB,
    createRemoteAdminSendFailurePromise,
    setConfig,
    setDeviceUiConfig,
    setModuleConfig,
    startRemoteTabTimeout,
  ]);

  useEffect(() => {
    sessionPasskeyRef.current = new Uint8Array();
    clearAllRemoteTabTimeouts();
    pendingAdminResponseResolversRef.current.clear();
    pendingTabResponseResolversRef.current.clear();
    loadedTabsRef.current = new Set<RemoteAdminTab>();
    loadingTabsRef.current = new Set<RemoteAdminTab>();
    setActiveTabs({});
    setLoadedTabs(new Set<RemoteAdminTab>());
    setLoadingTabs(new Set<RemoteAdminTab>());
    setConfigState(create(Protobuf.LocalOnly.LocalConfigSchema));
    setModuleConfigState(create(Protobuf.LocalOnly.LocalModuleConfigSchema));
    setChannelsState(new Map());
    setChangeRegistry(createChangeRegistry());
  }, [clearAllRemoteTabTimeouts, nodeNum]);

  const onFormInit = useCallback(<T extends FieldValues>(methods: UseFormReturn<T>) => {
    setFormMethods(methods as UseFormReturn);
    setRhfState({ isDirty: false, isValid: true });

    unsubRef.current?.();
    unsubRef.current = methods.subscribe({
      formState: { isDirty: true, isValid: true },
      callback: ({ isDirty, isValid }) => {
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
      if (!sessionPasskeyRef.current.length) {
        throw new Error("Remote admin session key not available yet");
      }

      const channelChanges = getAllChannelChanges();
      const configChanges = getAllConfigChanges();
      const moduleConfigChanges = getAllModuleConfigChanges();
      const adminMessages = getAllQueuedAdminMessages();
      const userChange = getChange({ type: "user" }) as Protobuf.Mesh.User | undefined;
      const hasTransactionalChanges =
        Boolean(userChange) ||
        channelChanges.length > 0 ||
        configChanges.length > 0 ||
        moduleConfigChanges.length > 0;

      if (hasTransactionalChanges) {
        await sendRemoteAdmin(
          {
            case: "beginEditSettings",
            value: true,
          },
          { includeSessionPasskey: true },
        );
      }

      if (userChange) {
        await sendRemoteAdmin(
          {
            case: "setOwner",
            value: userChange,
          },
          { includeSessionPasskey: true },
        );

        nodeDB.addUser({
          id: Date.now(),
          rxTime: new Date(),
          type: "direct",
          from: nodeNum,
          to: nodeNum,
          channel: Types.ChannelNumber.Primary,
          data: userChange,
        });
      }

      for (const channel of channelChanges) {
        await sendRemoteAdmin(
          {
            case: "setChannel",
            value: channel,
          },
          { includeSessionPasskey: true },
        );

        toast({
          title: t("toast.savedChannel.title", {
            ns: "ui",
            channelName: channel.settings?.name,
          }),
        });
      }

      for (const newConfig of configChanges) {
        await sendRemoteAdmin(
          {
            case: "setConfig",
            value: newConfig,
          },
          { includeSessionPasskey: true },
        );

        toast({
          title: t("toast.saveSuccess.title"),
          description: t("toast.saveSuccess.description", {
            case: newConfig.payloadVariant.case,
          }),
        });
      }

      for (const newModuleConfig of moduleConfigChanges) {
        await sendRemoteAdmin(
          {
            case: "setModuleConfig",
            value: newModuleConfig,
          },
          { includeSessionPasskey: true },
        );

        toast({
          title: t("toast.saveSuccess.title"),
          description: t("toast.saveSuccess.description", {
            case: newModuleConfig.payloadVariant.case,
          }),
        });
      }

      for (const message of adminMessages) {
        if (!message.payloadVariant.case) {
          continue;
        }

        await sendRemoteAdmin(message.payloadVariant, {
          includeSessionPasskey: true,
        });

        const positionPayload = getPositionAdminPayload(message);
        if (positionPayload) {
          nodeDB.addPosition({
            id: Date.now(),
            rxTime: new Date(),
            type: "direct",
            from: nodeNum,
            to: nodeNum,
            channel: Types.ChannelNumber.Primary,
            data: positionPayload,
          });
        }

        const deviceUiPayload = getDeviceUiAdminPayload(message);
        if (deviceUiPayload) {
          setDeviceUiConfig(deviceUiPayload);
        }
      }

      if (hasTransactionalChanges) {
        await sendRemoteAdmin(
          {
            case: "commitEditSettings",
            value: true,
          },
          { includeSessionPasskey: true },
        );
      }

      channelChanges.forEach(addChannel);
      configChanges.forEach(setConfig);
      moduleConfigChanges.forEach(setModuleConfig);

      clearAllChanges();

      if (formMethods) {
        formMethods.reset(formMethods.getValues(), {
          keepDirty: false,
          keepErrors: false,
          keepTouched: false,
          keepValues: true,
        });

        formMethods.trigger();
      }

      toast({
        title: t("toast.saveAllSuccess.title"),
        description: t("toast.saveAllSuccess.description"),
      });
    } catch (error) {
      console.warn("remote admin save failed", error);
      toast({
        title: t("toast.configSaveError.title"),
        description:
          error instanceof Error ? error.message : t("toast.configSaveError.description"),
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    addChannel,
    clearAllChanges,
    formMethods,
    getAllChannelChanges,
    getAllConfigChanges,
    getAllModuleConfigChanges,
    getAllQueuedAdminMessages,
    getChange,
    nodeDB,
    nodeNum,
    sendRemoteAdmin,
    setConfig,
    setDeviceUiConfig,
    setModuleConfig,
    t,
    toast,
  ]);

  const handleReset = useCallback(() => {
    formMethods?.reset();
    clearAllChanges();
  }, [clearAllChanges, formMethods]);

  const getRemoteDeviceActionLabel = useCallback(
    (action: RemoteDeviceAction) => {
      switch (action) {
        case "reboot":
          return t("remoteAdmin.actions.reboot", "Reboot");
        case "hibernate":
          return t("remoteAdmin.actions.hibernate", "Hibernate Device");
        case "factoryResetDevice":
          return t("remoteAdmin.actions.factoryResetDevice", "Factory Settings");
        case "nodeDbReset":
          return t("remoteAdmin.actions.nodeDbReset", "NodeDB Reset");
      }
    },
    [t],
  );

  const handleRemoteDeviceAction = useCallback(
    async (action: RemoteDeviceAction) => {
      const label = getRemoteDeviceActionLabel(action);
      const confirmed =
        typeof window === "undefined" ||
        window.confirm(
          t("remoteAdmin.actions.confirm", 'Inviare il comando remoto "{{label}}" al nodo?', {
            label,
          }),
        );

      if (!confirmed) {
        return;
      }

      setRemoteActionBusy(action);
      try {
        await ensureRemoteSession();
        await sendRemoteAdmin(getRemoteDeviceActionPayload(action), {
          includeSessionPasskey: true,
        });
        toast({
          title: t("remoteAdmin.toast.actionSent.title", "Remote command sent"),
          description: label,
        });
      } catch (error) {
        console.warn(`remote admin ${action} failed`, error);
        toast({
          title: t("remoteAdmin.toast.actionFailed.title", "Remote command failed"),
          description: error instanceof Error ? error.message : label,
        });
      } finally {
        setRemoteActionBusy(undefined);
      }
    },
    [ensureRemoteSession, getRemoteDeviceActionLabel, sendRemoteAdmin, t, toast],
  );

  const configChangeCount = getConfigChangeCount(changeRegistry);
  const moduleConfigChangeCount = getModuleConfigChangeCount(changeRegistry);
  const channelChangeCount = getChannelChangeCount(changeRegistry);
  const adminMessageChangeCount = getAdminMessageDraftCount(changeRegistry);

  const sections = useMemo(
    () => [
      {
        key: "radio",
        route: remoteAdminRadioRoute,
        label: t("navigation.radioConfig"),
        icon: RadioTowerIcon,
        changeCount: configChangeCount + channelChangeCount,
        component: RadioConfig,
      },
      {
        key: "device",
        route: remoteAdminDeviceRoute,
        label: t("navigation.deviceConfig"),
        icon: RouterIcon,
        changeCount: configChangeCount + Number(hasUserChange(changeRegistry)),
        component: DeviceConfig,
      },
      {
        key: "module",
        route: remoteAdminModuleRoute,
        label: t("navigation.moduleConfig"),
        icon: LayersIcon,
        changeCount: moduleConfigChangeCount,
        component: ModuleConfig,
      },
    ],
    [channelChangeCount, changeRegistry, configChangeCount, moduleConfigChangeCount, t],
  );

  const activeSection = (sections.find((section) => section.key === activeSectionKey) ??
    sections[0])!;

  const leftSidebar = useMemo(
    () => (
      <Sidebar>
        <SidebarSection label={t("sidebar.label")} className="py-2 px-0">
          {sections.map((section) => (
            <LeftSidebarButton
              key={section.key}
              label={section.label}
              active={activeSection?.key === section.key}
              onClick={() => navigate({ to: section.route.to, params: { nodeNum } })}
              Icon={section.icon}
              isDirty={section.changeCount > 0}
              count={section.changeCount}
            />
          ))}
        </SidebarSection>
      </Sidebar>
    ),
    [activeSection?.key, navigate, nodeNum, sections, t],
  );

  const mobileSubNav = (
    <div className="flex items-center gap-1 overflow-x-auto">
      {sections.map((section) => {
        const Icon = section.icon;
        const active = activeSection?.key === section.key;
        return (
          <button
            key={section.key}
            type="button"
            onClick={() => navigate({ to: section.route.to, params: { nodeNum } })}
            className={cn(
              "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md px-3 text-xs font-medium",
              active
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
            )}
          >
            <Icon className="size-4" />
            <span className="whitespace-nowrap">{section.label}</span>
            {section.changeCount > 0 ? (
              <span className="rounded-full bg-blue-500 px-1.5 text-[0.65rem] leading-4 text-white">
                {section.changeCount}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );

  const hasDrafts =
    configChangeCount > 0 ||
    moduleConfigChangeCount > 0 ||
    channelChangeCount > 0 ||
    hasUserChange(changeRegistry) ||
    adminMessageChangeCount > 0;
  const hasPending = hasDrafts || rhfState.isDirty;
  const buttonOpacity = hasPending ? "opacity-100" : "opacity-0";
  const saveDisabled =
    isSaving || isRefreshing || !localDevice.connection || !rhfState.isValid || !hasPending;
  const remoteActionsDisabled =
    !localDevice.connection || isSaving || remoteActionBusy !== undefined;
  const supportedDevicePanelMenuItems = useMemo(
    () =>
      DEVICE_PANEL_MENU_ITEMS.filter((item) =>
        isRemotePanelMenuItemSupported(item, targetMetadata),
      ),
    [targetMetadata],
  );
  const supportedModulePanelMenuItems = useMemo(
    () =>
      MODULE_PANEL_MENU_ITEMS.filter((item) =>
        isRemotePanelMenuItemSupported(item, targetMetadata),
      ),
    [targetMetadata],
  );
  const supportedPanelMenuItems = useMemo(
    () => [...supportedDevicePanelMenuItems, ...supportedModulePanelMenuItems],
    [supportedDevicePanelMenuItems, supportedModulePanelMenuItems],
  );
  const panelOperationItems = useMemo<RemoteAdminPanelOperationItem[]>(
    () => [
      {
        action: "reboot",
        label: getRemoteDeviceActionLabel("reboot"),
        icon: RefreshCwIcon,
      },
      {
        action: "hibernate",
        label: getRemoteDeviceActionLabel("hibernate"),
        icon: PowerIcon,
      },
      {
        action: "factoryResetDevice",
        label: getRemoteDeviceActionLabel("factoryResetDevice"),
        icon: Trash2Icon,
      },
      {
        action: "nodeDbReset",
        label: getRemoteDeviceActionLabel("nodeDbReset"),
        icon: DatabaseIcon,
      },
    ],
    [getRemoteDeviceActionLabel],
  );

  const handleRemoteRefresh = useCallback(async () => {
    if (!activeTab) {
      toast({
        title: t("remoteAdmin.toast.selectSubsection.title", "Select a subsection first"),
        description: t(
          "remoteAdmin.toast.selectSubsection.description",
          "Choose a tab before requesting remote data.",
        ),
      });
      return;
    }

    setIsRefreshing(true);
    try {
      await requestRemoteTab(activeTab, { force: true, awaitResult: true });
    } catch (error) {
      console.warn("remote admin manual refresh failed", error);
      toast({
        title: t("remoteAdmin.toast.loadError.title", "Unable to load remote settings"),
        description:
          error instanceof Error
            ? error.message
            : t(
                "remoteAdmin.toast.loadError.description",
                "The remote node did not return its configuration.",
              ),
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [activeTab, requestRemoteTab, t, toast]);

  const actions = useMemo(
    () => [
      {
        key: "refresh",
        icon: RefreshCwIcon,
        label: t("common:button.refresh", "Refresh"),
        onClick: handleRemoteRefresh,
        className: cn([
          "transition-opacity hover:bg-slate-200 disabled:hover:bg-white",
          "hover:dark:bg-slate-300 hover:dark:text-black cursor-pointer",
        ]),
        isLoading: isRefreshing,
      },
      {
        key: "node-operations",
        icon: ServerCogIcon,
        label: t("remoteAdmin.actions.nodeOperations", "Node Operations"),
        disabled: remoteActionsDisabled,
        isLoading: remoteActionBusy !== undefined,
        className: cn([
          "transition-colors hover:bg-slate-200 disabled:hover:bg-white",
          "hover:dark:bg-slate-300 hover:dark:text-black cursor-pointer",
        ]),
        subActions: [
          {
            key: "remote-reboot",
            icon: RefreshCwIcon,
            label: getRemoteDeviceActionLabel("reboot"),
            onClick: () => {
              void handleRemoteDeviceAction("reboot");
            },
            disabled: remoteActionsDisabled,
            isLoading: remoteActionBusy === "reboot",
            className: cn("text-amber-700 dark:text-amber-300"),
          },
          {
            key: "remote-hibernate",
            icon: PowerIcon,
            label: getRemoteDeviceActionLabel("hibernate"),
            onClick: () => {
              void handleRemoteDeviceAction("hibernate");
            },
            disabled: remoteActionsDisabled,
            isLoading: remoteActionBusy === "hibernate",
            className: cn("text-amber-700 dark:text-amber-300"),
          },
          {
            key: "remote-factory-reset",
            icon: Trash2Icon,
            label: getRemoteDeviceActionLabel("factoryResetDevice"),
            onClick: () => {
              void handleRemoteDeviceAction("factoryResetDevice");
            },
            disabled: remoteActionsDisabled,
            isLoading: remoteActionBusy === "factoryResetDevice",
            className: cn("text-red-700 dark:text-red-300"),
          },
          {
            key: "remote-nodedb-reset",
            icon: DatabaseIcon,
            label: getRemoteDeviceActionLabel("nodeDbReset"),
            onClick: () => {
              void handleRemoteDeviceAction("nodeDbReset");
            },
            disabled: remoteActionsDisabled,
            isLoading: remoteActionBusy === "nodeDbReset",
            className: cn("text-red-700 dark:text-red-300"),
          },
        ],
      },
      {
        key: "unsavedChanges",
        label: t("common:formValidation.unsavedChanges"),
        onClick: () => {},
        className: cn([
          "bg-blue-500 text-slate-900 hover:bg-initial",
          "transition-colors duration-200",
          buttonOpacity,
          "transition-opacity",
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
          "hover:dark:bg-slate-300 hover:dark:text-black cursor-pointer",
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
        ]),
        onClick: handleSave,
        label: t("common:button.save"),
      },
    ],
    [
      buttonOpacity,
      getRemoteDeviceActionLabel,
      handleRemoteRefresh,
      handleRemoteDeviceAction,
      handleReset,
      handleSave,
      hasPending,
      isRefreshing,
      isSaving,
      remoteActionBusy,
      remoteActionsDisabled,
      rhfState.isValid,
      saveDisabled,
      t,
    ],
  );

  const remoteTarget = useMemo<ConfigTarget>(
    () => ({
      config,
      moduleConfig,
      deviceUiConfig,
      channels,
      hardware: create(Protobuf.Mesh.MyNodeInfoSchema, {
        ...localDevice.hardware,
        myNodeNum: nodeNum,
      }),
      connection: localDevice.connection,
      connectionId: localDevice.connectionId,
      setConfig,
      setModuleConfig,
      setDeviceUiConfig,
      addChannel,
      setDialogOpen: () => undefined,
      setChange,
      removeChange,
      getChange,
      clearAllChanges,
      hasConfigChange: (variant) => hasConfigChange(changeRegistry, variant),
      hasModuleConfigChange: (variant) => hasModuleConfigChange(changeRegistry, variant),
      hasChannelChange: (index) => hasChannelChange(changeRegistry, index),
      hasUserChange: () => hasUserChange(changeRegistry),
      getConfigChangeCount: () => getConfigChangeCount(changeRegistry),
      getModuleConfigChangeCount: () => getModuleConfigChangeCount(changeRegistry),
      getChannelChangeCount: () => getChannelChangeCount(changeRegistry),
      getEffectiveConfig,
      getEffectiveModuleConfig,
      getAllConfigChanges,
      getAllModuleConfigChanges,
      getAllChannelChanges,
      queueAdminMessage,
      getAllQueuedAdminMessages,
      getAdminMessageChangeCount: () => getAdminMessageDraftCount(changeRegistry),
      isRemote: true,
      targetNodeNum: nodeNum,
    }),
    [
      addChannel,
      changeRegistry,
      channels,
      clearAllChanges,
      config,
      deviceUiConfig,
      getAllChannelChanges,
      getAllConfigChanges,
      getAllModuleConfigChanges,
      getAllQueuedAdminMessages,
      getChange,
      getEffectiveConfig,
      getEffectiveModuleConfig,
      localDevice.connection,
      localDevice.connectionId,
      localDevice.hardware,
      moduleConfig,
      nodeNum,
      queueAdminMessage,
      removeChange,
      setChange,
      setConfig,
      setDeviceUiConfig,
      setModuleConfig,
    ],
  );

  const ActiveComponent = activeSection?.component;
  const pageLabel = getNodeLongName(targetNode)
    ? `${t("navigation.remoteAdmin", "Remote Admin")} · ${getNodeLongName(targetNode)}`
    : `${t("navigation.remoteAdmin", "Remote Admin")} · ${nodeNum}`;
  const panelActiveTitle =
    activeTab === undefined
      ? t("navigation.remoteAdmin", "Remote Admin")
      : (supportedPanelMenuItems.find((item) => item.tab === activeTab)?.label ??
        PANEL_MENU_ITEMS.find((item) => item.tab === activeTab)?.label ??
        activeSection.label);

  if (mode === "panel") {
    return (
      <ConfigTargetProvider value={remoteTarget}>
        <div className="flex h-full max-h-full min-h-0 flex-col overflow-hidden bg-[#111] text-zinc-100">
          <div className="flex items-center gap-3 border-b border-zinc-800 bg-[#202020] px-4 py-3">
            <button
              type="button"
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-blue-500 text-zinc-100 shadow-[0_0_0_2px_rgba(255,255,255,0.85)] hover:bg-white/10"
              onClick={handlePanelBack}
              aria-label={panelMenuOpen ? "Close remote admin" : "Back to remote admin menu"}
            >
              <ArrowLeftIcon className="size-6" />
            </button>
            <div className="min-w-0">
              <div className="truncate text-xl font-semibold text-zinc-100">
                {getNodeLongName(targetNode) ?? nodeNum}
              </div>
              <div className="truncate text-sm text-zinc-300">
                {panelMenuOpen ? t("navigation.remoteAdmin", "Remote Admin") : panelActiveTitle}
              </div>
            </div>
          </div>

          <div
            className={cn(
              "min-h-0 flex-1 px-4 py-5",
              panelMenuOpen
                ? "touch-pan-y overflow-y-auto overscroll-contain"
                : "flex flex-col overflow-hidden",
            )}
          >
            {panelMenuOpen ? (
              <>
                {supportedDevicePanelMenuItems.length > 0 ? (
                  <RemoteAdminPanelSection title="Impostazioni dispositivo">
                    {supportedDevicePanelMenuItems.map((item) => (
                      <RemoteAdminPanelMenuRow
                        key={item.key}
                        item={item}
                        onClick={() => handlePanelMenuItem(item)}
                      />
                    ))}
                  </RemoteAdminPanelSection>
                ) : null}

                {supportedModulePanelMenuItems.length > 0 ? (
                  <RemoteAdminPanelSection title="Impostazioni moduli">
                    {supportedModulePanelMenuItems.map((item) => (
                      <RemoteAdminPanelMenuRow
                        key={item.key}
                        item={item}
                        onClick={() => handlePanelMenuItem(item)}
                      />
                    ))}
                  </RemoteAdminPanelSection>
                ) : null}

                <RemoteAdminPanelSection title="Node Operations">
                  {panelOperationItems.map((item) => (
                    <RemoteAdminPanelOperationButton
                      key={item.action}
                      item={item}
                      disabled={remoteActionsDisabled}
                      busy={remoteActionBusy === item.action}
                      onClick={() => {
                        void handleRemoteDeviceAction(item.action);
                      }}
                    />
                  ))}
                </RemoteAdminPanelSection>
              </>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
                  <h2 className="min-w-0 truncate text-2xl font-semibold text-zinc-100">
                    {panelActiveTitle}
                  </h2>
                  <button
                    type="button"
                    className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md bg-[#252525] px-3 text-sm font-semibold text-zinc-100 hover:bg-[#303030] disabled:cursor-not-allowed disabled:opacity-45"
                    onClick={handleRemoteRefresh}
                    disabled={isRefreshing || !localDevice.connection}
                  >
                    <RefreshCwIcon className={cn("size-4", isRefreshing && "animate-spin")} />
                    Refresh
                  </button>
                </div>
                <div className="darkmesh-config-panel min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain pr-1">
                  {ActiveComponent ? (
                    <ActiveComponent
                      onFormInit={onFormInit}
                      activeTab={activeTab}
                      onTabChange={handleRemoteTabChange}
                      loadedTabs={loadedTabs}
                      loadingTabs={loadingTabs}
                      hideTabs
                    />
                  ) : null}
                </div>
                <RemoteAdminPanelActionBar
                  hasPending={hasPending}
                  isSaving={isSaving}
                  saveDisabled={saveDisabled}
                  onCancel={handleReset}
                  onSend={handleSave}
                />
              </div>
            )}
          </div>
        </div>
      </ConfigTargetProvider>
    );
  }

  return (
    <ConfigTargetProvider value={remoteTarget}>
      <PageLayout
        contentClassName="overflow-auto"
        leftBar={leftSidebar}
        label={pageLabel}
        actions={actions}
        mobileSubNav={mobileSubNav}
      >
        {ActiveComponent && (
          <ActiveComponent
            onFormInit={onFormInit}
            activeTab={activeTab}
            onTabChange={handleRemoteTabChange}
            loadedTabs={loadedTabs}
            loadingTabs={loadingTabs}
          />
        )}
      </PageLayout>
    </ConfigTargetProvider>
  );
}

function RemoteAdminPanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-7">
      <h2 className="mb-3 text-xl font-semibold text-zinc-100">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function RemoteAdminPanelActionBar({
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

function RemoteAdminPanelMenuRow({
  item,
  onClick,
}: {
  item: RemoteAdminPanelMenuItem;
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

function RemoteAdminPanelOperationButton({
  item,
  disabled,
  busy,
  onClick,
}: {
  item: RemoteAdminPanelOperationItem;
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

export default RemoteAdminPage;
