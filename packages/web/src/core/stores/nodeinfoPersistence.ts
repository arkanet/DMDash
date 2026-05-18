import { get, set, del } from "idb-keyval";
import { Protobuf } from "@meshtastic/core";
import { normalizePosition } from "@core/utils/geo.ts";

const PREFIX = "nodeinfo";
const INDEX_KEY = (dbId: number) => `${PREFIX}:index:${dbId}`;
const UINT8_ARRAY_TAG = "Uint8Array";

type JsonRecord = Record<string, unknown>;
type ByteArrayEnvelope = {
  __datatype: typeof UINT8_ARRAY_TAG;
  value: number[];
};

function keyFor(dbId: number, nodeNum: number) {
  return `${PREFIX}:${dbId}:${nodeNum}`;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isByteArray(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)
  );
}

function encodeValue(value: unknown): unknown {
  if (value instanceof Uint8Array) {
    return {
      __datatype: UINT8_ARRAY_TAG,
      value: Array.from(value),
    } satisfies ByteArrayEnvelope;
  }

  return value;
}

function reviveEncodedValue(value: unknown): unknown {
  if (value instanceof Uint8Array) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(reviveEncodedValue);
  }

  if (!isRecord(value)) {
    return value;
  }

  if (value.__datatype === UINT8_ARRAY_TAG && isByteArray(value.value)) {
    return new Uint8Array(value.value);
  }

  if (value.type === "Buffer" && isByteArray(value.data)) {
    return new Uint8Array(value.data);
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [key, reviveEncodedValue(nestedValue)]),
  );
}

function coerceByteArray(value: unknown): Uint8Array | undefined {
  const revived = reviveEncodedValue(value);

  if (revived === undefined || revived === null) {
    return undefined;
  }

  if (revived instanceof Uint8Array) {
    return revived;
  }

  if (isByteArray(revived)) {
    return new Uint8Array(revived);
  }

  if (!isRecord(revived)) {
    return undefined;
  }

  const entries = Object.entries(revived);
  if (entries.length === 0) {
    return new Uint8Array();
  }

  const numericEntries = entries.map(([key, entryValue]) => ({
    key: Number(key),
    value: entryValue,
  }));
  if (
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

function normalizeNodeForStorage(node: Protobuf.Mesh.NodeInfo): Protobuf.Mesh.NodeInfo {
  return node.position ? { ...node, position: normalizePosition(node.position) } : node;
}

function toStoredNode(node: Protobuf.Mesh.NodeInfo): unknown {
  return JSON.parse(
    JSON.stringify(normalizeNodeForStorage(node), (_, value) => encodeValue(value)),
  );
}

function fromStoredNode(value: unknown): Protobuf.Mesh.NodeInfo {
  const revived = reviveEncodedValue(value) as Protobuf.Mesh.NodeInfo;
  const user = revived.user as
    | (Protobuf.Mesh.User & {
        publicKey?: unknown;
        macaddr?: unknown;
      })
    | undefined;

  if (!user) {
    return normalizeNodeForStorage(revived);
  }

  const publicKey = coerceByteArray(user.publicKey);
  const macaddr = coerceByteArray(user.macaddr);
  const normalizedUser = {
    ...user,
    ...(publicKey !== undefined ? { publicKey } : {}),
    ...(macaddr !== undefined ? { macaddr } : {}),
  } as Protobuf.Mesh.User;

  return normalizeNodeForStorage({
    ...revived,
    user: normalizedUser,
  });
}

export async function putNode(dbId: number, node: Protobuf.Mesh.NodeInfo) {
  // Store as a plain JS object for compatibility, but keep byte fields typed on readback.
  try {
    await set(keyFor(dbId, node.num), toStoredNode(node));
    // update index
    try {
      const idx = (await get(INDEX_KEY(dbId))) as number[] | undefined;
      const next = Array.isArray(idx) ? Array.from(new Set([...idx, node.num])) : [node.num];
      await set(INDEX_KEY(dbId), next);
    } catch {
      // best effort
    }
  } catch (_e) {
    console.warn("nodeinfoPersistence.putNode failed", _e);
  }
}

export async function putNodesBatch(dbId: number, nodes: Protobuf.Mesh.NodeInfo[]) {
  // write nodes sequentially to avoid concurrent index-update races
  for (const n of nodes) {
    // eslint-disable-next-line no-await-in-loop
    await putNode(dbId, n);
  }
}

export async function getNode(
  dbId: number,
  nodeNum: number,
): Promise<Protobuf.Mesh.NodeInfo | undefined> {
  const val = await get(keyFor(dbId, nodeNum));
  if (!val) return undefined;
  try {
    return fromStoredNode(val);
  } catch (_e) {
    console.error("nodeinfoPersistence: failed to revive node", _e);
    return undefined;
  }
}

export async function getAllNodes(dbId: number): Promise<Protobuf.Mesh.NodeInfo[]> {
  try {
    const idx = (await get(INDEX_KEY(dbId))) as number[] | undefined;
    if (!Array.isArray(idx) || idx.length === 0) return [];

    const results: Protobuf.Mesh.NodeInfo[] = [];
    await Promise.all(
      idx.map(async (n) => {
        const val = await get(keyFor(dbId, n));
        if (val) {
          results.push(fromStoredNode(val));
        }
      }),
    );

    return results;
  } catch {
    return [];
  }
}

export async function deleteNode(dbId: number, nodeNum: number) {
  await del(keyFor(dbId, nodeNum));
  try {
    const idx = (await get(INDEX_KEY(dbId))) as number[] | undefined;
    if (Array.isArray(idx)) {
      const next = idx.filter((n) => n !== nodeNum);
      await set(INDEX_KEY(dbId), next);
    }
  } catch {
    // ignore
  }
}

export async function clearDb(dbId: number) {
  try {
    const idx = (await get(INDEX_KEY(dbId))) as number[] | undefined;
    if (!Array.isArray(idx) || idx.length === 0) {
      await del(INDEX_KEY(dbId));
      return;
    }
    await Promise.all(idx.map((n) => del(keyFor(dbId, n))));
    await del(INDEX_KEY(dbId));
  } catch {
    // ignore
  }
}

export async function listNodeKeys(dbId: number): Promise<number[]> {
  try {
    const idx = (await get(INDEX_KEY(dbId))) as number[] | undefined;
    return Array.isArray(idx) ? idx.slice() : [];
  } catch {
    return [];
  }
}

export default {
  putNode,
  putNodesBatch,
  getNode,
  getAllNodes,
  deleteNode,
  clearDb,
  listNodeKeys,
};
