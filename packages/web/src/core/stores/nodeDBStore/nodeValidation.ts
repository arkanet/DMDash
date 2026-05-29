import type { NodeErrorType } from "@core/stores";
import type { Protobuf } from "@meshtastic/core";
import { fromByteArray } from "base64-js";

export type IncomingNodeValidationResult = {
  node?: Protobuf.Mesh.NodeInfo;
  error?: NodeErrorType;
  clearExistingError?: boolean;
};

export function equalKey(a?: Uint8Array | null, b?: Uint8Array | null): boolean {
  if (!a || !b) {
    return false;
  }
  if (a === b) {
    return true;
  }
  const len = a.byteLength;
  if (len !== b.byteLength) {
    return false;
  }
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

export function hasPublicKey(key?: Uint8Array | null): key is Uint8Array {
  return Boolean(key && key.length > 0);
}

function preserveExistingPublicKey(
  oldNode: Protobuf.Mesh.NodeInfo,
  newNode: Protobuf.Mesh.NodeInfo,
): Protobuf.Mesh.NodeInfo {
  if (!hasPublicKey(oldNode.user?.publicKey)) {
    return newNode;
  }

  if (!newNode.user) {
    return newNode;
  }

  return {
    ...newNode,
    user: {
      ...(oldNode.user ?? {}),
      ...newNode.user,
      publicKey: oldNode.user.publicKey,
    },
  };
}

// Validates a new incoming node against existing nodes.
// Mirrors Android trust semantics: node number is the anchor, metadata can update,
// and a conflicting public key is surfaced without trusting the new key.
export function validateIncomingNode(
  newNode: Protobuf.Mesh.NodeInfo,
  getNodes: (filter?: (node: Protobuf.Mesh.NodeInfo) => boolean) => Protobuf.Mesh.NodeInfo[],
): IncomingNodeValidationResult {
  const num = newNode.num;
  const existingNodes = getNodes((node) => node.num === num);

  if (existingNodes.length === 0) {
    // No existing node with this node number.
    // Check if the new node's public key (if present and not empty)
    // is already claimed by another existing node.
    if (hasPublicKey(newNode.user?.publicKey)) {
      const nodesWithSameKey = getNodes(
        (node) => node.num !== num && equalKey(node.user?.publicKey, newNode.user?.publicKey),
      );
      if (nodesWithSameKey.length > 0) {
        // This is a potential impersonation attempt.

        console.warn(
          `Node ${num} rejected: Public key already claimed by another node. Key:`,
          fromByteArray(newNode.user?.publicKey ?? new Uint8Array()),
        );

        return { error: "DUPLICATE_PKI" };
      }
    }
    return { node: newNode, clearExistingError: true };
  } else if (existingNodes.length === 1) {
    // One existing node with this node number.
    const oldNode = existingNodes[0];
    if (!oldNode) {
      return {};
    }

    const oldKey = oldNode.user?.publicKey;
    const newKey = newNode.user?.publicKey;

    if (!hasPublicKey(oldKey) || equalKey(oldKey, newKey)) {
      // Keys match or existing key was empty: trust the incoming node data completely.
      // This allows for legitimate updates to user info and other fields.
      return { node: newNode, clearExistingError: true };
    } else if (hasPublicKey(newKey)) {
      console.warn(
        `Node ${num} received a different public key. Old key:`,
        fromByteArray(oldKey ?? new Uint8Array()),
        "New key:",
        fromByteArray(newKey ?? new Uint8Array()),
      );

      // Accept the latest node metadata, but keep the previously trusted public key.
      return {
        node: preserveExistingPublicKey(oldNode, newNode),
        error: "MISMATCH_PKI",
      };
    } else {
      // Incoming node has no public key: keep the trusted key, but accept non-key updates.
      return {
        node: preserveExistingPublicKey(oldNode, newNode),
        clearExistingError: true,
      };
    }
  } else {
    // Multiple existing nodes with the same node number
    // This should never happen, but if it does, we drop the new node entirely.
    console.warn(`Node ${num} rejected: Multiple existing nodes with this node number.`);

    return { error: "DUPLICATE_PKI" };
  }
}
