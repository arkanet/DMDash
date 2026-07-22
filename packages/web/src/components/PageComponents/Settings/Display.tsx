import { useWaitForConfig } from "@app/core/hooks/useWaitForConfig";
import { DisplayValidationSchema } from "@app/validation/config/display.ts";
import { create } from "@bufbuild/protobuf";
import { DynamicForm, type DynamicFormFormInit } from "@components/Form/DynamicForm.tsx";
import { useConfigTarget } from "@core/hooks/useConfigTarget.tsx";
import { deepCompareConfig } from "@core/utils/deepCompareConfig.ts";
import { Protobuf } from "@meshtastic/core";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod/v4";

const DeviceUiGpsFormatEnum = z.enum(Protobuf.DeviceUI.DeviceUIConfig_GpsCoordinateFormat);
const DisplayFormValidationSchema = DisplayValidationSchema.extend({
  deviceUiGpsFormat: DeviceUiGpsFormatEnum,
});
type DisplayFormValidation = z.infer<typeof DisplayFormValidationSchema>;

interface DisplayConfigProps {
  onFormInit: DynamicFormFormInit<DisplayFormValidation>;
}

const createDefaultDisplayConfig = () => create(Protobuf.Config.Config_DisplayConfigSchema);

export const Display = ({ onFormInit }: DisplayConfigProps) => {
  useWaitForConfig({ configCase: "display" });
  const {
    config,
    deviceUiConfig,
    connection,
    isRemote,
    setChange,
    getEffectiveConfig,
    removeChange,
    queueAdminMessage,
  } = useConfigTarget();
  const { t } = useTranslation("config");

  useEffect(() => {
    if (isRemote) {
      return;
    }

    void connection?.getDeviceUiConfig().catch(() => undefined);
  }, [connection, isRemote]);

  const defaultValues = useMemo(
    (): DisplayFormValidation => ({
      ...createDefaultDisplayConfig(),
      ...config.display,
      deviceUiGpsFormat: deviceUiConfig.gpsFormat,
    }),
    [config.display, deviceUiConfig.gpsFormat],
  );

  const values = useMemo(
    (): DisplayFormValidation => ({
      ...createDefaultDisplayConfig(),
      ...config.display,
      ...getEffectiveConfig("display"),
      deviceUiGpsFormat: deviceUiConfig.gpsFormat,
    }),
    [config.display, deviceUiConfig.gpsFormat, getEffectiveConfig],
  );

  const onSubmit = (data: DisplayFormValidation) => {
    const { deviceUiGpsFormat, ...displayData } = data;

    if (deepCompareConfig(config.display, displayData, true)) {
      removeChange({ type: "config", variant: "display" });
    } else {
      setChange({ type: "config", variant: "display" }, displayData, config.display);
    }

    const nextDeviceUiConfig = create(Protobuf.DeviceUI.DeviceUIConfigSchema, {
      ...deviceUiConfig,
      gpsFormat: deviceUiGpsFormat,
    });

    if (deepCompareConfig(deviceUiConfig, nextDeviceUiConfig, true)) {
      removeChange({
        type: "adminMessage",
        variant: "storeUiConfig",
        id: "storeUiConfig",
      });
      return;
    }

    queueAdminMessage(
      create(Protobuf.Admin.AdminMessageSchema, {
        payloadVariant: {
          case: "storeUiConfig",
          value: nextDeviceUiConfig,
        },
      }),
    );
  };

  return (
    <DynamicForm<DisplayFormValidation>
      onSubmit={onSubmit}
      onFormInit={onFormInit}
      validationSchema={DisplayFormValidationSchema}
      defaultValues={defaultValues}
      values={values}
      fieldGroups={[
        {
          label: t("display.title"),
          description: t("display.description"),
          fields: [
            {
              type: "number",
              name: "screenOnSecs",
              label: t("display.screenTimeout.label"),
              description: t("display.screenTimeout.description"),
              properties: {
                suffix: t("unit.second.plural"),
              },
            },
            {
              type: "select",
              name: "deviceUiGpsFormat",
              label: t("display.gpsDisplayUnits.label"),
              description: t("display.gpsDisplayUnits.description"),
              properties: {
                enumValue: Protobuf.DeviceUI.DeviceUIConfig_GpsCoordinateFormat,
                formatEnumName: true,
              },
            },
            {
              type: "number",
              name: "autoScreenCarouselSecs",
              label: t("display.carouselDelay.label"),
              description: t("display.carouselDelay.description"),
              properties: {
                suffix: t("unit.second.plural"),
              },
            },
            {
              type: "toggle",
              name: "compassNorthTop",
              label: t("display.compassNorthTop.label"),
              description: t("display.compassNorthTop.description"),
            },
            {
              type: "toggle",
              name: "use12hClock",
              label: t("display.twelveHourClock.label"),
              description: t("display.twelveHourClock.description"),
            },
            {
              type: "toggle",
              name: "flipScreen",
              label: t("display.flipScreen.label"),
              description: t("display.flipScreen.description"),
            },
            {
              type: "select",
              name: "units",
              label: t("display.displayUnits.label"),
              description: t("display.displayUnits.description"),
              properties: {
                enumValue: Protobuf.Config.Config_DisplayConfig_DisplayUnits,
                formatEnumName: true,
              },
            },
            {
              type: "select",
              name: "oled",
              label: t("display.oledType.label"),
              description: t("display.oledType.description"),
              properties: {
                enumValue: Protobuf.Config.Config_DisplayConfig_OledType,
              },
            },
            {
              type: "select",
              name: "displaymode",
              label: t("display.displayMode.label"),
              description: t("display.displayMode.description"),
              properties: {
                enumValue: Protobuf.Config.Config_DisplayConfig_DisplayMode,
                formatEnumName: true,
              },
            },
            {
              type: "toggle",
              name: "headingBold",
              label: t("display.headingBold.label"),
              description: t("display.headingBold.description"),
            },
            {
              type: "toggle",
              name: "wakeOnTapOrMotion",
              label: t("display.wakeOnTapOrMotion.label"),
              description: t("display.wakeOnTapOrMotion.description"),
            },
          ],
        },
      ]}
    />
  );
};
