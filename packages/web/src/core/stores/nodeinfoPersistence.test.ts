import { create } from "@bufbuild/protobuf";
import { Protobuf } from "@meshtastic/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const idbMem = new Map<string, any>();
vi.mock("idb-keyval", () => ({
  get: vi.fn((k: string) => Promise.resolve(idbMem.get(k))),
  set: vi.fn((k: string, v: any) => {
    idbMem.set(k, v);
    return Promise.resolve();
  }),
  del: vi.fn((k: string) => {
    idbMem.delete(k);
    return Promise.resolve();
  }),
}));

import * as persistence from "./nodeinfoPersistence";

function makeNode(num: number, extras: Record<string, any> = {}) {
  return create(Protobuf.Mesh.NodeInfoSchema, { num, ...extras });
}
function makeUser(fields: Record<string, any>) {
  return create(Protobuf.Mesh.UserSchema, fields);
}

describe("nodeinfoPersistence", () => {
  beforeEach(() => {
    idbMem.clear();
    vi.clearAllMocks();
  });

  it("put/get node and index", async () => {
    const node = makeNode(10);
    await persistence.putNode(1, node);
    const got = await persistence.getNode(1, 10);
    expect(got?.num).toBe(10);
    const keys = await persistence.listNodeKeys(1);
    expect(keys).toEqual([10]);
  });

  it("putNodesBatch and getAllNodes", async () => {
    const nodes = [makeNode(2), makeNode(3)];
    await persistence.putNodesBatch(2, nodes as any);
    const all = await persistence.getAllNodes(2);
    expect(all.map((n) => n.num).sort()).toEqual([2, 3]);
  });

  it("preserves public keys as Uint8Array after put/get", async () => {
    const publicKey = new Uint8Array([1, 2, 3, 4]);

    await persistence.putNode(
      4,
      makeNode(9, {
        user: makeUser({ publicKey, longName: "keyed-node" }),
      }),
    );

    const got = await persistence.getNode(4, 9);
    expect(got?.user?.publicKey).toBeInstanceOf(Uint8Array);
    expect(Array.from(got?.user?.publicKey ?? [])).toEqual([1, 2, 3, 4]);

    const all = await persistence.getAllNodes(4);
    expect(all[0]?.user?.publicKey).toBeInstanceOf(Uint8Array);
    expect(Array.from(all[0]?.user?.publicKey ?? [])).toEqual([1, 2, 3, 4]);
  });

  it("revives legacy public keys stored as JSON numeric records", async () => {
    idbMem.set("nodeinfo:5:10", {
      num: 10,
      user: {
        longName: "legacy-node",
        publicKey: { 0: 8, 1: 9, 2: 10 },
      },
    });
    idbMem.set("nodeinfo:index:5", [10]);

    const got = await persistence.getNode(5, 10);
    expect(got?.user?.publicKey).toBeInstanceOf(Uint8Array);
    expect(Array.from(got?.user?.publicKey ?? [])).toEqual([8, 9, 10]);

    const all = await persistence.getAllNodes(5);
    expect(all[0]?.user?.publicKey).toBeInstanceOf(Uint8Array);
    expect(Array.from(all[0]?.user?.publicKey ?? [])).toEqual([8, 9, 10]);
  });

  it("deleteNode and clearDb", async () => {
    await persistence.putNode(3, makeNode(7) as any);
    await persistence.putNode(3, makeNode(8) as any);
    await persistence.deleteNode(3, 7);
    expect(await persistence.getNode(3, 7)).toBeUndefined();
    let keys = await persistence.listNodeKeys(3);
    expect(keys).toEqual([8]);
    await persistence.clearDb(3);
    expect(await persistence.getAllNodes(3)).toEqual([]);
    expect(await persistence.listNodeKeys(3)).toEqual([]);
  });
});
