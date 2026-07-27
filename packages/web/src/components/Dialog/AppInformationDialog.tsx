import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@components/UI/Dialog.tsx";

interface AppInformationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AppInformationDialog({ open, onOpenChange }: AppInformationDialogProps) {
  const version = String(import.meta.env.VITE_VERSION || "unknown").toUpperCase();
  const commitHash = String(import.meta.env.VITE_COMMIT_HASH || "unknown").toUpperCase();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogClose />
        <DialogHeader>
          <DialogTitle>Informazioni</DialogTitle>
        </DialogHeader>
        <dl className="grid gap-3 text-sm text-slate-700 dark:text-slate-200">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-500 dark:text-slate-400">App</dt>
            <dd className="font-medium">DMDash</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-500 dark:text-slate-400">Version</dt>
            <dd className="font-medium">{version}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-500 dark:text-slate-400">Commit</dt>
            <dd className="font-medium">#{commitHash.slice(0, 7)}</dd>
          </div>
        </dl>
      </DialogContent>
    </Dialog>
  );
}
