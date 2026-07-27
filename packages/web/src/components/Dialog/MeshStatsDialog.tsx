import { MeshStatsPanel } from "@app/darkmesh/MeshStatsPanel.tsx";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@components/UI/Dialog.tsx";

interface MeshStatsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MeshStatsDialog({ open, onOpenChange }: MeshStatsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-3xl sm:max-w-3xl">
        <DialogClose />
        <DialogHeader>
          <DialogTitle>Mesh Stats</DialogTitle>
          <DialogDescription>
            Track DarkMesh traceroute and text compression savings for this browser profile.
          </DialogDescription>
        </DialogHeader>
        <MeshStatsPanel />
      </DialogContent>
    </Dialog>
  );
}
