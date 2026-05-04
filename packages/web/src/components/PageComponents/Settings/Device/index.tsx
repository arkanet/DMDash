import { useWaitForConfig } from "@app/core/hooks/useWaitForConfig";
import { type DeviceValidation, DeviceValidationSchema } from "@app/validation/config/device.ts";
import { useUnsafeRolesDialog } from "@components/Dialog/UnsafeRolesDialog/useUnsafeRolesDialog.ts";
import { DynamicForm, type DynamicFormFormInit } from "@components/Form/DynamicForm.tsx";
import { useConfigTarget } from "@core/hooks/useConfigTarget.tsx";
import { deepCompareConfig } from "@core/utils/deepCompareConfig.ts";
import {
  getRoleAwareRebroadcastModeOptions,
  getRoleDefaultRebroadcastMode,
  normalizeDeviceConfigForRole,
} from "@core/utils/deviceRebroadcastMode.ts";
import { Protobuf } from "@meshtastic/core";
import { useEffect, useMemo, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";

interface DeviceConfigProps {
  onFormInit: DynamicFormFormInit<DeviceValidation>;
}

const FALLBACK_DEVICE_CONFIG: DeviceValidation = {
  role: Protobuf.Config.Config_DeviceConfig_Role.CLIENT,
  serialEnabled: false,
  buttonGpio: 0,
  buzzerGpio: 0,
  rebroadcastMode: Protobuf.Config.Config_DeviceConfig_RebroadcastMode.ALL,
  nodeInfoBroadcastSecs: 900,
  doubleTapAsButtonPress: false,
  isManaged: false,
  disableTripleClick: false,
  ledHeartbeatDisabled: false,
  tzdef: "",
};

export const Device = ({ onFormInit }: DeviceConfigProps) => {
  useWaitForConfig({ configCase: "device" });

  const { config, setChange, getEffectiveConfig, removeChange } = useConfigTarget();
  const { t } = useTranslation("config");
  const { validateRoleSelection } = useUnsafeRolesDialog();
  const [formMethods, setFormMethods] = useState<UseFormReturn<DeviceValidation> | null>(null);
  const baseDeviceConfig = config.device ?? FALLBACK_DEVICE_CONFIG;
  const effectiveDeviceConfig = getEffectiveConfig("device") ?? baseDeviceConfig;
  const defaultDeviceConfig = useMemo(
    () => normalizeDeviceConfigForRole(baseDeviceConfig),
    [baseDeviceConfig],
  );
  const formValues = useMemo(
    () => normalizeDeviceConfigForRole(effectiveDeviceConfig),
    [effectiveDeviceConfig],
  );
  const [liveRole, setLiveRole] = useState(formValues.role);

  useEffect(() => {
    setLiveRole(formValues.role);
  }, [formValues.role]);

  useEffect(() => {
    if (!formMethods) {
      return;
    }

    const subscription = formMethods.watch((_value, { name }) => {
      const nextValues = formMethods.getValues();

      if (name === "role") {
        const nextMode = getRoleDefaultRebroadcastMode(nextValues.role);

        if (nextValues.rebroadcastMode !== nextMode) {
          formMethods.setValue("rebroadcastMode", nextMode, {
            shouldDirty: true,
            shouldTouch: true,
            shouldValidate: true,
          });
          nextValues.rebroadcastMode = nextMode;
        }
      }

      const normalizedValues = normalizeDeviceConfigForRole(nextValues);

      if (normalizedValues.rebroadcastMode !== nextValues.rebroadcastMode) {
        formMethods.setValue("rebroadcastMode", normalizedValues.rebroadcastMode, {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true,
        });
        nextValues.rebroadcastMode = normalizedValues.rebroadcastMode;
      }

      setLiveRole(normalizedValues.role);
    });

    return () => subscription.unsubscribe();
  }, [formMethods]);

  const handleFormInit = (methods: UseFormReturn<DeviceValidation>) => {
    setFormMethods(methods);
    onFormInit(methods);
  };

  const rebroadcastModeOptions = useMemo(
    () => getRoleAwareRebroadcastModeOptions(liveRole),
    [liveRole],
  );

  const onSubmit = (data: DeviceValidation) => {
    const normalizedData = normalizeDeviceConfigForRole(data);

    if (deepCompareConfig(config.device, normalizedData, true)) {
      removeChange({ type: "config", variant: "device" });
      return;
    }

    setChange({ type: "config", variant: "device" }, normalizedData, config.device);
  };

  return (
    <DynamicForm<DeviceValidation>
      onSubmit={onSubmit}
      onFormInit={handleFormInit}
      validationSchema={DeviceValidationSchema}
      defaultValues={defaultDeviceConfig}
      values={formValues}
      fieldGroups={[
        {
          label: t("device.title"),
          description: t("device.description"),
          fields: [
            {
              type: "select",
              name: "role",
              label: t("device.role.label"),
              description: t("device.role.description"),
              validate: validateRoleSelection,
              properties: {
                enumValue: Protobuf.Config.Config_DeviceConfig_Role,
                formatEnumName: true,
              },
            },
            {
              type: "number",
              name: "buttonGpio",
              label: t("device.buttonPin.label"),
              description: t("device.buttonPin.description"),
            },
            {
              type: "number",
              name: "buzzerGpio",
              label: t("device.buzzerPin.label"),
              description: t("device.buzzerPin.description"),
            },
            {
              type: "select",
              name: "rebroadcastMode",
              label: t("device.rebroadcastMode.label"),
              description: t("device.rebroadcastMode.description"),
              properties: {
                enumValue: rebroadcastModeOptions,
                formatEnumName: true,
              },
            },
            {
              type: "number",
              name: "nodeInfoBroadcastSecs",
              label: t("device.nodeInfoBroadcastInterval.label"),
              description: t("device.nodeInfoBroadcastInterval.description"),
              properties: {
                suffix: t("unit.second.plural"),
              },
            },
            {
              type: "toggle",
              name: "doubleTapAsButtonPress",
              label: t("device.doubleTapAsButtonPress.label"),
              description: t("device.doubleTapAsButtonPress.description"),
            },
            {
              type: "toggle",
              name: "disableTripleClick",
              label: t("device.disableTripleClick.label"),
              description: t("device.disableTripleClick.description"),
            },
            {
              type: "text",
              name: "tzdef",
              label: t("device.posixTimezone.label"),
              description: t("device.posixTimezone.description"),
              properties: {
                fieldLength: {
                  max: 64,
                  currentValueLength: effectiveDeviceConfig.tzdef?.length,
                  showCharacterCount: true,
                },
              },
            },
            {
              type: "toggle",
              name: "ledHeartbeatDisabled",
              label: t("device.ledHeartbeatDisabled.label"),
              description: t("device.ledHeartbeatDisabled.description"),
            },
          ],
        },
      ]}
    />
  );
};
