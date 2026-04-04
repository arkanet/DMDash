import { Channels } from "@app/components/PageComponents/Channels/Channels";
import { LoRa } from "@components/PageComponents/Settings/LoRa.tsx";
import { Security } from "@components/PageComponents/Settings/Security/Security.tsx";
import { Spinner } from "@components/UI/Spinner.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@components/UI/Tabs.tsx";
import { useConfigTarget } from "@core/hooks/useConfigTarget.tsx";
import { type ValidConfigType } from "@core/stores";
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
  case: ValidConfigType | "channels";
  label: string;
  element: ComponentType<ConfigProps>;
  count?: number;
};

export const RadioConfig = ({
  onFormInit,
  activeTab,
  onTabChange,
  loadedTabs,
  loadingTabs,
}: ConfigProps) => {
  const { hasConfigChange } = useConfigTarget();
  const { t } = useTranslation("config");
  const tabs: TabItem[] = useMemo(
    () => [
      {
        case: "lora",
        label: t("page.tabLora"),
        element: LoRa,
      },
      {
        case: "channels",
        label: t("page.tabChannels"),
        element: Channels,
      },
      {
        case: "security",
        label: t("page.tabSecurity"),
        element: Security,
      },
    ],
    [t],
  );

  const flags = useMemo(
    () =>
      new Map(tabs.map((tab) => [tab.case, tab.case !== "channels" && hasConfigChange(tab.case)])),
    [tabs, hasConfigChange],
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
      <TabsList className="w-full dark:bg-slate-700">
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
            "remoteAdmin.selectSubsection",
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
                  "remoteAdmin.subsectionUnavailable",
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
