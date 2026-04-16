import { describe, expect, it } from "vitest";
import * as utils from "./utils";

describe("Plus Code and Distress message size", () => {
  it("encodePlusCode returns expected format and contains '+'", () => {
    const code = utils.encodePlusCode(45.123456, 9.123456, 8);
    expect(code).toContain("+");
    expect(code.length).toBeGreaterThanOrEqual(9); // 8 chars + '+'
    // allowed alphabet characters (uppercase alnum and '+')
    expect(/^[0-9A-Z+]+$/.test(code.replace(/\+/g, "+"))).toBe(true);
  });

  it("Plus Code message is shorter than raw coordinate message", () => {
    const lat = 45.123456;
    const lon = 9.123456;

    // Build a plus-code based message manually
    const plus = utils.encodePlusCode(lat, lon, 8);
    const plusMsg = ["DIST", plus, "HELP", utils.zuluTimeTag()].join(" ");

    // Manually build a version that uses raw coordinates instead of Plus Code
    const coord = `${lat.toFixed(6)},${lon.toFixed(6)}`;
    const coordMsg = ["DIST", coord, "HELP", utils.zuluTimeTag()].join(" ");

    expect(plus).toContain("+");
    expect(plusMsg.length).toBeLessThanOrEqual(coordMsg.length);
  });
});
