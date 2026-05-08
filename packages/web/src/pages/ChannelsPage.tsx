import { Channels } from "@app/components/PageComponents/Channels/Channels";
import { PageLayout } from "@components/PageLayout.tsx";
import { Sidebar } from "@components/Sidebar.tsx";
import type { JSX } from "react";
import type { UseFormReturn } from "react-hook-form";

const noopFormInit = <T extends object>(_methods: UseFormReturn<T>) => {};

export default function ChannelsPage(): JSX.Element {
  return (
    <PageLayout
      label="Channels"
      leftBar={<Sidebar />}
      noPadding
      contentClassName="overflow-auto bg-background-primary"
    >
      <Channels onFormInit={noopFormInit} />
    </PageLayout>
  );
}
