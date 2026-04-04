import { AmbientLighting } from "@components/PageComponents/ModuleConfig/AmbientLighting.tsx";
import { Audio } from "@components/PageComponents/ModuleConfig/Audio.tsx";
import { CannedMessage } from "@components/PageComponents/ModuleConfig/CannedMessage.tsx";
import { DetectionSensor } from "@components/PageComponents/ModuleConfig/DetectionSensor.tsx";
import { ExternalNotification } from "@components/PageComponents/ModuleConfig/ExternalNotification.tsx";
import { MQTT } from "@components/PageComponents/ModuleConfig/MQTT.tsx";
import { NeighborInfo } from "@components/PageComponents/ModuleConfig/NeighborInfo.tsx";
import { Paxcounter } from "@components/PageComponents/ModuleConfig/Paxcounter.tsx";
import { RangeTest } from "@components/PageComponents/ModuleConfig/RangeTest.tsx";
import { Serial } from "@components/PageComponents/ModuleConfig/Serial.tsx";
import { StoreForward } from "@components/PageComponents/ModuleConfig/StoreForward.tsx";
import { Telemetry } from "@components/PageComponents/ModuleConfig/Telemetry.tsx";
import { Spinner } from "@components/UI/Spinner.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@components/UI/Tabs.tsx";
import { useConfigTarget } from "@core/hooks/useConfigTarget.tsx";
import { type ValidModuleConfigType } from "@core/stores";
import { type ComponentType, Suspense, useMemo } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";

interface ConfigProps {
  onFormInit: <T extends object>(methods: UseFormReturn<T>) => void;
  activeTab?: string;
  onTabChange?: (value: string) => void;
  loadedTabs?: ReadonlySet<string>;
  loadingTabs?: ReadonlySet<string>;
}

type TabItem = {
  case: ValidModuleConfigType;
  label: string;
  element: ComponentType<ConfigProps>;
  count?: number;
};

export const ModuleConfig = ({
  onFormInit,
  activeTab,
  onTabChange,
  loadedTabs,
  loadingTabs,
}: ConfigProps) => {
  const { hasModuleConfigChange } = useConfigTarget();
  const { t } = useTranslation("moduleConfig");
  const tabs: TabItem[] = useMemo(
    () => [
      {
        case: "mqtt",
        label: t("page.tabMqtt"),
        element: MQTT,
      },
      {
        case: "serial",
        label: t("page.tabSerial"),
        element: Serial,
      },
      {
        case: "externalNotification",
        label: t("page.tabExternalNotification"),
        element: ExternalNotification,
      },
      {
        case: "storeForward",
        label: t("page.tabStoreAndForward"),
        element: StoreForward,
      },
      {
        case: "rangeTest",
        label: t("page.tabRangeTest"),
        element: RangeTest,
      },
      {
        case: "telemetry",
        label: t("page.tabTelemetry"),
        element: Telemetry,
      },
      {
        case: "cannedMessage",
        label: t("page.tabCannedMessage"),
        element: CannedMessage,
      },
      {
        case: "audio",
        label: t("page.tabAudio"),
        element: Audio,
      },
      {
        case: "neighborInfo",
        label: t("page.tabNeighborInfo"),
        element: NeighborInfo,
      },
      {
        case: "ambientLighting",
        label: t("page.tabAmbientLighting"),
        element: AmbientLighting,
      },
      {
        case: "detectionSensor",
        label: t("page.tabDetectionSensor"),
        element: DetectionSensor,
      },
      {
        case: "paxcounter",
        label: t("page.tabPaxcounter"),
        element: Paxcounter,
      },
    ],
    [t],
  );

  const flags = useMemo(
    () => new Map(tabs.map((tab) => [tab.case, hasModuleConfigChange(tab.case)])),
    [tabs, hasModuleConfigChange],
  );

  const isLazyMode = activeTab !== undefined || onTabChange !== undefined;
  const tabsProps = isLazyMode
    ? {
        value: activeTab,
        onValueChange: onTabChange,
      }
    : {
        defaultValue: tabs[0]?.case,
      };

  return (
    <Tabs {...tabsProps}>
      <TabsList className="w-full dark:bg-slate-800">
        {tabs.map((tab) => (
          <TabsTrigger key={tab.case} value={tab.case} className="dark:text-white relative">
            {tab.label}
            {flags.get(tab.case) && (
              <span className="absolute -top-0.5 -right-0.5 z-50 flex size-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-500 opacity-25" />
                <span className="relative inline-flex size-3 rounded-full bg-sky-500" />
              </span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
      {isLazyMode && !activeTab ? (
        <div className="mt-4 rounded-md border border-slate-200 p-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          {t(
            "config:remoteAdmin.selectSubsection",
            "Select a subsection to load the remote configuration.",
          )}
        </div>
      ) : null}
      {tabs.map((tab) => (
        <TabsContent key={tab.case} value={tab.case}>
          {isLazyMode ? (
            loadingTabs?.has(tab.case) ? (
              <Spinner size="lg" className="my-5" />
            ) : loadedTabs?.has(tab.case) ? (
              <Suspense fallback={<Spinner size="lg" className="my-5" />}>
                <tab.element onFormInit={onFormInit} />
              </Suspense>
            ) : (
              <div className="py-5 text-sm text-slate-500 dark:text-slate-400">
                {t(
                  "config:remoteAdmin.subsectionUnavailable",
                  "Remote data is not available yet. Use Refresh to try again.",
                )}
              </div>
            )
          ) : (
            <Suspense fallback={<Spinner size="lg" className="my-5" />}>
              <tab.element onFormInit={onFormInit} />
            </Suspense>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
};
