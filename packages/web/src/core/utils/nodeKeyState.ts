import type { NodeError } from "@core/stores/nodeDBStore/types.ts";
import { Protobuf } from "@meshtastic/core";

type NodeLike = {
  user?: {
    publicKey?: Uint8Array;
  };
};

export type NodeKeyState = "pkc" | "missing-public-key" | "error";

function hasNodePublicKey(node?: NodeLike): boolean {
  return Boolean(node?.user?.publicKey && node.user.publicKey.length > 0);
}

export function isNodeKeyError(nodeError?: NodeError, node?: NodeLike): boolean {
  if (!nodeError) {
    return false;
  }

  if (typeof nodeError.error === "string") {
    return ["MISMATCH_PKI", "DUPLICATE_PKI", "MISMATCH_IDENTITY"].includes(nodeError.error);
  }

  if (nodeError.error === Protobuf.Mesh.Routing_Error.PKI_UNKNOWN_PUBKEY) {
    return !hasNodePublicKey(node);
  }

  return false;
}

export function getNodeKeyState(node?: NodeLike, nodeError?: NodeError): NodeKeyState {
  if (isNodeKeyError(nodeError, node)) {
    return "error";
  }

  if (hasNodePublicKey(node)) {
    return "pkc";
  }

  return "missing-public-key";
}
