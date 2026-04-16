import { create } from "@bufbuild/protobuf";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@components/UI/Dialog.tsx";
import { Input } from "@components/UI/Input.tsx";
import { Button } from "@components/UI/Button.tsx";
import { useDevice, useNodeDB } from "@core/stores";
import {
  parseSharedContactUrl,
  parseDmdbContents,
  createNodeInfoFromSharedContact,
} from "../../darkmesh/utils.ts";
import { Protobuf } from "@meshtastic/core";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export interface NodeImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const NodeImportDialog = ({ open, onOpenChange }: NodeImportDialogProps) => {
  const { sendAdminMessage } = useDevice();
  const { addNode } = useNodeDB();
  const { t } = useTranslation("dialog");
  const [input, setInput] = useState("");
  const [valid, setValid] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [parsedResult, setParsedResult] = useState<ReturnType<typeof parseDmdbContents> | null>(
    null,
  );

  useEffect(() => {
    try {
      // try shared contact
      parseSharedContactUrl(input);
      setValid(true);
      return;
    } catch {
      // try DMDB content (user might paste full DMDB contents)
    }

    try {
      // Basic heuristic: DMDB header present
      if (input && input.includes("DARKMESH_NODEDB_FILE")) {
        parseDmdbContents(input);
        setValid(true);
        return;
      }
    } catch {
      // invalid
    }

    setValid(false);
  }, [input]);

  const apply = () => {
    try {
      // If it's a DMDB paste
      if (input.includes("DARKMESH_NODEDB_FILE")) {
        const parsed = parseDmdbContents(input);

        // Determine backbone roles and skipped contacts
        const BACKBONE_ROLES = [
          Protobuf.Config.Config_DeviceConfig_Role.ROUTER,
          Protobuf.Config.Config_DeviceConfig_Role.ROUTER_LATE,
          Protobuf.Config.Config_DeviceConfig_Role.CLIENT_BASE,
        ];

        const contactsToAdd = parsed.backboneOnly
          ? parsed.contacts.filter((contact) =>
              BACKBONE_ROLES.includes(
                contact.user?.role ?? Protobuf.Config.Config_DeviceConfig_Role.CLIENT,
              ),
            )
          : parsed.contacts;

        const skipped = parsed.contacts.length - contactsToAdd.length;

        if (parsed.backboneOnly && skipped > 0) {
          // Show confirmation UI summarizing skipped contacts
          setParsedResult(parsed);
          setConfirming(true);
          return;
        }

        // Default: import all parsed contacts
        parsed.contacts.forEach((contact) => {
          sendAdminMessage(
            create(Protobuf.Admin.AdminMessageSchema, {
              payloadVariant: { case: "addContact", value: contact },
            }),
          );
          addNode(createNodeInfoFromSharedContact(contact, parsed.favoriteOnly));
        });
        onOpenChange(false);
        setInput("");
        return;
      }

      // Otherwise assume single shared contact URL
      const contact = parseSharedContactUrl(input);
      sendAdminMessage(
        create(Protobuf.Admin.AdminMessageSchema, {
          payloadVariant: { case: "addContact", value: contact },
        }),
      );
      addNode(createNodeInfoFromSharedContact(contact, false));
      onOpenChange(false);
      setInput("");
    } catch (err) {
      // swallow; validation should have prevented this
      console.warn("Failed to import node", err);
    }
  };

  const doImport = (force = false) => {
    if (!parsedResult) return;
    const toImport = force
      ? parsedResult.contacts
      : parsedResult.contacts.filter((contact) => {
          const role = contact.user?.role ?? Protobuf.Config.Config_DeviceConfig_Role.CLIENT;
          return [
            Protobuf.Config.Config_DeviceConfig_Role.ROUTER,
            Protobuf.Config.Config_DeviceConfig_Role.ROUTER_LATE,
            Protobuf.Config.Config_DeviceConfig_Role.CLIENT_BASE,
          ].includes(role);
        });

    toImport.forEach((contact) => {
      sendAdminMessage(
        create(Protobuf.Admin.AdminMessageSchema, {
          payloadVariant: { case: "addContact", value: contact },
        }),
      );
      addNode(createNodeInfoFromSharedContact(contact, parsedResult.favoriteOnly));
      if (parsedResult.favoriteOnly) {
        // mark favorite via store helper if available
      }
    });

    setConfirming(false);
    setParsedResult(null);
    onOpenChange(false);
    setInput("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogClose />
        <DialogHeader>
          <DialogTitle>{t("nodeImport.title", "Import Node")}</DialogTitle>
        </DialogHeader>

        {!confirming ? (
          <>
            <div className="flex flex-col gap-3">
              <Input
                placeholder={t("nodeImport.placeholder", "Insert URL")}
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button onClick={apply} disabled={!valid}>
                {t("button.apply", "Apply")}
              </Button>
            </DialogFooter>
          </>
        ) : (
          // Confirmation UI
          <>
            <div className="space-y-3">
              <div className="text-sm">{t("nodeImport.confirmTitle", "Import summary")}</div>
              <div className="text-sm text-slate-600">
                {parsedResult ? (
                  <>
                    <div>
                      {t(
                        "nodeImport.summary.counts",
                        "Parsed {total} contacts, {allowed} backbone",
                        {
                          total: parsedResult.contacts.length,
                          allowed: parsedResult.contacts.filter((c) =>
                            [
                              Protobuf.Config.Config_DeviceConfig_Role.ROUTER,
                              Protobuf.Config.Config_DeviceConfig_Role.ROUTER_LATE,
                              Protobuf.Config.Config_DeviceConfig_Role.CLIENT_BASE,
                            ].includes(
                              c.user?.role ?? Protobuf.Config.Config_DeviceConfig_Role.CLIENT,
                            ),
                          ).length,
                        },
                      )}
                    </div>
                    <div className="mt-2">
                      {t(
                        "nodeImport.summary.note",
                        "This file was exported as backbone-only; some contacts will be skipped.",
                      )}
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      <div>
                        {t(
                          "nodeImport.summary.how",
                          "Backbone nodes are those with roles: ROUTER, ROUTER_LATE, CLIENT_BASE. GPS presence means a recorded position (latitude/longitude) is present.",
                        )}
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            </div>

            <DialogFooter>
              <Button onClick={() => doImport(false)}>
                {t("nodeImport.confirm.keep_backbone", "Import backbone only")}
              </Button>
              <Button variant="outline" onClick={() => doImport(true)}>
                {t("nodeImport.confirm.import_all", "Import all anyway")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
