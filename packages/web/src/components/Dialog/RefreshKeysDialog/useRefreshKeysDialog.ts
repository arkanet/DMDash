import { useDevice, useNodeDB } from "@core/stores";
import { useCallback } from "react";

export function useRefreshKeysDialog() {
  const { setDialogOpen, refreshKeysNodeNum, setRefreshKeysNodeNum } = useDevice();
  const { removeNode, clearNodeError, getNodeError } = useNodeDB();

  const handleCloseDialog = useCallback(() => {
    setDialogOpen("refreshKeys", false);
    setRefreshKeysNodeNum(undefined);
  }, [setDialogOpen, setRefreshKeysNodeNum]);

  const handleNodeRemove = useCallback(() => {
    if (refreshKeysNodeNum === undefined) {
      handleCloseDialog();
      return;
    }

    const nodeWithError = getNodeError(refreshKeysNodeNum);
    if (!nodeWithError) {
      handleCloseDialog();
      return;
    }
    clearNodeError(refreshKeysNodeNum);
    handleCloseDialog();
    return removeNode(nodeWithError?.node);
  }, [refreshKeysNodeNum, clearNodeError, getNodeError, removeNode, handleCloseDialog]);

  return {
    handleCloseDialog,
    handleNodeRemove,
  };
}
