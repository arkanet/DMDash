import { createContext, useContext } from "react";
import { useDevice, type Device } from "@core/stores";

type ConfigTargetBase = Pick<
  Device,
  | "config"
  | "moduleConfig"
  | "channels"
  | "hardware"
  | "connection"
  | "setConfig"
  | "setModuleConfig"
  | "addChannel"
  | "setDialogOpen"
  | "setChange"
  | "removeChange"
  | "getChange"
  | "clearAllChanges"
  | "hasConfigChange"
  | "hasModuleConfigChange"
  | "hasChannelChange"
  | "hasUserChange"
  | "getConfigChangeCount"
  | "getModuleConfigChangeCount"
  | "getChannelChangeCount"
  | "getEffectiveConfig"
  | "getEffectiveModuleConfig"
  | "getAllConfigChanges"
  | "getAllModuleConfigChanges"
  | "getAllChannelChanges"
  | "queueAdminMessage"
  | "getAllQueuedAdminMessages"
  | "getAdminMessageChangeCount"
>;

export type ConfigTarget = ConfigTargetBase & {
  isRemote: boolean;
  targetNodeNum: number;
};

const ConfigTargetContext = createContext<ConfigTarget | undefined>(undefined);

export const ConfigTargetProvider = ConfigTargetContext.Provider;

export function useConfigTarget(): ConfigTarget {
  const context = useContext(ConfigTargetContext);
  const device = useDevice();

  if (context) {
    return context;
  }

  return {
    ...device,
    isRemote: false,
    targetNodeNum: device.hardware.myNodeNum,
  };
}
