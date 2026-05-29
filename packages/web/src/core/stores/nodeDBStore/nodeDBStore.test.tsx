import { create } from "@bufbuild/protobuf";
import { Protobuf } from "@meshtastic/core";
import { act, render, screen, waitFor } from "@testing-library/react";
import { toByteArray } from "base64-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NodeDB } from "./index.ts";

const idbMem = new Map<string, any>();
vi.mock("idb-keyval", () => ({
  get: vi.fn((key: string) => Promise.resolve(idbMem.get(key))),
  set: vi.fn((key: string, val: string) => {
    idbMem.set(key, val);
    return Promise.resolve();
  }),
  del: vi.fn((k: string) => {
    idbMem.delete(k);
    return Promise.resolve();
  }),
}));

let deviceIdForTests = 1;
vi.mock("@core/hooks/useDeviceContext", () => ({
  useDeviceContext: () => ({ deviceId: deviceIdForTests }),
  __setDeviceId: (id: number) => {
    deviceIdForTests = id;
  },
}));

// import a fresh copy of the store module (because the store is created at import time)
async function freshStore(persist = false) {
  vi.resetModules();

  // suppress console output from the store during tests (for github actions)
  vi.spyOn(console, "debug").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});

  vi.doMock("@core/services/featureFlags", () => ({
    featureFlags: {
      get: vi.fn((key: string) => (key === "persistNodeDB" ? persist : false)),
    },
  }));

  const storeMod = await import("./index.ts");
  const { useNodeDB } = await import("../index.ts");
  return { ...storeMod, useNodeDB };
}

function makeNode(num: number, extras: Record<string, any> = {}) {
  return create(Protobuf.Mesh.NodeInfoSchema, { num, ...extras });
}
function makeUser(fields: Record<string, any>) {
  return create(Protobuf.Mesh.UserSchema, fields);
}
function makePosition(fields: Record<string, any>) {
  return create(Protobuf.Mesh.PositionSchema, fields);
}

describe("NodeDB store", () => {
  beforeEach(() => {
    idbMem.clear();
    vi.clearAllMocks();
  });

  it("addNodeDB returns same instance on repeated calls; getNodeDB works", async () => {
    const { useNodeDBStore } = await freshStore();

    const db1 = useNodeDBStore.getState().addNodeDB(123);
    const db2 = useNodeDBStore.getState().addNodeDB(123);
    expect(db1).toStrictEqual(db2);

    const got = useNodeDBStore.getState().getNodeDB(123);
    expect(got).toStrictEqual(db1);

    expect(useNodeDBStore.getState().getNodeDBs().length).toBe(1);
  });

  it("addNode, getNode(s), getNodesLength, removeNode", async () => {
    const { useNodeDBStore } = await freshStore();
    const db = useNodeDBStore.getState().addNodeDB(1);

    db.addNode(makeNode(10));
    db.addNode(makeNode(11));
    expect(db.getNodesLength()).toBe(2);
    expect(db.getNode(10)?.num).toBe(10);

    const all = db.getNodes();
    expect(all.map((n) => n.num).sort()).toEqual([10, 11]);

    db.removeNode(10);
    expect(db.getNodesLength()).toBe(1);
    expect(db.getNode(10)).toBeUndefined();
  });

  it("processPacket creates or updates a node", async () => {
    const { useNodeDBStore } = await freshStore();
    const db = useNodeDBStore.getState().addNodeDB(1);

    db.processPacket({ from: 50, time: 1111, snr: 7, hopStart: 3, hopLimit: 3 });
    expect(db.getNode(50)).toBeTruthy();
    expect(db.getNode(50)?.lastHeard).toBe(1111);
    expect(db.getNode(50)?.snr).toBe(7);
    expect(db.getNode(50)?.hopsAway).toBe(0);

    db.processPacket({ from: 50, time: 2222, snr: 9, hopStart: 5, hopLimit: 3 });
    expect(db.getNode(50)?.lastHeard).toBe(2222);
    expect(db.getNode(50)?.snr).toBe(9);
    expect(db.getNode(50)?.hopsAway).toBe(2);

    db.processPacket({ from: 50, time: 0, snr: 9 });
    expect(db.getNode(50)?.lastHeard).toBeCloseTo(Date.now() / 1000, -1); // within 1s, note lastHeard is in seconds
    expect(db.getNode(50)?.snr).toBe(9);
    expect(db.getNode(50)?.hopsAway).toBe(2);
  });

  it("processPacket marks packet hop metadata with zero hopStart or inverted limits as unknown", async () => {
    const { useNodeDBStore } = await freshStore();
    const db = useNodeDBStore.getState().addNodeDB(1);

    db.processPacket({ from: 51, time: 1111, snr: 7, hopStart: 3, hopLimit: 3 });
    expect(db.getNode(51)?.hopsAway).toBe(0);

    db.processPacket({ from: 51, time: 2222, snr: 8, hopStart: 0, hopLimit: 0 });
    expect(db.getNode(51)?.hopsAway).toBeUndefined();

    db.processPacket({ from: 51, time: 3333, snr: 9, hopStart: 2, hopLimit: 3 });
    expect(db.getNode(51)?.hopsAway).toBeUndefined();
  });

  it("addUser and addPosition updates existing or creates new nodes", async () => {
    const { useNodeDBStore } = await freshStore();
    const db = useNodeDBStore.getState().addNodeDB(1);

    // addUser creates node if missing
    db.addUser({ from: 77, data: { id: "u" } } as any);
    expect(db.getNode(77)?.user).toEqual({ id: "u" });

    // addPosition updates same node
    db.addPosition({ from: 77, data: { lat: 1, lon: 2 } } as any);
    expect(db.getNode(77)?.position).toEqual({
      lat: 1,
      lon: 2,
      latitudeI: 10000000,
      longitudeI: 20000000,
    });
    expect(db.getNode(77)?.num).toBe(77);
  });

  it("stores latest power metrics by node id", async () => {
    const { useNodeDBStore } = await freshStore();
    const db = useNodeDBStore.getState().addNodeDB(1);

    const powerMetrics = create(Protobuf.Telemetry.PowerMetricsSchema, {
      ch1Voltage: 3.3,
      ch1Current: 12.5,
    });

    db.addTelemetry({
      from: 22,
      rxTime: new Date(123_000),
      rxSnr: 4,
      data: create(Protobuf.Telemetry.TelemetrySchema, {
        variant: {
          case: "powerMetrics",
          value: powerMetrics,
        },
      }),
    } as any);

    expect(db.getPowerMetrics(22)).toEqual(powerMetrics);
    expect(db.getNode(22)?.lastHeard).toBe(123);
    expect(db.getNode(22)?.snr).toBe(4);
  });

  it("tracks unread and read status message state across updates", async () => {
    const { useNodeDBStore } = await freshStore();
    const db = useNodeDBStore.getState().addNodeDB(1);

    db.updateNodeStatus(88, "  Battery low  ");

    const withStatus = db.getNode(88) as Protobuf.Mesh.NodeInfo & {
      nodeStatus?: string;
      lastReadNodeStatus?: string;
    };
    expect(withStatus.num).toBe(88);
    expect(withStatus.nodeStatus).toBe("Battery low");
    expect(withStatus.lastReadNodeStatus).toBeUndefined();

    db.markNodeStatusRead(88);

    const read = db.getNode(88) as Protobuf.Mesh.NodeInfo & {
      nodeStatus?: string;
      lastReadNodeStatus?: string;
    };
    expect(read.lastReadNodeStatus).toBe("Battery low");

    db.updateNodeStatus(88, "Battery ok");

    const updated = db.getNode(88) as Protobuf.Mesh.NodeInfo & {
      nodeStatus?: string;
      lastReadNodeStatus?: string;
    };
    expect(updated.nodeStatus).toBe("Battery ok");
    expect(updated.lastReadNodeStatus).toBe("Battery low");

    db.updateNodeStatus(88, "   ");

    const cleared = db.getNode(88) as Protobuf.Mesh.NodeInfo & {
      nodeStatus?: string;
      lastReadNodeStatus?: string;
    };
    expect(cleared.nodeStatus).toBeUndefined();
    expect(cleared.lastReadNodeStatus).toBeUndefined();
  });

  it("errors map: setNodeError, getNodeError, hasNodeError, clearNodeError", async () => {
    const { useNodeDBStore } = await freshStore();
    const db = useNodeDBStore.getState().addNodeDB(1);

    db.setNodeError(10, "BadFoo" as any);
    expect(db.hasNodeError(10)).toBe(true);
    expect(db.getNodeError(10)).toEqual({ node: 10, error: "BadFoo" });

    db.clearNodeError(10);
    expect(db.hasNodeError(10)).toBe(false);
    expect(db.getNodeError(10)).toBeUndefined();
  });

  it("getMyNode returns undefined before setNodeNum; works after", async () => {
    const { useNodeDBStore } = await freshStore();
    const db = useNodeDBStore.getState().addNodeDB(1);
    db.addNode(makeNode(123));

    expect(db.getMyNode()).toBeUndefined();
    db.setNodeNum(123);

    const me = db.getMyNode();
    expect(me?.num).toBe(123);
  });

  it("setNodeNum merges with existing DB with same myNodeNum", async () => {
    const { useNodeDBStore } = await freshStore();
    const st = useNodeDBStore.getState();

    const oldDB = st.addNodeDB(10);
    oldDB.setNodeNum(999);
    oldDB.addNode(makeNode(200));
    oldDB.setNodeError(200, "ERROR" as any);
    const powerMetrics = create(Protobuf.Telemetry.PowerMetricsSchema, { ch1Voltage: 4.2 });
    oldDB.addTelemetry({
      from: 200,
      rxTime: new Date(),
      data: create(Protobuf.Telemetry.TelemetrySchema, {
        variant: {
          case: "powerMetrics",
          value: powerMetrics,
        },
      }),
    } as any);

    const newDB = st.addNodeDB(11);
    // newDB currently empty; setting same myNodeNum should copy maps from oldDB and delete old
    newDB.setNodeNum(999);

    expect(st.getNodeDB(10)).toBeUndefined();
    expect(st.getNodeDB(11)).toBeDefined();
    expect(newDB.getNode(200)).toBeTruthy();
    expect(newDB.getNodeError(200)).toEqual({ node: 200, error: "ERROR" });
    expect(newDB.getPowerMetrics(200)).toEqual(powerMetrics);
  });

  it("partialize persists only data, and onRehydrateStorage rebuilds methods", async () => {
    const persistedPublicKey = toByteArray("40g5tLC6A+tXE92EyhwVwdiKsXwa1QUjZjkzEi0pCy4=");

    {
      const { useNodeDBStore } = await freshStore(true); // with persistence
      const st = useNodeDBStore.getState();
      const db = st.addNodeDB(123);
      db.setNodeNum(321);
      db.addNode(
        makeNode(50, {
          user: makeUser({ publicKey: persistedPublicKey, longName: "keyed-50" }),
        }),
      );
      db.setNodeError(50, "ERROR" as any);
    }
    {
      const { useNodeDBStore } = await freshStore(true); // with persistence
      const st = useNodeDBStore.getState();
      const db = st.getNodeDB(123)!;

      // methods should work after rehydrate
      expect(db.getNode(50)?.num).toBe(50);
      expect(db.getNode(50)?.user?.publicKey).toBeInstanceOf(Uint8Array);
      expect(db.getNode(50)?.user?.publicKey).toEqual(persistedPublicKey);
      expect(db.getNodeError(50)).toEqual({ node: 50, error: "ERROR" });
      db.addNode(makeNode(51));
      expect(db.getNode(51)).toBeTruthy();
    }
  });

  it("getNodes applies filter and excludes myNodeNum", async () => {
    const { useNodeDBStore } = await freshStore();
    const db = useNodeDBStore.getState().addNodeDB(1);
    db.setNodeNum(11);
    db.addNode(makeNode(10));
    db.addNode(makeNode(11));
    db.addNode(makeNode(12));

    const all = db.getNodes();
    expect(all.map((n) => n.num).sort()).toEqual([10, 12]); // excludes my (11)

    const filtered = db.getNodes((n) => n.num > 10);
    expect(filtered.map((n) => n.num).sort()).toEqual([12]); // still excludes 11
  });

  it("will prune nodes after 14 days of inactivity and clear persisted entries", async () => {
    const { useNodeDBStore } = await freshStore();
    const st = useNodeDBStore.getState();
    const nowSec = Math.floor(Date.now() / 1000);
    const db = st.addNodeDB(1);
    db.processPacket({ from: 1, time: nowSec - 15 * 24 * 3600 } as any); // 15 days ago
    db.processPacket({ from: 2, time: nowSec - 7 * 24 * 3600 } as any); // 7 days ago

    await Promise.resolve();
    idbMem.set("nodeinfo:1:1", makeNode(1));
    idbMem.set("nodeinfo:1:2", makeNode(2));
    idbMem.set("nodeinfo:index:1", [1, 2]);

    expect(db.pruneStaleNodes()).toBe(1);
    expect(db.getNode(1)).toBeUndefined();
    expect(db.getNode(2)).toBeDefined();
    await waitFor(() => expect(idbMem.has("nodeinfo:1:1")).toBe(false));
    expect(idbMem.has("nodeinfo:1:2")).toBe(true);
  });

  it("removeNodeDB persists removal across reload", async () => {
    {
      const { useNodeDBStore } = await freshStore(true); // with persistence
      const st = useNodeDBStore.getState();
      st.addNodeDB(99);
      expect(st.getNodeDB(99)).toBeDefined();
      st.removeNodeDB(99);
      expect(st.getNodeDB(99)).toBeUndefined();
    }
    {
      const { useNodeDBStore } = await freshStore(true); // with persistence
      const st = useNodeDBStore.getState();
      expect(st.getNodeDB(99)).toBeUndefined(); // still gone
    }
  });

  it("on rehydrate only rebuilds DBs with myNodeNum set (orphans dropped)", async () => {
    {
      const { useNodeDBStore } = await freshStore(true); // with persistence
      const st = useNodeDBStore.getState();

      const orphan = st.addNodeDB(500); // no setNodeNum
      orphan.addNode(makeNode(1));

      const good = st.addNodeDB(501);
      good.setNodeNum(42);
      good.addNode(makeNode(2));
    }
    {
      const { useNodeDBStore } = await freshStore(true); // with persistence
      const st = useNodeDBStore.getState();
      expect(st.getNodeDB(500)).toBeUndefined(); // orphan dropped
      expect(st.getNodeDB(501)).toBeDefined(); // kept
      expect(st.getNodeDB(501)!.getNode(2)).toBeTruthy();
    }
  });

  it("methods throw after their DB is removed from the map", async () => {
    const { useNodeDBStore } = await freshStore();
    const st = useNodeDBStore.getState();
    const db = st.addNodeDB(800);

    st.removeNodeDB(800);

    expect(() => db.getNodesLength()).toThrow(/No nodeDB found/);
    expect(() => db.addNode(makeNode(1))).toThrow(/No nodeDB found/);
  });
});

describe("NodeDB – merge semantics, PKI checks & extras", () => {
  const keyOld = toByteArray("40g5tLC6A+tXE92EyhwVwdiKsXwa1QUjZjkzEi0pCy4=");
  const keyNew = toByteArray("osxYoEP43oDeWZyjyKx1wz/5cvwEOthHB6AhO2fXEQg=");

  it("upserts node", async () => {
    const { useNodeDBStore } = await freshStore();
    const st = useNodeDBStore.getState();

    const oldDB = st.addNodeDB(10);
    oldDB.setNodeNum(999);
    oldDB.addNode(makeNode(200, { position: { altitude: 100 } }));

    const newDB = st.addNodeDB(11);
    newDB.addNode(makeNode(300));
    newDB.addNode(makeNode(200, { position: { altitude: 120 } }));
    newDB.setNodeNum(999);

    expect(st.getNodeDB(10)).toBeUndefined(); // old db removed
    expect(newDB.getNode(300)).toBeTruthy(); // node kept
    const n200 = newDB.getNode(200)!;
    expect(n200.position?.altitude).toBe(120); // replace existing
  });

  it("key conflict: keep trusted key, accept latest metadata, flag error", async () => {
    const { useNodeDBStore } = await freshStore();
    const st = useNodeDBStore.getState();

    const oldDB = st.addNodeDB(20);
    oldDB.setNodeNum(42);
    oldDB.addNode(
      makeNode(7, {
        user: makeUser({ publicKey: keyOld, longName: "old-7" }),
        position: makePosition({ latitudeI: 11, longitudeI: 22 }),
      }),
    );
    const newDB = st.addNodeDB(21);
    newDB.addNode(
      makeNode(7, {
        user: makeUser({ publicKey: keyNew, longName: "new-7" }),
        position: makePosition({ latitudeI: 33 }),
      }),
    );
    newDB.setNodeNum(42);

    const n7 = newDB.getNode(7)!;

    // metadata from latest broadcast, key from previously trusted node
    expect(n7.user?.longName).toBe("new-7");
    expect(n7.user?.publicKey).toEqual(keyOld);
    expect(n7.position?.latitudeI).toBe(33);
    expect(n7.position?.longitudeI).toBeUndefined();

    // error flagged
    const err = newDB.getNodeError(7);
    expect(err).toBeTruthy();
    expect(String(err!.error)).toMatch(/MISMATCH|PK/i);
  });

  it("empty new key; preserve old key while accepting new metadata", async () => {
    const { useNodeDBStore } = await freshStore();
    const st = useNodeDBStore.getState();

    const oldDB = st.addNodeDB(30);
    oldDB.setNodeNum(77);
    oldDB.addNode(makeNode(5, { user: { publicKey: keyOld, longName: "old-5" } }));

    const newDB = st.addNodeDB(31);
    newDB.addNode(makeNode(5, { user: { publicKey: new Uint8Array(), longName: "new-5" } }));

    newDB.setNodeNum(77);

    // keep old PK, but accept non-key data from the newer node
    const n5 = newDB.getNode(5)!;
    expect(n5.user?.publicKey).toEqual(keyOld);
    expect(n5.user?.longName).toBe("new-5");

    // error not flagged
    const err = newDB!.getNodeError(5);
    expect(err).toBeUndefined();
  });

  it("old key empty, new key present, store new node", async () => {
    const { useNodeDBStore } = await freshStore();
    const st = useNodeDBStore.getState();

    const oldDB = st.addNodeDB(40);
    oldDB.setNodeNum(1001);
    oldDB.addNode(makeNode(8, { user: { longName: "old-8" } })); // no key

    const newDB = st.addNodeDB(41);
    newDB.addNode(
      makeNode(8, {
        user: { publicKey: keyNew, longName: "new-8" },
        position: { altitude: 555 },
      }),
    );

    newDB.setNodeNum(1001);

    // node from new
    const n8 = newDB.getNode(8)!;
    expect(n8.user?.longName).toBe("new-8");
    expect(n8.user?.publicKey).toEqual(keyNew);
    expect(n8.position?.altitude).toBe(555);

    // no error
    const err = newDB.getNodeError(8);
    expect(err).toBeFalsy();
  });

  it("preserves existing public key while accepting NodeInfo updates with an empty key", async () => {
    const { useNodeDBStore } = await freshStore();
    const db = useNodeDBStore.getState().addNodeDB(42);

    db.addNode(
      makeNode(5, {
        user: makeUser({ publicKey: keyOld, longName: "old-5", shortName: "o5" }),
        position: makePosition({ altitude: 100 }),
      }),
    );
    db.addNode(
      makeNode(5, {
        user: makeUser({ publicKey: new Uint8Array(), longName: "new-5", shortName: "n5" }),
        position: makePosition({ altitude: 250 }),
      }),
    );

    const node = db.getNode(5)!;
    expect(node.user?.longName).toBe("new-5");
    expect(node.user?.shortName).toBe("n5");
    expect(node.user?.publicKey).toEqual(keyOld);
    expect(node.position?.altitude).toBe(250);
    expect(db.getNodeError(5)).toBeUndefined();
  });

  it("preserves existing public key when a user packet omits it", async () => {
    const { useNodeDBStore } = await freshStore();
    const db = useNodeDBStore.getState().addNodeDB(42);

    db.addNode(makeNode(5, { user: { publicKey: keyOld, longName: "old-5" } }));
    db.addUser({
      from: 5,
      to: 0,
      id: 123,
      rxTime: new Date(),
      data: makeUser({ longName: "new-5", shortName: "n5", publicKey: new Uint8Array() }),
    } as any);

    const node = db.getNode(5)!;
    expect(node.user?.longName).toBe("new-5");
    expect(node.user?.shortName).toBe("n5");
    expect(node.user?.publicKey).toEqual(keyOld);
  });

  it("rejects duplicate public keys by byte value, not Uint8Array identity", async () => {
    const { useNodeDBStore } = await freshStore();
    const db = useNodeDBStore.getState().addNodeDB(43);

    db.addNode(makeNode(5, { user: makeUser({ publicKey: keyOld, longName: "node-5" }) }));
    db.addNode(
      makeNode(6, {
        user: makeUser({ publicKey: new Uint8Array(keyOld), longName: "node-6" }),
      }),
    );

    expect(db.getNode(6)).toBeUndefined();
    expect(db.getNodeError(6)?.error).toBe("DUPLICATE_PKI");
  });

  it("keeps the trusted user packet public key and flags the change", async () => {
    const { useNodeDBStore } = await freshStore();
    const db = useNodeDBStore.getState().addNodeDB(44);

    db.addNode(makeNode(5, { user: makeUser({ publicKey: keyOld, longName: "old-5" }) }));
    db.addUser({
      from: 5,
      to: 0,
      id: 124,
      rxTime: new Date(),
      data: makeUser({ publicKey: keyNew, longName: "new-5" }),
    } as any);

    const node = db.getNode(5)!;
    expect(node.user?.longName).toBe("new-5");
    expect(node.user?.publicKey).toEqual(keyOld);
    expect(db.getNodeError(5)?.error).toBe("MISMATCH_PKI");
  });

  it("keeps mismatch PKI sticky across later broadcasts with the conflicting key", async () => {
    const { useNodeDBStore } = await freshStore();
    const db = useNodeDBStore.getState().addNodeDB(45);

    db.addNode(makeNode(5, { user: makeUser({ publicKey: keyOld, longName: "old-5" }) }));
    db.addUser({
      from: 5,
      to: 0,
      id: 124,
      rxTime: new Date(),
      data: makeUser({ publicKey: keyNew, longName: "new-5" }),
    } as any);

    expect(db.getNodeError(5)?.error).toBe("MISMATCH_PKI");

    db.addUser({
      from: 5,
      to: 0,
      id: 125,
      rxTime: new Date(),
      data: makeUser({ publicKey: keyNew, longName: "newer-5" }),
    } as any);

    expect(db.getNode(5)?.user?.longName).toBe("newer-5");
    expect(db.getNode(5)?.user?.publicKey).toEqual(keyOld);
    expect(db.getNodeError(5)?.error).toBe("MISMATCH_PKI");
  });

  it("accepts a changed user.id on the same node number like Android does", async () => {
    const { useNodeDBStore } = await freshStore();
    const db = useNodeDBStore.getState().addNodeDB(46);

    db.addNode(
      makeNode(9, {
        user: makeUser({ id: "!oldnode", publicKey: keyOld, longName: "old-9" }),
      }),
    );
    db.addUser({
      from: 9,
      to: 0,
      id: 126,
      rxTime: new Date(),
      data: makeUser({ id: "!newnode", publicKey: keyOld, longName: "new-9" }),
    } as any);

    const node = db.getNode(9)!;
    expect(node.user?.id).toBe("!newnode");
    expect(node.user?.longName).toBe("new-9");
    expect(node.user?.publicKey).toEqual(keyOld);
    expect(db.getNodeError(9)).toBeUndefined();
  });

  it("unions nodeErrors: preserves old and new, respects existing-on-conflict", async () => {
    const { useNodeDBStore } = await freshStore();
    const st = useNodeDBStore.getState();

    const oldDB = st.addNodeDB(50);
    oldDB.setNodeNum(2020);
    oldDB.addNode(makeNode(1, { user: { longName: "old-1" } }));
    oldDB.setNodeError(1, "OLD_ERR" as any);

    const newDB = st.addNodeDB(51);
    newDB.addNode(makeNode(1, { user: { longName: "new-1" } }));
    newDB.addNode(makeNode(2, { user: { longName: "new-2" } }));
    newDB.setNodeError(2, "NEW_ERR" as any);

    // also set overlapping error
    newDB.setNodeError(1, "SHOULD_NOT_OVERWRITE" as any);

    newDB.setNodeNum(2020);

    expect(newDB.getNodeError(1)!.error).toBe("OLD_ERR"); // old kept
    expect(newDB.getNodeError(2)!.error).toBe("NEW_ERR"); // new added
  });

  it("removeAllNodes (optionally keeping my node) and removeAllNodeErrors persist across reload", async () => {
    {
      const { useNodeDBStore } = await freshStore(true); // with persistence
      const st = useNodeDBStore.getState();
      const db = st.addNodeDB(1000);
      db.setNodeNum(55);
      db.addNode(makeNode(55, { user: { longName: "me" } }));
      db.addNode(makeNode(56));
      db.setNodeError(56, "ERR" as any);
      db.removeAllNodes(true);
      db.removeAllNodeErrors();
    }
    {
      const { useNodeDBStore } = await freshStore(true); // with persistence
      const st = useNodeDBStore.getState();
      const db = st.getNodeDB(1000)!;
      expect(db.getNode(55)).toBeTruthy(); // kept me
      expect(db.getNode(56)).toBeUndefined(); // cleared others
      expect(db.getNodeError(56)).toBeUndefined(); // cleared errors
    }
  });

  it("getMyNode works after merge establishes myNodeNum", async () => {
    const { useNodeDBStore } = await freshStore();
    const st = useNodeDBStore.getState();

    const oldDB = st.addNodeDB(1100);
    oldDB.setNodeNum(4242);
    oldDB.addNode(makeNode(4242));

    const newDB = st.addNodeDB(1101);
    newDB.setNodeNum(4242);

    expect(newDB.getMyNode()?.num).toBe(4242);
  });
});

describe("NodeDB deviceContext & debounce", () => {
  beforeEach(() => {
    idbMem.clear();
    vi.clearAllMocks();
  });

  it("useNodeDB resolves per-device DB and switches with deviceId", async () => {
    const { useNodeDBStore, useNodeDB } = await freshStore();

    // device 1
    deviceIdForTests = 1;
    const st = useNodeDBStore.getState();
    const db1 = st.addNodeDB(1);
    db1.addNode({ num: 10 } as any);

    function Comp() {
      const len = useNodeDB((db: NodeDB) => db.getNodesLength(), {
        debounce: 0,
        equality: (a: number, b: number) => a === b,
      });
      return <div data-testid="len">{len}</div>;
    }

    const { rerender } = render(<Comp />);
    expect(screen.getByTestId("len").textContent).toBe("1");

    // switch to device 2 and add nodes
    deviceIdForTests = 2;
    const db2 = st.addNodeDB(2);
    db2.addNode({ num: 20 } as any);
    db2.addNode({ num: 21 } as any);
    db2.addNode({ num: 22 } as any);

    // re-render so the hook re-subscribes with the new deviceId
    await act(async () => {
      rerender(<Comp />);
    });

    expect(screen.getByTestId("len").textContent).toBe("3");
  });

  it("useNodeDB selector re-renders only when the selected slice changes", async () => {
    const { useNodeDBStore, useNodeDB } = await freshStore();
    deviceIdForTests = 1;

    const st = useNodeDBStore.getState();
    const db = st.addNodeDB(1);

    let renders = 0;
    function Comp() {
      const len = useNodeDB((d: NodeDB) => d.getNodesLength(), {
        debounce: 0,
        equality: (a: number, b: number) => a === b,
      });
      renders++;
      return <div data-testid="len">{len}</div>;
    }

    render(<Comp />);
    expect(screen.getByTestId("len").textContent).toBe("0");
    expect(renders).toBe(1);

    // mutate something unrelated to length
    await act(async () => {
      db.setNodeError(999, "X" as any);
    });
    expect(screen.getByTestId("len").textContent).toBe("0");
    expect(renders).toBe(1); // no re-render

    // now actually change the slice
    await act(async () => {
      db.addNode({ num: 1 } as any);
    });
    expect(screen.getByTestId("len").textContent).toBe("1");
    expect(renders).toBe(2);
  });

  it("useNodeDB debounce coalesces rapid updates", async () => {
    vi.useFakeTimers();
    const { useNodeDBStore, useNodeDB } = await freshStore();
    deviceIdForTests = 1;

    const st = useNodeDBStore.getState();
    const db = st.addNodeDB(1);

    let renders = 0;
    function Comp() {
      const len = useNodeDB((d: NodeDB) => d.getNodesLength(), {
        debounce: 50,
        equality: (a: number, b: number) => a === b,
      });
      renders++;
      return <div data-testid="len">{len}</div>;
    }

    render(<Comp />);

    // burst of updates within the debounce window
    db.addNode({ num: 1 } as any);
    db.addNode({ num: 2 } as any);
    db.addNode({ num: 3 } as any);

    await act(() => {
      vi.advanceTimersByTime(49);
    });
    expect(renders).toBe(1); // not yet

    await act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(screen.getByTestId("len").textContent).toBe("3");
    expect(renders).toBe(2); // single coalesced re-render

    vi.useRealTimers();
  });
});
