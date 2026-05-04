import { useWaitForConfig } from "@app/core/hooks/useWaitForConfig";
import { type LoRaValidation, LoRaValidationSchema } from "@app/validation/config/lora.ts";
import { DynamicForm, type DynamicFormFormInit } from "@components/Form/DynamicForm.tsx";
import type { FieldProps } from "@components/Form/DynamicFormField.tsx";
import { useConfigTarget } from "@core/hooks/useConfigTarget.tsx";
import {
  getLoraChannelNumOptions,
  getDisplayedLoraChannelNum,
  getDisplayedLoraOverrideFrequency,
  getLoraPrimaryChannelName,
  normalizeLoRaConfigForPreview,
  normalizeLoRaConfigForSubmit,
} from "@core/utils/loraConfig.ts";
import { deepCompareConfig } from "@core/utils/deepCompareConfig.ts";
import { Protobuf } from "@meshtastic/core";
import { useEffect, useMemo, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";

interface LoRaConfigProps {
  onFormInit: DynamicFormFormInit<LoRaValidation>;
}

export const LoRa = ({ onFormInit }: LoRaConfigProps) => {
  useWaitForConfig({ configCase: "lora" });

  const { config, setChange, getEffectiveConfig, removeChange, channels } = useConfigTarget();
  const { t } = useTranslation("config");
  const methodsRef = useRef<UseFormReturn<LoRaValidation> | null>(null);
  const syncedFormValuesKeyRef = useRef<string | null>(null);
  const [formMethods, setFormMethods] = useState<UseFormReturn<LoRaValidation> | null>(null);
  const [liveLoraConfig, setLiveLoraConfig] = useState<LoRaValidation | null>(null);
  const effectiveLoraConfig = getEffectiveConfig("lora") ?? config.lora;

  if (!effectiveLoraConfig) {
    return null;
  }

  const baseLoraConfig = config.lora ?? effectiveLoraConfig;

  const primaryChannelSettings = useMemo(
    () =>
      Array.from(channels.values()).find(
        (channel) => channel.role === Protobuf.Channel.Channel_Role.PRIMARY,
      )?.settings,
    [channels],
  );
  const primaryChannelName = useMemo(
    () => getLoraPrimaryChannelName(effectiveLoraConfig, primaryChannelSettings?.name),
    [effectiveLoraConfig, primaryChannelSettings?.name],
  );
  const displayedChannelNum = useMemo(
    () => getDisplayedLoraChannelNum(effectiveLoraConfig, primaryChannelName),
    [effectiveLoraConfig, primaryChannelName],
  );
  const displayedOverrideFrequency = useMemo(
    () => getDisplayedLoraOverrideFrequency(effectiveLoraConfig, primaryChannelName),
    [effectiveLoraConfig, primaryChannelName],
  );
  const formValues = useMemo<LoRaValidation>(
    () => ({
      usePreset: effectiveLoraConfig.usePreset,
      modemPreset: effectiveLoraConfig.modemPreset,
      bandwidth: effectiveLoraConfig.bandwidth,
      spreadFactor: effectiveLoraConfig.spreadFactor,
      codingRate: effectiveLoraConfig.codingRate,
      frequencyOffset: effectiveLoraConfig.frequencyOffset,
      region: effectiveLoraConfig.region,
      hopLimit: effectiveLoraConfig.hopLimit,
      txEnabled: effectiveLoraConfig.txEnabled,
      txPower: effectiveLoraConfig.txPower,
      channelNum:
        effectiveLoraConfig.channelNum === 0 ? displayedChannelNum : effectiveLoraConfig.channelNum,
      overrideDutyCycle: effectiveLoraConfig.overrideDutyCycle,
      sx126xRxBoostedGain: effectiveLoraConfig.sx126xRxBoostedGain,
      overrideFrequency:
        effectiveLoraConfig.overrideFrequency === 0
          ? displayedOverrideFrequency
          : effectiveLoraConfig.overrideFrequency,
      ignoreIncoming: effectiveLoraConfig.ignoreIncoming,
      ignoreMqtt: effectiveLoraConfig.ignoreMqtt,
      configOkToMqtt: effectiveLoraConfig.configOkToMqtt,
    }),
    [displayedChannelNum, displayedOverrideFrequency, effectiveLoraConfig],
  );
  const previewFormValues = useMemo<LoRaValidation>(
    () => ({
      ...formValues,
      ...normalizeLoRaConfigForPreview(formValues, effectiveLoraConfig, {
        channelNum: false,
        overrideFrequency: false,
      }),
    }),
    [effectiveLoraConfig, formValues],
  );
  const previewFormValuesKey = useMemo(
    () => JSON.stringify(previewFormValues),
    [previewFormValues],
  );

  const handleFormInit = (methods: UseFormReturn<LoRaValidation>) => {
    methodsRef.current = methods;
    setFormMethods(methods);
    setLiveLoraConfig({
      ...methods.getValues(),
      ...normalizeLoRaConfigForPreview(methods.getValues(), effectiveLoraConfig, {
        channelNum: false,
        overrideFrequency: false,
      }),
    });
    onFormInit(methods);
  };

  useEffect(() => {
    if (syncedFormValuesKeyRef.current === previewFormValuesKey) {
      return;
    }

    syncedFormValuesKeyRef.current = previewFormValuesKey;
    setLiveLoraConfig((current) => {
      if (current && JSON.stringify(current) === previewFormValuesKey) {
        return current;
      }

      return previewFormValues;
    });
  }, [previewFormValues, previewFormValuesKey]);

  useEffect(() => {
    if (!formMethods) {
      return;
    }

    const subscription = formMethods.watch((_value, { name }) => {
      const nextValues = formMethods.getValues();
      const channelNumDirty = formMethods.getFieldState("channelNum").isDirty;
      const overrideFrequencyDirty = formMethods.getFieldState("overrideFrequency").isDirty;
      const nextPreviewConfig = {
        ...nextValues,
        ...normalizeLoRaConfigForPreview(nextValues, effectiveLoraConfig, {
          channelNum: channelNumDirty,
          overrideFrequency: overrideFrequencyDirty,
        }),
      };
      const nextPrimaryChannelName = getLoraPrimaryChannelName(
        nextPreviewConfig,
        primaryChannelSettings?.name,
      );
      const nextDisplayedChannelNum = getDisplayedLoraChannelNum(
        nextPreviewConfig,
        nextPrimaryChannelName,
      );
      const nextDisplayedOverrideFrequency = getDisplayedLoraOverrideFrequency(
        nextPreviewConfig,
        nextPrimaryChannelName,
      );
      const currentChannelNum = Number(nextValues.channelNum);
      const currentOverrideFrequency = Number(nextValues.overrideFrequency);

      if (
        !channelNumDirty &&
        effectiveLoraConfig.channelNum === 0 &&
        (name === "region" ||
          name === "usePreset" ||
          name === "modemPreset" ||
          name === "bandwidth") &&
        currentChannelNum !== nextDisplayedChannelNum
      ) {
        formMethods.setValue("channelNum", nextDisplayedChannelNum, {
          shouldDirty: false,
          shouldTouch: false,
          shouldValidate: true,
        });
      }

      if (
        nextPreviewConfig.overrideFrequency === 0 &&
        (name === "region" ||
          name === "usePreset" ||
          name === "modemPreset" ||
          name === "bandwidth" ||
          name === "channelNum" ||
          name === "frequencyOffset" ||
          name === "overrideFrequency") &&
        currentOverrideFrequency !== nextDisplayedOverrideFrequency
      ) {
        formMethods.setValue("overrideFrequency", nextDisplayedOverrideFrequency, {
          shouldDirty: overrideFrequencyDirty,
          shouldTouch: overrideFrequencyDirty,
          shouldValidate: true,
        });
      }

      setLiveLoraConfig(nextPreviewConfig);
    });

    return () => subscription.unsubscribe();
  }, [effectiveLoraConfig, formMethods, primaryChannelSettings?.name]);

  const slotPreviewConfig = liveLoraConfig ?? previewFormValues;
  const slotPreviewPrimaryChannelName = useMemo(
    () => getLoraPrimaryChannelName(slotPreviewConfig, primaryChannelSettings?.name),
    [primaryChannelSettings?.name, slotPreviewConfig],
  );
  const slotPreviewChannelNum = useMemo(
    () => getDisplayedLoraChannelNum(slotPreviewConfig, slotPreviewPrimaryChannelName),
    [slotPreviewConfig, slotPreviewPrimaryChannelName],
  );
  const frequencySlotOptions = useMemo(() => {
    const options = getLoraChannelNumOptions(slotPreviewConfig);

    if (!(slotPreviewChannelNum.toString() in options) && slotPreviewChannelNum > 0) {
      return {
        [slotPreviewChannelNum]: slotPreviewChannelNum,
        ...options,
      };
    }

    return options;
  }, [slotPreviewChannelNum, slotPreviewConfig]);

  const onSubmit = (data: LoRaValidation) => {
    const normalizedData = normalizeLoRaConfigForSubmit(data, baseLoraConfig, {
      channelNum: methodsRef.current?.getFieldState("channelNum").isDirty ?? false,
      overrideFrequency: methodsRef.current?.getFieldState("overrideFrequency").isDirty ?? false,
    });

    if (deepCompareConfig(baseLoraConfig, normalizedData, true)) {
      removeChange({ type: "config", variant: "lora" });
      return;
    }

    setChange({ type: "config", variant: "lora" }, normalizedData, baseLoraConfig);
  };

  const waveformFields: FieldProps<LoRaValidation>[] = slotPreviewConfig.usePreset
    ? [
        {
          type: "select" as const,
          name: "modemPreset" as const,
          label: t("lora.modemPreset.label"),
          description: t("lora.modemPreset.description"),
          properties: {
            enumValue: Protobuf.Config.Config_LoRaConfig_ModemPreset,
            formatEnumName: true,
          },
        },
      ]
    : [
        {
          type: "number" as const,
          name: "bandwidth" as const,
          label: t("lora.bandwidth.label"),
          description: t("lora.bandwidth.description"),
          properties: {
            suffix: t("unit.kilohertz"),
          },
        },
        {
          type: "number" as const,
          name: "spreadFactor" as const,
          label: t("lora.spreadingFactor.label"),
          description: t("lora.spreadingFactor.description"),
          properties: {
            suffix: t("unit.cps"),
          },
        },
        {
          type: "number" as const,
          name: "codingRate" as const,
          label: t("lora.codingRate.label"),
          description: t("lora.codingRate.description"),
        },
      ];

  return (
    <DynamicForm<LoRaValidation>
      onSubmit={onSubmit}
      onFormInit={handleFormInit}
      validationSchema={LoRaValidationSchema}
      defaultValues={formValues}
      values={formValues}
      fieldGroups={[
        {
          label: t("lora.title"),
          description: t("lora.description"),
          fields: [
            {
              type: "select",
              name: "region",
              label: t("lora.region.label"),
              description: t("lora.region.description"),
              properties: {
                enumValue: Protobuf.Config.Config_LoRaConfig_RegionCode,
              },
            },
            {
              type: "select",
              name: "hopLimit",
              label: t("lora.hopLimit.label"),
              description: t("lora.hopLimit.description"),
              properties: {
                enumValue: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7 },
              },
            },
            {
              type: "select",
              name: "channelNum",
              label: t("lora.frequencySlot.label"),
              description: t("lora.frequencySlot.description"),
              properties: {
                enumValue: frequencySlotOptions,
              },
            },
            {
              type: "toggle",
              name: "ignoreMqtt",
              label: t("lora.ignoreMqtt.label"),
              description: t("lora.ignoreMqtt.description"),
            },
            {
              type: "toggle",
              name: "configOkToMqtt",
              label: t("lora.okToMqtt.label"),
              description: t("lora.okToMqtt.description"),
            },
          ],
        },
        {
          label: t("lora.waveformSettings.label"),
          description: t("lora.waveformSettings.description"),
          fields: [
            {
              type: "toggle",
              name: "usePreset",
              label: t("lora.usePreset.label"),
              description: t("lora.usePreset.description"),
            },
            ...waveformFields,
          ],
        },
        {
          label: t("lora.radioSettings.label"),
          description: t("lora.radioSettings.description"),
          fields: [
            {
              type: "toggle",
              name: "txEnabled",
              label: t("lora.transmitEnabled.label"),
              description: t("lora.transmitEnabled.description"),
            },
            {
              type: "number",
              name: "txPower",
              label: t("lora.transmitPower.label"),
              description: t("lora.transmitPower.description"),
              properties: {
                suffix: t("unit.dbm"),
              },
            },
            {
              type: "toggle",
              name: "overrideDutyCycle",
              label: t("lora.overrideDutyCycle.label"),
              description: t("lora.overrideDutyCycle.description"),
            },
            {
              type: "number",
              name: "frequencyOffset",
              label: t("lora.frequencyOffset.label"),
              description: t("lora.frequencyOffset.description"),
              properties: {
                suffix: t("unit.hertz"),
              },
            },
            {
              type: "toggle",
              name: "sx126xRxBoostedGain",
              label: t("lora.boostedRxGain.label"),
              description: t("lora.boostedRxGain.description"),
            },
            {
              type: "text",
              name: "overrideFrequency",
              label: t("lora.overrideFrequency.label"),
              description: t("lora.overrideFrequency.description"),
              properties: {
                suffix: t("unit.megahertz"),
                inputMode: "decimal",
                lang: "en",
                pattern: "^\\d+(\\.\\d{0,3})?$",
              },
            },
          ],
        },
      ]}
    />
  );
};
