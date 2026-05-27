import { create, fromBinary, toBinary } from "@bufbuild/protobuf";
import { useDeviceStore } from "@core/stores/deviceStore/index.ts";
import { useNodeDBStore } from "@core/stores/nodeDBStore/index.ts";
import { randId } from "@core/utils/randId.ts";
import { getX25519PublicKey, getX25519SharedSecret } from "@core/utils/x25519.ts";
import { Protobuf, Utils } from "@meshtastic/core";

type DemoRemoteAdminPendingEdit = {
  owner: Protobuf.Mesh.User;
  config: Protobuf.LocalOnly.LocalConfig;
  moduleConfig: Protobuf.LocalOnly.LocalModuleConfig;
  channels: Map<number, Protobuf.Channel.Channel>;
};

type DemoRemoteAdminTargetState = {
  owner: Protobuf.Mesh.User;
  metadata: Protobuf.Mesh.DeviceMetadata;
  config: Protobuf.LocalOnly.LocalConfig;
  moduleConfig: Protobuf.LocalOnly.LocalModuleConfig;
  channels: Map<number, Protobuf.Channel.Channel>;
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  adminKeys: Uint8Array[];
  sessionPasskeys: Map<string, Uint8Array>;
  pendingEdit?: DemoRemoteAdminPendingEdit;
};

export type DemoRemoteAdminConnection = {
  events: Utils.EventSystem;
  sendPacket: (
    payload: Uint8Array,
    portNum: Protobuf.Portnums.PortNum,
    destination: number,
  ) => Promise<number>;
};

const demoRemoteAdminConnections = new Map<number, DemoRemoteAdminConnection>();
const demoRemoteAdminTargets = new Map<number, Map<number, DemoRemoteAdminTargetState>>();

function encodeSeedBytes(seed: string, length = 32): Uint8Array {
  const source = new TextEncoder().encode(seed.repeat(Math.ceil(length / seed.length) + 1));
  return source.slice(0, length);
}

function createPrivateKey(seed: string): Uint8Array {
  const key = encodeSeedBytes(seed);
  key[0] = (key[0] ?? 0) & 248;
  key[31] = (key[31] ?? 0) & 127;
  key[31] |= 64;
  return key;
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function cloneUser(user: Protobuf.Mesh.User): Protobuf.Mesh.User {
  return create(Protobuf.Mesh.UserSchema, user);
}

function cloneConfig(config: Protobuf.LocalOnly.LocalConfig): Protobuf.LocalOnly.LocalConfig {
  return create(Protobuf.LocalOnly.LocalConfigSchema, config);
}

function cloneModuleConfig(
  config: Protobuf.LocalOnly.LocalModuleConfig,
): Protobuf.LocalOnly.LocalModuleConfig {
  return create(Protobuf.LocalOnly.LocalModuleConfigSchema, config);
}

function cloneChannel(channel: Protobuf.Channel.Channel): Protobuf.Channel.Channel {
  return create(Protobuf.Channel.ChannelSchema, channel);
}

function cloneChannelMap(
  channels: Map<number, Protobuf.Channel.Channel>,
): Map<number, Protobuf.Channel.Channel> {
  return new Map(
    Array.from(channels.entries(), ([index, channel]) => [index, cloneChannel(channel)]),
  );
}

function getConfigResponseForType(
  config: Protobuf.LocalOnly.LocalConfig,
  configType: Protobuf.Admin.AdminMessage_ConfigType,
): Protobuf.Config.Config | undefined {
  switch (configType) {
    case Protobuf.Admin.AdminMessage_ConfigType.DEVICE_CONFIG:
      return create(Protobuf.Config.ConfigSchema, {
        payloadVariant: { case: "device", value: config.device },
      });
    case Protobuf.Admin.AdminMessage_ConfigType.POSITION_CONFIG:
      return create(Protobuf.Config.ConfigSchema, {
        payloadVariant: { case: "position", value: config.position },
      });
    case Protobuf.Admin.AdminMessage_ConfigType.POWER_CONFIG:
      return create(Protobuf.Config.ConfigSchema, {
        payloadVariant: { case: "power", value: config.power },
      });
    case Protobuf.Admin.AdminMessage_ConfigType.NETWORK_CONFIG:
      return create(Protobuf.Config.ConfigSchema, {
        payloadVariant: { case: "network", value: config.network },
      });
    case Protobuf.Admin.AdminMessage_ConfigType.DISPLAY_CONFIG:
      return create(Protobuf.Config.ConfigSchema, {
        payloadVariant: { case: "display", value: config.display },
      });
    case Protobuf.Admin.AdminMessage_ConfigType.BLUETOOTH_CONFIG:
      return create(Protobuf.Config.ConfigSchema, {
        payloadVariant: { case: "bluetooth", value: config.bluetooth },
      });
    case Protobuf.Admin.AdminMessage_ConfigType.LORA_CONFIG:
      return create(Protobuf.Config.ConfigSchema, {
        payloadVariant: { case: "lora", value: config.lora },
      });
    case Protobuf.Admin.AdminMessage_ConfigType.SECURITY_CONFIG:
      return create(Protobuf.Config.ConfigSchema, {
        payloadVariant: { case: "security", value: config.security },
      });
    default:
      return undefined;
  }
}

function getModuleConfigResponseForType(
  config: Protobuf.LocalOnly.LocalModuleConfig,
  configType: Protobuf.Admin.AdminMessage_ModuleConfigType,
): Protobuf.ModuleConfig.ModuleConfig | undefined {
  switch (configType) {
    case Protobuf.Admin.AdminMessage_ModuleConfigType.MQTT_CONFIG:
      return create(Protobuf.ModuleConfig.ModuleConfigSchema, {
        payloadVariant: { case: "mqtt", value: config.mqtt },
      });
    case Protobuf.Admin.AdminMessage_ModuleConfigType.SERIAL_CONFIG:
      return create(Protobuf.ModuleConfig.ModuleConfigSchema, {
        payloadVariant: { case: "serial", value: config.serial },
      });
    case Protobuf.Admin.AdminMessage_ModuleConfigType.EXTNOTIF_CONFIG:
      return create(Protobuf.ModuleConfig.ModuleConfigSchema, {
        payloadVariant: {
          case: "externalNotification",
          value: config.externalNotification,
        },
      });
    case Protobuf.Admin.AdminMessage_ModuleConfigType.STOREFORWARD_CONFIG:
      return create(Protobuf.ModuleConfig.ModuleConfigSchema, {
        payloadVariant: { case: "storeForward", value: config.storeForward },
      });
    case Protobuf.Admin.AdminMessage_ModuleConfigType.RANGETEST_CONFIG:
      return create(Protobuf.ModuleConfig.ModuleConfigSchema, {
        payloadVariant: { case: "rangeTest", value: config.rangeTest },
      });
    case Protobuf.Admin.AdminMessage_ModuleConfigType.TELEMETRY_CONFIG:
      return create(Protobuf.ModuleConfig.ModuleConfigSchema, {
        payloadVariant: { case: "telemetry", value: config.telemetry },
      });
    case Protobuf.Admin.AdminMessage_ModuleConfigType.CANNEDMSG_CONFIG:
      return create(Protobuf.ModuleConfig.ModuleConfigSchema, {
        payloadVariant: { case: "cannedMessage", value: config.cannedMessage },
      });
    case Protobuf.Admin.AdminMessage_ModuleConfigType.AUDIO_CONFIG:
      return create(Protobuf.ModuleConfig.ModuleConfigSchema, {
        payloadVariant: { case: "audio", value: config.audio },
      });
    case Protobuf.Admin.AdminMessage_ModuleConfigType.REMOTEHARDWARE_CONFIG:
      return create(Protobuf.ModuleConfig.ModuleConfigSchema, {
        payloadVariant: {
          case: "remoteHardware",
          value: config.remoteHardware,
        },
      });
    case Protobuf.Admin.AdminMessage_ModuleConfigType.NEIGHBORINFO_CONFIG:
      return create(Protobuf.ModuleConfig.ModuleConfigSchema, {
        payloadVariant: { case: "neighborInfo", value: config.neighborInfo },
      });
    case Protobuf.Admin.AdminMessage_ModuleConfigType.AMBIENTLIGHTING_CONFIG:
      return create(Protobuf.ModuleConfig.ModuleConfigSchema, {
        payloadVariant: {
          case: "ambientLighting",
          value: config.ambientLighting,
        },
      });
    case Protobuf.Admin.AdminMessage_ModuleConfigType.DETECTIONSENSOR_CONFIG:
      return create(Protobuf.ModuleConfig.ModuleConfigSchema, {
        payloadVariant: {
          case: "detectionSensor",
          value: config.detectionSensor,
        },
      });
    case Protobuf.Admin.AdminMessage_ModuleConfigType.PAXCOUNTER_CONFIG:
      return create(Protobuf.ModuleConfig.ModuleConfigSchema, {
        payloadVariant: { case: "paxcounter", value: config.paxcounter },
      });
    case Protobuf.Admin.AdminMessage_ModuleConfigType.STATUSMESSAGE_CONFIG:
      return create(Protobuf.ModuleConfig.ModuleConfigSchema, {
        payloadVariant: { case: "statusmessage", value: config.statusmessage },
      });
    case Protobuf.Admin.AdminMessage_ModuleConfigType.TRAFFICMANAGEMENT_CONFIG:
      return create(Protobuf.ModuleConfig.ModuleConfigSchema, {
        payloadVariant: {
          case: "trafficManagement",
          value: config.trafficManagement,
        },
      });
    default:
      return undefined;
  }
}

function createRemoteAdminMeshPacket(
  from: number,
  to: number,
  payload: Protobuf.Admin.AdminMessage,
): Protobuf.Mesh.MeshPacket {
  return create(Protobuf.Mesh.MeshPacketSchema, {
    id: randId(),
    from,
    to,
    payloadVariant: {
      case: "decoded",
      value: create(Protobuf.Mesh.DataSchema, {
        portnum: Protobuf.Portnums.PortNum.ADMIN_APP,
        payload: toBinary(Protobuf.Admin.AdminMessageSchema, payload),
      }),
    },
  });
}

function createAckTimeoutError(id: number): {
  id: number;
  error: Protobuf.Mesh.Routing_Error;
} {
  return {
    id,
    error: Protobuf.Mesh.Routing_Error.TIMEOUT,
  };
}

function ensureDemoTargetState(
  deviceId: number,
  nodeNum: number,
): DemoRemoteAdminTargetState | undefined {
  const device = useDeviceStore.getState().getDevice(deviceId);
  const nodeDB = useNodeDBStore.getState().getNodeDB(deviceId);
  const node = nodeDB?.getNode(nodeNum);
  const owner = node?.user;

  if (!device || !nodeDB || !node || !owner || !device.config.security.publicKey.length) {
    return undefined;
  }

  let deviceTargets = demoRemoteAdminTargets.get(deviceId);
  if (!deviceTargets) {
    deviceTargets = new Map();
    demoRemoteAdminTargets.set(deviceId, deviceTargets);
  }

  const existing = deviceTargets.get(nodeNum);
  if (existing) {
    existing.adminKeys = [new Uint8Array(device.config.security.publicKey)];
    return existing;
  }

  const privateKey = createPrivateKey(`${owner.longName}-pki`);
  const publicKey = getX25519PublicKey(privateKey);
  const config = cloneConfig(device.config);
  config.device = create(Protobuf.Config.Config_DeviceConfigSchema, {
    ...config.device,
    role: owner.role,
    isManaged: true,
  });
  config.position = create(Protobuf.Config.Config_PositionConfigSchema, {
    ...config.position,
    fixedPosition: nodeNum === device.hardware.myNodeNum,
  });
  config.bluetooth = create(Protobuf.Config.Config_BluetoothConfigSchema, {
    ...config.bluetooth,
    enabled: device.metadata.get(nodeNum)?.hasBluetooth ?? false,
  });
  config.security = create(Protobuf.Config.Config_SecurityConfigSchema, {
    ...config.security,
    privateKey,
    publicKey,
    adminKey: [new Uint8Array(device.config.security.publicKey)],
  });

  const moduleConfig = cloneModuleConfig(device.moduleConfig);
  moduleConfig.statusmessage = create(
    Protobuf.ModuleConfig.ModuleConfig_StatusMessageConfigSchema,
    {
      ...moduleConfig.statusmessage,
      nodeStatus: node.status?.rawValue ?? `Nodo ${owner.shortName} operativo`,
    },
  );

  const targetState: DemoRemoteAdminTargetState = {
    owner: create(Protobuf.Mesh.UserSchema, {
      ...owner,
      publicKey,
    }),
    metadata: create(
      Protobuf.Mesh.DeviceMetadataSchema,
      device.metadata.get(nodeNum) ?? device.metadata.get(0) ?? {},
    ),
    config,
    moduleConfig,
    channels: cloneChannelMap(device.channels),
    privateKey,
    publicKey,
    adminKeys: [new Uint8Array(device.config.security.publicKey)],
    sessionPasskeys: new Map(),
  };

  deviceTargets.set(nodeNum, targetState);
  return targetState;
}

function ensurePendingEdit(targetState: DemoRemoteAdminTargetState): DemoRemoteAdminPendingEdit {
  if (!targetState.pendingEdit) {
    targetState.pendingEdit = {
      owner: cloneUser(targetState.owner),
      config: cloneConfig(targetState.config),
      moduleConfig: cloneModuleConfig(targetState.moduleConfig),
      channels: cloneChannelMap(targetState.channels),
    };
  }

  return targetState.pendingEdit;
}

export function getDemoRemoteAdminConnection(deviceId: number): DemoRemoteAdminConnection {
  const existingConnection = demoRemoteAdminConnections.get(deviceId);
  if (existingConnection) {
    return existingConnection;
  }

  const events = new Utils.EventSystem();
  const connection: DemoRemoteAdminConnection = {
    events,
    async sendPacket(payload, portNum, destination) {
      const packetId = randId();
      if (portNum !== Protobuf.Portnums.PortNum.ADMIN_APP) {
        throw createAckTimeoutError(packetId);
      }

      const device = useDeviceStore.getState().getDevice(deviceId);
      const localSecurity = device?.config.security;
      const localNodeNum = device?.hardware.myNodeNum ?? 0;
      if (!device || !localSecurity?.privateKey.length || !localSecurity.publicKey.length) {
        throw createAckTimeoutError(packetId);
      }

      const targetState = ensureDemoTargetState(deviceId, destination);
      if (!targetState) {
        throw createAckTimeoutError(packetId);
      }

      if (
        !targetState.adminKeys.some((adminKey) => bytesEqual(adminKey, localSecurity.publicKey))
      ) {
        throw createAckTimeoutError(packetId);
      }

      const adminMessage = fromBinary(Protobuf.Admin.AdminMessageSchema, payload);
      const sharedSecret = getX25519SharedSecret(localSecurity.privateKey, targetState.publicKey);
      const reciprocalSecret = getX25519SharedSecret(
        targetState.privateKey,
        localSecurity.publicKey,
      );
      if (!bytesEqual(sharedSecret, reciprocalSecret)) {
        throw createAckTimeoutError(packetId);
      }

      const sessionKeyId = bytesToHex(localSecurity.publicKey);
      const sessionPasskey = targetState.sessionPasskeys.get(sessionKeyId) ?? sharedSecret;

      if (
        adminMessage.sessionPasskey &&
        adminMessage.sessionPasskey.length > 0 &&
        !bytesEqual(adminMessage.sessionPasskey, sessionPasskey)
      ) {
        throw createAckTimeoutError(packetId);
      }

      targetState.sessionPasskeys.set(sessionKeyId, sessionPasskey);

      let response: Protobuf.Admin.AdminMessage | undefined;

      switch (adminMessage.payloadVariant.case) {
        case "getDeviceMetadataRequest":
          response = create(Protobuf.Admin.AdminMessageSchema, {
            sessionPasskey,
            payloadVariant: {
              case: "getDeviceMetadataResponse",
              value: targetState.metadata,
            },
          });
          break;
        case "getOwnerRequest":
          response = create(Protobuf.Admin.AdminMessageSchema, {
            sessionPasskey,
            payloadVariant: {
              case: "getOwnerResponse",
              value: targetState.pendingEdit?.owner ?? targetState.owner,
            },
          });
          break;
        case "getChannelRequest": {
          const requestedIndex = Math.max(0, adminMessage.payloadVariant.value - 1);
          const channels = targetState.pendingEdit?.channels ?? targetState.channels;
          response = create(Protobuf.Admin.AdminMessageSchema, {
            sessionPasskey,
            payloadVariant: {
              case: "getChannelResponse",
              value:
                channels.get(requestedIndex) ??
                create(Protobuf.Channel.ChannelSchema, {
                  index: requestedIndex,
                  role: Protobuf.Channel.Channel_Role.DISABLED,
                }),
            },
          });
          break;
        }
        case "getConfigRequest": {
          const configResponse = getConfigResponseForType(
            targetState.pendingEdit?.config ?? targetState.config,
            adminMessage.payloadVariant.value,
          );
          if (configResponse) {
            response = create(Protobuf.Admin.AdminMessageSchema, {
              sessionPasskey,
              payloadVariant: {
                case: "getConfigResponse",
                value: configResponse,
              },
            });
          }
          break;
        }
        case "getModuleConfigRequest": {
          const moduleConfigResponse = getModuleConfigResponseForType(
            targetState.pendingEdit?.moduleConfig ?? targetState.moduleConfig,
            adminMessage.payloadVariant.value,
          );
          if (moduleConfigResponse) {
            response = create(Protobuf.Admin.AdminMessageSchema, {
              sessionPasskey,
              payloadVariant: {
                case: "getModuleConfigResponse",
                value: moduleConfigResponse,
              },
            });
          }
          break;
        }
        case "beginEditSettings":
          ensurePendingEdit(targetState);
          break;
        case "setOwner":
          ensurePendingEdit(targetState).owner = cloneUser(adminMessage.payloadVariant.value);
          break;
        case "setChannel":
          ensurePendingEdit(targetState).channels.set(
            adminMessage.payloadVariant.value.index,
            cloneChannel(adminMessage.payloadVariant.value),
          );
          break;
        case "setConfig": {
          const targetConfig = ensurePendingEdit(targetState).config;
          switch (adminMessage.payloadVariant.value.payloadVariant.case) {
            case "device":
              targetConfig.device = adminMessage.payloadVariant.value.payloadVariant.value;
              break;
            case "position":
              targetConfig.position = adminMessage.payloadVariant.value.payloadVariant.value;
              break;
            case "power":
              targetConfig.power = adminMessage.payloadVariant.value.payloadVariant.value;
              break;
            case "network":
              targetConfig.network = adminMessage.payloadVariant.value.payloadVariant.value;
              break;
            case "display":
              targetConfig.display = adminMessage.payloadVariant.value.payloadVariant.value;
              break;
            case "bluetooth":
              targetConfig.bluetooth = adminMessage.payloadVariant.value.payloadVariant.value;
              break;
            case "lora":
              targetConfig.lora = adminMessage.payloadVariant.value.payloadVariant.value;
              break;
            case "security":
              targetConfig.security = adminMessage.payloadVariant.value.payloadVariant.value;
              break;
          }
          break;
        }
        case "setModuleConfig": {
          const targetModuleConfig = ensurePendingEdit(targetState).moduleConfig;
          switch (adminMessage.payloadVariant.value.payloadVariant.case) {
            case "mqtt":
              targetModuleConfig.mqtt = adminMessage.payloadVariant.value.payloadVariant.value;
              break;
            case "serial":
              targetModuleConfig.serial = adminMessage.payloadVariant.value.payloadVariant.value;
              break;
            case "externalNotification":
              targetModuleConfig.externalNotification =
                adminMessage.payloadVariant.value.payloadVariant.value;
              break;
            case "storeForward":
              targetModuleConfig.storeForward =
                adminMessage.payloadVariant.value.payloadVariant.value;
              break;
            case "rangeTest":
              targetModuleConfig.rangeTest = adminMessage.payloadVariant.value.payloadVariant.value;
              break;
            case "telemetry":
              targetModuleConfig.telemetry = adminMessage.payloadVariant.value.payloadVariant.value;
              break;
            case "cannedMessage":
              targetModuleConfig.cannedMessage =
                adminMessage.payloadVariant.value.payloadVariant.value;
              break;
            case "audio":
              targetModuleConfig.audio = adminMessage.payloadVariant.value.payloadVariant.value;
              break;
            case "remoteHardware":
              targetModuleConfig.remoteHardware =
                adminMessage.payloadVariant.value.payloadVariant.value;
              break;
            case "neighborInfo":
              targetModuleConfig.neighborInfo =
                adminMessage.payloadVariant.value.payloadVariant.value;
              break;
            case "ambientLighting":
              targetModuleConfig.ambientLighting =
                adminMessage.payloadVariant.value.payloadVariant.value;
              break;
            case "detectionSensor":
              targetModuleConfig.detectionSensor =
                adminMessage.payloadVariant.value.payloadVariant.value;
              break;
            case "paxcounter":
              targetModuleConfig.paxcounter =
                adminMessage.payloadVariant.value.payloadVariant.value;
              break;
            case "statusmessage":
              targetModuleConfig.statusmessage =
                adminMessage.payloadVariant.value.payloadVariant.value;
              break;
            case "trafficManagement":
              targetModuleConfig.trafficManagement =
                adminMessage.payloadVariant.value.payloadVariant.value;
              break;
          }
          break;
        }
        case "commitEditSettings":
          if (targetState.pendingEdit) {
            targetState.owner = cloneUser(targetState.pendingEdit.owner);
            targetState.config = cloneConfig(targetState.pendingEdit.config);
            targetState.moduleConfig = cloneModuleConfig(targetState.pendingEdit.moduleConfig);
            targetState.channels = cloneChannelMap(targetState.pendingEdit.channels);
            targetState.privateKey = targetState.config.security.privateKey;
            targetState.publicKey = targetState.config.security.publicKey;
            targetState.adminKeys = [...targetState.config.security.adminKey];
            targetState.pendingEdit = undefined;
          }
          break;
      }

      if (response) {
        queueMicrotask(() => {
          events.onMeshPacket.dispatch(
            createRemoteAdminMeshPacket(destination, localNodeNum, response),
          );
        });
      }

      return packetId;
    },
  };

  demoRemoteAdminConnections.set(deviceId, connection);
  return connection;
}
