import BatteryAlertsPanel from "@components/PageComponents/Notifications/BatteryAlertsPanel.tsx";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@components/UI/Dialog.tsx";

interface BatteryAlertsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BatteryAlertsDialog({ open, onOpenChange }: BatteryAlertsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-3xl sm:max-w-3xl">
        <DialogClose />
        <DialogHeader>
          <DialogTitle>Battery Alerts</DialogTitle>
          <DialogDescription>
            Configure low battery notifications by node scope, percentage and voltage thresholds.
          </DialogDescription>
        </DialogHeader>
        <BatteryAlertsPanel />
      </DialogContent>
    </Dialog>
  );
}
