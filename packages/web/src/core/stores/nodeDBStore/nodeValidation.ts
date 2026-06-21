import type { NodeErrorType } from "@core/stores";
import type { Protobuf } from "@meshtastic/core";
import { fromByteArray } from "base64-js";

export type IncomingNodeValidationResult = {
  node?: Protobuf.Mesh.NodeInfo;
  error?: NodeErrorType;
  clearExistingError?: boolean;
};

function isByteArray(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizePublicKey(key?: unknown): Uint8Array | undefined {
  if (key === undefined || key === null) {
    return undefined;
  }

  if (key instanceof Uint8Array) {
    return key;
  }

  if (isByteArray(key)) {
    return new Uint8Array(key);
  }

  if (!isRecord(key)) {
    return undefined;
  }

  if (key.__datatype === "Uint8Array" && isByteArray(key.value)) {
    return new Uint8Array(key.value);
  }

  if (key.type === "Buffer" && isByteArray(key.data)) {
    return new Uint8Array(key.data);
  }

  const numericEntries = Object.entries(key).map(([entryKey, entryValue]) => ({
    key: Number(entryKey),
    value: entryValue,
  }));

  if (
    numericEntries.length === 0 ||
    !numericEntries.every(
      (entry): entry is { key: number; value: number } =>
        Number.isInteger(entry.key) &&
        entry.key >= 0 &&
        typeof entry.value === "number" &&
        Number.isInteger(entry.value) &&
        entry.value >= 0 &&
        entry.value <= 255,
    )
  ) {
    return undefined;
  }

  numericEntries.sort((left, right) => left.key - right.key);
  for (let index = 0; index < numericEntries.length; index++) {
    if (numericEntries[index]?.key !== index) {
      return undefined;
    }
  }

  return new Uint8Array(numericEntries.map((entry) => entry.value));
}

export function equalKey(a?: unknown, b?: unknown): boolean {
  const left = normalizePublicKey(a);
  const right = normalizePublicKey(b);

  if (!left || !right) {
    return false;
  }
  if (left === right) {
    return true;
  }
  const len = left.byteLength;
  if (len !== right.byteLength) {
    return false;
  }
  for (let i = 0; i < len; i++) {
    if (left[i] !== right[i]) {
      return false;
    }
  }
  return true;
}

export function hasPublicKey(key?: unknown): boolean {
  const publicKey = normalizePublicKey(key);
  return Boolean(publicKey && publicKey.length > 0);
}

function normalizeNodePublicKey(node: Protobuf.Mesh.NodeInfo): Protobuf.Mesh.NodeInfo {
  const publicKey = normalizePublicKey(node.user?.publicKey);
  if (!node.user || !publicKey || publicKey === node.user.publicKey) {
    return node;
  }

  return {
    ...node,
    user: {
      ...node.user,
      publicKey,
    },
  };
}

function preserveExistingPublicKey(
  oldNode: Protobuf.Mesh.NodeInfo,
  newNode: Protobuf.Mesh.NodeInfo,
): Protobuf.Mesh.NodeInfo {
  const trustedPublicKey = normalizePublicKey(oldNode.user?.publicKey);
  if (!hasPublicKey(trustedPublicKey)) {
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
      publicKey: trustedPublicKey,
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
    const newPublicKey = normalizePublicKey(newNode.user?.publicKey);
    if (hasPublicKey(newPublicKey)) {
      const nodesWithSameKey = getNodes(
        (node) => node.num !== num && equalKey(node.user?.publicKey, newPublicKey),
      );
      if (nodesWithSameKey.length > 0) {
        // This is a potential impersonation attempt.

        console.warn(
          `Node ${num} rejected: Public key already claimed by another node. Key:`,
          fromByteArray(newPublicKey ?? new Uint8Array()),
        );

        return { error: "DUPLICATE_PKI" };
      }
    }
    return { node: normalizeNodePublicKey(newNode), clearExistingError: true };
  } else if (existingNodes.length === 1) {
    // One existing node with this node number.
    const oldNode = existingNodes[0];
    if (!oldNode) {
      return {};
    }

    const oldKey = normalizePublicKey(oldNode.user?.publicKey);
    const newKey = normalizePublicKey(newNode.user?.publicKey);

    if (!hasPublicKey(oldKey) || equalKey(oldKey, newKey)) {
      // Keys match or existing key was empty: trust the incoming node data completely.
      // This allows for legitimate updates to user info and other fields.
      return { node: normalizeNodePublicKey(newNode), clearExistingError: true };
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
