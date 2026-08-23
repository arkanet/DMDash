import { describe, expect, it } from "vitest";
import { Protobuf } from "@meshtastic/core";
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

  it("returns key-error when the target node has a PKI error", () => {
    expect(
      getDirectMessageKeyExchangeStatus(
        {
          user: { publicKey: new Uint8Array([1, 2, 3]) },
          isKeyManuallyVerified: true,
        },
        { node: 42, error: "MISMATCH_PKI" },
      ),
    ).toBe("key-error");
  });

  it("returns ready when PKI_UNKNOWN_PUBKEY is stale and the public key exists", () => {
    expect(
      getDirectMessageKeyExchangeStatus(
        {
          user: { publicKey: new Uint8Array([1, 2, 3]) },
          isKeyManuallyVerified: true,
        },
        { node: 42, error: Protobuf.Mesh.Routing_Error.PKI_UNKNOWN_PUBKEY },
      ),
    ).toBe("ready");
  });

  it("returns ready when the node key exists even if it is not manually verified", () => {
    expect(
      getDirectMessageKeyExchangeStatus({
        user: { publicKey: new Uint8Array([1, 2, 3]) },
        isKeyManuallyVerified: false,
      }),
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
    expect(getDirectMessageKeyExchangeDescription("key-error")).toContain("refreshed");
  });

  it("blocks opening a DM when the node, its public key, or its PKI state are not ready", () => {
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
    ).toBe(true);

    expect(
      shouldBlockDirectMessageNavigation(
        {
          user: { publicKey: new Uint8Array([1, 2, 3]) },
          isKeyManuallyVerified: true,
        },
        { node: 7, error: Protobuf.Mesh.Routing_Error.PKI_UNKNOWN_PUBKEY },
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
      getDirectMessageNavigationBlockDescription(
        {
          user: { publicKey: new Uint8Array([1, 2, 3]) },
          isKeyManuallyVerified: true,
        },
        { node: 7, error: "MISMATCH_PKI" },
      ),
    ).toBe(getDirectMessageKeyExchangeDescription("key-error"));

    expect(
      getDirectMessageNavigationBlockDescription({
        user: { publicKey: new Uint8Array([1, 2, 3]) },
        isKeyManuallyVerified: true,
      }),
    ).toBeUndefined();
  });
});
