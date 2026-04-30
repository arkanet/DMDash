import { useNodeDB } from "@core/stores";
import type { Protobuf, Types } from "@meshtastic/core";
import { useTranslation } from "react-i18next";
import { getNodeShortName, getNodeLongName } from "@app/darkmesh/utils";
import { positionPoint } from "@core/utils/geo.ts";
import { numberToHexUnpadded } from "@noble/curves/abstract/utils";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../UI/Dialog.tsx";

export interface LocationResponseDialogProps {
  location: Types.PacketMetadata<Protobuf.Mesh.Position> | undefined;
  open: boolean;
  onOpenChange: () => void;
}

export const LocationResponseDialog = ({
  location,
  open,
  onOpenChange,
}: LocationResponseDialogProps) => {
  const { t } = useTranslation("dialog");
  const { getNode } = useNodeDB();

  const from = getNode(location?.from ?? 0);
  const longName = from
    ? (getNodeLongName(from) ?? `!${numberToHexUnpadded(from.num).toUpperCase()}`)
    : t("unknown.longName");
  const shortName = getNodeShortName(from) ?? t("unknown.shortName");

  const position = location?.data;
  const point = positionPoint(position);
  const hasCoordinates = Boolean(point);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogClose />
        <DialogHeader>
          <DialogTitle>
            {t("locationResponse.title", {
              interpolation: { escapeValue: false },
              identifier: `${longName} (${shortName})`,
            })}
          </DialogTitle>
        </DialogHeader>
        <DialogDescription>
          {hasCoordinates ? (
            <div className="ml-5 flex">
              <span className="ml-4 border-l-2 border-l-backgroundPrimary pl-2 text-textPrimary">
                <p>
                  {t("locationResponse.coordinates")}
                  <a
                    className="text-blue-500 dark:text-blue-400"
                    href={`https://www.openstreetmap.org/?mlat=${point?.latitude ?? 0}&mlon=${
                      point?.longitude ?? 0
                    }&layers=N`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {" "}
                    {point?.latitude}, {point?.longitude}
                  </a>
                </p>
                {typeof position?.altitude === "number" && (
                  <p>
                    {t("locationResponse.altitude")} {position.altitude}
                    {position.altitude < 1 ? t("unit.meter.one") : t("unit.meter.plural")}
                  </p>
                )}
              </span>
            </div>
          ) : (
            // Optional: Show a message if coordinates are not available
            <p className="text-textPrimary">{t("locationResponse.noCoordinates")}</p>
          )}
        </DialogDescription>
      </DialogContent>
    </Dialog>
  );
};
