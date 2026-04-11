import type { PxOffset } from "@components/PageComponents/Map/cluster.ts";
import type { WaypointWithMetadata } from "@core/stores";
import type { Popup as MaplibrePopup } from "maplibre-gl";
import { memo, type ReactElement, useEffect, useRef } from "react";
import { Popup, useMap } from "react-map-gl/maplibre";

export type PopupState =
  | { type: "node"; num: number; offset: PxOffset; preventAutoPan?: boolean }
  | { type: "waypoint"; waypoint: WaypointWithMetadata; preventAutoPan?: boolean };

export const PopupWrapper = memo(function SelectedNodePopup({
  lng,
  lat,
  offset,
  onClose,
  preventAutoPan,
  children,
}: {
  lng: number;
  lat: number;
  offset?: PxOffset;
  onClose: () => void;
  preventAutoPan?: boolean;
  children: ReactElement;
}) {
  const popupRef = useRef<MaplibrePopup | null>(null);
  const { default: mapRef } = useMap();

  useEffect(() => {
    if (preventAutoPan) return;
    if (!mapRef || !popupRef.current) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      const map = mapRef.getMap();
      const popupElement = popupRef.current?.getElement();
      if (!popupElement) {
        return;
      }

      const popupRect = popupElement.getBoundingClientRect();
      const mapRect = map.getContainer().getBoundingClientRect();
      const projectedPoint = map.project([lng, lat]);
      const popupCenterX = popupRect.left - mapRect.left + popupRect.width / 2;
      const popupCenterY = popupRect.top - mapRect.top + popupRect.height / 2;

      mapRef.easeTo({
        center: [lng, lat],
        offset: [projectedPoint.x - popupCenterX, projectedPoint.y - popupCenterY],
        duration: 320,
      });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [lat, lng, mapRef, preventAutoPan]);

  return (
    <Popup
      ref={popupRef}
      anchor="top"
      longitude={lng}
      latitude={lat}
      onClose={onClose}
      className="darkmesh-map-popup w-full max-w-fit"
      maxWidth="fit-content"
      style={{
        left: `${offset?.[0] ?? 0}px`,
        top: `${(offset?.[1] ?? 0) + 22}px`,
        maxWidth: "fit-content",
      }}
    >
      {children as never}
    </Popup>
  );
});
