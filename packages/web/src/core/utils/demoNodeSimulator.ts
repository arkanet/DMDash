import { useDarkMeshStore } from "@app/darkmesh/store.ts";
import { create } from "@bufbuild/protobuf";
import { useDeviceStore } from "@core/stores/deviceStore/index.ts";
import {
  getConversationId,
  MessageState,
  MessageType,
  useMessageStore,
} from "@core/stores/messageStore/index.ts";
import type { Message } from "@core/stores/messageStore/types.ts";
import { useNodeDBStore } from "@core/stores/nodeDBStore/index.ts";
import { normalizePosition } from "@core/utils/geo.ts";
import { randId } from "@core/utils/randId.ts";
import { getX25519PublicKey } from "@core/utils/x25519.ts";
import { Protobuf, Types } from "@meshtastic/core";

export const DEMO_DEVICE_ID = -9001;
export const DEMO_BOT_NODE_NUM = 9001011;

const DEMO_PROFILE_VERSION = "2.7.21-demo-roma.1";
const DEMO_MY_NODE_NUM = 9001000;
const DEMO_HUB_NAME = "roma hub";
const DEMO_FREQ_MHZ = 868.0;
const DEMO_BANDWIDTH_HZ = 125_000;
const DEMO_NOISE_FIGURE_DB = 6;
const DEMO_TX_POWER_DBM = 20;
const DEMO_ANTENNA_GAIN_DB = 2;

type DemoNodeBlueprint = {
  num: number;
  longName: string;
  shortName: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  role: Protobuf.Config.Config_DeviceConfig_Role;
  hwModel: Protobuf.Mesh.HardwareModel;
  batteryLevel: number;
  voltage: number;
  firmwareVersion: string;
  viaMqtt?: boolean;
  isFavorite?: boolean;
  isLicensed?: boolean;
  isUnmessageable?: boolean;
  obstructionDb?: number;
  temperatureC?: number;
  humidity?: number;
  powerChannelVoltage?: number;
  powerChannelCurrent?: number;
};

type LinkMetrics = {
  distanceKm: number;
  rxRssi: number;
  snr: number;
  hopsAway: number;
};

const DEMO_HUB_BLUEPRINT: DemoNodeBlueprint = {
  num: DEMO_MY_NODE_NUM,
  longName: DEMO_HUB_NAME,
  shortName: "RHUB",
  latitude: 41.9028,
  longitude: 12.4964,
  altitude: 24,
  role: Protobuf.Config.Config_DeviceConfig_Role.ROUTER,
  hwModel: Protobuf.Mesh.HardwareModel.TLORA_T3_S3,
  batteryLevel: 83,
  voltage: 4.08,
  firmwareVersion: DEMO_PROFILE_VERSION,
  isLicensed: true,
  obstructionDb: 4,
  temperatureC: 29.1,
  humidity: 52,
  powerChannelVoltage: 12.2,
  powerChannelCurrent: 180,
};

const DEMO_BOT_BLUEPRINT: DemoNodeBlueprint = {
  num: DEMO_BOT_NODE_NUM,
  longName: "darkmesh bot",
  shortName: "DBOT",
  latitude: 41.8902,
  longitude: 12.4922,
  altitude: 32,
  role: Protobuf.Config.Config_DeviceConfig_Role.CLIENT,
  hwModel: Protobuf.Mesh.HardwareModel.HELTEC_V3,
  batteryLevel: 97,
  voltage: 4.18,
  firmwareVersion: "2.7.21-demo-bot",
  isFavorite: true,
  isLicensed: true,
  obstructionDb: 5,
  temperatureC: 27.1,
  humidity: 46,
  powerChannelVoltage: 5.09,
  powerChannelCurrent: 290,
};

const DEMO_NODE_BLUEPRINTS: DemoNodeBlueprint[] = [
  DEMO_BOT_BLUEPRINT,
  {
    num: 9001001,
    longName: "test 001",
    shortName: "TVAT",
    latitude: 41.9022,
    longitude: 12.4539,
    altitude: 38,
    role: Protobuf.Config.Config_DeviceConfig_Role.CLIENT,
    hwModel: Protobuf.Mesh.HardwareModel.HELTEC_V3,
    batteryLevel: 74,
    voltage: 3.97,
    firmwareVersion: "2.7.21-demo-vaticano",
    isFavorite: true,
    isLicensed: true,
    obstructionDb: 7,
    temperatureC: 30.0,
    humidity: 47,
    powerChannelVoltage: 5.08,
    powerChannelCurrent: 410,
  },
  {
    num: 9001002,
    longName: "test 002",
    shortName: "TOST",
    latitude: 41.732,
    longitude: 12.276,
    altitude: 7,
    role: Protobuf.Config.Config_DeviceConfig_Role.CLIENT,
    hwModel: Protobuf.Mesh.HardwareModel.TLORA_T3_S3,
    batteryLevel: 67,
    voltage: 3.89,
    firmwareVersion: "2.7.21-demo-ostia",
    obstructionDb: 12,
    temperatureC: 28.4,
    humidity: 61,
  },
  {
    num: 9001003,
    longName: "test 003",
    shortName: "TFCO",
    latitude: 41.77,
    longitude: 12.2389,
    altitude: 6,
    role: Protobuf.Config.Config_DeviceConfig_Role.ROUTER_LATE,
    hwModel: Protobuf.Mesh.HardwareModel.HELTEC_V3,
    batteryLevel: 101,
    voltage: 5.03,
    firmwareVersion: "2.7.20-demo-fiumicino",
    obstructionDb: 11,
    temperatureC: 27.8,
    humidity: 63,
    powerChannelVoltage: 13.1,
    powerChannelCurrent: 220,
  },
  {
    num: 9001004,
    longName: "test 004",
    shortName: "TFRS",
    latitude: 41.8097,
    longitude: 12.679,
    altitude: 320,
    role: Protobuf.Config.Config_DeviceConfig_Role.CLIENT,
    hwModel: Protobuf.Mesh.HardwareModel.TLORA_T3_S3,
    batteryLevel: 81,
    voltage: 4.11,
    firmwareVersion: "2.7.21-demo-frascati",
    obstructionDb: 5,
    temperatureC: 24.2,
    humidity: 55,
  },
  {
    num: 9001005,
    longName: "test 005",
    shortName: "TTIV",
    latitude: 41.9636,
    longitude: 12.7984,
    altitude: 235,
    role: Protobuf.Config.Config_DeviceConfig_Role.ROUTER,
    hwModel: Protobuf.Mesh.HardwareModel.HELTEC_V3,
    batteryLevel: 58,
    voltage: 3.82,
    firmwareVersion: "2.7.21-demo-tivoli",
    obstructionDb: 6,
    temperatureC: 25.6,
    humidity: 50,
    powerChannelVoltage: 24.2,
    powerChannelCurrent: 84,
  },
  {
    num: 9001006,
    longName: "test 006",
    shortName: "TCMP",
    latitude: 41.8008,
    longitude: 12.6002,
    altitude: 124,
    role: Protobuf.Config.Config_DeviceConfig_Role.CLIENT_MUTE,
    hwModel: Protobuf.Mesh.HardwareModel.TLORA_T3_S3,
    batteryLevel: 46,
    voltage: 3.73,
    firmwareVersion: "2.7.20-demo-ciampino",
    obstructionDb: 9,
    temperatureC: 29.3,
    humidity: 49,
    isUnmessageable: true,
  },
  {
    num: 9001007,
    longName: "test 007",
    shortName: "TMTR",
    latitude: 42.0521,
    longitude: 12.6197,
    altitude: 165,
    role: Protobuf.Config.Config_DeviceConfig_Role.CLIENT_BASE,
    hwModel: Protobuf.Mesh.HardwareModel.HELTEC_V3,
    batteryLevel: 92,
    voltage: 4.17,
    firmwareVersion: "2.7.21-demo-monterotondo",
    obstructionDb: 8,
    temperatureC: 23.9,
    humidity: 51,
    powerChannelVoltage: 48.0,
    powerChannelCurrent: 32,
    viaMqtt: true,
  },
  {
    num: 9001008,
    longName: "test 008",
    shortName: "TBRC",
    latitude: 42.1024,
    longitude: 12.176,
    altitude: 280,
    role: Protobuf.Config.Config_DeviceConfig_Role.ROUTER,
    hwModel: Protobuf.Mesh.HardwareModel.TLORA_T3_S3,
    batteryLevel: 63,
    voltage: 3.86,
    firmwareVersion: "2.7.21-demo-bracciano",
    obstructionDb: 9,
    temperatureC: 22.4,
    humidity: 57,
    powerChannelVoltage: 12.5,
    powerChannelCurrent: 96,
    isFavorite: true,
  },
  {
    num: 9001009,
    longName: "test 009",
    shortName: "TPMZ",
    latitude: 41.6695,
    longitude: 12.5013,
    altitude: 108,
    role: Protobuf.Config.Config_DeviceConfig_Role.CLIENT,
    hwModel: Protobuf.Mesh.HardwareModel.HELTEC_V3,
    batteryLevel: 71,
    voltage: 3.95,
    firmwareVersion: "2.7.20-demo-pomezia",
    obstructionDb: 10,
    temperatureC: 28.2,
    humidity: 58,
  },
  {
    num: 9001010,
    longName: "test 010",
    shortName: "TVLT",
    latitude: 41.6886,
    longitude: 12.7776,
    altitude: 332,
    role: Protobuf.Config.Config_DeviceConfig_Role.ROUTER,
    hwModel: Protobuf.Mesh.HardwareModel.TLORA_T3_S3,
    batteryLevel: 54,
    voltage: 3.79,
    firmwareVersion: "2.7.21-demo-velletri",
    obstructionDb: 7,
    temperatureC: 24.8,
    humidity: 54,
    powerChannelVoltage: 12.0,
    powerChannelCurrent: 76,
    viaMqtt: true,
  },
];

const demoReplyTimers = new Map<string, number>();

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

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

function formatNodeId(nodeNum: number): string {
  return `!${nodeNum.toString(16).toUpperCase()}`;
}

function createPosition(latitude: number, longitude: number, altitude = 0) {
  return create(
    Protobuf.Mesh.PositionSchema,
    normalizePosition({
      latitudeI: Math.round(latitude * 1e7),
      longitudeI: Math.round(longitude * 1e7),
      altitude,
    }),
  );
}

function distanceKm(
  left: Pick<DemoNodeBlueprint, "latitude" | "longitude">,
  right: Pick<DemoNodeBlueprint, "latitude" | "longitude">,
): number {
  const earthRadiusKm = 6371;
  const dLat = ((right.latitude - left.latitude) * Math.PI) / 180;
  const dLon = ((right.longitude - left.longitude) * Math.PI) / 180;
  const lat1 = (left.latitude * Math.PI) / 180;
  const lat2 = (right.latitude * Math.PI) / 180;
  const haversine =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(haversine));
}

function calculateLinkMetrics(from: DemoNodeBlueprint, to: DemoNodeBlueprint): LinkMetrics {
  const distance = Math.max(0.35, distanceKm(from, to));
  const freeSpaceLossDb = 32.44 + 20 * Math.log10(distance) + 20 * Math.log10(DEMO_FREQ_MHZ);
  const obstructionDb =
    8 + Math.min(12, distance * 0.45) + ((from.obstructionDb ?? 0) + (to.obstructionDb ?? 0)) / 2;
  const rxRssi = clamp(
    DEMO_TX_POWER_DBM + 2 * DEMO_ANTENNA_GAIN_DB - freeSpaceLossDb - obstructionDb,
    -126,
    -78,
  );
  const noiseFloorDbm = -174 + 10 * Math.log10(DEMO_BANDWIDTH_HZ) + DEMO_NOISE_FIGURE_DB;
  const snr = clamp(rxRssi - noiseFloorDbm, -20, 12);
  const hopsAway = rxRssi >= -109 && snr >= 6 ? 1 : rxRssi >= -117 && snr >= -2 ? 2 : 3;

  return {
    distanceKm: Number(distance.toFixed(2)),
    rxRssi: Number(rxRssi.toFixed(1)),
    snr: Number(snr.toFixed(1)),
    hopsAway,
  };
}

function createDemoNode(
  blueprint: DemoNodeBlueprint,
  link: LinkMetrics,
  lastHeard: number,
): Protobuf.Mesh.NodeInfo {
  const privateKey = createPrivateKey(`${blueprint.longName}-pki`);
  const publicKey = getX25519PublicKey(privateKey);

  return create(Protobuf.Mesh.NodeInfoSchema, {
    num: blueprint.num,
    lastHeard,
    hopsAway: blueprint.num === DEMO_MY_NODE_NUM ? 0 : link.hopsAway,
    snr: blueprint.num === DEMO_MY_NODE_NUM ? 11.5 : link.snr,
    viaMqtt: blueprint.viaMqtt,
    isFavorite: blueprint.isFavorite,
    user: create(Protobuf.Mesh.UserSchema, {
      id: formatNodeId(blueprint.num),
      longName: blueprint.longName,
      shortName: blueprint.shortName,
      role: blueprint.role,
      hwModel: blueprint.hwModel,
      publicKey,
      isLicensed: blueprint.isLicensed,
      isUnmessagable: blueprint.isUnmessageable,
    }),
    position: createPosition(blueprint.latitude, blueprint.longitude, blueprint.altitude),
    deviceMetrics: create(Protobuf.Telemetry.DeviceMetricsSchema, {
      batteryLevel: blueprint.batteryLevel,
      voltage: blueprint.voltage,
    }),
  });
}

function addDeviceMetrics(
  deviceId: number,
  nodeNum: number,
  lastHeard: number,
  snr: number,
  batteryLevel: number,
  voltage: number,
): void {
  const nodeDB = useNodeDBStore.getState().getNodeDB(deviceId);
  if (!nodeDB) {
    return;
  }

  nodeDB.addTelemetry({
    from: nodeNum,
    rxTime: new Date(lastHeard * 1000),
    rxSnr: snr,
    data: create(Protobuf.Telemetry.TelemetrySchema, {
      variant: {
        case: "deviceMetrics",
        value: create(Protobuf.Telemetry.DeviceMetricsSchema, {
          batteryLevel,
          voltage,
        }),
      },
    }),
  } as never);
}

function addPowerMetrics(
  deviceId: number,
  nodeNum: number,
  lastHeard: number,
  snr: number,
  voltage: number,
  current: number,
): void {
  const nodeDB = useNodeDBStore.getState().getNodeDB(deviceId);
  if (!nodeDB) {
    return;
  }

  nodeDB.addTelemetry({
    from: nodeNum,
    rxTime: new Date(lastHeard * 1000),
    rxSnr: snr,
    data: create(Protobuf.Telemetry.TelemetrySchema, {
      variant: {
        case: "powerMetrics",
        value: create(Protobuf.Telemetry.PowerMetricsSchema, {
          ch1Voltage: voltage,
          ch1Current: current,
        }),
      },
    }),
  } as never);
}

function addEnvironmentMetrics(
  deviceId: number,
  nodeNum: number,
  lastHeard: number,
  snr: number,
  temperature: number,
  humidity: number,
): void {
  const nodeDB = useNodeDBStore.getState().getNodeDB(deviceId);
  if (!nodeDB) {
    return;
  }

  nodeDB.addTelemetry({
    from: nodeNum,
    rxTime: new Date(lastHeard * 1000),
    rxSnr: snr,
    data: create(Protobuf.Telemetry.TelemetrySchema, {
      variant: {
        case: "environmentMetrics",
        value: create(Protobuf.Telemetry.EnvironmentMetricsSchema, {
          temperature,
          relativeHumidity: humidity,
        }),
      },
    }),
  } as never);
}

function createMetadata(
  firmwareVersion: string,
  overrides: Partial<Protobuf.Mesh.DeviceMetadata> = {},
): Protobuf.Mesh.DeviceMetadata {
  return create(Protobuf.Mesh.DeviceMetadataSchema, {
    firmwareVersion,
    hasBluetooth: true,
    hasWifi: true,
    hasEthernet: true,
    excludedModules: 0,
    ...overrides,
  });
}

export function isDemoDevice(deviceId: number): boolean {
  return deviceId === DEMO_DEVICE_ID;
}

function getAllDemoBlueprints(): DemoNodeBlueprint[] {
  return [DEMO_HUB_BLUEPRINT, ...DEMO_NODE_BLUEPRINTS];
}

function findDemoBlueprint(nodeNum: number): DemoNodeBlueprint | undefined {
  return getAllDemoBlueprints().find((blueprint) => blueprint.num === nodeNum);
}

function createDemoTextMessage(params: {
  type: MessageType;
  from: number;
  to: number;
  channel: Types.ChannelNumber;
  message: string;
  state: MessageState;
  date?: number;
  messageId?: number;
  replyId?: number;
  hopsAway?: number;
  compressed?: boolean;
}): Message {
  return {
    type: params.type,
    from: params.from,
    to: params.to,
    channel: params.channel,
    date: params.date ?? Date.now(),
    messageId: params.messageId ?? randId(),
    state: params.state,
    message: params.message,
    replyId: params.replyId,
    hopsAway: params.hopsAway,
    compressed: params.compressed,
  };
}

function ensureDemoMessageStore(deviceId: number) {
  const state = useMessageStore.getState();
  return state.getMessageStore(deviceId) ?? state.addMessageStore(deviceId);
}

function ensureDemoMessagesSeeded(deviceId: number): void {
  if (!isDemoDevice(deviceId)) {
    return;
  }

  const store = ensureDemoMessageStore(deviceId);
  store.setNodeNum(DEMO_MY_NODE_NUM);

  const directConversation = store.messages.direct.get(
    getConversationId(DEMO_MY_NODE_NUM, DEMO_BOT_NODE_NUM),
  );
  if (!directConversation || directConversation.size === 0) {
    store.saveMessage(
      createDemoTextMessage({
        type: MessageType.Direct,
        from: DEMO_BOT_NODE_NUM,
        to: DEMO_MY_NODE_NUM,
        channel: Types.ChannelNumber.Primary,
        message:
          "Ciao, sono DarkMesh Bot. Posso rispondere su radio, nodi vicini, posizioni e routing della demo.",
        state: MessageState.Received,
        date: Date.now() - 7 * 60_000,
        messageId: 910001,
        hopsAway: 1,
      }),
    );
    store.saveMessage(
      createDemoTextMessage({
        type: MessageType.Direct,
        from: DEMO_MY_NODE_NUM,
        to: DEMO_BOT_NODE_NUM,
        channel: Types.ChannelNumber.Primary,
        message: "Stato rete demo?",
        state: MessageState.Delivered,
        date: Date.now() - 6 * 60_000,
        messageId: 910002,
        hopsAway: 1,
      }),
    );
    store.saveMessage(
      createDemoTextMessage({
        type: MessageType.Direct,
        from: DEMO_BOT_NODE_NUM,
        to: DEMO_MY_NODE_NUM,
        channel: Types.ChannelNumber.Primary,
        message:
          "Rete demo attiva: 11 nodi visibili, 3 relay principali e 1 gateway con confidenza alta.",
        state: MessageState.Received,
        date: Date.now() - 5 * 60_000,
        messageId: 910003,
        hopsAway: 1,
      }),
    );
  }

  const broadcastLog = store.messages.broadcast.get(Types.ChannelNumber.Primary);
  if (!broadcastLog || broadcastLog.size === 0) {
    store.saveMessage(
      createDemoTextMessage({
        type: MessageType.Broadcast,
        from: DEMO_BOT_NODE_NUM,
        to: 0xffffffff,
        channel: Types.ChannelNumber.Primary,
        message:
          "DarkMesh Bot online sul canale principale. Scrivi 'bot status' o apri una chat diretta con me.",
        state: MessageState.Received,
        date: Date.now() - 4 * 60_000,
        messageId: 910101,
        hopsAway: 1,
      }),
    );
  }
}

function buildDemoBotReply(message: string, chatType: MessageType, chatId: number): string {
  const normalized = message.trim().toLowerCase();

  if (normalized.includes("status") || normalized.includes("stato")) {
    return "Stato demo: gateway operativo, link primario a 868 MHz, traffico contenuto e nodi mobili allineati su Roma e provincia.";
  }

  if (normalized.includes("map") || normalized.includes("mappa")) {
    return "Apri la mappa per vedere i relay tra Roma centro, Tivoli, Bracciano e Velletri. I tracciati SNR sono gia' simulati.";
  }

  if (normalized.includes("neighbor") || normalized.includes("vicin")) {
    return "Per ogni nodo demo posso mostrare i 4 vicini migliori con SNR coerente al link budget calcolato.";
  }

  if (normalized.includes("radio") || normalized.includes("snr") || normalized.includes("rssi")) {
    return "I dati radio della demo usano una stima a 868 MHz con perdita di spazio libero e attenuazione urbana semplificata.";
  }

  if (chatType === MessageType.Broadcast || normalized.includes("ciao")) {
    return `Ricevuto su ${chatType === MessageType.Broadcast ? `canale ${chatId}` : "chat diretta"}. Posso rispondere su routing, nodi, posizione e radio.`;
  }

  return "Messaggio ricevuto. Prova con: stato rete, mappa, neighbor, radio o chiedimi un nodo specifico della demo.";
}

function clearDemoReplyTimer(key: string): void {
  const existing = demoReplyTimers.get(key);
  if (existing !== undefined && typeof window !== "undefined") {
    window.clearTimeout(existing);
  }
  demoReplyTimers.delete(key);
}

function scheduleDemoBotReply(params: {
  deviceId: number;
  chatType: MessageType;
  chatId: number;
  message: string;
  replyTo?: number;
}): void {
  if (typeof window === "undefined") {
    return;
  }

  const key = `${params.deviceId}:${params.chatType}:${params.chatId}`;
  clearDemoReplyTimer(key);

  const timeoutId = window.setTimeout(() => {
    ensureDemoMessagesSeeded(params.deviceId);
    const store = ensureDemoMessageStore(params.deviceId);
    const device = useDeviceStore.getState().getDevice(params.deviceId);
    if (!device) {
      demoReplyTimers.delete(key);
      return;
    }

    const response = createDemoTextMessage({
      type: params.chatType,
      from: DEMO_BOT_NODE_NUM,
      to: params.chatType === MessageType.Direct ? DEMO_MY_NODE_NUM : 0xffffffff,
      channel:
        params.chatType === MessageType.Direct
          ? Types.ChannelNumber.Primary
          : (params.chatId as Types.ChannelNumber),
      message: buildDemoBotReply(params.message, params.chatType, params.chatId),
      state: MessageState.Received,
      replyId: params.replyTo,
      hopsAway: 1,
    });

    store.saveMessage(response);
    demoReplyTimers.delete(key);
  }, 900);

  demoReplyTimers.set(key, timeoutId);
}

export function simulateDemoNodeInfo(deviceId: number, nodeNum: number) {
  if (!isDemoDevice(deviceId)) {
    return undefined;
  }

  const existingDevice = useDeviceStore.getState().getDevice(deviceId);
  const existingNodeDb = useNodeDBStore.getState().getNodeDB(deviceId);
  if (!existingDevice || !existingNodeDb) {
    ensureDemoNodeSimulatorSeeded(deviceId);
  }
  const node = useNodeDBStore.getState().getNodeDB(deviceId)?.getNode(nodeNum);
  const metadata = useDeviceStore.getState().getDevice(deviceId)?.metadata.get(nodeNum);
  return node ? { node, metadata } : undefined;
}

export function simulateDemoPositionPacket(
  deviceId: number,
  nodeNum: number,
): Types.PacketMetadata<Protobuf.Mesh.Position> | undefined {
  if (!isDemoDevice(deviceId)) {
    return undefined;
  }

  const existingDevice = useDeviceStore.getState().getDevice(deviceId);
  const existingNodeDb = useNodeDBStore.getState().getNodeDB(deviceId);
  if (!existingDevice || !existingNodeDb) {
    ensureDemoNodeSimulatorSeeded(deviceId);
  }
  const node = useNodeDBStore.getState().getNodeDB(deviceId)?.getNode(nodeNum);
  if (!node?.position) {
    return undefined;
  }

  return {
    id: randId(),
    from: nodeNum,
    to: DEMO_MY_NODE_NUM,
    rxTime: new Date(),
    type: "direct",
    channel: Types.ChannelNumber.Primary,
    data: node.position,
  } as never;
}

export function simulateDemoNeighborInfo(
  deviceId: number,
  nodeNum: number,
): Protobuf.Mesh.NeighborInfo | undefined {
  if (!isDemoDevice(deviceId)) {
    return undefined;
  }

  const existingDevice = useDeviceStore.getState().getDevice(deviceId);
  const existingNodeDb = useNodeDBStore.getState().getNodeDB(deviceId);
  if (!existingDevice || !existingNodeDb) {
    ensureDemoNodeSimulatorSeeded(deviceId);
  }
  return useDeviceStore.getState().getDevice(deviceId)?.getNeighborInfo(nodeNum);
}

export function simulateDemoEnvironmentMetrics(
  deviceId: number,
  nodeNum: number,
): Protobuf.Telemetry.EnvironmentMetrics | undefined {
  if (!isDemoDevice(deviceId)) {
    return undefined;
  }

  const existingDevice = useDeviceStore.getState().getDevice(deviceId);
  const existingNodeDb = useNodeDBStore.getState().getNodeDB(deviceId);
  if (!existingDevice || !existingNodeDb) {
    ensureDemoNodeSimulatorSeeded(deviceId);
  }
  return useNodeDBStore.getState().getNodeDB(deviceId)?.getEnvironmentMetrics(nodeNum);
}

export function simulateDemoPowerMetrics(
  deviceId: number,
  nodeNum: number,
): Protobuf.Telemetry.PowerMetrics | undefined {
  if (!isDemoDevice(deviceId)) {
    return undefined;
  }

  const existingDevice = useDeviceStore.getState().getDevice(deviceId);
  const existingNodeDb = useNodeDBStore.getState().getNodeDB(deviceId);
  if (!existingDevice || !existingNodeDb) {
    ensureDemoNodeSimulatorSeeded(deviceId);
  }
  return useNodeDBStore.getState().getNodeDB(deviceId)?.getPowerMetrics(nodeNum);
}

function getDemoRelayPath(nodeNum: number): number[] {
  const target = findDemoBlueprint(nodeNum);
  if (!target || nodeNum === DEMO_MY_NODE_NUM) {
    return [];
  }

  const allRouters = DEMO_NODE_BLUEPRINTS.filter(
    (candidate) =>
      candidate.num !== nodeNum &&
      candidate.role !== Protobuf.Config.Config_DeviceConfig_Role.CLIENT &&
      candidate.role !== Protobuf.Config.Config_DeviceConfig_Role.CLIENT_MUTE,
  );

  const targetLink = calculateLinkMetrics(DEMO_HUB_BLUEPRINT, target);
  const relayCandidates = allRouters
    .map((candidate) => ({
      candidate,
      score:
        calculateLinkMetrics(DEMO_HUB_BLUEPRINT, candidate).snr +
        calculateLinkMetrics(candidate, target).snr,
    }))
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.candidate.num);

  if (targetLink.hopsAway <= 1) {
    return [];
  }

  if (targetLink.hopsAway === 2) {
    return relayCandidates.slice(0, 1);
  }

  return relayCandidates.slice(0, 2);
}

export function simulateDemoTraceroute(
  deviceId: number,
  nodeNum: number,
): Types.PacketMetadata<Protobuf.Mesh.RouteDiscovery> | undefined {
  if (!isDemoDevice(deviceId)) {
    return undefined;
  }

  const existingDevice = useDeviceStore.getState().getDevice(deviceId);
  const existingNodeDb = useNodeDBStore.getState().getNodeDB(deviceId);
  if (!existingDevice || !existingNodeDb) {
    ensureDemoNodeSimulatorSeeded(deviceId);
  }
  const target = findDemoBlueprint(nodeNum);
  if (!target) {
    return undefined;
  }

  const route = getDemoRelayPath(nodeNum);
  const routeBack = [...route].reverse();
  const forwardNodes = [DEMO_MY_NODE_NUM, ...route, nodeNum]
    .map((num) => findDemoBlueprint(num))
    .filter((value): value is DemoNodeBlueprint => value !== undefined);
  const backwardNodes = [nodeNum, ...routeBack, DEMO_MY_NODE_NUM]
    .map((num) => findDemoBlueprint(num))
    .filter((value): value is DemoNodeBlueprint => value !== undefined);
  const snrTowards = forwardNodes.slice(0, -1).map((fromNode, index) => {
    const nextNode = forwardNodes[index + 1];
    return Math.round(calculateLinkMetrics(fromNode, nextNode).snr * 4);
  });
  const snrBack = backwardNodes.slice(0, -1).map((fromNode, index) => {
    const nextNode = backwardNodes[index + 1];
    return Math.round(calculateLinkMetrics(fromNode, nextNode).snr * 4);
  });

  return {
    id: randId(),
    from: nodeNum,
    to: DEMO_MY_NODE_NUM,
    rxTime: new Date(),
    portnum: Protobuf.Portnums.PortNum.ROUTING_APP,
    data: create(Protobuf.Mesh.RouteDiscoverySchema, {
      route,
      routeBack,
      snrTowards,
      snrBack,
    }),
    durationMs: 1200 + route.length * 450,
  } as never;
}

export async function sendDemoMessage(params: {
  deviceId: number;
  chatType: MessageType;
  chatId: number;
  message: string;
  replyId?: number;
  compressed?: boolean;
}): Promise<number> {
  if (!isDemoDevice(params.deviceId)) {
    throw new Error("Demo messaging is not available for this device");
  }

  ensureDemoNodeSimulatorSeeded(params.deviceId);
  ensureDemoMessagesSeeded(params.deviceId);

  const store = ensureDemoMessageStore(params.deviceId);
  const outgoingId = randId();
  store.saveMessage(
    createDemoTextMessage({
      type: params.chatType,
      from: DEMO_MY_NODE_NUM,
      to: params.chatType === MessageType.Direct ? params.chatId : 0xffffffff,
      channel:
        params.chatType === MessageType.Direct
          ? Types.ChannelNumber.Primary
          : (params.chatId as Types.ChannelNumber),
      message: params.message,
      state: MessageState.Delivered,
      messageId: outgoingId,
      replyId: params.replyId,
      compressed: params.compressed,
      hopsAway: params.chatType === MessageType.Direct ? 1 : 0,
    }),
  );

  if (
    params.chatType === MessageType.Direct
      ? params.chatId === DEMO_BOT_NODE_NUM
      : params.chatId === Types.ChannelNumber.Primary
  ) {
    scheduleDemoBotReply({
      deviceId: params.deviceId,
      chatType: params.chatType,
      chatId: params.chatId,
      message: params.message,
      replyTo: outgoingId,
    });
  }

  return outgoingId;
}

function seedDeviceConfig(deviceId: number): void {
  const device = useDeviceStore.getState().getDevice(deviceId);
  if (!device) {
    return;
  }

  const hubPrivateKey = createPrivateKey("roma-hub-security");
  const hubPublicKey = getX25519PublicKey(hubPrivateKey);

  device.setStatus(Types.DeviceStatusEnum.DeviceConnected);
  device.setConnectionPhase("configured");
  device.clearAllChanges();

  device.setConfig(
    create(Protobuf.Config.ConfigSchema, {
      payloadVariant: {
        case: "device",
        value: create(Protobuf.Config.Config_DeviceConfigSchema, {
          role: Protobuf.Config.Config_DeviceConfig_Role.ROUTER,
          serialEnabled: true,
          buttonGpio: 0,
          buzzerGpio: 33,
          rebroadcastMode: Protobuf.Config.Config_DeviceConfig_RebroadcastMode.ALL,
          nodeInfoBroadcastSecs: 900,
          doubleTapAsButtonPress: true,
          isManaged: true,
          disableTripleClick: false,
          ledHeartbeatDisabled: false,
          tzdef: "CET-1CEST,M3.5.0,M10.5.0/3",
        }),
      },
    }),
  );

  device.setConfig(
    create(Protobuf.Config.ConfigSchema, {
      payloadVariant: {
        case: "lora",
        value: create(Protobuf.Config.Config_LoRaConfigSchema, {
          usePreset: true,
          modemPreset: Protobuf.Config.Config_LoRaConfig_ModemPreset.LONG_FAST,
          bandwidth: 250,
          spreadFactor: 11,
          codingRate: 5,
          frequencyOffset: 0,
          region: Protobuf.Config.Config_LoRaConfig_RegionCode.EU_868,
          hopLimit: 3,
          txEnabled: true,
          txPower: DEMO_TX_POWER_DBM,
          channelNum: 0,
          overrideDutyCycle: false,
          sx126xRxBoostedGain: true,
          overrideFrequency: 0,
          ignoreIncoming: [],
          ignoreMqtt: false,
          configOkToMqtt: true,
        }),
      },
    }),
  );

  device.setConfig(
    create(Protobuf.Config.ConfigSchema, {
      payloadVariant: {
        case: "power",
        value: create(Protobuf.Config.Config_PowerConfigSchema, {
          isPowerSaving: false,
        }),
      },
    }),
  );

  device.setConfig(
    create(Protobuf.Config.ConfigSchema, {
      payloadVariant: {
        case: "position",
        value: create(Protobuf.Config.Config_PositionConfigSchema, {
          fixedPosition: true,
        }),
      },
    }),
  );

  device.setConfig(
    create(Protobuf.Config.ConfigSchema, {
      payloadVariant: {
        case: "security",
        value: create(Protobuf.Config.Config_SecurityConfigSchema, {
          isManaged: true,
          adminChannelEnabled: true,
          debugLogApiEnabled: true,
          serialEnabled: true,
          privateKey: hubPrivateKey,
          publicKey: hubPublicKey,
          adminKey: [
            encodeSeedBytes("roma-admin-primary"),
            encodeSeedBytes("roma-admin-secondary"),
            encodeSeedBytes("roma-admin-tertiary"),
          ],
        }),
      },
    }),
  );

  device.setModuleConfig(
    create(Protobuf.ModuleConfig.ModuleConfigSchema, {
      payloadVariant: {
        case: "telemetry",
        value: create(Protobuf.ModuleConfig.ModuleConfig_TelemetryConfigSchema, {
          deviceTelemetryEnabled: true,
          deviceUpdateInterval: 300,
          environmentUpdateInterval: 900,
          environmentMeasurementEnabled: true,
          environmentScreenEnabled: true,
          environmentDisplayFahrenheit: false,
          airQualityEnabled: true,
          airQualityInterval: 1800,
          powerMeasurementEnabled: true,
          powerUpdateInterval: 600,
          powerScreenEnabled: true,
        }),
      },
    }),
  );

  device.setModuleConfig(
    create(Protobuf.ModuleConfig.ModuleConfigSchema, {
      payloadVariant: {
        case: "neighborInfo",
        value: create(Protobuf.ModuleConfig.ModuleConfig_NeighborInfoConfigSchema, {
          enabled: true,
          transmitOverLora: true,
          updateInterval: 600,
        }),
      },
    }),
  );
}

export function ensureDemoNodeSimulatorSeeded(deviceId = DEMO_DEVICE_ID): void {
  const deviceState = useDeviceStore.getState();
  const nodeState = useNodeDBStore.getState();
  const darkMeshState = useDarkMeshStore.getState();
  const existingDevice = deviceState.getDevice(deviceId);
  const existingNodeDB = nodeState.getNodeDB(deviceId);
  const allBlueprints = [DEMO_HUB_BLUEPRINT, ...DEMO_NODE_BLUEPRINTS];

  const existingHub = existingNodeDB?.getNode(DEMO_MY_NODE_NUM);
  const existingPeers =
    existingNodeDB?.getNodes((node) => node.user?.longName?.startsWith("test ") === true, true) ??
    [];
  const existingMetadataVersion = existingDevice?.metadata.get(0)?.firmwareVersion;
  const existingSecurityKeyLength = existingDevice?.config.security?.privateKey?.length ?? 0;

  if (
    existingHub?.user?.longName === DEMO_HUB_NAME &&
    existingPeers.length >= DEMO_NODE_BLUEPRINTS.length &&
    existingMetadataVersion === DEMO_PROFILE_VERSION &&
    existingSecurityKeyLength === 32
  ) {
    return;
  }

  const nowSec = Math.floor(Date.now() / 1000);

  if (existingDevice) {
    deviceState.removeDevice(deviceId);
  }
  if (existingNodeDB) {
    nodeState.removeNodeDB(deviceId);
  }

  const device = useDeviceStore.getState().addDevice(deviceId);
  const nodeDB = useNodeDBStore.getState().addNodeDB(deviceId);

  nodeDB.setNodeNum(DEMO_MY_NODE_NUM);

  seedDeviceConfig(deviceId);

  const hubLink: LinkMetrics = {
    distanceKm: 0,
    rxRssi: -84,
    snr: 11.5,
    hopsAway: 0,
  };

  const linkMap = new Map<number, LinkMetrics>([[DEMO_MY_NODE_NUM, hubLink]]);
  for (const blueprint of DEMO_NODE_BLUEPRINTS) {
    linkMap.set(blueprint.num, calculateLinkMetrics(DEMO_HUB_BLUEPRINT, blueprint));
  }

  allBlueprints.forEach((blueprint, index) => {
    const link = linkMap.get(blueprint.num) ?? hubLink;
    const lastHeard = nowSec - index * 47;
    nodeDB.addNode(createDemoNode(blueprint, link, lastHeard));
    addDeviceMetrics(
      deviceId,
      blueprint.num,
      lastHeard,
      link.snr,
      blueprint.batteryLevel,
      blueprint.voltage,
    );
    nodeDB.processPacket({
      from: blueprint.num,
      time: lastHeard,
      snr: link.snr,
      rxRssi: link.rxRssi,
    } as never);

    if (
      blueprint.powerChannelVoltage !== undefined &&
      blueprint.powerChannelCurrent !== undefined
    ) {
      addPowerMetrics(
        deviceId,
        blueprint.num,
        lastHeard,
        link.snr,
        blueprint.powerChannelVoltage,
        blueprint.powerChannelCurrent,
      );
    }

    if (blueprint.temperatureC !== undefined && blueprint.humidity !== undefined) {
      addEnvironmentMetrics(
        deviceId,
        blueprint.num,
        lastHeard,
        link.snr,
        blueprint.temperatureC,
        blueprint.humidity,
      );
    }

    device.addMetadata(
      blueprint.num,
      createMetadata(blueprint.firmwareVersion, {
        hasBluetooth: blueprint.num === DEMO_MY_NODE_NUM,
        hasWifi: blueprint.num === DEMO_MY_NODE_NUM || blueprint.viaMqtt === true,
        hasEthernet: blueprint.num === DEMO_MY_NODE_NUM,
      }),
    );
  });

  device.addMetadata(0, createMetadata(DEMO_PROFILE_VERSION));
  device.setHardware(create(Protobuf.Mesh.MyNodeInfoSchema, { myNodeNum: DEMO_MY_NODE_NUM }));

  [
    {
      index: 0,
      role: Protobuf.Channel.Channel_Role.PRIMARY,
      name: "Roma Mesh",
      seed: "roma-mesh-primary",
    },
    {
      index: 1,
      role: Protobuf.Channel.Channel_Role.SECONDARY,
      name: "Ops Lazio",
      seed: "roma-mesh-ops",
    },
    {
      index: 2,
      role: Protobuf.Channel.Channel_Role.SECONDARY,
      name: "Civic Relay",
      seed: "roma-mesh-civic",
    },
  ].forEach((channel) => {
    device.addChannel(
      create(Protobuf.Channel.ChannelSchema, {
        index: channel.index,
        role: channel.role,
        settings: {
          name: channel.name,
          psk: encodeSeedBytes(channel.seed),
        },
      }),
    );
  });

  allBlueprints.forEach((sourceBlueprint) => {
    const neighbors = allBlueprints
      .filter((candidate) => candidate.num !== sourceBlueprint.num)
      .map((candidate) => {
        const metrics = calculateLinkMetrics(sourceBlueprint, candidate);
        return {
          nodeId: candidate.num,
          snr: metrics.snr,
          distanceKm: metrics.distanceKm,
        };
      })
      .filter((candidate) => candidate.snr >= -9)
      .sort((left, right) => right.snr - left.snr)
      .slice(0, 4);

    device.addNeighborInfo(
      sourceBlueprint.num,
      create(Protobuf.Mesh.NeighborInfoSchema, {
        nodeId: sourceBlueprint.num,
        lastSentById: DEMO_MY_NODE_NUM,
        neighbors: neighbors.map((neighbor) => ({
          nodeId: neighbor.nodeId,
          snr: neighbor.snr,
        })),
      }),
    );
  });

  darkMeshState.setGateway(deviceId, {
    nodeNum: DEMO_MY_NODE_NUM,
    nodeName: DEMO_HUB_NAME,
    source: "direct",
    confidence: 0.96,
    observedAt: Date.now(),
    rxSnr: hubLink.snr,
    rxRssi: hubLink.rxRssi,
    deviceMetrics: create(Protobuf.Telemetry.DeviceMetricsSchema, {
      batteryLevel: DEMO_HUB_BLUEPRINT.batteryLevel,
      voltage: DEMO_HUB_BLUEPRINT.voltage,
    }),
  });

  ensureDemoMessagesSeeded(deviceId);
}
