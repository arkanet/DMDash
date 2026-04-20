import { Label } from "@components/UI/Label.tsx";
import { useAppStore, useDevice, useNodeDB } from "@core/stores";
import { useTranslation } from "react-i18next";
import { getNodeLongName } from "@app/darkmesh/utils.ts";
import { DialogWrapper } from "./DialogWrapper.tsx";

export interface RemoveNodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const RemoveNodeDialog = ({ open, onOpenChange }: RemoveNodeDialogProps) => {
  const { t } = useTranslation("dialog");
  const { connection } = useDevice();
  const { getNode, removeNode } = useNodeDB();
  const { nodeNumToBeRemoved } = useAppStore();

  const handleConfirm = () => {
    connection?.removeNodeByNum(nodeNumToBeRemoved);
    removeNode(nodeNumToBeRemoved);
  };

  return (
    <DialogWrapper
      open={open}
      onOpenChange={onOpenChange}
      type="confirm"
      title={t("removeNode.title")}
      description={t("removeNode.description")}
      variant="destructive"
      confirmText={t("button.remove")}
      onConfirm={handleConfirm}
    >
      <div className="gap-4">
        <Label>{getNodeLongName(getNode(nodeNumToBeRemoved))}</Label>
      </div>
    </DialogWrapper>
  );
};
