import { boundsFromLngLat, hasPos, type LngLat, toLngLat } from "@core/utils/geo";
import type { Protobuf } from "@meshtastic/core";
import { useCallback } from "react";
import type { MapRef } from "react-map-gl/maplibre";

const FIT_PADDING = { top: 10, bottom: 10, left: 10, right: 10 } as const;

function clampLat(lat: number): number {
  return Math.max(-85, Math.min(85, lat));
}

function clampLng(lng: number): number {
  return Math.max(-180, Math.min(180, lng));
}

export function useMapFitting(map: MapRef | undefined) {
  const focusLngLat = useCallback(
    (position: LngLat) => {
      if (!map) {
        return;
      }
      const [lng, lat] = position;
      map.easeTo({
        center: [lng, lat],
        zoom: map.getZoom(),
      });
    },
    [map],
  );

  const fitToNodes = useCallback(
    (nodes: Protobuf.Mesh.NodeInfo[]) => {
      if (!map || nodes.length === 0) {
        return;
      }

      const positionedNodes = nodes.filter((node): node is Protobuf.Mesh.NodeInfo =>
        Boolean(node?.position && hasPos(node.position)),
      );

      if (positionedNodes.length === 0) {
        return;
      }

      if (positionedNodes.length === 1 && positionedNodes[0]) {
        return focusLngLat(toLngLat(positionedNodes[0].position));
      }

      // Build [lng, lat] coords, then let boundsFromLngLat do the turf dance
      const coords = positionedNodes.map((node) => toLngLat(node.position));
      const bounds = boundsFromLngLat(coords);
      if (!bounds) {
        return;
      }

      const center = map.cameraForBounds(bounds, {
        padding: FIT_PADDING,
      });

      if (center) {
        map.easeTo(center);
      }
    },
    [map, focusLngLat],
  );

  const fitToNodesKeepingCenter = useCallback(
    (nodes: Protobuf.Mesh.NodeInfo[]) => {
      if (!map || nodes.length === 0) {
        return;
      }

      const coords = nodes
        .filter((node): node is Protobuf.Mesh.NodeInfo =>
          Boolean(node?.position && hasPos(node.position)),
        )
        .map((node) => toLngLat(node.position));

      if (coords.length === 0) {
        return;
      }

      const center = map.getCenter();
      const currentLng = center.lng;
      const currentLat = center.lat;
      const symmetricCoords = coords.flatMap(([lng, lat]) => [
        [lng, lat] as LngLat,
        [clampLng(2 * currentLng - lng), clampLat(2 * currentLat - lat)] as LngLat,
      ]);

      const bounds = boundsFromLngLat(symmetricCoords);
      if (!bounds) {
        return;
      }

      const camera = map.cameraForBounds(bounds, {
        padding: FIT_PADDING,
      });

      if (camera?.zoom !== undefined) {
        map.easeTo({ center: [currentLng, currentLat], zoom: camera.zoom });
      }
    },
    [map],
  );

  return { focusLngLat, fitToNodes, fitToNodesKeepingCenter };
}
