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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogClose />
        <DialogHeader>
          <DialogTitle>{t("nodeImport.title", "Import Node")}</DialogTitle>
        </DialogHeader>

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
      </DialogContent>
    </Dialog>
  );
};
