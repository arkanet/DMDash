import { deviceRoute, moduleRoute, radioRoute } from "@app/routes";
import { create, toBinary } from "@bufbuild/protobuf";
import { PageLayout } from "@components/PageLayout.tsx";
import { Sidebar } from "@components/Sidebar.tsx";
import { LeftSidebarButton } from "@components/UI/Sidebar/LeftSidebarButton.tsx";
import { SidebarSection } from "@components/UI/Sidebar/SidebarSection.tsx";
import { useConfigTarget } from "@core/hooks/useConfigTarget.tsx";
import { useToast } from "@core/hooks/useToast.ts";
import { useNodeDB } from "@core/stores";
import { cn } from "@core/utils/cn.ts";
import {
  isExpectedRebootDisconnectError,
  markExpectedDeviceReconnect,
} from "@core/utils/rebootReconnect.ts";
import { Protobuf, Types } from "@meshtastic/core";
import { DeviceConfig } from "@pages/Settings/DeviceConfig.tsx";
import { ModuleConfig } from "@pages/Settings/ModuleConfig.tsx";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayersIcon,
  RadioTowerIcon,
  RefreshCwIcon,
  RouterIcon,
  SaveIcon,
  SaveOff,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { RadioConfig } from "./RadioConfig.tsx";

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

  const [isSaving, setIsSaving] = useState(false);
  const [rhfState, setRhfState] = useState({ isDirty: false, isValid: true });
  const unsubRef = useRef<(() => void) | null>(null);
  const [formMethods, setFormMethods] = useState<UseFormReturn | null>(null);
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

  const mobileSubNav = (
    <div className="flex items-center gap-1 overflow-x-auto">
      {sections.map((section) => {
        const Icon = section.icon;
        const active = activeSection?.key === section.key;
        return (
          <button
            key={section.key}
            type="button"
            onClick={() => navigate({ to: section.route.to })}
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
      contentClassName="route-content-mb-10 overflow-auto"
      leftBar={leftSidebar}
      label={activeSection?.label ?? ""}
      actions={actions}
      mobileSubNav={mobileSubNav}
    >
      {ActiveComponent && <ActiveComponent onFormInit={onFormInit} />}
    </PageLayout>
  );
};

export default ConfigPage;
