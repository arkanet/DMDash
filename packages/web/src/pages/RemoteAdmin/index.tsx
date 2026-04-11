import {
  remoteAdminRoute,
  remoteAdminDeviceRoute,
  remoteAdminModuleRoute,
  remoteAdminRadioRoute,
} from "@app/routes";
import { create, fromBinary, toBinary } from "@bufbuild/protobuf";
import { PageLayout } from "@components/PageLayout.tsx";
import { Sidebar } from "@components/Sidebar.tsx";
import { SidebarButton } from "@components/UI/Sidebar/SidebarButton.tsx";
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
import { DeviceConfig } from "@pages/Settings/DeviceConfig.tsx";
import { ModuleConfig } from "@pages/Settings/ModuleConfig.tsx";
import { Protobuf, Types } from "@meshtastic/core";
import { RadioConfig } from "@pages/Settings/RadioConfig.tsx";
import {
  LayersIcon,
  RadioTowerIcon,
  RefreshCwIcon,
  RouterIcon,
  SaveIcon,
  SaveOff,
} from "lucide-react";
import { useNavigate, useParams, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";

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

const REMOTE_RESPONSE_TIMEOUT_MS = 8000;

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
  neighborInfo: Protobuf.Admin.AdminMessage_ModuleConfigType.NEIGHBORINFO_CONFIG,
  ambientLighting: Protobuf.Admin.AdminMessage_ModuleConfigType.AMBIENTLIGHTING_CONFIG,
  detectionSensor: Protobuf.Admin.AdminMessage_ModuleConfigType.DETECTIONSENSOR_CONFIG,
  paxcounter: Protobuf.Admin.AdminMessage_ModuleConfigType.PAXCOUNTER_CONFIG,
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
  }

  return next;
};

const resolveAdminChannelIndex = (channels: Map<Types.ChannelNumber, Protobuf.Channel.Channel>) => {
  const adminChannel = Array.from(channels.values()).find(
    (channel) => channel.settings?.name?.toLowerCase() === "admin",
  );

  return (adminChannel?.index ?? Types.ChannelNumber.Primary) as Types.ChannelNumber;
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
  const [channels, setChannelsState] = useState<Map<Types.ChannelNumber, Protobuf.Channel.Channel>>(
    () => new Map(),
  );
  const [changeRegistry, setChangeRegistry] = useState<ChangeRegistry>(() =>
    createChangeRegistry(),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [rhfState, setRhfState] = useState({ isDirty: false, isValid: true });
  const [formMethods, setFormMethods] = useState<UseFormReturn | null>(null);
  const [activeTabs, setActiveTabs] = useState<Partial<Record<RemoteAdminSection, RemoteAdminTab>>>(
    {},
  );
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
  const activeSectionKey = useMemo<RemoteAdminSection>(
    () => resolveRemoteAdminSection(routerState.location.pathname, nodeNum),
    [nodeNum, routerState.location.pathname],
  );
  const activeTab = activeTabs[activeSectionKey];
  // Public key checks removed for now — PKC admin path unused in this build

  const setConfig = useCallback((newConfig: Protobuf.Config.Config) => {
    setConfigState((current) => applyConfigMessage(current, newConfig));
  }, []);

  const setModuleConfig = useCallback((newConfig: Protobuf.ModuleConfig.ModuleConfig) => {
    setModuleConfigState((current) => applyModuleConfigMessage(current, newConfig));
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
    const messageId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const variant =
      message.payloadVariant.case === "setFixedPosition" ? "setFixedPosition" : "other";

    setChangeRegistry((current) => {
      const next = new Map(current.changes);
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

  const ensureRemoteSession = useCallback(async () => {
    if (sessionPasskeyRef.current.length > 0) {
      return;
    }

    const waitForSession = waitForRemoteAdminResponse();
    await sendRemoteAdmin(
      {
        case: "getDeviceMetadataRequest",
        value: true,
      },
      { wantResponse: true },
    );
    await waitForSession;
  }, [sendRemoteAdmin, waitForRemoteAdminResponse]);

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

        if (tab === "user") {
          await sendRemoteAdmin(
            {
              case: "getOwnerRequest",
              value: true,
            },
            { wantResponse: true },
          );
        } else if (tab === "channels") {
          await sendRemoteAdmin(
            {
              case: "getChannelRequest",
              value: 1,
            },
            { wantResponse: true },
          );
        } else if (REMOTE_CONFIG_TAB_REQUESTS[tab] !== undefined) {
          await sendRemoteAdmin(
            {
              case: "getConfigRequest",
              value: REMOTE_CONFIG_TAB_REQUESTS[tab],
            },
            { wantResponse: true },
          );
        } else if (REMOTE_MODULE_TAB_REQUESTS[tab] !== undefined) {
          await sendRemoteAdmin(
            {
              case: "getModuleConfigRequest",
              value: REMOTE_MODULE_TAB_REQUESTS[tab],
            },
            { wantResponse: true },
          );
        }

        if (options?.awaitResult) {
          await waitForRemoteTabResponse(tab);
        }
      } catch (error) {
        console.warn(`remote admin ${tab} request failed`, error);
        markRemoteTabFailed(tab);
        throw error;
      }
    },
    [
      ensureRemoteSession,
      localDevice.connection,
      markRemoteTabFailed,
      sendRemoteAdmin,
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
        case "getModuleConfigResponse": {
          setModuleConfig(adminMessage.payloadVariant.value);
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
            sendRemoteAdmin(
              {
                case: "getChannelRequest",
                value: channel.index + 2,
              },
              { wantResponse: true },
            ).catch((error) => {
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
    sendRemoteAdmin,
    setConfig,
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

      if (hasTransactionalChanges) {
        await sendRemoteAdmin(
          {
            case: "commitEditSettings",
            value: true,
          },
          { includeSessionPasskey: true },
        );
      }

      for (const message of adminMessages) {
        if (!message.payloadVariant.case) {
          continue;
        }

        await sendRemoteAdmin(message.payloadVariant, {
          includeSessionPasskey: true,
        });

        if (message.payloadVariant.case === "setFixedPosition") {
          nodeDB.addPosition({
            id: Date.now(),
            rxTime: new Date(),
            type: "direct",
            from: nodeNum,
            to: nodeNum,
            channel: Types.ChannelNumber.Primary,
            data: message.payloadVariant.value,
          });
        }
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
    setModuleConfig,
    t,
    toast,
  ]);

  const handleReset = useCallback(() => {
    formMethods?.reset();
    clearAllChanges();
  }, [clearAllChanges, formMethods]);

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

  const activeSection =
    sections.find((section) =>
      routerState.location.pathname.includes(`/remote-admin/${nodeNum}/${section.key}`),
    ) ?? sections[0];

  const leftSidebar = useMemo(
    () => (
      <Sidebar>
        <SidebarSection label={t("sidebar.label")} className="py-2 px-0">
          {sections.map((section) => (
            <SidebarButton
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
      handleRemoteRefresh,
      handleReset,
      handleSave,
      hasPending,
      isRefreshing,
      isSaving,
      rhfState.isValid,
      saveDisabled,
      t,
    ],
  );

  const remoteTarget = useMemo<ConfigTarget>(
    () => ({
      config,
      moduleConfig,
      channels,
      hardware: create(Protobuf.Mesh.MyNodeInfoSchema, {
        ...localDevice.hardware,
        myNodeNum: nodeNum,
      }),
      connection: localDevice.connection,
      setConfig,
      setModuleConfig,
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
      getAllChannelChanges,
      getAllConfigChanges,
      getAllModuleConfigChanges,
      getAllQueuedAdminMessages,
      getChange,
      getEffectiveConfig,
      getEffectiveModuleConfig,
      localDevice.connection,
      localDevice.hardware,
      moduleConfig,
      nodeNum,
      queueAdminMessage,
      removeChange,
      setChange,
      setConfig,
      setModuleConfig,
    ],
  );

  const ActiveComponent = activeSection?.component;
  const pageLabel = targetNode?.user?.longName
    ? `${t("navigation.remoteAdmin", "Remote Admin")} · ${targetNode.user.longName}`
    : `${t("navigation.remoteAdmin", "Remote Admin")} · ${nodeNum}`;

  return (
    <ConfigTargetProvider value={remoteTarget}>
      <PageLayout
        contentClassName="overflow-auto"
        leftBar={leftSidebar}
        label={pageLabel}
        actions={actions}
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
};

export default RemoteAdminPage;
