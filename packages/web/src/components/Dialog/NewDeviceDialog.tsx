import AddConnectionDialog from "@components/Dialog/AddConnectionDialog/AddConnectionDialog.tsx";

export interface NewDeviceProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const NewDeviceDialog = ({ open, onOpenChange }: NewDeviceProps) => {
  const isHTTPS = typeof window !== "undefined" && window.location.protocol === "https:";

  return <AddConnectionDialog open={open} onOpenChange={onOpenChange} isHTTPS={isHTTPS} />;
};
