import { beforeEach, describe, expect, it, vi } from "vitest";

const STORAGE_KEY = "darkmesh-dashboard-store";

async function freshStore() {
  vi.resetModules();
  return (await import("./store.ts")) as typeof import("./store.ts");
}

function makeTraceSelection() {
  return {
    id: 77,
    rxTime: "2026-05-05T10:00:00.000Z",
    type: "broadcast",
    from: 0x22,
    to: 0x11,
    channel: 0,
    data: {
      route: [0x33, 0x44],
      routeBack: [0x55],
      snrTowards: [16, 12],
      snrBack: [8],
    },
  };
}

describe("DarkMesh store persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("persists hunt drafts independently from the active hunt config", async () => {
    const { defaultHuntConfig, useDarkMeshStore } = await freshStore();
    const state = useDarkMeshStore.getState();

    const activeConfig = {
      ...defaultHuntConfig,
      enabled: true,
      endpoint: "https://active.example",
      token: "active-token",
      mode: "local" as const,
      backgroundMode: "fast" as const,
      forwardedCount: 3,
    };
    const draftConfig = {
      ...defaultHuntConfig,
      enabled: false,
      endpoint: "https://draft.example",
      token: "draft-token",
      mode: "both" as const,
      backgroundMode: "slow" as const,
    };

    state.upsertHuntConfig(5, activeConfig);
    state.upsertHuntDraft(5, draftConfig);

    expect(useDarkMeshStore.getState().huntByDevice[5]).toMatchObject(activeConfig);
    expect(useDarkMeshStore.getState().huntDraftByDevice[5]).toMatchObject(draftConfig);

    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    expect(persisted.state.huntByDevice[5]).toMatchObject(activeConfig);
    expect(persisted.state.huntDraftByDevice[5]).toMatchObject(draftConfig);

    const rehydrated = (await freshStore()).useDarkMeshStore.getState();
    expect(rehydrated.huntByDevice[5]).toMatchObject(activeConfig);
    expect(rehydrated.huntDraftByDevice[5]).toMatchObject(draftConfig);
  });

  it("rehydrates the selected traceroute overlay", async () => {
    const { useDarkMeshStore } = await freshStore();
    const traceSelection = makeTraceSelection();

    useDarkMeshStore.getState().setSelectedTraceRoute(traceSelection as never);

    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    expect(persisted.state.selectedTraceRoute).toMatchObject({
      from: 0x22,
      to: 0x11,
      data: {
        route: [0x33, 0x44],
        routeBack: [0x55],
      },
    });

    const rehydrated = (await freshStore()).useDarkMeshStore.getState();
    expect(rehydrated.selectedTraceRoute).toMatchObject({
      from: 0x22,
      to: 0x11,
      data: {
        route: [0x33, 0x44],
        routeBack: [0x55],
      },
    });
  });

  it("persists compression mode and mesh stats per device", async () => {
    const { defaultMeshStats, useDarkMeshStore } = await freshStore();
    const state = useDarkMeshStore.getState();

    state.setCompressionMode(7, "remote");
    state.incrementTraceTotal(7);
    state.incrementTraceSuccess(7);
    state.recordTraceDistance(7, 12.6);
    state.addCompressionSavings(7, 25, 123.4);

    expect(useDarkMeshStore.getState().compressionModeByDevice?.[7]).toBe("remote");
    expect(useDarkMeshStore.getState().meshStatsByDevice?.[7]).toMatchObject({
      traceTotal: 1,
      traceSuccess: 1,
      traceLongestKm: 13,
      traceMaxTraveledKm: 13,
      compressionSentTotal: 1,
      compressionBytesSaved: 25,
      compressionAirtimeSavedMs: 123.4,
    });

    state.resetMeshStats(7, "compression");

    expect(useDarkMeshStore.getState().meshStatsByDevice?.[7]).toMatchObject({
      traceTotal: 1,
      traceSuccess: 1,
      traceLongestKm: 13,
      traceMaxTraveledKm: 13,
      compressionSentTotal: 0,
      compressionBytesSaved: 0,
      compressionAirtimeSavedMs: 0,
    });

    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    expect(persisted.state.compressionModeByDevice[7]).toBe("remote");
    expect(persisted.state.meshStatsByDevice[7]).toMatchObject({
      traceTotal: 1,
      compressionSentTotal: 0,
    });

    const rehydratedStore = (await freshStore()).useDarkMeshStore;
    expect(rehydratedStore.getState().compressionModeByDevice?.[7]).toBe("remote");
    expect(rehydratedStore.getState().meshStatsByDevice?.[7]).toMatchObject({
      traceTotal: 1,
      compressionSentTotal: 0,
    });

    rehydratedStore.getState().resetMeshStats(7);
    expect(rehydratedStore.getState().meshStatsByDevice?.[7]).toEqual(defaultMeshStats);
  });
});
