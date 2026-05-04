import { useWaitForConfig } from "@app/core/hooks/useWaitForConfig";
import {
  type TrafficManagementValidation,
  TrafficManagementValidationSchema,
} from "@app/validation/moduleConfig/trafficManagement.ts";
import { DynamicForm, type DynamicFormFormInit } from "@components/Form/DynamicForm.tsx";
import { useConfigTarget } from "@core/hooks/useConfigTarget.tsx";
import { deepCompareConfig } from "@core/utils/deepCompareConfig.ts";
import { useTranslation } from "react-i18next";

interface TrafficManagementModuleConfigProps {
  onFormInit: DynamicFormFormInit<TrafficManagementValidation>;
}

export const TrafficManagement = ({ onFormInit }: TrafficManagementModuleConfigProps) => {
  useWaitForConfig({ moduleConfigCase: "trafficManagement" });

  const { moduleConfig, setChange, getEffectiveModuleConfig, removeChange } = useConfigTarget();
  const { t } = useTranslation("moduleConfig");

  const onSubmit = (data: TrafficManagementValidation) => {
    if (deepCompareConfig(moduleConfig.trafficManagement, data, true)) {
      removeChange({ type: "moduleConfig", variant: "trafficManagement" });
      return;
    }

    setChange(
      { type: "moduleConfig", variant: "trafficManagement" },
      data,
      moduleConfig.trafficManagement,
    );
  };

  return (
    <DynamicForm<TrafficManagementValidation>
      onSubmit={onSubmit}
      onFormInit={onFormInit}
      validationSchema={TrafficManagementValidationSchema}
      defaultValues={moduleConfig.trafficManagement}
      values={getEffectiveModuleConfig("trafficManagement")}
      fieldGroups={[
        {
          label: t("trafficManagement.title", "Traffic Management Config"),
          description: t(
            "trafficManagement.description",
            "Inspect mesh traffic and apply shaping rules to reduce channel utilization.",
          ),
          fields: [
            {
              type: "toggle",
              name: "enabled",
              label: t("trafficManagement.enabled.label", "Traffic Management Enabled"),
              description: t(
                "trafficManagement.enabled.description",
                "Enable the traffic management module.",
              ),
            },
            {
              type: "toggle",
              name: "positionDedupEnabled",
              label: t("trafficManagement.positionDedupEnabled.label", "Position Dedup"),
              description: t(
                "trafficManagement.positionDedupEnabled.description",
                "Drop redundant position broadcasts from the same node.",
              ),
            },
            {
              type: "number",
              name: "positionPrecisionBits",
              label: t("trafficManagement.positionPrecisionBits.label", "Position Precision"),
              description: t(
                "trafficManagement.positionPrecisionBits.description",
                "Bits of precision used when deduplicating position broadcasts.",
              ),
            },
            {
              type: "number",
              name: "positionMinIntervalSecs",
              label: t("trafficManagement.positionMinIntervalSecs.label", "Position Min Interval"),
              description: t(
                "trafficManagement.positionMinIntervalSecs.description",
                "Minimum interval in seconds between position updates from the same node.",
              ),
              properties: {
                suffix: t("unit.second.plural"),
              },
            },
            {
              type: "toggle",
              name: "nodeinfoDirectResponse",
              label: t(
                "trafficManagement.nodeinfoDirectResponse.label",
                "NodeInfo Direct Response",
              ),
              description: t(
                "trafficManagement.nodeinfoDirectResponse.description",
                "Reply to NodeInfo requests directly from the local cache.",
              ),
            },
            {
              type: "number",
              name: "nodeinfoDirectResponseMaxHops",
              label: t(
                "trafficManagement.nodeinfoDirectResponseMaxHops.label",
                "NodeInfo Direct Response Max Hops",
              ),
              description: t(
                "trafficManagement.nodeinfoDirectResponseMaxHops.description",
                "Minimum hop distance from the requester before sending a cached NodeInfo response.",
              ),
            },
            {
              type: "toggle",
              name: "rateLimitEnabled",
              label: t("trafficManagement.rateLimitEnabled.label", "Rate Limit Enabled"),
              description: t(
                "trafficManagement.rateLimitEnabled.description",
                "Throttle nodes that exceed the configured packet rate.",
              ),
            },
            {
              type: "number",
              name: "rateLimitWindowSecs",
              label: t("trafficManagement.rateLimitWindowSecs.label", "Rate Limit Window"),
              description: t(
                "trafficManagement.rateLimitWindowSecs.description",
                "Time window in seconds used for packet rate calculations.",
              ),
              properties: {
                suffix: t("unit.second.plural"),
              },
            },
            {
              type: "number",
              name: "rateLimitMaxPackets",
              label: t("trafficManagement.rateLimitMaxPackets.label", "Rate Limit Max Packets"),
              description: t(
                "trafficManagement.rateLimitMaxPackets.description",
                "Maximum packets allowed inside the rate limit window.",
              ),
            },
            {
              type: "toggle",
              name: "dropUnknownEnabled",
              label: t("trafficManagement.dropUnknownEnabled.label", "Drop Unknown Enabled"),
              description: t(
                "trafficManagement.dropUnknownEnabled.description",
                "Drop undecryptable or unknown packets after the configured threshold.",
              ),
            },
            {
              type: "number",
              name: "unknownPacketThreshold",
              label: t(
                "trafficManagement.unknownPacketThreshold.label",
                "Unknown Packet Threshold",
              ),
              description: t(
                "trafficManagement.unknownPacketThreshold.description",
                "Number of unknown packets allowed before traffic from a node is dropped.",
              ),
            },
            {
              type: "toggle",
              name: "exhaustHopTelemetry",
              label: t("trafficManagement.exhaustHopTelemetry.label", "Exhaust Hop Telemetry"),
              description: t(
                "trafficManagement.exhaustHopTelemetry.description",
                "Set hop limit to zero for relayed telemetry broadcasts.",
              ),
            },
            {
              type: "toggle",
              name: "exhaustHopPosition",
              label: t("trafficManagement.exhaustHopPosition.label", "Exhaust Hop Position"),
              description: t(
                "trafficManagement.exhaustHopPosition.description",
                "Set hop limit to zero for relayed position broadcasts.",
              ),
            },
            {
              type: "toggle",
              name: "routerPreserveHops",
              label: t("trafficManagement.routerPreserveHops.label", "Router Preserve Hops"),
              description: t(
                "trafficManagement.routerPreserveHops.description",
                "Preserve hop counts for router-to-router traffic.",
              ),
            },
          ],
        },
      ]}
    />
  );
};
