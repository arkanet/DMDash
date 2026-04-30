import { bbox, lineString } from "@turf/turf";

export type LngLat = [number, number];
export type Mercator = [number, number];
export type Bounds = [[number, number], [number, number]];
export type GeoPoint = { latitude: number; longitude: number };

const INT_DEG = 1e7;
const EARTH_RADIUS = 6378137;

export type PositionLike = {
  latitudeI?: number;
  longitudeI?: number;
  lat?: number | string;
  lon?: number | string;
};

const parseCoordinate = (value: number | string | undefined): number | undefined => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(/,/g, "."));
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
};

export const positionPoint = (position?: PositionLike): GeoPoint | undefined => {
  if (!position) {
    return undefined;
  }

  const latitude = parseCoordinate(position.lat);
  const longitude = parseCoordinate(position.lon);
  if (latitude !== undefined && longitude !== undefined) {
    return { latitude, longitude };
  }

  if (
    Number.isFinite(position.latitudeI) &&
    Number.isFinite(position.longitudeI) &&
    !(position.latitudeI === 0 && position.longitudeI === 0)
  ) {
    return {
      latitude: (position.latitudeI ?? 0) / INT_DEG,
      longitude: (position.longitudeI ?? 0) / INT_DEG,
    };
  }

  return undefined;
};

export const normalizePosition = <T extends PositionLike | undefined>(position: T): T => {
  if (!position) {
    return position;
  }

  const normalized = { ...position } as PositionLike;
  const point = positionPoint(position);

  if (point) {
    normalized.lat = point.latitude;
    normalized.lon = point.longitude;
    normalized.latitudeI = Math.round(point.latitude * INT_DEG);
    normalized.longitudeI = Math.round(point.longitude * INT_DEG);
  }

  return normalized as T;
};

export const toLngLat = (position?: PositionLike): LngLat => {
  const point = positionPoint(position);
  return [point?.longitude ?? 0, point?.latitude ?? 0];
};

export const hasPos = (position?: PositionLike) => positionPoint(position) !== undefined;

export const distanceBetweenPositions = (
  from?: PositionLike,
  to?: PositionLike,
): number | undefined => {
  const fromPoint = positionPoint(from);
  const toPoint = positionPoint(to);

  if (!fromPoint || !toPoint) {
    return undefined;
  }

  return (
    distanceMeters(
      [fromPoint.longitude, fromPoint.latitude],
      [toPoint.longitude, toPoint.latitude],
    ) / 1000
  );
};

export const boundsFromLngLat = (coords: LngLat[]): Bounds | undefined => {
  if (coords.length === 0) {
    return undefined;
  }

  const [minLng, minLat, maxLng, maxLat] = bbox(lineString(coords));

  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
};

const deg2rad = (d: number) => (d * Math.PI) / 180;
const rad2deg = (r: number) => (r * 180) / Math.PI;

export function lngLatToMercator([lng, lat]: LngLat): Mercator {
  return [
    EARTH_RADIUS * deg2rad(lng),
    EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + deg2rad(lat) / 2)),
  ];
}

export function mercatorToLngLat([x, y]: Mercator): LngLat {
  return [
    rad2deg(x / EARTH_RADIUS),
    rad2deg(2 * Math.atan(Math.exp(y / EARTH_RADIUS)) - Math.PI / 2),
  ];
}

export function distanceMeters([lng1, lat1]: LngLat, [lng2, lat2]: LngLat) {
  const phi1 = deg2rad(lat1),
    phi2 = deg2rad(lat2);
  const x = deg2rad(lng2 - lng1) * Math.cos((phi1 + phi2) * 0.5);
  const y = phi2 - phi1;
  return EARTH_RADIUS * Math.hypot(x, y);
}

export function precisionBitsToMeters(precisionBits: number): number {
  const M_PER_DEG_EQ = (2 * Math.PI * EARTH_RADIUS) / 360; // ≈ 111_319.490793 m/deg

  const stepInt = 2 ** (32 - precisionBits);
  const stepDegrees = stepInt / INT_DEG;
  return Math.round(0.5 * stepDegrees * M_PER_DEG_EQ);
}

export function bearingDegrees(from: LngLat, to: LngLat): number {
  const [lambda1deg, phi1deg] = from;
  const [lambda2deg, phi2deg] = to;

  const phi1 = deg2rad(phi1deg);
  const phi2 = deg2rad(phi2deg);
  const deltaLambda = deg2rad(lambda2deg - lambda1deg);

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  return (rad2deg(Math.atan2(y, x)) + 360) % 360;
}
