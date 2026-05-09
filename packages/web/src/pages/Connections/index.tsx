import AddConnectionDialog from "@app/components/Dialog/AddConnectionDialog/AddConnectionDialog";
import { TimeAgo } from "@app/components/generic/TimeAgo";
import LanguageSwitcher from "@app/components/LanguageSwitcher";
import { ConnectionStatusBadge } from "@app/components/PageComponents/Connections/ConnectionStatusBadge";
import type { Connection } from "@app/core/stores/deviceStore/types";
import { useConnections } from "@app/pages/Connections/useConnections";
import { connectionTypeIcon, formatConnectionSubtext } from "@app/pages/Connections/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@components/UI/AlertDialog.tsx";
import { Badge } from "@components/UI/Badge.tsx";
import { Button } from "@components/UI/Button.tsx";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@components/UI/Card.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@components/UI/DropdownMenu.tsx";
import { Separator } from "@components/UI/Separator.tsx";
import { useToast } from "@core/hooks/useToast.ts";
import { useDeviceStore } from "@core/stores";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ExternalLink,
  LinkIcon,
  MoreHorizontal,
  RotateCw,
  RouterIcon,
  Star,
  StarOff,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

const DARKMESH_RETURN_LINKS = [
  { href: "https://darkmesh.neocities.org/", label: "DarkMesh" },
  { href: "https://github.com/arkanet/DMDash", label: "DMDash GIT" },
  { href: "https://t.me/meshtastic_roma", label: "LoRaMesh Roma" },
  { href: "https://maps.loracity.it", label: "MAPS" },
  { href: "https://mesh.loracity.it/", label: "BLOG" },
] as const;

const DARKMESH_ACTION_COLOR = "#00bcd4";

export const Connections = () => {
  const {
    connections,
    addConnection,
    connect,
    disconnect,
    removeConnection,
    setDefaultConnection,
    refreshStatuses,
    syncConnectionStatuses,
  } = useConnections();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [addOpen, setAddOpen] = useState(false);
  const [pendingNavigationConnectionId, setPendingNavigationConnectionId] = useState<
    Connection["id"] | null
  >(null);
  const pendingNavigationConnectionPhase = useDeviceStore((state) => {
    if (!pendingNavigationConnectionId) {
      return undefined;
    }

    const pendingConnection = state.savedConnections.find(
      (connection) => connection.id === pendingNavigationConnectionId,
    );
    if (!pendingConnection?.meshDeviceId) {
      return undefined;
    }

    return state.getDevice(pendingConnection.meshDeviceId)?.connectionPhase;
  });
  const isURLHTTPS = useMemo(() => location.protocol === "https:", []);
  const { t } = useTranslation("connections");

  // On first mount, sync statuses and refresh
  useEffect(() => {
    syncConnectionStatuses();
    refreshStatuses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!pendingNavigationConnectionId) {
      return;
    }

    const pendingConnection = connections.find((c) => c.id === pendingNavigationConnectionId);
    if (!pendingConnection) {
      setPendingNavigationConnectionId(null);
      return;
    }

    if (
      pendingConnection.status === "configured" ||
      pendingNavigationConnectionPhase === "configured"
    ) {
      setPendingNavigationConnectionId(null);
      navigate({ to: "/map" });
      return;
    }

    if (pendingConnection.status === "error" || pendingConnection.status === "disconnected") {
      setPendingNavigationConnectionId(null);
    }
  }, [connections, navigate, pendingNavigationConnectionId, pendingNavigationConnectionPhase]);

  const sorted = useMemo(() => {
    const copy = [...connections];
    return copy.sort((a, b) => {
      if (a.isDefault && !b.isDefault) {
        return -1;
      }
      if (!a.isDefault && b.isDefault) {
        return 1;
      }
      const aConnected = a.status === "connected" || a.status === "configured";
      const bConnected = b.status === "connected" || b.status === "configured";
      if (aConnected && !bConnected) {
        return -1;
      }
      return a.name.localeCompare(b.name);
    });
  }, [connections]);

  const hasConnectedDevice = useMemo(
    () =>
      connections.some(
        (connection) => connection.status === "connected" || connection.status === "configured",
      ),
    [connections],
  );

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top,#611818_0%,#1f0d0d_33%,#090909_74%)] p-6 text-zinc-100">
      <div className="mx-auto space-y-6">
        <header className="rounded-[28px] border border-white/10 bg-[#141414]/92 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-sm">
          <div className="flex flex-col gap-5">
            <div className="grid items-start gap-4 md:grid-cols-[auto_1fr_auto]">
              <div className="flex justify-center md:justify-start">
                <img
                  src="/darkmesh-dashboard-logo.png"
                  alt="DarkMesh Dashboard"
                  className="h-20 w-20 rounded-2xl border border-white/10 bg-black/80 p-2 shadow-[0_0_30px_rgba(255,255,255,0.06)]"
                />
              </div>
              <div className="flex min-w-0 flex-col items-center gap-3">
                <h1 className="whitespace-nowrap text-center text-[clamp(1.35rem,7vw,2.85rem)] font-semibold uppercase tracking-[0.16em] text-white">
                  {t("page.title")}
                </h1>
                <div className="flex flex-wrap justify-center gap-2">
                  {hasConnectedDevice ? (
                    <Button
                      variant="outline"
                      onClick={() => navigate({ to: "/map" })}
                      className="gap-2 border-white/15 bg-black/20 text-zinc-100 hover:bg-white/10 hover:text-white"
                    >
                      <ArrowLeft className="size-4" />
                      {t("button.backToApp", "Back to app")}
                    </Button>
                  ) : null}
                  <Button
                    onClick={() => setAddOpen(true)}
                    className="gap-2 border border-[#7a2424] bg-[#551717] text-zinc-100 hover:bg-[#6c1d1d]"
                  >
                    <RouterIcon className="size-5" />
                    {t("button.addConnection")}
                  </Button>
                </div>
              </div>
              <div className="flex justify-center md:justify-end">
                <LanguageSwitcher />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-evenly gap-2">
              {DARKMESH_RETURN_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-[#7a2424] bg-[#2a0f0f] px-3 py-1.5 text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-zinc-100 transition-colors hover:bg-[#3a1515]"
                >
                  {link.label}
                  <ExternalLink className="size-3.5" />
                </a>
              ))}
            </div>
          </div>
        </header>

        <Separator className="bg-white/10" />

        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => navigate({ to: "/guide" })}
            className="inline-flex items-center gap-2 rounded-full border border-[#7a2424] bg-[#551717] px-6 py-3 text-sm font-semibold uppercase tracking-[0.16em] text-zinc-100 transition-colors hover:bg-[#6c1d1d] hover:text-white"
          >
            GUIDE
            <LinkIcon className="size-4" />
          </button>
        </div>

        <p className="w-full text-sm leading-6 text-zinc-300 md:text-base">
          {t("page.description")}
        </p>

        {sorted.length === 0 ? (
          <Card className="border-dashed border-white/15 bg-[#141414]/92 text-zinc-100">
            <CardHeader>
              <CardTitle className="text-lg">{t("noConnections.title")} </CardTitle>
            </CardHeader>
            <CardContent className="text-zinc-400">{t("noConnections.description")}</CardContent>
            <CardFooter>
              <Button
                onClick={() => setAddOpen(true)}
                className="gap-2 border border-[#7a2424] bg-[#551717] text-zinc-100 hover:bg-[#6c1d1d]"
              >
                <RouterIcon className="size-5" />
                {t("button.addConnection")}
              </Button>
            </CardFooter>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {sorted.map((c) => (
              <ConnectionCard
                key={c.id}
                connection={c}
                onConnect={async () => {
                  setPendingNavigationConnectionId(c.id);
                  const ok = await connect(c.id, { allowPrompt: true });
                  toast({
                    title: ok ? t("toasts.connected") : t("toasts.failed"),
                    description: ok
                      ? t("toasts.nowConnected", {
                          name: c.name,
                          interpolation: { escapeValue: false },
                        })
                      : t("toasts.checkConnection"),
                  });
                  if (!ok) {
                    setPendingNavigationConnectionId(null);
                  }
                }}
                onDisconnect={async () => {
                  await disconnect(c.id);
                  toast({
                    title: t("toasts.disconnected"),
                    description: t("toasts.nowDisconnected", {
                      name: c.name,
                      interpolation: { escapeValue: false },
                    }),
                  });
                }}
                onSetDefault={() => {
                  setDefaultConnection(c.id);
                  toast({
                    title: t("toasts.defaultSet"),
                    description: t("toasts.defaultConnection", {
                      name: c.name,
                      interpolation: { escapeValue: false },
                    }),
                  });
                }}
                onDelete={async () => {
                  await disconnect(c.id);
                  removeConnection(c.id);
                  toast({
                    title: t("toasts.deleted"),
                    description: t("toasts.deletedByName", {
                      name: c.name,
                      interpolation: { escapeValue: false },
                    }),
                  });
                }}
                onRetry={async () => {
                  setPendingNavigationConnectionId(c.id);
                  const ok = await connect(c.id, { allowPrompt: true });
                  toast({
                    title: ok ? t("toasts.connected") : t("toasts.failed"),
                    description: ok
                      ? t("toasts.nowConnected", {
                          name: c.name,
                          interpolation: { escapeValue: false },
                        })
                      : t("toasts.pickConnectionAgain"),
                  });
                  if (!ok) {
                    setPendingNavigationConnectionId(null);
                  }
                }}
              />
            ))}
          </div>
        )}

        <AddConnectionDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          isHTTPS={isURLHTTPS}
          onSave={async (partial, btDevice) => {
            const created = addConnection(partial, btDevice);
            setAddOpen(false);
            toast({
              title: t("toasts.added"),
              description: t("toasts.savedByName", {
                name: created.name,
                interpolation: { escapeValue: false },
              }),
            });
          }}
        />
      </div>
    </div>
  );
};

function TypeBadge({ type }: { type: Connection["type"] }) {
  const Icon = connectionTypeIcon(type);
  const label =
    type === "http"
      ? "Network HTTP"
      : type === "tcp"
        ? "Network TCP"
        : type === "bluetooth" || type === "ios-bluetooth"
          ? type === "ios-bluetooth"
            ? "iOS Bluetooth"
            : "Bluetooth"
          : "Serial";
  return (
    <Badge variant="default" className="gap-1.5 border border-white/10 bg-white/5 text-zinc-100">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Badge>
  );
}

function ConnectionCard({
  connection,
  onConnect,
  onDisconnect,
  onSetDefault,
  onDelete,
  onRetry,
}: {
  connection: Connection;
  onConnect: () => Promise<boolean> | Promise<void>;
  onDisconnect: () => Promise<void> | Promise<void>;
  onSetDefault: () => void;
  onDelete: () => void;
  onRetry: () => Promise<boolean> | Promise<void>;
}) {
  const { t } = useTranslation("connections");

  const Icon = connectionTypeIcon(connection.type);
  const isBusy = connection.status === "connecting" || connection.status === "configuring";
  const isConnected = connection.status === "connected" || connection.status === "configured";
  const isError = connection.status === "error";

  return (
    <Card className="flex flex-col border-white/10 bg-[#141414]/92 text-zinc-100 shadow-[0_18px_40px_rgba(0,0,0,0.32)]">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2">
              <Icon className="size-4 text-zinc-400" />
              <span className="truncate">{connection.name}</span>
              {connection.isDefault ? (
                <Badge variant="secondary" className="gap-1 bg-[#2a0f0f] text-zinc-100">
                  <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500" />
                  {t("default")}
                </Badge>
              ) : null}
            </CardTitle>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <TypeBadge type={connection.type} />
              <span className="truncate text-zinc-400">{formatConnectionSubtext(connection)}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
            <ConnectionStatusBadge status={connection.status} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="size-4" />
                  <span className="sr-only">{t("moreActions")}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={8}>
                {connection.type === "http" && connection.isDefault && (
                  <DropdownMenuItem className="gap-2" onClick={() => onSetDefault()}>
                    <StarOff className="size-4" />
                    {t("button.unsetDefault")}
                  </DropdownMenuItem>
                )}
                {connection.type === "http" && !connection.isDefault && (
                  <DropdownMenuItem className="gap-2" onClick={() => onSetDefault()}>
                    <Star className="size-4" />
                    {t("button.setDefault")}
                  </DropdownMenuItem>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem
                      className="gap-2 text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
                      onSelect={(e) => e.preventDefault()}
                    >
                      <Trash2 className="size-4" />
                      {t("button.delete")}
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("deleteConnection")}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t("areYouSure", { name: connection.name })}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("button.cancel")}</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-red-600 hover:bg-red-700"
                        onClick={() => onDelete()}
                      >
                        {t("button.delete")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isBusy ? <ConnectionProgressBar status={connection.status} /> : null}
        {connection.error ? (
          <p className={isBusy ? "mt-3 text-sm text-red-400" : "text-sm text-red-400"}>
            {connection.error}
          </p>
        ) : connection.lastConnectedAt ? (
          <p className={isBusy ? "mt-3 text-sm text-zinc-400" : "text-sm text-zinc-400"}>
            {t("lastConnectedAt", { date: "" })}{" "}
            <TimeAgo timestamp={connection.lastConnectedAt} className="text-sm text-zinc-400" />
          </p>
        ) : (
          <p className={isBusy ? "mt-3 text-sm text-zinc-400" : "text-sm text-zinc-400"}>
            {t("neverConnected")}
          </p>
        )}
      </CardContent>
      <CardFooter className="flex items-center gap-2 mt-auto">
        {isConnected ? (
          <Button
            variant="subtle"
            className="gap-2"
            onClick={() => onDisconnect()}
            disabled={isBusy}
          >
            {t("button.disconnect")}
          </Button>
        ) : (
          <Button
            className="gap-2"
            onClick={() => (isError ? onRetry() : onConnect())}
            disabled={isBusy}
          >
            {isError ? (
              <>
                <RotateCw className="size-4" />
                {t("button.retry")}
              </>
            ) : (
              <>
                <LinkIcon className="size-4" />
                {t("button.connect")}
              </>
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

function ConnectionProgressBar({ status }: { status: Connection["status"] }) {
  const { t } = useTranslation("connections");
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const nextStartedAt = Date.now();
    setStartedAt(nextStartedAt);
    setNow(nextStartedAt);

    const interval = window.setInterval(() => setNow(Date.now()), 120);
    return () => window.clearInterval(interval);
  }, [status]);

  const elapsedMs = Math.max(0, now - startedAt);
  const estimateMs = status === "configuring" ? 18_000 : 10_000;
  const progress = Math.min(96, Math.max(6, (elapsedMs / estimateMs) * 100));
  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  const label =
    status === "configuring"
      ? t("status.configuring", "Configuring device")
      : t("status.connecting", "Connecting to device");

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-xs font-medium text-zinc-400">
        <span>{label}</span>
        <span>{elapsedSeconds}s</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-[width] duration-150 ease-linear"
          style={{ width: `${progress}%`, backgroundColor: DARKMESH_ACTION_COLOR }}
        />
      </div>
    </div>
  );
}
