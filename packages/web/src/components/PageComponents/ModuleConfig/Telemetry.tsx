import { useWaitForConfig } from "@app/core/hooks/useWaitForConfig";
import {
  type TelemetryValidation,
  TelemetryValidationSchema,
} from "@app/validation/moduleConfig/telemetry.ts";
import { DynamicForm, type DynamicFormFormInit } from "@components/Form/DynamicForm.tsx";
import { useConfigTarget } from "@core/hooks/useConfigTarget.tsx";
import { deepCompareConfig } from "@core/utils/deepCompareConfig.ts";
import { useTranslation } from "react-i18next";

interface TelemetryModuleConfigProps {
  onFormInit: DynamicFormFormInit<TelemetryValidation>;
}

export const Telemetry = ({ onFormInit }: TelemetryModuleConfigProps) => {
  useWaitForConfig({ moduleConfigCase: "telemetry" });

  const { moduleConfig, setChange, getEffectiveModuleConfig, removeChange } = useConfigTarget();
  const { t } = useTranslation("moduleConfig");
  const disabledByDeviceTelemetry = [{ fieldName: "deviceTelemetryEnabled" as const }];

  const onSubmit = (data: TelemetryValidation) => {
    if (deepCompareConfig(moduleConfig.telemetry, data, true)) {
      removeChange({ type: "moduleConfig", variant: "telemetry" });
      return;
    }

    setChange({ type: "moduleConfig", variant: "telemetry" }, data, moduleConfig.telemetry);
  };

  return (
    <DynamicForm<TelemetryValidation>
      onSubmit={onSubmit}
      onFormInit={onFormInit}
      validationSchema={TelemetryValidationSchema}
      defaultValues={moduleConfig.telemetry}
      values={getEffectiveModuleConfig("telemetry")}
      fieldGroups={[
        {
          label: t("telemetry.title"),
          description: t("telemetry.description"),
          fields: [
            {
              type: "toggle",
              name: "deviceTelemetryEnabled",
              label: t("telemetry.deviceTelemetryEnabled.label", "Send Device Telemetry"),
              description: t(
                "telemetry.deviceTelemetryEnabled.description",
                "Enable the device telemetry module to send metrics to the mesh.",
              ),
            },
            {
              type: "number",
              name: "deviceUpdateInterval",
              label: t("telemetry.deviceUpdateInterval.label"),
              description: t("telemetry.deviceUpdateInterval.description"),
              disabledBy: disabledByDeviceTelemetry,
              properties: {
                suffix: t("unit.second.plural"),
              },
            },
            {
              type: "number",
              name: "environmentUpdateInterval",
              label: t("telemetry.environmentUpdateInterval.label"),
              description: t("telemetry.environmentUpdateInterval.description"),
              disabledBy: disabledByDeviceTelemetry,
              properties: {
                suffix: t("unit.second.plural"),
              },
            },
            {
              type: "toggle",
              name: "environmentMeasurementEnabled",
              label: t("telemetry.environmentMeasurementEnabled.label"),
              description: t("telemetry.environmentMeasurementEnabled.description"),
              disabledBy: disabledByDeviceTelemetry,
            },
            {
              type: "toggle",
              name: "environmentScreenEnabled",
              label: t("telemetry.environmentScreenEnabled.label"),
              description: t("telemetry.environmentScreenEnabled.description"),
              disabledBy: disabledByDeviceTelemetry,
            },
            {
              type: "toggle",
              name: "environmentDisplayFahrenheit",
              label: t("telemetry.environmentDisplayFahrenheit.label"),
              description: t("telemetry.environmentDisplayFahrenheit.description"),
              disabledBy: disabledByDeviceTelemetry,
            },
            {
              type: "toggle",
              name: "airQualityEnabled",
              label: t("telemetry.airQualityEnabled.label"),
              description: t("telemetry.airQualityEnabled.description"),
              disabledBy: disabledByDeviceTelemetry,
            },
            {
              type: "number",
              name: "airQualityInterval",
              label: t("telemetry.airQualityInterval.label"),
              description: t("telemetry.airQualityInterval.description"),
              disabledBy: disabledByDeviceTelemetry,
            },
            {
              type: "toggle",
              name: "powerMeasurementEnabled",
              label: t("telemetry.powerMeasurementEnabled.label"),
              description: t("telemetry.powerMeasurementEnabled.description"),
              disabledBy: disabledByDeviceTelemetry,
            },
            {
              type: "number",
              name: "powerUpdateInterval",
              label: t("telemetry.powerUpdateInterval.label"),
              description: t("telemetry.powerUpdateInterval.description"),
              disabledBy: disabledByDeviceTelemetry,
            },
            {
              type: "toggle",
              name: "powerScreenEnabled",
              label: t("telemetry.powerScreenEnabled.label"),
              description: t("telemetry.powerScreenEnabled.description"),
              disabledBy: disabledByDeviceTelemetry,
            },
          ],
        },
      ]}
    />
  );
};
