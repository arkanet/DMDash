import { DeviceWrapper } from "@app/DeviceWrapper.tsx";
import { CommandPalette } from "@components/CommandPalette/index.tsx";
import { DialogManager } from "@components/Dialog/DialogManager.tsx";
import { KeyBackupReminder } from "@components/KeyBackupReminder.tsx";
import { ThemeDocumentController } from "@components/ThemeDocumentController.tsx";
import { Toaster } from "@components/Toaster.tsx";
import { ErrorPage } from "@components/UI/ErrorPage.tsx";
import Footer from "@components/UI/Footer.tsx";
import { SidebarProvider, useAppStore, useDeviceStore } from "@core/stores";
import { DarkMeshRuntime } from "@app/darkmesh/runtime.tsx";
import { Connections } from "@pages/Connections/index.tsx";
import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { useEffect, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { MapProvider } from "react-map-gl/maplibre";

function useMobileViewport() {
  useEffect(() => {
    const root = document.documentElement;

    const updateViewportHeight = () => {
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      root.style.setProperty("--app-viewport-height", `${viewportHeight}px`);
      root.classList.toggle("mobile-viewport-zoomed", (window.visualViewport?.scale ?? 1) > 1.01);
    };

    let animationFrame = 0;
    const scheduleViewportUpdate = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(updateViewportHeight);
    };

    root.classList.add("mobile-scale-75");
    updateViewportHeight();
    window.addEventListener("resize", scheduleViewportUpdate);
    window.addEventListener("orientationchange", scheduleViewportUpdate);
    window.visualViewport?.addEventListener("resize", scheduleViewportUpdate);
    window.visualViewport?.addEventListener("scroll", scheduleViewportUpdate);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", scheduleViewportUpdate);
      window.removeEventListener("orientationchange", scheduleViewportUpdate);
      window.visualViewport?.removeEventListener("resize", scheduleViewportUpdate);
      window.visualViewport?.removeEventListener("scroll", scheduleViewportUpdate);
      root.classList.remove("mobile-scale-75");
      root.classList.remove("mobile-viewport-zoomed");
      root.style.removeProperty("--app-viewport-height");
    };
  }, []);
}

function DeviceConnectionProgress({
  phase,
}: {
  phase: "disconnected" | "connecting" | "configuring" | "configured";
}) {
  const [elapsed, setElapsed] = useState(0);
  const active = phase === "connecting" || phase === "configuring";

  useEffect(() => {
    if (!active) {
      setElapsed(0);
      return;
    }

    const nextStartedAt = Date.now();
    setElapsed(0);

    const interval = window.setInterval(() => {
      setElapsed(Date.now() - nextStartedAt);
    }, 120);

    return () => window.clearInterval(interval);
  }, [active, phase]);

  if (!active) {
    return null;
  }

  const estimateMs = phase === "configuring" ? 18_000 : 10_000;
  const progress = Math.min(96, Math.max(4, (elapsed / estimateMs) * 100));

  return (
    <div
      className="pointer-events-none fixed top-0 right-0 left-0 z-[70] h-1 overflow-hidden bg-black/15"
      aria-hidden="true"
    >
      <progress
        className="darkmesh-connection-progress-value h-full w-full"
        value={progress}
        max={100}
      />
      <div className="darkmesh-connection-progress-shine absolute inset-y-0 left-0 w-1/3 opacity-40" />
    </div>
  );
}

export function App() {
  useMobileViewport();

  const { getDevice } = useDeviceStore();
  const { selectedDeviceId } = useAppStore();
  const navigate = useNavigate();
  const pathname = useLocation({
    select: (location) => location.pathname,
  });

  const device = getDevice(selectedDeviceId);
  const isPublicGuideRoute = pathname === "/guide" || pathname.startsWith("/guide/");
  const isConnectionsRoute = pathname === "/" || pathname === "/connections";
  const shouldRedirectToConnections = !device && !isPublicGuideRoute && !isConnectionsRoute;

  useEffect(() => {
    if (shouldRedirectToConnections) {
      void navigate({ to: "/connections", replace: true });
    }
  }, [navigate, shouldRedirectToConnections]);

  return (
    // <ThemeProvider defaultTheme="system" storageKey="theme">
    <ErrorBoundary FallbackComponent={ErrorPage}>
      {/* <NewDeviceDialog
        open={connectDialogOpen}
        onOpenChange={(open) => {
          setConnectDialogOpen(open);
        }}
      /> */}
      <Toaster />
      <ThemeDocumentController pathname={pathname} />
      <TanStackRouterDevtools position="bottom-right" />
      <DeviceWrapper deviceId={selectedDeviceId}>
        <div className="mobile-viewport-fill flex h-full min-h-0 w-full flex-col bg-background-primary text-text-primary">
          <SidebarProvider>
            <div className="flex h-full min-h-0 flex-1 flex-col">
              {isConnectionsRoute ? (
                <div className="flex h-full min-h-0 w-full flex-1 flex-col">
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    {device ? <DeviceConnectionProgress phase={device.connectionPhase} /> : null}
                    <Outlet />
                  </div>
                  <div className="shrink-0">
                    <Footer />
                  </div>
                </div>
              ) : device ? (
                <div className="flex h-full min-h-0 w-full flex-1">
                  <DeviceConnectionProgress phase={device.connectionPhase} />
                  <DarkMeshRuntime />
                  <DialogManager />
                  <KeyBackupReminder />
                  <CommandPalette />
                  <MapProvider>
                    <Outlet />
                  </MapProvider>
                </div>
              ) : isPublicGuideRoute ? (
                <Outlet />
              ) : shouldRedirectToConnections ? null : (
                <div className="flex h-full min-h-0 flex-1 flex-col">
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    <Connections />
                  </div>
                  <div className="shrink-0">
                    <Footer />
                  </div>
                </div>
              )}
            </div>
          </SidebarProvider>
        </div>
      </DeviceWrapper>
    </ErrorBoundary>
  ); // </ThemeProvider>
}
