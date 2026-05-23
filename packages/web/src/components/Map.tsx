import { useTheme } from "@core/hooks/useTheme.ts";
import type { StyleSpecification } from "maplibre-gl";
import { useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import MapGl, {
  AttributionControl,
  type MapLayerMouseEvent,
  type MapRef,
  ScaleControl,
} from "react-map-gl/maplibre";

interface MapProps {
  children?: React.ReactNode;
  onLoad?: (map: MapRef) => void;
  onMouseMove?: (event: MapLayerMouseEvent) => void;
  onMove?: (event: { viewState: { zoom: number; bearing?: number } }) => void;
  onClick?: (event: MapLayerMouseEvent) => void;
  interactiveLayerIds?: string[];
  initialViewState?: {
    latitude?: number;
    longitude?: number;
    zoom?: number;
  };
}

const osmRasterStyle: StyleSpecification = {
  version: 8,
  name: "OpenStreetMap Mapnik raster tiles",
  sources: {
    "osm-mapnik": {
      type: "raster",
      tiles: ["https://a.tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution:
        "Basemap data <a href='https://www.osm.org' target=_blank>© OpenStreetMap contributors</a>",
    },
  },
  layers: [
    {
      id: "background",
      type: "background",
      paint: {
        "background-color": "rgba(0,0,0,0)",
      },
    },
    {
      id: "osm-mapnik",
      type: "raster",
      source: "osm-mapnik",
    },
  ],
};

export const BaseMap = ({
  children,
  onLoad,
  onClick,
  onMouseMove,
  onMove,
  interactiveLayerIds,
  initialViewState,
}: MapProps) => {
  const { theme } = useTheme();
  const { t } = useTranslation("map");

  const darkMode = theme === "dark";
  const mapRef = useRef<MapRef | null>(null);

  const locale = useMemo(() => {
    return {
      "GeolocateControl.FindMyLocation": t("maplibre.GeolocateControl.FindMyLocation"),
      "NavigationControl.ZoomIn": t("maplibre.NavigationControl.ZoomIn"),
      "NavigationControl.ZoomOut": t("maplibre.NavigationControl.ZoomOut"),
      "ScaleControl.Meters": t("unit.meter.suffix"),
      "ScaleControl.Kilometers": t("unit.kilometer.suffix"),
      "CooperativeGesturesHandler.WindowsHelpText": t(
        "maplibre.CooperativeGesturesHandler.WindowsHelpText",
      ),
      "CooperativeGesturesHandler.MacHelpText": t(
        "maplibre.CooperativeGesturesHandler.MacHelpText",
      ),
      "CooperativeGesturesHandler.MobileHelpText": t(
        "maplibre.CooperativeGesturesHandler.MobileHelpText",
      ),
    };
  }, [t]);

  return (
    <MapGl
      ref={mapRef}
      mapStyle={osmRasterStyle}
      attributionControl={false}
      renderWorldCopies={false}
      maxPitch={0}
      dragRotate={false}
      touchZoomRotate={true}
      initialViewState={
        initialViewState ?? {
          zoom: 1.8,
          latitude: 35,
          longitude: 0,
        }
      }
      style={{ filter: darkMode ? "brightness(0.9)" : undefined }}
      locale={locale}
      interactiveLayerIds={interactiveLayerIds}
      onMouseMove={onMouseMove}
      onMove={onMove}
      onClick={onClick}
      onLoad={() => {
        const map = mapRef.current;
        if (map) {
          onLoad?.(map);
        }
      }}
    >
      <AttributionControl
        style={{
          background: darkMode ? "#ffffff" : undefined,
          color: darkMode ? "black" : undefined,
        }}
      />
      {/* { Disabled for now until we can use i18n for the geolocate control} */}
      {/* <GeolocateControl
        position="top-right"
        i18nIsDynamicList
        positionOptions={{ enableHighAccuracy: true }}
        trackUserLocation
      />  */}
      <ScaleControl />
      {children}
    </MapGl>
  );
};
