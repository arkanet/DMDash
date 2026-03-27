import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { type RenderOptions, render } from "@testing-library/react";
import type { ReactElement } from "react";
import "@app/i18n-config.ts";

import { DeviceWrapper } from "@app/DeviceWrapper.tsx";
import { routeTree } from "@app/routes.tsx";
import type { useAppStore, useMessageStore } from "@core/stores";
import type { useTranslation } from "react-i18next";

const Providers = () => {
  const memoryHistory = createMemoryHistory({
    initialEntries: ["/"],
  });

  const router = createRouter({
    routeTree,
    history: memoryHistory,
    context: {
      stores: {
        app: {} as ReturnType<typeof useAppStore>,
        message: {} as ReturnType<typeof useMessageStore>,
      },
      i18n: {} as ReturnType<typeof useTranslation>,
    },
  });

  return (
    <DeviceWrapper deviceId={0}>
      <RouterProvider router={router} />
    </DeviceWrapper>
  );
};

const renderWithProviders = (ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) =>
  render(ui, { wrapper: Providers, ...options });

export * from "@testing-library/react";

export { renderWithProviders as render };
