import type { NodeError } from "@core/stores/nodeDBStore/types.ts";
import { Protobuf } from "@meshtastic/core";

type NodeLike = {
  user?: {
    publicKey?: Uint8Array;
  };
};

export type NodeKeyState = "pkc" | "missing-public-key" | "error";

export function isNodeKeyError(nodeError?: NodeError): boolean {
  if (!nodeError) {
    return false;
  }

  if (typeof nodeError.error === "string") {
    return ["MISMATCH_PKI", "DUPLICATE_PKI", "MISMATCH_IDENTITY"].includes(nodeError.error);
  }

  return nodeError.error === Protobuf.Mesh.Routing_Error.PKI_UNKNOWN_PUBKEY;
}

export function getNodeKeyState(node?: NodeLike, nodeError?: NodeError): NodeKeyState {
  if (isNodeKeyError(nodeError)) {
    return "error";
  }

  if (node?.user?.publicKey && node.user.publicKey.length > 0) {
    return "pkc";
  }

  return "missing-public-key";
}
