import type { NodeError } from "@core/stores/nodeDBStore/types.ts";

export type DirectMessageKeyExchangeStatus = "ready" | "missing-node" | "missing-public-key";

type DirectMessageNode = {
  user?: {
    publicKey?: Uint8Array;
  };
  isKeyManuallyVerified?: boolean;
};

export function getDirectMessageKeyExchangeStatus(
  node?: DirectMessageNode,
  _nodeError?: NodeError,
): DirectMessageKeyExchangeStatus {
  if (!node) {
    return "missing-node";
  }

  if (!node.user?.publicKey || node.user.publicKey.length === 0) {
    return "missing-public-key";
  }

  return "ready";
}

export function getDirectMessageKeyExchangeDescription(
  status: Exclude<DirectMessageKeyExchangeStatus, "ready">,
): string {
  switch (status) {
    case "missing-public-key":
      return "Direct messages require this node's public key.";
    case "missing-node":
      return "Wait for this node's information to sync before sending a direct message.";
  }
}

export function shouldBlockDirectMessageNavigation(
  node?: DirectMessageNode,
  nodeError?: NodeError,
): boolean {
  return getDirectMessageKeyExchangeStatus(node, nodeError) !== "ready";
}

export function getDirectMessageNavigationBlockDescription(
  node?: DirectMessageNode,
  nodeError?: NodeError,
): string | undefined {
  const status = getDirectMessageKeyExchangeStatus(node, nodeError);

  if (status === "ready") {
    return undefined;
  }

  return getDirectMessageKeyExchangeDescription(status);
}
