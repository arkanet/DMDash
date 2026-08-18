import { SupportBadge } from "@app/components/Badge/SupportedBadge.tsx";
import { Switch } from "@app/components/UI/Switch.tsx";
import type { BluetoothTransportMode, NewConnection } from "@app/core/stores/deviceStore/types.ts";
import {
  type NativeBleDeviceSelection,
  isNativeBleAvailable,
  requestNativeBleDevice,
  scanNativeBleDevices,
} from "@app/pages/Connections/TransportNativeBle";
import {
  DEFAULT_TCP_PORT,
  type DiscoveredNetworkDevice,
  type NetworkConnectionMode,
  discoverNetworkDevices,
  needsLocalNetworkBridge,
  testHttpReachable,
  testTcpReachable,
} from "@app/pages/Connections/utils";
import { Button } from "@components/UI/Button.tsx";
import { Input } from "@components/UI/Input.tsx";
import { Label } from "@components/UI/Label.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@components/UI/Tabs.tsx";
import { Link } from "@components/UI/Typography/Link.tsx";
import {
  type BrowserFeature,
  useBrowserFeatureDetection,
} from "@core/hooks/useBrowserFeatureDetection.ts";
import { useToast } from "@core/hooks/useToast.ts";
import { isIosLikeDevice } from "@core/utils/pwaEnvironment.ts";
import { TransportWebBluetooth } from "@meshtastic/transport-web-bluetooth";
import {
  AlertCircle,
  Bluetooth,
  Cable,
  CheckCircle2,
  Globe,
  Loader2,
  type LucideIcon,
  MousePointerClick,
  Network,
  Radar,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { DialogWrapper } from "../DialogWrapper.tsx";
import { urlOrIpv4Schema } from "./validation.ts";

type TabKey = "network" | "bluetooth" | "serial";
type TestingStatus = "idle" | "testing" | "success" | "failure";
type DiscoveryStatus = "idle" | "scanning" | "done" | "failure";
type DialogState = {
  tab: TabKey;
  networkMode: NetworkConnectionMode;
  name: string;
  protocol: "http" | "https";
  url: string;
  tcpPort: string;
  testStatus: TestingStatus;
  btSelected:
    | {
        id: string;
        name?: string;
        device?: BluetoothDevice;
        transport: BluetoothTransportMode;
        rssi?: number;
      }
    | undefined;
  serialSelected: { vendorId?: number; productId?: number } | undefined;
};

type DialogAction =
  | { type: "RESET"; payload?: { isHTTPS?: boolean } }
  | { type: "SET_TAB"; payload: TabKey }
  | { type: "SET_NETWORK_MODE"; payload: NetworkConnectionMode }
  | { type: "SET_NAME"; payload: string }
  | { type: "SET_PROTOCOL"; payload: "http" | "https" }
  | { type: "SET_URL"; payload: string }
  | { type: "SET_TCP_PORT"; payload: string }
  | { type: "SET_TEST_STATUS"; payload: TestingStatus }
  | {
      type: "SET_BT_SELECTED";
      payload:
        | {
            id: string;
            name?: string;
            device?: BluetoothDevice;
            transport: BluetoothTransportMode;
            rssi?: number;
          }
        | undefined;
    }
  | {
      type: "SET_SERIAL_SELECTED";
      payload: { vendorId?: number; productId?: number } | undefined;
    }
  | { type: "SET_URL_AND_RESET_TEST"; payload: string };

interface FeatureErrorProps {
  missingFeatures: BrowserFeature[];
  tabId: "bluetooth" | "serial";
}

type Pane = {
  children: () => React.ReactNode;
  placeholder: string;
  validate: () => boolean;
  build: () => NewConnection | null;
};

const featureErrors: Record<BrowserFeature, { href: string; i18nKey: string }> = {
  "Web Bluetooth": {
    href: "https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API#browser_compatibility",
    i18nKey: "addConnection.validation.requiresWebBluetooth",
  },
  "Web Serial": {
    href: "https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API#browser_compatibility",
    i18nKey: "addConnection.validation.requiresWebSerial",
  },
  "Secure Context": {
    href: "https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts",
    i18nKey: "addConnection.validation.requiresSecureContext",
  },
};

const FeatureErrorMessage = ({ missingFeatures, tabId }: FeatureErrorProps) => {
  if (missingFeatures.length === 0) {
    return null;
  }

  const browserFeatures = missingFeatures.filter((feature) => feature !== "Secure Context");
  const needsSecureContext = missingFeatures.includes("Secure Context");

  const needsFeature =
    tabId === "bluetooth" && browserFeatures.includes("Web Bluetooth")
      ? "Web Bluetooth"
      : tabId === "serial" && browserFeatures.includes("Web Serial")
        ? "Web Serial"
        : undefined;

  return (
    <div className="flex flex-col items-start gap-2 bg-red-500 p-4 rounded-md text-sm mt-4">
      <div className="flex items-center gap-2 w-full">
        <AlertCircle size={40} className="mr-2 shrink-0 text-white" />
        <div className="flex flex-col gap-3">
          <div className="text-sm text-white">
            {needsFeature && (
              <Trans
                i18nKey={featureErrors[needsFeature].i18nKey}
                components={[
                  <Link
                    key="0"
                    href={featureErrors[needsFeature].href}
                    className="underline hover:text-slate-200 text-white dark:text-white dark:hover:text-slate-300"
                  />,
                ]}
              />
            )}
            {needsFeature && needsSecureContext && " "}
            {needsSecureContext && (
              <Trans
                i18nKey={
                  browserFeatures.length > 0
                    ? "addConnection.validation.additionallyRequiresSecureContext"
                    : "addConnection.validation.requiresSecureContext"
                }
                components={{
                  "0": (
                    <Link
                      href={featureErrors["Secure Context"].href}
                      className="underline hover:text-slate-200 text-white dark:text-white dark:hover:text-slate-300"
                    />
                  ),
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const initialState: DialogState = {
  tab: "network",
  networkMode: "http",
  name: "",
  protocol: "http",
  url: "",
  tcpPort: String(DEFAULT_TCP_PORT),
  testStatus: "idle",
  btSelected: undefined,
  serialSelected: undefined,
};
export const createInitialDialogState = (overrides?: Partial<DialogState>): DialogState => {
  return { ...initialState, ...(overrides ?? {}) };
};

export const dialogStateInitializer = (overrides?: Partial<DialogState>): DialogState =>
  createInitialDialogState(overrides);

function dialogReducer(state: DialogState, action: DialogAction): DialogState {
  switch (action.type) {
    case "RESET":
      return createInitialDialogState(action.payload?.isHTTPS ? { protocol: "https" } : {});
    case "SET_TAB":
      return { ...state, tab: action.payload };
    case "SET_NETWORK_MODE":
      return { ...state, networkMode: action.payload, testStatus: "idle" };
    case "SET_NAME":
      return { ...state, name: action.payload };
    case "SET_PROTOCOL":
      return { ...state, protocol: action.payload };
    case "SET_URL":
      return { ...state, url: action.payload };
    case "SET_TCP_PORT":
      return { ...state, tcpPort: action.payload, testStatus: "idle" };
    case "SET_TEST_STATUS":
      return { ...state, testStatus: action.payload };
    case "SET_BT_SELECTED":
      return { ...state, btSelected: action.payload };
    case "SET_SERIAL_SELECTED":
      return { ...state, serialSelected: action.payload };
    case "SET_URL_AND_RESET_TEST":
      return { ...state, url: action.payload, testStatus: "idle" };
    default:
      return state;
  }
}

function PickerRow({
  label,
  buttonText,
  onPick,
  disabled,
  display,
  helper,
}: {
  label: string;
  buttonText: string;
  onPick: () => void | Promise<void>;
  disabled?: boolean;
  display: string;
  helper?: string;
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <Button variant="subtle" className="gap-2" onClick={onPick} disabled={disabled}>
          <MousePointerClick className="h-4 w-4" />
          {buttonText}
        </Button>
        <div className="text-sm text-slate-500 dark:text-slate-400 truncate">{display}</div>
      </div>
      {helper ? <p className="text-xs text-slate-500 dark:text-slate-400">{helper}</p> : null}
    </div>
  );
}

function sortNativeBleDevices(a: NativeBleDeviceSelection, b: NativeBleDeviceSelection): number {
  const rssiA = a.rssi ?? Number.NEGATIVE_INFINITY;
  const rssiB = b.rssi ?? Number.NEGATIVE_INFINITY;
  if (rssiA !== rssiB) {
    return rssiB - rssiA;
  }
  return (a.name ?? a.id).localeCompare(b.name ?? b.id);
}

function formatNativeBleSignal(rssi?: number): string {
  return typeof rssi === "number" ? `${rssi} dBm` : "RSSI n/a";
}

function getBluetoothDisplayName(device?: { id: string; name?: string }): string {
  return device?.name || device?.id || "Unknown device";
}

const TAB_META: Array<{ key: TabKey; label: string; Icon: LucideIcon }> = [
  { key: "network", label: "Network", Icon: Network },
  { key: "bluetooth", label: "Bluetooth", Icon: Bluetooth },
  { key: "serial", label: "Serial", Icon: Cable },
];

export default function AddConnectionDialog({
  open = false,
  onOpenChange = () => {},
  onSave = async () => {},
  isHTTPS = false,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSave?: (conn: NewConnection, device?: BluetoothDevice) => Promise<void>;
  isHTTPS?: boolean;
}) {
  const { toast } = useToast();
  const [state, dispatch] = useReducer(dialogReducer, initialState, () =>
    dialogStateInitializer(isHTTPS ? { protocol: "https" } : {}),
  );
  const { unsupported } = useBrowserFeatureDetection();
  const { t } = useTranslation();
  const [discoveryStatus, setDiscoveryStatus] = useState<DiscoveryStatus>("idle");
  const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredNetworkDevice[]>([]);
  const [nativeBleScanStatus, setNativeBleScanStatus] = useState<DiscoveryStatus>("idle");
  const [nativeBleDevices, setNativeBleDevices] = useState<NativeBleDeviceSelection[]>([]);

  const nativeBleSupported = isNativeBleAvailable();
  const webBluetoothSupported = typeof navigator !== "undefined" && "bluetooth" in navigator;
  const bluetoothSupported = nativeBleSupported || webBluetoothSupported;
  const bluetoothUnsupported = nativeBleSupported
    ? unsupported.filter((feature) => feature !== "Web Bluetooth")
    : unsupported;
  const serialSupported = typeof navigator !== "undefined" && "serial" in navigator;
  const iosLikeDevice = isIosLikeDevice();
  const isURLHTTPS = isHTTPS;

  const reset = useCallback(() => {
    dispatch({ type: "RESET", payload: { isHTTPS } });
  }, [isHTTPS]);

  useEffect(() => {
    if (!open) {
      reset();
      setDiscoveryStatus("idle");
      setDiscoveredDevices([]);
      setNativeBleScanStatus("idle");
      setNativeBleDevices([]);
    }
  }, [reset, open]);

  const makeToastErrorHandler = useCallback(
    (titlePrefix: string) =>
      (err: unknown): void => {
        if (err && (err as { name?: string }).name === "NotFoundError") {
          return; // user canceled
        }
        const message = err instanceof Error ? err.message : String(err);
        toast({ title: `${titlePrefix} error`, description: message });
      },
    [toast],
  );

  const selectNativeBluetoothDevice = useCallback(
    (device: NativeBleDeviceSelection) => {
      dispatch({
        type: "SET_BT_SELECTED",
        payload: {
          id: device.id,
          name: device.name,
          transport: "native",
          rssi: device.rssi,
        },
      });
      if (!state.name || state.name === "") {
        dispatch({
          type: "SET_NAME",
          payload: device.name
            ? t("addConnection.bluetoothConnection.short", {
                deviceName: device.name,
              })
            : t("addConnection.bluetoothConnection.long"),
        });
      }
      toast({
        title: "Native BLE device selected",
        description: getBluetoothDisplayName(device),
      });
    },
    [state.name, toast, t],
  );

  const handlePickBluetooth = useCallback(async () => {
    if (nativeBleSupported) {
      try {
        const device = await requestNativeBleDevice();
        selectNativeBluetoothDevice(device);
      } catch (err) {
        makeToastErrorHandler("Bluetooth")(err);
      }
      return;
    }

    if (!bluetoothSupported) {
      toast({
        title: t("addConnection.bluetoothConnection.notSupported.title"),
        description: t("addConnection.bluetoothConnection.notSupported.description"),
      });
      return;
    }
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [TransportWebBluetooth.ServiceUuid] }],
      });
      dispatch({
        type: "SET_BT_SELECTED",
        payload: {
          id: device.id,
          name: device.name ?? undefined,
          device,
          transport: "web",
        },
      });
      if (!state.name || state.name === "") {
        dispatch({
          type: "SET_NAME",
          payload: device.name
            ? t("addConnection.bluetoothConnection.short", {
                deviceName: device.name,
              })
            : t("addConnection.bluetoothConnection.long"),
        });
      }
      toast({
        title: t("addConnection.bluetoothConnection.selected"),
        description: device.name || device.id,
      });
    } catch (err) {
      makeToastErrorHandler("Bluetooth")(err);
    }
  }, [
    nativeBleSupported,
    bluetoothSupported,
    selectNativeBluetoothDevice,
    state.name,
    toast,
    makeToastErrorHandler,
    t,
  ]);

  const handleScanNativeBluetooth = useCallback(async () => {
    if (!nativeBleSupported) {
      return;
    }

    setNativeBleScanStatus("scanning");
    setNativeBleDevices([]);
    const seen = new Map<string, NativeBleDeviceSelection>();
    let stopScan: (() => Promise<void>) | undefined;

    try {
      stopScan = await scanNativeBleDevices((device) => {
        const previous = seen.get(device.id);
        const next = {
          ...previous,
          ...device,
          name: device.name ?? previous?.name,
        };
        seen.set(device.id, next);
        setNativeBleDevices(Array.from(seen.values()).sort(sortNativeBleDevices));
      });

      await new Promise((resolve) => setTimeout(resolve, 8000));
      await stopScan();
      stopScan = undefined;
      setNativeBleScanStatus(seen.size > 0 ? "done" : "failure");

      if (seen.size === 0) {
        toast({
          title: "No Bluetooth devices found",
          description: "Keep the Meshtastic radio nearby and make sure Bluetooth is enabled.",
        });
      }
    } catch (err) {
      if (stopScan) {
        await stopScan().catch(() => {});
      }
      setNativeBleScanStatus("failure");
      makeToastErrorHandler("Bluetooth")(err);
    }
  }, [nativeBleSupported, toast, makeToastErrorHandler]);

  const handlePickSerial = useCallback(async () => {
    if (!serialSupported) {
      toast({
        title: t("addConnection.serialConnection.notSupported.title"),
        description: t("addConnection.serialConnection.notSupported.description"),
      });
      return;
    }
    try {
      const port = await (
        navigator as Navigator & {
          serial: {
            requestPort: (o: Record<string, unknown>) => Promise<SerialPort>;
          };
        }
      ).serial.requestPort({});
      const info =
        (
          port as SerialPort & {
            getInfo?: () => { usbVendorId?: number; usbProductId?: number };
          }
        ).getInfo?.() ?? {};
      dispatch({
        type: "SET_SERIAL_SELECTED",
        payload: {
          vendorId: info.usbVendorId,
          productId: info.usbProductId,
        },
      });
      if (!state.name || state.name === "") {
        const v = info.usbVendorId ? info.usbVendorId.toString(16) : "?";
        const p = info.usbProductId ? info.usbProductId.toString(16) : "?";
        dispatch({ type: "SET_NAME", payload: `Serial: ${v}:${p}` });
      }
      toast({
        title: t("addConnection.serialConnection.portSelected.title"),
        description: t("addConnection.serialConnection.portSelected.description"),
      });
    } catch (err) {
      makeToastErrorHandler("Serial")(err);
    }
  }, [serialSupported, state.name, toast, makeToastErrorHandler, t]);

  const handleTestHttp = useCallback(async () => {
    const fullUrl = `${state.protocol}://${state.url}`;
    const validatedURL = urlOrIpv4Schema.safeParse(fullUrl);
    if (validatedURL.success === false) {
      toast({
        title: t("addConnection.httpConnection.invalidUrl.title"),
        description: t("addConnection.httpConnection.invalidUrl.description"),
      });
      return;
    }
    dispatch({ type: "SET_TEST_STATUS", payload: "testing" });
    const reachable = await testHttpReachable(validatedURL.data);
    if (reachable) {
      dispatch({ type: "SET_TEST_STATUS", payload: "success" });
    } else {
      dispatch({ type: "SET_TEST_STATUS", payload: "failure" });
      toast({
        title: t("addConnection.httpConnection.connectionTest.failure.title"),
        description: t("addConnection.httpConnection.connectionTest.failure.description"),
      });
    }
  }, [state.protocol, state.url, toast, t]);

  const tcpPort = Number.parseInt(state.tcpPort, 10);
  const tcpHostValid = urlOrIpv4Schema.safeParse(state.url).success;
  const tcpPortValid = Number.isInteger(tcpPort) && tcpPort >= 10 && tcpPort <= 65535;

  const handleTestTcp = useCallback(async () => {
    if (!tcpHostValid || !tcpPortValid) {
      toast({
        title: "Invalid TCP endpoint",
        description: "Enter a valid IP or hostname and a TCP port between 10 and 65535.",
      });
      return;
    }
    dispatch({ type: "SET_TEST_STATUS", payload: "testing" });
    if (needsLocalNetworkBridge(state.url.trim())) {
      dispatch({ type: "SET_TEST_STATUS", payload: "failure" });
      toast({
        title: "Local bridge required",
        description:
          "This page is not running on your local network. Start DMDash locally or on a LAN host, then test the private TCP endpoint again.",
      });
      return;
    }
    const reachable = await testTcpReachable(state.url.trim(), tcpPort);
    if (reachable) {
      dispatch({ type: "SET_TEST_STATUS", payload: "success" });
    } else {
      dispatch({ type: "SET_TEST_STATUS", payload: "failure" });
      toast({
        title: "TCP endpoint not reachable",
        description:
          "Check that the node is reachable on the network and Meshtastic TCP is enabled.",
      });
    }
  }, [state.url, tcpHostValid, tcpPort, tcpPortValid, toast]);

  const handleDiscoverNetwork = useCallback(async () => {
    setDiscoveryStatus("scanning");
    const devices = await discoverNetworkDevices();
    setDiscoveredDevices(devices);
    setDiscoveryStatus(devices.length > 0 ? "done" : "failure");
  }, []);

  const selectDiscoveredDevice = useCallback(
    (device: DiscoveredNetworkDevice, mode: NetworkConnectionMode, port: number) => {
      const host =
        device.addresses.find((address) => address.includes(".")) ??
        device.addresses[0] ??
        device.host;
      dispatch({ type: "SET_NETWORK_MODE", payload: mode });
      dispatch({ type: "SET_URL_AND_RESET_TEST", payload: host });
      dispatch({ type: "SET_TCP_PORT", payload: String(port) });
      if (!state.name) {
        dispatch({ type: "SET_NAME", payload: device.name });
      }
    },
    [state.name],
  );

  const PANES: Record<TabKey, Pane> = useMemo(
    () => ({
      network: {
        placeholder:
          state.networkMode === "http"
            ? t("addConnection.httpConnection.namePlaceholder")
            : "Network TCP node",
        children: () => (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant={state.networkMode === "http" ? "default" : "subtle"}
                className="gap-2"
                onClick={() => dispatch({ type: "SET_NETWORK_MODE", payload: "http" })}
              >
                <Globe className="h-4 w-4" />
                HTTP
              </Button>
              <Button
                type="button"
                variant={state.networkMode === "tcp" ? "default" : "subtle"}
                className="gap-2"
                onClick={() => dispatch({ type: "SET_NETWORK_MODE", payload: "tcp" })}
              >
                <Network className="h-4 w-4" />
                TCP
              </Button>
              <Button
                type="button"
                variant="subtle"
                className="gap-2"
                onClick={handleDiscoverNetwork}
                disabled={discoveryStatus === "scanning"}
              >
                {discoveryStatus === "scanning" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Radar className="h-4 w-4" />
                )}
                Discover
              </Button>
            </div>

            {discoveredDevices.length > 0 ? (
              <div className="grid gap-2 rounded-md border border-slate-200 p-2 dark:border-slate-800">
                {discoveredDevices.map((device) => (
                  <div
                    key={device.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded bg-slate-50 p-2 text-sm dark:bg-slate-900"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">{device.name}</div>
                      <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {(device.addresses[0] ?? device.host) || "Unknown host"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {device.services.map((service) => (
                        <Button
                          key={`${device.id}-${service.protocol}-${service.port}`}
                          type="button"
                          variant="subtle"
                          size="sm"
                          onClick={() =>
                            selectDiscoveredDevice(device, service.protocol, service.port)
                          }
                        >
                          {service.protocol.toUpperCase()}:{service.port}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : discoveryStatus === "failure" ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No network devices discovered. You can still enter an address manually.
              </p>
            ) : null}

            {state.networkMode === "http" ? (
              <>
                <Label htmlFor="url">{t("addConnection.httpConnection.heading")}</Label>

                <Input
                  id={"url"}
                  inputMode="url"
                  placeholder={t("addConnection.httpConnection.inputPlaceholder")}
                  prefix={`${state.protocol}://`}
                  value={state.url}
                  onChange={(e) => {
                    dispatch({
                      type: "SET_URL_AND_RESET_TEST",
                      payload: e.target.value,
                    });
                  }}
                />
                <div className="flex items-center gap-2 mt-1">
                  <Switch
                    value={state.protocol}
                    disabled={!!isURLHTTPS}
                    checked={state.protocol === "https"}
                    onCheckedChange={(value) => {
                      dispatch({
                        type: "SET_PROTOCOL",
                        payload: value ? "https" : "http",
                      });
                      dispatch({ type: "SET_TEST_STATUS", payload: "idle" });
                    }}
                  ></Switch>
                  <Label>{t("addConnection.httpConnection.useHttps")}</Label>
                </div>
              </>
            ) : (
              <>
                <Label htmlFor="tcp-host">Meshtastic TCP endpoint</Label>
                <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
                  <Input
                    id={"tcp-host"}
                    inputMode="url"
                    placeholder="192.168.1.42 or meshtastic.local"
                    value={state.url}
                    onChange={(e) => {
                      dispatch({
                        type: "SET_URL_AND_RESET_TEST",
                        payload: e.target.value,
                      });
                    }}
                  />
                  <Input
                    aria-label="TCP port"
                    inputMode="numeric"
                    value={state.tcpPort}
                    onChange={(e) => {
                      dispatch({
                        type: "SET_TCP_PORT",
                        payload: e.target.value,
                      });
                    }}
                  />
                </div>
              </>
            )}

            <div className="flex items-center gap-2 mt-4">
              <Button
                variant="subtle"
                className="gap-2"
                onClick={state.networkMode === "http" ? handleTestHttp : handleTestTcp}
                disabled={
                  state.networkMode === "http"
                    ? urlOrIpv4Schema.safeParse(`${state.protocol}://${state.url}`).success ===
                        false || state.testStatus === "testing"
                    : !tcpHostValid || !tcpPortValid || state.testStatus === "testing"
                }
              >
                {state.testStatus === "testing" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {state.networkMode === "http"
                      ? t("addConnection.httpConnection.connectionTest.button.loading")
                      : "Testing"}
                  </>
                ) : (
                  <>
                    <MousePointerClick className="h-4 w-4" />
                    {state.networkMode === "http"
                      ? t("addConnection.httpConnection.connectionTest.button.label")
                      : "Test TCP"}
                  </>
                )}
              </Button>
              {state.testStatus === "success" && (
                <div className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  {state.networkMode === "http"
                    ? t("addConnection.httpConnection.connectionTest.reachable")
                    : "Reachable"}
                </div>
              )}
              {state.testStatus === "failure" && (
                <div className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
                  <XCircle className="h-4 w-4" />
                  {state.networkMode === "http"
                    ? t("addConnection.httpConnection.connectionTest.notReachable")
                    : "Not reachable"}
                </div>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {state.networkMode === "http"
                ? t("addConnection.httpConnection.connectionTest.description")
                : "Uses the Meshtastic TCP stream on port 4403 through the local DMDash bridge."}
            </p>
          </div>
        ),
        validate: () =>
          state.networkMode === "http"
            ? urlOrIpv4Schema.safeParse(`${state.protocol}://${state.url}`).success === true &&
              state.testStatus === "success"
            : tcpHostValid && tcpPortValid && state.testStatus === "success",
        build: () =>
          state.networkMode === "http"
            ? {
                type: "http",
                name: state.name.trim(),
                url: `${state.protocol}://${state.url.trim()}`,
              }
            : {
                type: "tcp",
                name: state.name.trim(),
                host: state.url.trim(),
                port: tcpPort,
              },
      },
      bluetooth: {
        placeholder: "My Bluetooth Node",
        children: () => (
          <>
            <SupportBadge
              supported={bluetoothSupported}
              labelSupported={
                nativeBleSupported
                  ? "Native BLE available"
                  : t("addConnection.bluetoothConnection.supported.title")
              }
              labelUnsupported={t("addConnection.bluetoothConnection.notSupported.title")}
            />
            {iosLikeDevice && !bluetoothSupported ? (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                iOS non espone Web Bluetooth a Safari o alle PWA installate. Usa HTTP(S) verso un
                gateway/nodo raggiungibile in rete, oppure un wrapper nativo con CoreBluetooth.
              </div>
            ) : null}
            {nativeBleSupported ? (
              <div className="grid gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="subtle"
                    className="gap-2"
                    onClick={handleScanNativeBluetooth}
                    disabled={nativeBleScanStatus === "scanning"}
                  >
                    {nativeBleScanStatus === "scanning" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Radar className="h-4 w-4" />
                    )}
                    Scan
                  </Button>
                  <Button
                    type="button"
                    variant="subtle"
                    className="gap-2"
                    onClick={handlePickBluetooth}
                    disabled={!bluetoothSupported || nativeBleScanStatus === "scanning"}
                  >
                    <MousePointerClick className="h-4 w-4" />
                    iOS picker
                  </Button>
                  {state.btSelected ? (
                    <div className="min-w-0 text-sm text-slate-500 dark:text-slate-400">
                      Selected:{" "}
                      <span className="font-medium text-slate-800 dark:text-slate-100">
                        {getBluetoothDisplayName(state.btSelected)}
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className="grid max-h-64 gap-2 overflow-y-auto rounded-md border border-slate-200 p-2 dark:border-slate-800">
                  {nativeBleDevices.length > 0 ? (
                    nativeBleDevices.map((device) => {
                      const selected =
                        state.btSelected?.transport === "native" &&
                        state.btSelected.id === device.id;
                      return (
                        <div
                          key={device.id}
                          className="flex items-center justify-between gap-3 rounded bg-slate-50 p-2 text-sm dark:bg-slate-900"
                        >
                          <div className="min-w-0">
                            <div className="truncate font-medium">
                              {device.name ?? "Meshtastic BLE"}
                            </div>
                            <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                              {device.id}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {formatNativeBleSignal(device.rssi)}
                            </span>
                            <Button
                              type="button"
                              variant={selected ? "default" : "subtle"}
                              size="sm"
                              onClick={() => selectNativeBluetoothDevice(device)}
                            >
                              {selected ? "Selected" : "Select"}
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded bg-slate-50 p-3 text-sm text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                      Scan to list nearby Meshtastic radios, or use the iOS picker to pair through
                      CoreBluetooth.
                    </div>
                  )}
                </div>

                {nativeBleScanStatus === "failure" ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    No device found. Wake the radio, keep it nearby, then scan again.
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Native BLE uses iOS CoreBluetooth instead of the browser Web Bluetooth engine.
                  </p>
                )}
              </div>
            ) : (
              <PickerRow
                label={t("addConnection.bluetoothConnection.device")}
                buttonText={t("addConnection.bluetoothConnection.selectDevice")}
                onPick={handlePickBluetooth}
                disabled={!bluetoothSupported}
                display={
                  state.btSelected
                    ? state.btSelected.name || state.btSelected.id
                    : t("addConnection.bluetoothConnection.notSelected")
                }
                helper={t("addConnection.bluetoothConnection.helperText")}
              />
            )}
            <FeatureErrorMessage missingFeatures={bluetoothUnsupported} tabId="bluetooth" />
          </>
        ),
        validate: () => state.name.trim().length > 0 && !!state.btSelected,
        build: () => ({
          type: "bluetooth",
          name: state.name.trim(),
          transport: state.btSelected?.transport ?? (nativeBleSupported ? "native" : "web"),
          deviceId: state.btSelected?.id,
          deviceName: state.btSelected?.name,
          gattServiceUUID: TransportWebBluetooth.ServiceUuid,
          rssi: state.btSelected?.rssi,
        }),
      },
      serial: {
        placeholder: t("addConnection.serialConnection.namePlaceholder"),
        children: () => (
          <>
            <SupportBadge
              supported={serialSupported}
              labelSupported={t("addConnection.serialConnection.supported.title")}
              labelUnsupported={t("addConnection.serialConnection.notSupported.title")}
            />
            <PickerRow
              label={t("addConnection.serialConnection.port")}
              buttonText={t("addConnection.serialConnection.selectPort")}
              onPick={handlePickSerial}
              disabled={!serialSupported}
              display={
                state.serialSelected
                  ? t("addConnection.serialConnection.deviceName", {
                      vendorId: state.serialSelected.vendorId?.toString(16) ?? "?",
                      productId: state.serialSelected.productId?.toString(16) ?? "?",
                    })
                  : t("addConnection.serialConnection.notSelected")
              }
              helper={t("addConnection.serialConnection.helperText")}
            />
            <FeatureErrorMessage missingFeatures={unsupported} tabId="serial" />
          </>
        ),
        validate: () =>
          state.name.trim().length > 0 && (!!state.serialSelected || !serialSupported),
        build: () => ({
          type: "serial",
          name: state.name.trim(),
          usbVendorId: state.serialSelected?.vendorId,
          usbProductId: state.serialSelected?.productId,
        }),
      },
    }),
    [
      state,
      bluetoothSupported,
      nativeBleSupported,
      nativeBleScanStatus,
      nativeBleDevices,
      bluetoothUnsupported,
      iosLikeDevice,
      serialSupported,
      isURLHTTPS,
      handlePickBluetooth,
      handleScanNativeBluetooth,
      handlePickSerial,
      handleDiscoverNetwork,
      handleTestHttp,
      handleTestTcp,
      selectDiscoveredDevice,
      discoveredDevices,
      discoveryStatus,
      unsupported,
      selectNativeBluetoothDevice,
      t,
      tcpHostValid,
      tcpPort,
      tcpPortValid,
    ],
  );

  const currentPane = PANES[state.tab];
  const canCreate = useMemo(() => currentPane.validate(), [currentPane]);

  const submit =
    (fn: (p: NewConnection, device?: BluetoothDevice) => Promise<void>) => async () => {
      if (!canCreate) {
        return;
      }
      const payload = currentPane.build();

      if (!payload) {
        return;
      }
      const btDevice = state.tab === "bluetooth" ? state.btSelected?.device : undefined;
      await fn(payload, btDevice);
    };

  return (
    <DialogWrapper
      variant="default"
      type="custom"
      title={t("addConnection.title")}
      description={t("addConnection.description")}
      cancelText={t("button.cancel")}
      open={open}
      onOpenChange={onOpenChange}
    >
      <Tabs
        value={state.tab}
        onValueChange={(v) => dispatch({ type: "SET_TAB", payload: v as TabKey })}
      >
        <TabsList className="grid grid-cols-3">
          {TAB_META.map(({ key, label, Icon }) => (
            <TabsTrigger key={key} value={key} className="gap-2">
              <Icon className="h-4 w-4" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {TAB_META.map(({ key }) => (
          <TabsContent key={key} value={key}>
            {state.tab === key ? (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-4">
                  <Label htmlFor={`name-${state.tab}`}>Name</Label>
                  <Input
                    id={`name-${state.tab}`}
                    value={state.name}
                    onChange={(evt) => dispatch({ type: "SET_NAME", payload: evt.target.value })}
                    placeholder={currentPane.placeholder}
                  />
                </div>
                {PANES[key].children()}
                <div className="flex justify-end">
                  <div className="inline-flex rounded-md shadow-sm overflow-hidden border">
                    <Button onClick={submit(onSave)} disabled={!canCreate} className="rounded-none">
                      {t("button.saveConnection")}
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </TabsContent>
        ))}
      </Tabs>
    </DialogWrapper>
  );
}
