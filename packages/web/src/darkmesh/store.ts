import type { Protobuf, Types } from "@meshtastic/core";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { DarkMeshChatKind } from "./utils.ts";

export interface ScheduledDarkMeshMessage {
  id: string;
  deviceId: number;
  label: string;
  kind: DarkMeshChatKind;
  destination: number;
  text: string;
  nextRunAt: number;
  recurrence: "once" | "daily" | "weekly";
  createdAt: number;
  lastRunAt?: number;
  lastError?: string;
}

export interface BeaconConfig {
  enabled: boolean;
  label: string;
  kind: DarkMeshChatKind;
  destination: number;
  intervalSeconds: number;
  prefix: string;
  text: string;
  includeName: boolean;
  includeGps: boolean;
  includeTime: boolean;
  lastSentAt?: number;
  lastError?: string;
}

export interface HuntConfig {
  enabled: boolean;
  endpoint: string;
  token: string;
  backgroundMode: "fast" | "medium" | "slow" | "super_slow";
  forwardedCount: number;
  lastForwardAt?: number;
  lastStatus?: string;
  lastError?: string;
}

export interface GatewaySnapshot {
  nodeNum: number;
  nodeName: string;
  source: "direct" | "relay" | "traceroute";
  confidence: number;
  observedAt: number;
  rxSnr?: number;
  rxRssi?: number;
  deviceMetrics?: Protobuf.Telemetry.DeviceMetrics;
}

export type TraceRouteSelection = Types.PacketMetadata<Protobuf.Mesh.RouteDiscovery>;

interface DarkMeshPersistedState {
  schedules: ScheduledDarkMeshMessage[];
  beaconsByDevice: Record<number, BeaconConfig>;
  huntByDevice: Record<number, HuntConfig>;
}

interface DarkMeshState extends DarkMeshPersistedState {
  selectedTraceRoute?: TraceRouteSelection;
  pendingTraceRouteTargetByDevice: Record<number, number | undefined>;
  /** Map deviceId -> packet requestId for pending traceroute requests */
  pendingTraceRouteRequestByDevice: Record<number, number | undefined>;
  gatewaysByDevice: Record<number, GatewaySnapshot | undefined>;
  addSchedule: (
    schedule: Omit<ScheduledDarkMeshMessage, "id" | "createdAt"> & {
      id?: string;
    },
  ) => void;
  removeSchedule: (scheduleId: string) => void;
  markScheduleSent: (scheduleId: string, nextRunAt?: number) => void;
  markScheduleError: (scheduleId: string, message: string) => void;
  upsertBeaconConfig: (deviceId: number, config: BeaconConfig) => void;
  markBeaconSent: (deviceId: number) => void;
  markBeaconError: (deviceId: number, message: string) => void;
  upsertHuntConfig: (deviceId: number, config: HuntConfig) => void;
  markHuntForwarded: (deviceId: number) => void;
  setHuntStatus: (deviceId: number, status: string) => void;
  setHuntError: (deviceId: number, message: string) => void;
  setGateway: (deviceId: number, gateway?: GatewaySnapshot) => void;
  setSelectedTraceRoute: (trace?: TraceRouteSelection) => void;
  setPendingTraceRouteTarget: (deviceId: number, target?: number) => void;
  setPendingTraceRouteRequest: (deviceId: number, requestId?: number) => void;
}

export const defaultBeaconConfig: BeaconConfig = {
  enabled: false,
  label: "Broadcast / Primary",
  kind: "broadcast",
  destination: 0,
  intervalSeconds: 30,
  prefix: "[SOS]",
  text: "",
  includeName: true,
  includeGps: true,
  includeTime: true,
};

export const defaultHuntConfig: HuntConfig = {
  enabled: false,
  endpoint: "https://maps.loracity.it",
  token: "ioL4ath3",
  backgroundMode: "fast",
  forwardedCount: 0,
};

export const useDarkMeshStore = create<DarkMeshState>()(
  persist(
    (set) => ({
      schedules: [],
      beaconsByDevice: {},
      huntByDevice: {},
      selectedTraceRoute: undefined,
      pendingTraceRouteTargetByDevice: {},
      pendingTraceRouteRequestByDevice: {},
      gatewaysByDevice: {},

      addSchedule: (schedule) =>
        set((state) => ({
          schedules: [
            {
              ...schedule,
              id: schedule.id ?? crypto.randomUUID(),
              createdAt: Date.now(),
            },
            ...state.schedules,
          ].sort((left, right) => left.nextRunAt - right.nextRunAt),
        })),

      removeSchedule: (scheduleId) =>
        set((state) => ({
          schedules: state.schedules.filter((schedule) => schedule.id !== scheduleId),
        })),

      markScheduleSent: (scheduleId, nextRunAt) =>
        set((state) => ({
          schedules: nextRunAt
            ? state.schedules.map((schedule) =>
                schedule.id === scheduleId
                  ? {
                      ...schedule,
                      nextRunAt,
                      lastRunAt: Date.now(),
                      lastError: undefined,
                    }
                  : schedule,
              )
            : state.schedules.filter((schedule) => schedule.id !== scheduleId),
        })),

      markScheduleError: (scheduleId, message) =>
        set((state) => ({
          schedules: state.schedules.map((schedule) =>
            schedule.id === scheduleId
              ? {
                  ...schedule,
                  lastError: message,
                }
              : schedule,
          ),
        })),

      upsertBeaconConfig: (deviceId, config) =>
        set((state) => ({
          beaconsByDevice: {
            ...state.beaconsByDevice,
            [deviceId]: config,
          },
        })),

      markBeaconSent: (deviceId) =>
        set((state) => ({
          beaconsByDevice: {
            ...state.beaconsByDevice,
            [deviceId]: {
              ...(state.beaconsByDevice[deviceId] ?? defaultBeaconConfig),
              lastSentAt: Date.now(),
              lastError: undefined,
            },
          },
        })),

      markBeaconError: (deviceId, message) =>
        set((state) => ({
          beaconsByDevice: {
            ...state.beaconsByDevice,
            [deviceId]: {
              ...(state.beaconsByDevice[deviceId] ?? defaultBeaconConfig),
              lastError: message,
            },
          },
        })),

      upsertHuntConfig: (deviceId, config) =>
        set((state) => ({
          huntByDevice: {
            ...state.huntByDevice,
            [deviceId]: config,
          },
        })),

      markHuntForwarded: (deviceId) =>
        set((state) => ({
          huntByDevice: {
            ...state.huntByDevice,
            [deviceId]: {
              ...(state.huntByDevice[deviceId] ?? defaultHuntConfig),
              forwardedCount: (state.huntByDevice[deviceId]?.forwardedCount ?? 0) + 1,
              lastForwardAt: Date.now(),
              lastError: undefined,
              lastStatus: "Forwarded packet to hunting endpoint",
            },
          },
        })),

      setHuntStatus: (deviceId, status) =>
        set((state) => ({
          huntByDevice: {
            ...state.huntByDevice,
            [deviceId]: {
              ...(state.huntByDevice[deviceId] ?? defaultHuntConfig),
              lastStatus: status,
              lastError: undefined,
            },
          },
        })),

      setHuntError: (deviceId, message) =>
        set((state) => ({
          huntByDevice: {
            ...state.huntByDevice,
            [deviceId]: {
              ...(state.huntByDevice[deviceId] ?? defaultHuntConfig),
              lastError: message,
            },
          },
        })),

      setGateway: (deviceId, gateway) =>
        set((state) => ({
          gatewaysByDevice: {
            ...state.gatewaysByDevice,
            [deviceId]: gateway,
          },
        })),

      setSelectedTraceRoute: (trace) =>
        set(() => ({
          selectedTraceRoute: trace,
        })),

      setPendingTraceRouteTarget: (deviceId, target) =>
        set((state) => ({
          pendingTraceRouteTargetByDevice: {
            ...state.pendingTraceRouteTargetByDevice,
            [deviceId]: target,
          },
        })),
      setPendingTraceRouteRequest: (deviceId, requestId) =>
        set((state) => ({
          pendingTraceRouteRequestByDevice: {
            ...state.pendingTraceRouteRequestByDevice,
            [deviceId]: requestId,
          },
        })),
    }),
    {
      name: "darkmesh-dashboard-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state): DarkMeshPersistedState => ({
        schedules: state.schedules,
        beaconsByDevice: state.beaconsByDevice,
        huntByDevice: state.huntByDevice,
      }),
    },
  ),
);
