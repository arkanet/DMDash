import { useConfigTarget } from "@core/hooks/useConfigTarget.tsx";
import { type ValidConfigType, type ValidModuleConfigType } from "@core/stores";

type UseWaitForConfigProps =
  | { configCase: ValidConfigType; moduleConfigCase?: never }
  | { configCase?: never; moduleConfigCase: ValidModuleConfigType };

export function useWaitForConfig({ configCase, moduleConfigCase }: UseWaitForConfigProps): void {
  const { config, moduleConfig } = useConfigTarget();

  const isDataDefined = configCase
    ? config[configCase] !== undefined
    : moduleConfig[moduleConfigCase as ValidModuleConfigType] !== undefined;

  if (!isDataDefined) {
    throw new Promise<void>(() => {});
  }
}
