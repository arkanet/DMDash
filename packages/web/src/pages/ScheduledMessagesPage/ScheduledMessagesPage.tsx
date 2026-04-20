import { useMemo } from "react";
import { PageLayout } from "@components/PageLayout.tsx";
import PowerNotificationPanel from "@components/PageComponents/PowerNotification/PowerNotificationPanel.tsx";
import { useTranslation } from "react-i18next";
import { useDevice, useNodeDB } from "@core/stores";
import { getNodeLongName } from "@app/darkmesh/utils.ts";

export default function ScheduledMessagesPage(): JSX.Element {
  const { t } = useTranslation("scheduledMessages");

  // Build destination options using available channels + nodes so the
  // scheduler can select channels or direct node targets.
  const { channels } = useDevice();
  const { getMyNode, getNodes } = useNodeDB();
  const myNode = getMyNode();

  const channelOptions = useMemo(
    () =>
      Array.from(channels.values())
        .filter((c) => c.role !== undefined)
        .map((channel) => ({
          label:
            channel.settings?.name ||
            (channel.index === 0 ? "Primary broadcast" : `Channel ${channel.index}`),
          value: `broadcast:${channel.index}`,
        })),
    [channels],
  );

  const nodes = getNodes((n) => n.num !== myNode?.num, true);
  const nodeOptions = nodes
    .filter((n) => Boolean(n.user))
    .sort((l, r) => (r.lastHeard ?? 0) - (l.lastHeard ?? 0))
    .map((n) => ({ num: n.num, shortName: n.user?.shortName, longName: getNodeLongName(n) }));

  const nodeDirectOptions = useMemo(
    () => nodeOptions.map((n) => ({ label: n.shortName || `!${n.num}`, value: `direct:${n.num}` })),
    [nodeOptions],
  );

  const destinationOptions = useMemo(
    () => [...channelOptions, ...nodeDirectOptions],
    [channelOptions, nodeDirectOptions],
  );

  return (
    <PageLayout label={t("page.title", "Scheduled Messages")}>
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold">{t("page.title", "Scheduled Messages")}</h1>
        </header>
        <PowerNotificationPanel destinationOptions={destinationOptions} nodeOptions={nodeOptions} />
      </div>
    </PageLayout>
  );
}
