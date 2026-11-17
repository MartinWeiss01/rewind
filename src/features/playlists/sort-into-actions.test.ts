import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDemoDataSource } from "@/data/demo/demo-data-source";
import type { MusicDataSource } from "@/data/music-data-source";
import { emptyDemoSessionState } from "@/demo/session-state";
import type { FeatureFlag } from "@/server/feature-flags";

const now = new Date("2026-11-15T20:00:00Z");
const context: { source: MusicDataSource; flags: Set<FeatureFlag> } = {
  source: undefined as unknown as MusicDataSource,
  flags: new Set(),
};

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/server/request-context", () => ({
  getRequestContext: async () => ({ ...context, viewer: { mode: "demo" }, now }),
}));

const { applySortAction, suggestSortAction } = await import("./sort-into-actions");

const SOURCE = "demo-playlist-01";
const TARGET_A = "demo-playlist-02";
const TARGET_B = "demo-playlist-03";

beforeEach(() => {
  vi.stubEnv("DEMO_LIVE_AI", "false");
  context.source = createDemoDataSource({
    state: emptyDemoSessionState("Europe/Berlin"),
    now,
    commit: async () => {},
  });
  context.flags = new Set(["playlistWrite", "ai"]);
});

async function ids(id: string) {
  const playlist = await context.source.getPlaylist(id);
  if (!playlist?.items) throw new Error("missing playlist");
  return { playlist, ids: playlist.items.map((i) => i.track.id) };
}

describe("suggestSortAction", () => {
  it("needs the AI and playlist-write flags", async () => {
    context.flags = new Set(["playlistWrite"]);
    expect(await suggestSortAction({ playlistId: SOURCE, targetIds: [TARGET_A] })).toEqual({
      status: "error",
      error: "forbidden",
    });
  });

  it("refuses the source as a target", async () => {
    expect(await suggestSortAction({ playlistId: SOURCE, targetIds: [SOURCE] })).toEqual({
      status: "error",
      error: "invalid",
    });
  });

  it("answers with pre-made suggestions in the demo, one per distinct track", async () => {
    const result = await suggestSortAction({ playlistId: SOURCE, targetIds: [TARGET_A, TARGET_B] });
    if (result.status !== "ok") throw new Error(result.error);
    expect(result.live).toBe(false);
    const { ids: sourceIds } = await ids(SOURCE);
    expect(result.suggestions.map((s) => s.trackId)).toEqual([...new Set(sourceIds)]);
    for (const s of result.suggestions) {
      expect([TARGET_A, TARGET_B, null]).toContain(s.targetId);
    }
  });
});

describe("applySortAction", () => {
  it("moves tracks into the targets with snapshots, and out of the source", async () => {
    const { playlist, ids: sourceIds } = await ids(SOURCE);
    const before = (await ids(TARGET_A)).ids;
    const moving = sourceIds.filter((id) => !before.includes(id)).slice(0, 2);
    const result = await applySortAction({
      playlistId: SOURCE,
      basedOn: playlist.snapshotId,
      moves: moving.map((trackId) => ({ trackId, targetId: TARGET_A })),
      removeFromSource: true,
      skipExisting: true,
    });
    expect(result).toMatchObject({ status: "ok", count: 2, playlistId: SOURCE });
    expect((await ids(TARGET_A)).ids).toEqual([...before, ...moving]);
    expect((await ids(SOURCE)).ids).toEqual(sourceIds.filter((id) => !moving.includes(id)));
    expect((await context.source.listSnapshots(TARGET_A))[0]?.label).toBe("moveIn:2");
    expect((await context.source.listSnapshots(SOURCE))[0]?.label).toBe("moveOut:2");
  });

  it("refuses a stale source and tracks it doesn't hold", async () => {
    const { playlist } = await ids(SOURCE);
    expect(
      await applySortAction({
        playlistId: SOURCE,
        basedOn: "old",
        moves: [{ trackId: "x", targetId: TARGET_A }],
        removeFromSource: false,
        skipExisting: true,
      }),
    ).toEqual({ status: "error", error: "stale" });
    expect(
      await applySortAction({
        playlistId: SOURCE,
        basedOn: playlist.snapshotId,
        moves: [{ trackId: "not-in-source", targetId: TARGET_A }],
        removeFromSource: false,
        skipExisting: true,
      }),
    ).toEqual({ status: "error", error: "invalid" });
  });
});
