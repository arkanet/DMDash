import { Button } from "@components/UI/Button.tsx";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@components/UI/Dialog.tsx";
import { useDevice, useNodeDB } from "@core/stores";
import { getNodeLongName, getNodeShortName } from "@app/darkmesh/utils.ts";
import { LockKeyholeOpenIcon } from "lucide-react";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useRefreshKeysDialog } from "./useRefreshKeysDialog.ts";

export interface RefreshKeysDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const RefreshKeysDialog = ({ open, onOpenChange }: RefreshKeysDialogProps) => {
  const { t } = useTranslation("dialog");
  const { refreshKeysNodeNum } = useDevice();
  const { getNodeError, getNode } = useNodeDB();

  const { handleCloseDialog, handleNodeRemove } = useRefreshKeysDialog();
  const handleDialogOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        onOpenChange(nextOpen);
        return;
      }

      handleCloseDialog();
    },
    [handleCloseDialog, onOpenChange],
  );

  if (refreshKeysNodeNum === undefined) {
    return null;
  }

  const nodeErrorNum = getNodeError(refreshKeysNodeNum);

  if (!nodeErrorNum) {
    return null;
  }

  const nodeWithError = getNode(nodeErrorNum.node);

  const text = {
    title: t("refreshKeys.title", {
      interpolation: { escapeValue: false },
      identifier: getNodeLongName(nodeWithError) ?? "",
    }),
    description: `${t("refreshKeys.description.unableToSendDmPrefix")}${
      getNodeLongName(nodeWithError) ?? ""
    } (${getNodeShortName(nodeWithError) ?? ""})${t(
      "refreshKeys.description.keyMismatchReasonSuffix",
    )}`,
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="flex w-[min(92vw,34rem)] max-w-[34rem] flex-col gap-4">
        <DialogClose onClick={handleCloseDialog} />
        <DialogHeader>
          <DialogTitle className="pr-8 break-words">{text.title}</DialogTitle>
        </DialogHeader>
        <DialogDescription className="break-words leading-relaxed">
          {text.description}
        </DialogDescription>
        <ul>
          <li className="flex items-start gap-3 max-sm:flex-col">
            <div className="mt-1 rounded-lg bg-slate-500 p-2">
              <LockKeyholeOpenIcon size={30} className="text-white justify-center" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <div>
                <p className="mb-0.5 font-bold">{t("refreshKeys.label.acceptNewKeys")}</p>
                <p className="break-words">{t("refreshKeys.description.acceptNewKeys")}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="default" name="requestNewKeys" onClick={handleNodeRemove}>
                  {t("button.requestNewKeys")}
                </Button>
                <Button variant="outline" name="dismiss" onClick={handleCloseDialog}>
                  {t("button.dismiss")}
                </Button>
              </div>
            </div>
          </li>
        </ul>
      </DialogContent>
    </Dialog>
  );
};
