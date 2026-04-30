import { describe, expect, it } from "vitest";
import {
  boundsFromLngLat,
  distanceBetweenPositions,
  hasPos,
  normalizePosition,
  positionPoint,
  toLngLat,
} from "./geo.ts";

describe("geo position normalization", () => {
  it("reads protobuf integer coordinates", () => {
    const position = { latitudeI: 419027835, longitudeI: 124963655 };

    expect(hasPos(position)).toBe(true);
    expect(positionPoint(position)).toEqual({ latitude: 41.9027835, longitude: 12.4963655 });
    expect(toLngLat(position)).toEqual([12.4963655, 41.9027835]);
  });

  it("reads legacy lat/lon coordinates and normalizes protobuf fields", () => {
    const position = normalizePosition({ lat: "41,9027835", lon: "12.4963655" });

    expect(positionPoint(position)).toEqual({ latitude: 41.9027835, longitude: 12.4963655 });
    expect(position.latitudeI).toBe(419027835);
    expect(position.longitudeI).toBe(124963655);
  });

  it("rejects empty zero coordinates", () => {
    expect(hasPos({ latitudeI: 0, longitudeI: 0 })).toBe(false);
    expect(positionPoint({ latitudeI: 0, longitudeI: 0 })).toBeUndefined();
  });

  it("computes distances between mixed coordinate formats", () => {
    const km = distanceBetweenPositions(
      { latitudeI: 419027835, longitudeI: 124963655 },
      { lat: 41.9, lon: 12.49 },
    );

    expect(km).toBeGreaterThan(0.5);
    expect(km).toBeLessThan(1);
  });

  it("keeps bounds in lng/lat order", () => {
    expect(
      boundsFromLngLat([
        [12, 41],
        [13, 42],
      ]),
    ).toEqual([
      [12, 41],
      [13, 42],
    ]);
  });
});
