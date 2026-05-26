import { DeviceWrapper } from "@app/DeviceWrapper.tsx";
import { ThemeDocumentController } from "@components/ThemeDocumentController.tsx";
import { Toaster } from "@components/Toaster.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@components/UI/AlertDialog.tsx";
import { ErrorPage } from "@components/UI/ErrorPage.tsx";
import Footer from "@components/UI/Footer.tsx";
import { LOST_CONNECTION_CRITICAL_GRACE_MS } from "@core/constants/connection.ts";
import { cn } from "@core/utils/cn.ts";
import { type Device, SidebarProvider, useAppStore, useDeviceStore } from "@core/stores";
import type { Connection } from "@core/stores/deviceStore/types.ts";
import { DarkMeshRuntime } from "@app/darkmesh/runtime.tsx";
import { Connections } from "@pages/Connections/index.tsx";
import { Types } from "@meshtastic/core";
import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { AlertTriangleIcon } from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";

const CommandPalette = lazy(() =>
  import("@components/CommandPalette/index.tsx").then((module) => ({
    default: module.CommandPalette,
  })),
);
const DialogManager = lazy(() =>
  import("@components/Dialog/DialogManager.tsx").then((module) => ({
    default: module.DialogManager,
  })),
);
const KeyBackupReminder = lazy(() =>
  import("@components/KeyBackupReminder.tsx").then((module) => ({
    default: module.KeyBackupReminder,
  })),
);
const RouterDevtools = import.meta.env.DEV
  ? lazy(() =>
      import("@tanstack/react-router-devtools").then((module) => ({
        default: module.TanStackRouterDevtools,
      })),
    )
  : null;

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

function useCommandPaletteShortcut(enabled: boolean) {
  const setCommandPaletteOpen = useAppStore((state) => state.setCommandPaletteOpen);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setCommandPaletteOpen(true);
      }
    };

    globalThis.addEventListener("keydown", handleKeydown);
    return () => globalThis.removeEventListener("keydown", handleKeydown);
  }, [enabled, setCommandPaletteOpen]);
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

function isUsableDevice(device: Device | undefined): device is Device {
  return (
    device?.connectionPhase === "configured" &&
    device.status !== Types.DeviceStatusEnum.DeviceDisconnected
  );
}

type LostConnectionNotice = {
  severity: "warning" | "critical";
  reason: string;
  connectionName?: string;
  connectionType?: Connection["type"];
};

function getConnectionReason(connection: Connection | undefined, fallback: string): string {
  if (connection?.expectedReconnectReason === "device-reboot") {
    return "Automatic reconnect timed out after a device reboot.";
  }

  return connection?.error || fallback;
}

function createLostConnectionNotice(
  connection: Connection | undefined,
  severity: LostConnectionNotice["severity"],
  fallbackReason: string,
): LostConnectionNotice {
  return {
    severity,
    reason: getConnectionReason(connection, fallbackReason),
    connectionName: connection?.name,
    connectionType: connection?.type,
  };
}

function LostConnectionDialog({
  notice,
  onDismiss,
}: {
  notice: LostConnectionNotice | null;
  onDismiss: () => void;
}) {
  const isCritical = notice?.severity === "critical";

  return (
    <AlertDialog
      open={Boolean(notice)}
      onOpenChange={(open) => {
        if (!open) {
          onDismiss();
        }
      }}
    >
      <AlertDialogContent
        className={
          isCritical
            ? "border-red-700 dark:border-red-700"
            : "border-amber-500 dark:border-amber-500"
        }
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangleIcon
              className={isCritical ? "size-5 text-red-600" : "size-5 text-amber-500"}
            />
            Lost Connection
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3 text-left text-slate-700 dark:text-slate-200">
            <span className="block">
              Non e' stato possibile ristabilire automaticamente la connessione al dispositivo.
            </span>
            {notice?.connectionName ? (
              <span className="block">
                Connection: {notice.connectionName}
                {notice.connectionType ? ` (${notice.connectionType})` : ""}
              </span>
            ) : null}
            <span className="block">Motivo: {notice?.reason}</span>
            <span className="block">
              Gravita: {isCritical ? "critical" : "warning"}. Riconnetti il device dalla pagina
              Connections.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={onDismiss}>Chiudi</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function App() {
  useMobileViewport();

  const { getDevice, getConnectionForDevice } = useDeviceStore();
  const selectedDeviceId = useAppStore((state) => state.selectedDeviceId);
  const commandPaletteOpen = useAppStore((state) => state.commandPaletteOpen);
  const navigate = useNavigate();
  const [lostConnectionNotice, setLostConnectionNotice] = useState<LostConnectionNotice | null>(
    null,
  );
  const [lostConnectionGraceUntil, setLostConnectionGraceUntil] = useState<number | null>(null);
  const pathname = useLocation({
    select: (location) => location.pathname,
  });

  const device = getDevice(selectedDeviceId);
  const selectedDeviceConnection = device ? getConnectionForDevice(device.id) : undefined;
  const isPublicGuideRoute = pathname === "/guide" || pathname.startsWith("/guide/");
  const isConnectionsRoute = pathname === "/" || pathname === "/connections";
  const hasUsableDevice = isUsableDevice(device);
  const expectedReconnectUntil = selectedDeviceConnection?.expectedReconnectUntil ?? 0;
  const expectedReconnectConnectionId = selectedDeviceConnection?.id;
  const isHoldingExpectedReconnect = !hasUsableDevice && expectedReconnectUntil > Date.now();
  const isHoldingLocalReconnect =
    !hasUsableDevice &&
    selectedDeviceConnection?.status === "reconnecting" &&
    (selectedDeviceConnection.type === "bluetooth" || selectedDeviceConnection.type === "serial");
  const shouldGuardLostConnection =
    !hasUsableDevice &&
    !isHoldingExpectedReconnect &&
    !isHoldingLocalReconnect &&
    !isPublicGuideRoute &&
    !isConnectionsRoute;
  const isHoldingLostConnectionGrace = Boolean(
    device &&
    shouldGuardLostConnection &&
    (lostConnectionGraceUntil === null || lostConnectionGraceUntil > Date.now()),
  );
  const deviceForAppShell =
    hasUsableDevice ||
    isHoldingExpectedReconnect ||
    isHoldingLocalReconnect ||
    isHoldingLostConnectionGrace
      ? device
      : undefined;
  const shouldRedirectToConnections = shouldGuardLostConnection && !isHoldingLostConnectionGrace;
  useCommandPaletteShortcut(Boolean(deviceForAppShell));

  useEffect(() => {
    if (hasUsableDevice || isPublicGuideRoute || isConnectionsRoute) {
      return;
    }

    if (!expectedReconnectConnectionId || !expectedReconnectUntil) {
      return;
    }

    const redirectAfterExpectedReconnectWindow = () => {
      const state = useDeviceStore.getState();
      const currentConnection = state
        .getSavedConnections()
        .find((connection) => connection.id === expectedReconnectConnectionId);
      const currentDevice = currentConnection?.meshDeviceId
        ? state.getDevice(currentConnection.meshDeviceId)
        : state.getDevice(selectedDeviceId);

      if (isUsableDevice(currentDevice)) {
        return;
      }

      state.updateSavedConnection(expectedReconnectConnectionId, {
        expectedReconnectUntil: undefined,
        expectedReconnectReason: undefined,
      });
      setLostConnectionNotice(
        createLostConnectionNotice(currentConnection, "critical", "Automatic reconnect timed out."),
      );
      void navigate({ to: "/connections", replace: true });
    };

    const timeoutMs = expectedReconnectUntil - Date.now();
    if (timeoutMs <= 0) {
      redirectAfterExpectedReconnectWindow();
      return;
    }

    const timeout = window.setTimeout(redirectAfterExpectedReconnectWindow, timeoutMs);
    return () => window.clearTimeout(timeout);
  }, [
    expectedReconnectConnectionId,
    expectedReconnectUntil,
    hasUsableDevice,
    isConnectionsRoute,
    isPublicGuideRoute,
    navigate,
    selectedDeviceId,
  ]);

  useEffect(() => {
    if (!shouldGuardLostConnection) {
      setLostConnectionGraceUntil(null);
      return;
    }

    if (!device) {
      void navigate({ to: "/connections", replace: true });
      return;
    }

    const nextGraceUntil =
      lostConnectionGraceUntil ?? Date.now() + LOST_CONNECTION_CRITICAL_GRACE_MS;
    if (lostConnectionGraceUntil === null) {
      setLostConnectionGraceUntil(nextGraceUntil);
    }

    const showCriticalLostConnection = () => {
      const state = useDeviceStore.getState();
      const currentDevice = state.getDevice(selectedDeviceId);
      const connectionForDevice = currentDevice
        ? state.getConnectionForDevice(currentDevice.id)
        : undefined;
      setLostConnectionNotice(
        createLostConnectionNotice(
          connectionForDevice,
          "critical",
          "The selected device connection is no longer available.",
        ),
      );
      void navigate({ to: "/connections", replace: true });
    };

    const timeoutMs = nextGraceUntil - Date.now();
    if (timeoutMs <= 0) {
      showCriticalLostConnection();
      return;
    }

    const timeout = window.setTimeout(showCriticalLostConnection, timeoutMs);
    return () => window.clearTimeout(timeout);
  }, [device, lostConnectionGraceUntil, navigate, selectedDeviceId, shouldGuardLostConnection]);

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
      <LostConnectionDialog
        notice={lostConnectionNotice}
        onDismiss={() => setLostConnectionNotice(null)}
      />
      <ThemeDocumentController pathname={pathname} />
      {RouterDevtools ? (
        <Suspense fallback={null}>
          <RouterDevtools position="bottom-right" />
        </Suspense>
      ) : null}
      <DeviceWrapper deviceId={selectedDeviceId}>
        <div className="mobile-viewport-fill flex h-full min-h-0 w-full flex-col bg-background-primary text-text-primary">
          <SidebarProvider>
            <div
              className={cn(
                "flex min-h-0 flex-1 flex-col overflow-hidden",
                !isPublicGuideRoute && "pb-[calc(env(safe-area-inset-bottom)+1.5rem)] md:pb-10",
              )}
            >
              {isConnectionsRoute ? (
                <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    {device ? <DeviceConnectionProgress phase={device.connectionPhase} /> : null}
                    <Outlet />
                  </div>
                </div>
              ) : deviceForAppShell ? (
                <div className="flex h-full min-h-0 w-full flex-1">
                  <DeviceConnectionProgress phase={deviceForAppShell.connectionPhase} />
                  <DarkMeshRuntime />
                  <Suspense fallback={null}>
                    <DialogManager />
                    <KeyBackupReminder />
                    {commandPaletteOpen ? <CommandPalette /> : null}
                  </Suspense>
                  <Outlet />
                </div>
              ) : isPublicGuideRoute ? (
                <Outlet />
              ) : shouldRedirectToConnections ? null : (
                <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    <Connections />
                  </div>
                </div>
              )}
            </div>
          </SidebarProvider>
        </div>
        <Footer />
      </DeviceWrapper>
    </ErrorBoundary>
  ); // </ThemeProvider>
}
