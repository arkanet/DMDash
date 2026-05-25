import { useDevice } from "@core/stores";
import { lazy, Suspense } from "react";

const FactoryResetConfigDialog = lazy(() =>
  import("@app/components/Dialog/FactoryResetConfigDialog/FactoryResetConfigDialog").then(
    (module) => ({ default: module.FactoryResetConfigDialog }),
  ),
);
const FactoryResetDeviceDialog = lazy(() =>
  import("@app/components/Dialog/FactoryResetDeviceDialog/FactoryResetDeviceDialog").then(
    (module) => ({ default: module.FactoryResetDeviceDialog }),
  ),
);
const ClearAllStoresDialog = lazy(() =>
  import("@components/Dialog/ClearAllStoresDialog/ClearAllStoresDialog.tsx").then((module) => ({
    default: module.ClearAllStoresDialog,
  })),
);
const ClientNotificationDialog = lazy(() =>
  import("@components/Dialog/ClientNotificationDialog/ClientNotificationDialog.tsx").then(
    (module) => ({ default: module.ClientNotificationDialog }),
  ),
);
const DeleteMessagesDialog = lazy(() =>
  import("@components/Dialog/DeleteMessagesDialog/DeleteMessagesDialog.tsx").then((module) => ({
    default: module.DeleteMessagesDialog,
  })),
);
const ImportDialog = lazy(() =>
  import("@components/Dialog/ImportDialog.tsx").then((module) => ({
    default: module.ImportDialog,
  })),
);
const NodeImportDialog = lazy(() =>
  import("@components/Dialog/NodeImportDialog.tsx").then((module) => ({
    default: module.NodeImportDialog,
  })),
);
const NodeDetailsDialog = lazy(() =>
  import("@components/Dialog/NodeDetailsDialog/NodeDetailsDialog.tsx").then((module) => ({
    default: module.NodeDetailsDialog,
  })),
);
const PkiBackupDialog = lazy(() =>
  import("@components/Dialog/PKIBackupDialog.tsx").then((module) => ({
    default: module.PkiBackupDialog,
  })),
);
const QRDialog = lazy(() =>
  import("@components/Dialog/QRDialog.tsx").then((module) => ({
    default: module.QRDialog,
  })),
);
const RebootDialog = lazy(() =>
  import("@components/Dialog/RebootDialog.tsx").then((module) => ({
    default: module.RebootDialog,
  })),
);
const RefreshKeysDialog = lazy(() =>
  import("@components/Dialog/RefreshKeysDialog/RefreshKeysDialog.tsx").then((module) => ({
    default: module.RefreshKeysDialog,
  })),
);
const RemoveNodeDialog = lazy(() =>
  import("@components/Dialog/RemoveNodeDialog.tsx").then((module) => ({
    default: module.RemoveNodeDialog,
  })),
);
const ResetNodeDbDialog = lazy(() =>
  import("@components/Dialog/ResetNodeDbDialog/ResetNodeDbDialog.tsx").then((module) => ({
    default: module.ResetNodeDbDialog,
  })),
);
const ShutdownDialog = lazy(() =>
  import("@components/Dialog/ShutdownDialog.tsx").then((module) => ({
    default: module.ShutdownDialog,
  })),
);
const UnsafeRolesDialog = lazy(() =>
  import("@components/Dialog/UnsafeRolesDialog/UnsafeRolesDialog.tsx").then((module) => ({
    default: module.UnsafeRolesDialog,
  })),
);

export const DialogManager = () => {
  const { channels, config, dialog, setDialogOpen } = useDevice();
  return (
    <Suspense fallback={null}>
      {dialog.QR ? (
        <QRDialog
          open={dialog.QR}
          onOpenChange={(open) => {
            setDialogOpen("QR", open);
          }}
          channels={channels}
          loraConfig={config.lora}
        />
      ) : null}
      {dialog.import ? (
        <ImportDialog
          open={dialog.import}
          onOpenChange={(open) => {
            setDialogOpen("import", open);
          }}
          loraConfig={config.lora}
        />
      ) : null}
      {dialog.nodeImport ? (
        <NodeImportDialog
          open={dialog.nodeImport}
          onOpenChange={(open) => {
            setDialogOpen("nodeImport", open);
          }}
        />
      ) : null}
      {dialog.shutdown ? (
        <ShutdownDialog
          open={dialog.shutdown}
          onOpenChange={() => {
            setDialogOpen("shutdown", false);
          }}
        />
      ) : null}
      {dialog.reboot ? (
        <RebootDialog
          open={dialog.reboot}
          onOpenChange={() => {
            setDialogOpen("reboot", false);
          }}
        />
      ) : null}
      {dialog.nodeRemoval ? (
        <RemoveNodeDialog
          open={dialog.nodeRemoval}
          onOpenChange={(open) => {
            setDialogOpen("nodeRemoval", open);
          }}
        />
      ) : null}
      {dialog.pkiBackup ? (
        <PkiBackupDialog
          open={dialog.pkiBackup}
          onOpenChange={(open) => {
            setDialogOpen("pkiBackup", open);
          }}
        />
      ) : null}
      {dialog.nodeDetails ? (
        <NodeDetailsDialog
          open={dialog.nodeDetails}
          onOpenChange={(open) => {
            setDialogOpen("nodeDetails", open);
          }}
        />
      ) : null}
      {dialog.unsafeRoles ? (
        <UnsafeRolesDialog
          open={dialog.unsafeRoles}
          onOpenChange={(open) => {
            setDialogOpen("unsafeRoles", open);
          }}
        />
      ) : null}
      {dialog.refreshKeys ? (
        <RefreshKeysDialog
          open={dialog.refreshKeys}
          onOpenChange={(open) => {
            setDialogOpen("refreshKeys", open);
          }}
        />
      ) : null}
      {dialog.deleteMessages ? (
        <DeleteMessagesDialog
          open={dialog.deleteMessages}
          onOpenChange={(open) => {
            setDialogOpen("deleteMessages", open);
          }}
        />
      ) : null}
      {dialog.clientNotification ? (
        <ClientNotificationDialog
          open={dialog.clientNotification}
          onOpenChange={(open) => {
            setDialogOpen("clientNotification", open);
          }}
        />
      ) : null}
      {dialog.resetNodeDb ? (
        <ResetNodeDbDialog
          open={dialog.resetNodeDb}
          onOpenChange={(open) => {
            setDialogOpen("resetNodeDb", open);
          }}
        />
      ) : null}
      {dialog.clearAllStores ? (
        <ClearAllStoresDialog
          open={dialog.clearAllStores}
          onOpenChange={(open) => {
            setDialogOpen("clearAllStores", open);
          }}
        />
      ) : null}
      {dialog.factoryResetDevice ? (
        <FactoryResetDeviceDialog
          open={dialog.factoryResetDevice}
          onOpenChange={(open) => {
            setDialogOpen("factoryResetDevice", open);
          }}
        />
      ) : null}
      {dialog.factoryResetConfig ? (
        <FactoryResetConfigDialog
          open={dialog.factoryResetConfig}
          onOpenChange={(open) => {
            setDialogOpen("factoryResetConfig", open);
          }}
        />
      ) : null}
    </Suspense>
  );
};
