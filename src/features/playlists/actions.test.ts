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
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string, values?: Record<string, string>) =>
    key === "newName" ? `${values?.name} · ${values?.group}` : key,
}));
vi.mock("@/server/request-context", () => ({
  getRequestContext: async () => ({ ...context, viewer: { mode: "demo" }, now }),
}));

const { applyEditAction, createPlaylistAction, mergeAction, restoreSnapshotAction, splitAction } =
  await import("./actions");

const PLAYLIST = "demo-playlist-01";
const FOLLOWED = "demo-playlist-12";

beforeEach(() => {
  context.source = createDemoDataSource({
    state: emptyDemoSessionState("Europe/Berlin"),
    now,
    commit: async () => {},
  });
  context.flags = new Set(["playlistWrite"]);
});

async function current(id = PLAYLIST) {
  const playlist = await context.source.getPlaylist(id);
  if (!playlist?.items) throw new Error("missing playlist");
  return { playlist, ids: playlist.items.map((i) => i.track.id) };
}

describe("playlist actions", () => {
  it("rejects writes without the playlistWrite flag", async () => {
    context.flags = new Set();
    const { playlist, ids } = await current();
    const result = await applyEditAction({
      playlistId: PLAYLIST,
      basedOn: playlist.snapshotId,
      trackIds: ids.slice(1),
      kind: "edit",
    });
    expect(result).toEqual({ status: "error", error: "forbidden" });
    expect((await current()).ids).toEqual(ids);
  });

  it("validates input", async () => {
    expect(await applyEditAction({ playlistId: 3 })).toEqual({ status: "error", error: "invalid" });
    expect(await createPlaylistAction({ name: " ", description: "", isPublic: false })).toEqual({
      status: "error",
      error: "invalid",
    });
  });

  it("snapshots before an edit, then writes, and can restore", async () => {
    const { playlist, ids } = await current();
    const result = await applyEditAction({
      playlistId: PLAYLIST,
      basedOn: playlist.snapshotId,
      trackIds: ids.slice(2),
      kind: "edit",
    });
    expect(result).toMatchObject({ status: "ok", count: 2 });
    expect((await current()).ids).toEqual(ids.slice(2));

    const [snapshot] = await context.source.listSnapshots(PLAYLIST);
    expect(snapshot?.trackIds).toEqual(ids);
    expect(snapshot?.label).toBe("edit:2");

    if (result.status !== "ok" || !result.snapshotId) throw new Error("no snapshot");
    const restored = await restoreSnapshotAction({
      playlistId: PLAYLIST,
      snapshotId: result.snapshotId,
    });
    expect(restored).toMatchObject({ status: "ok" });
    expect((await current()).ids).toEqual(ids);
    // The restore saved the edited list first, so it can be undone too.
    expect(await context.source.listSnapshots(PLAYLIST)).toHaveLength(2);
  });

  it("refuses stale edits and lists that add tracks", async () => {
    const { playlist, ids } = await current();
    expect(
      await applyEditAction({ playlistId: PLAYLIST, basedOn: "old", trackIds: ids, kind: "sort" }),
    ).toEqual({ status: "error", error: "stale" });
    expect(
      await applyEditAction({
        playlistId: PLAYLIST,
        basedOn: playlist.snapshotId,
        trackIds: [...ids, "invented-track"],
        kind: "sort",
      }),
    ).toEqual({ status: "error", error: "invalid" });
  });

  it("refuses to edit a followed playlist", async () => {
    expect(
      await applyEditAction({ playlistId: FOLLOWED, basedOn: "x", trackIds: [], kind: "edit" }),
    ).toEqual({ status: "error", error: "readOnly" });
  });

  it("reports a partial failure with the snapshot to restore", async () => {
    const { playlist, ids } = await current();
    context.source = {
      ...context.source,
      replacePlaylistItems: async () => {
        throw new Error("rate limited");
      },
    };
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await applyEditAction({
      playlistId: PLAYLIST,
      basedOn: playlist.snapshotId,
      trackIds: [...ids].reverse(),
      kind: "sort",
    });
    expect(result).toMatchObject({ status: "partial", stage: "items", playlistId: PLAYLIST });
    if (result.status !== "partial") throw new Error("expected partial");
    expect(result.snapshotId).toBeTruthy();
  });

  it("merges into an existing playlist, skipping tracks already there", async () => {
    const target = await current(PLAYLIST);
    const source = await current("demo-playlist-02");
    const result = await mergeAction({
      targetId: PLAYLIST,
      newName: null,
      sourceIds: ["demo-playlist-02"],
      skipExisting: true,
      deleteSources: false,
    });
    const after = await current(PLAYLIST);
    const newOnes = [...new Set(source.ids)].filter((id) => !target.ids.includes(id));
    expect(result).toMatchObject({ status: "ok", count: newOnes.length });
    expect(after.ids).toEqual([...target.ids, ...newOnes]);
    expect(await context.source.listSnapshots(PLAYLIST)).toHaveLength(1);
  });

  it("merges into a new playlist and deletes the editable sources", async () => {
    const result = await mergeAction({
      targetId: null,
      newName: "Invented mix",
      sourceIds: ["demo-playlist-02", "demo-playlist-03"],
      skipExisting: true,
      deleteSources: true,
    });
    expect(result).toMatchObject({ status: "ok" });
    const names = (await context.source.listPlaylists()).map((p) => p.id);
    expect(names).not.toContain("demo-playlist-02");
    expect(names).not.toContain("demo-playlist-03");
  });

  it("splits into new playlists and leaves the original alone", async () => {
    const before = await current();
    const count = (await context.source.listPlaylists()).length;
    const result = await splitAction({ playlistId: PLAYLIST, by: "year", minSize: 3 });
    expect(result).toMatchObject({ status: "ok" });
    if (result.status !== "ok") throw new Error("expected ok");
    const after = await context.source.listPlaylists();
    expect(after).toHaveLength(count + result.count);
    expect(after.at(-1)?.name.startsWith(before.playlist.name)).toBe(true);
    expect((await current()).ids).toEqual(before.ids);
  });
});
