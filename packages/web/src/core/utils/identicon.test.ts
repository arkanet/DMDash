import {
  getCachedNodeIdenticon,
  getNodeIdenticonDataUri,
  renderDarkMeshIdenticonSvg,
  resolveNodeAvatarId,
} from "./identicon";
import { describe, expect, it } from "vitest";

describe("identicon", () => {
  it("resolves node ids using the provided user id first", () => {
    expect(resolveNodeAvatarId(0x06f57578, "!06f57578")).toBe("!06f57578");
  });

  it("falls back to the DarkMesh-style hex node id", () => {
    expect(resolveNodeAvatarId(0x06f57578)).toBe("!6f57578");
  });

  it("renders deterministic SVG for the same digest", () => {
    const hash = new Uint8Array([6, 245, 117, 120, 12, 99, 4, 1, 22, 19, 7, 88]);
    const firstSvg = renderDarkMeshIdenticonSvg(hash);
    const secondSvg = renderDarkMeshIdenticonSvg(hash);

    expect(firstSvg).toBe(secondSvg);
    expect(firstSvg).toContain("<svg");
    expect(firstSvg).toContain("<path");
  });

  it("caches identicon data URIs by node id", async () => {
    const nodeId = "!06f57578";
    const first = await getNodeIdenticonDataUri(nodeId);
    const second = await getNodeIdenticonDataUri(nodeId);

    expect(first).toBe(second);
    expect(getCachedNodeIdenticon(nodeId)).toBe(first);
    expect(first.startsWith("data:image/svg+xml")).toBe(true);
  });

  it("produces different icons for different node ids", async () => {
    const first = await getNodeIdenticonDataUri("!06f57578");
    const second = await getNodeIdenticonDataUri("!06f57579");

    expect(first).not.toBe(second);
  });
});
