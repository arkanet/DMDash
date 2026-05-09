# DMDash iOS Bluetooth Bridge

iOS and iPadOS browsers do not expose Web Bluetooth. DMDash supports iOS Bluetooth by running the web app inside a native iOS container that exposes a small JavaScript bridge backed by CoreBluetooth.

The web app detects the bridge with:

```ts
window.DMDashIOSBluetooth
```

## JavaScript API

The native container must inject this object before DMDash starts:

```ts
type IOSBluetoothDeviceInfo = {
  id: string;
  name?: string;
};

window.DMDashIOSBluetooth = {
  isAvailable(): boolean | Promise<boolean>,
  requestDevice(): Promise<IOSBluetoothDeviceInfo>,
  connect(deviceId: string): Promise<void>,
  disconnect(deviceId: string): Promise<void>,
  write(deviceId: string, base64Data: string): Promise<void>,
};
```

`base64Data` is a complete Meshtastic transport packet encoded as base64.

## Native-To-Web Events

When native CoreBluetooth receives a complete packet from the Meshtastic device, it must dispatch:

```ts
window.dispatchEvent(
  new CustomEvent("dmdash-ios-bluetooth-packet", {
    detail: {
      deviceId: "stable-native-device-id",
      data: "base64-packet",
    },
  }),
);
```

`data` may also be a `number[]` or `Uint8Array`, but base64 is preferred for WebView bridge compatibility.

When the native link status changes, dispatch:

```ts
window.dispatchEvent(
  new CustomEvent("dmdash-ios-bluetooth-status", {
    detail: {
      deviceId: "stable-native-device-id",
      status: "connected" | "connecting" | "disconnected",
      reason: "optional-native-reason",
    },
  }),
);
```

## Meshtastic BLE UUIDs

The native implementation should use the same Meshtastic BLE service and characteristics as the Web Bluetooth transport:

- Service: `6ba1b218-15a8-461f-9fa8-5dcae273eafd`
- To radio: `f75c76d2-129e-4dad-a1dd-7866124401e7`
- From radio: `2c55e69e-4993-11ed-b878-0242ac120002`
- From num: `ed9da18c-a800-4f66-a670-aa7547e34453`

The native side should subscribe to `fromNum`, then read `fromRadio` until it returns an empty value, mirroring `TransportWebBluetooth`.

## Web Flow

When the bridge is available, the Add Connection dialog shows an `iOS` tab. Saved connections use:

```ts
{
  type: "ios-bluetooth",
  deviceId: "...",
  deviceName: "..."
}
```

The rest of DMDash uses the normal Meshtastic `Transport` contract, so map, nodes, messages, channels, settings and DarkMesh runtime stay shared with desktop/Android web.
