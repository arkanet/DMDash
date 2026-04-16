import { get, set, del } from "idb-keyval";
import { Protobuf } from "@meshtastic/core";

const PREFIX = "nodeinfo";
const INDEX_KEY = (dbId: number) => `${PREFIX}:index:${dbId}`;

function keyFor(dbId: number, nodeNum: number) {
  return `${PREFIX}:${dbId}:${nodeNum}`;
}

export async function putNode(dbId: number, node: Protobuf.Mesh.NodeInfo) {
  // store as plain JS object for compatibility (avoids protobuf binary edge-cases in tests)
  try {
    await set(keyFor(dbId, node.num), JSON.parse(JSON.stringify(node)));
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
    return val as unknown as Protobuf.Mesh.NodeInfo;
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
        if (val) results.push(val as unknown as Protobuf.Mesh.NodeInfo);
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
