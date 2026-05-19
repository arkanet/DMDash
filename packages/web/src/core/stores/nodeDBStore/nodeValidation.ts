import type { NodeErrorType } from "@core/stores";
import type { Protobuf } from "@meshtastic/core";
import { fromByteArray } from "base64-js";

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

function hasPublicKey(key?: Uint8Array | null): key is Uint8Array {
  return Boolean(key && key.length > 0);
}

function preserveExistingPublicKey(
  oldNode: Protobuf.Mesh.NodeInfo,
  newNode: Protobuf.Mesh.NodeInfo,
): Protobuf.Mesh.NodeInfo {
  if (!hasPublicKey(oldNode.user?.publicKey) || hasPublicKey(newNode.user?.publicKey)) {
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
// If valid, returns a node to store, else returns undefined.
export function validateIncomingNode(
  newNode: Protobuf.Mesh.NodeInfo,
  setNodeError: (nodeNum: number, error: NodeErrorType) => void,
  getNodes: (filter?: (node: Protobuf.Mesh.NodeInfo) => boolean) => Protobuf.Mesh.NodeInfo[],
): Protobuf.Mesh.NodeInfo | undefined {
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

        setNodeError(num, "DUPLICATE_PKI");
        return undefined; // drop newNode entirely
      }
    }
    return newNode; // No conflicts, accept newNode
  } else if (existingNodes.length === 1) {
    // One existing node with this node number.
    const oldNode = existingNodes[0];
    if (!oldNode) {
      return undefined;
    }

    const oldKey = oldNode.user?.publicKey;
    const newKey = newNode.user?.publicKey;

    if (!hasPublicKey(oldKey) || equalKey(oldKey, newKey)) {
      // Keys match or existing key was empty: trust the incoming node data completely.
      // This allows for legitimate updates to user info and other fields.
      return newNode;
    } else if (hasPublicKey(newKey)) {
      console.warn(
        `Node ${num} rejected: existing key does not match incoming key. Old key:`,
        fromByteArray(oldKey ?? new Uint8Array()),
        "New key:",
        fromByteArray(newKey ?? new Uint8Array()),
      );

      // Keys do not match and existing key was not empty: potential impersonation attempt.
      setNodeError(num, "MISMATCH_PKI");
      return oldNode; // drop newNode fields and return old
    } else {
      // Incoming node has no public key: keep the trusted key, but accept non-key updates.
      return preserveExistingPublicKey(oldNode, newNode);
    }
  } else {
    // Multiple existing nodes with the same node number
    // This should never happen, but if it does, we drop the new node entirely.
    console.warn(`Node ${num} rejected: Multiple existing nodes with this node number.`);

    setNodeError(num, "DUPLICATE_PKI");
    return undefined; // drop newNode entirely
  }
}
