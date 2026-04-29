import { describe, expect, it } from "vitest";
import {
  getDirectMessageNavigationBlockDescription,
  getDirectMessageKeyExchangeDescription,
  getDirectMessageKeyExchangeStatus,
  shouldBlockDirectMessageNavigation,
} from "./directMessageKeyExchange.ts";

describe("getDirectMessageKeyExchangeStatus", () => {
  it("returns missing-node when the target node is unavailable", () => {
    expect(getDirectMessageKeyExchangeStatus()).toBe("missing-node");
  });

  it("returns missing-public-key when the target node has no public key", () => {
    expect(
      getDirectMessageKeyExchangeStatus({
        user: { publicKey: new Uint8Array(0) },
        isKeyManuallyVerified: false,
      }),
    ).toBe("missing-public-key");
  });

  it("returns ready when the node key exists even if it is not manually verified", () => {
    expect(
      getDirectMessageKeyExchangeStatus({
        user: { publicKey: new Uint8Array([1, 2, 3]) },
        isKeyManuallyVerified: false,
      }),
    ).toBe("ready");
  });

  it("returns ready when the node has a public key even if a routing error exists", () => {
    expect(
      getDirectMessageKeyExchangeStatus(
        {
          user: { publicKey: new Uint8Array([1, 2, 3]) },
          isKeyManuallyVerified: true,
        },
        { node: 42, error: "MISMATCH_PKI" },
      ),
    ).toBe("ready");
  });

  it("returns ready when the public key exists", () => {
    expect(
      getDirectMessageKeyExchangeStatus({
        user: { publicKey: new Uint8Array([1, 2, 3]) },
        isKeyManuallyVerified: true,
      }),
    ).toBe("ready");
  });

  it("provides a user-facing explanation for blocked direct messages", () => {
    expect(getDirectMessageKeyExchangeDescription("missing-public-key")).toContain("public key");
    expect(getDirectMessageKeyExchangeDescription("missing-node")).toContain("sync");
  });

  it("blocks opening a DM only when the node or its public key are missing", () => {
    expect(shouldBlockDirectMessageNavigation()).toBe(true);

    expect(
      shouldBlockDirectMessageNavigation({
        user: { publicKey: new Uint8Array(0) },
        isKeyManuallyVerified: false,
      }),
    ).toBe(true);

    expect(
      shouldBlockDirectMessageNavigation({
        user: { publicKey: new Uint8Array([1, 2, 3]) },
        isKeyManuallyVerified: false,
      }),
    ).toBe(false);

    expect(
      shouldBlockDirectMessageNavigation(
        {
          user: { publicKey: new Uint8Array([1, 2, 3]) },
          isKeyManuallyVerified: true,
        },
        { node: 7, error: "MISMATCH_PKI" },
      ),
    ).toBe(false);

    expect(
      shouldBlockDirectMessageNavigation({
        user: { publicKey: new Uint8Array([1, 2, 3]) },
        isKeyManuallyVerified: true,
      }),
    ).toBe(false);
  });

  it("returns the same blocking description used for send-time checks", () => {
    expect(
      getDirectMessageNavigationBlockDescription({
        user: { publicKey: new Uint8Array(0) },
        isKeyManuallyVerified: true,
      }),
    ).toBe(getDirectMessageKeyExchangeDescription("missing-public-key"));

    expect(
      getDirectMessageNavigationBlockDescription({
        user: { publicKey: new Uint8Array([1, 2, 3]) },
        isKeyManuallyVerified: true,
      }),
    ).toBeUndefined();
  });
});
