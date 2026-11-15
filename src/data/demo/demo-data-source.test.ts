import { describe, expect, it } from "vitest";
import { emptyDemoSessionState } from "@/demo/session-state";
import { intervalFor, previousInterval, TimeRange } from "@/domain/time-range";
import * as stats from "@/features/stats/engine";
import { createDemoDataSource, demoSampleExport } from "./demo-data-source";

const now = new Date("2026-11-15T20:00:00Z");

function setup() {
  const state = emptyDemoSessionState("Europe/Berlin");
  const commits: number[] = [];
  const source = createDemoDataSource({
    state,
    now,
    commit: async (s) => void commits.push(s.revision),
  });
  return { source, state, commits };
}

describe("demo data source", () => {
  it("feeds the stats engine quickly", async () => {
    const { source } = setup();
    const rules = await source.getListeningRules();
    const started = performance.now();
    const all = await source.getListening(intervalFor(TimeRange.AllTime, now));
    const range = intervalFor(TimeRange.Last4Weeks, now);
    const current = await source.getListening(range);
    const previous = await source.getListening(previousInterval(range));
    const firstPlayed = stats.firstPlayedByArtist(all.plays, all.tracks, rules);
    const overview = stats.overview(current, previous, rules);
    const streaks = stats.streaks(all.plays, rules, now);
    const discovery = stats.discovery(current, firstPlayed, range, rules);
    stats.recap(all, all.plays, rules, intervalFor(TimeRange.LastYear, now), firstPlayed);
    const elapsed = performance.now() - started;

    expect(overview.plays).toBeGreaterThan(400);
    expect(streaks.current).toBeGreaterThanOrEqual(22);
    expect(streaks.longest?.days).toBeGreaterThanOrEqual(41);
    expect(discovery.newArtists.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(1500);
  });

  it("sandboxes playlist edits and keeps snapshots", async () => {
    const { source, commits } = setup();
    const [first] = await source.listPlaylists();
    if (!first) throw new Error("no playlists");
    const detail = await source.getPlaylist(first.id);
    const ids = detail?.items?.map((i) => i.track.id) ?? [];
    await source.saveSnapshot(first.id, "Before dedupe", ids);
    await source.replacePlaylistItems(first.id, [...new Set(ids)]);
    const after = await source.getPlaylist(first.id);
    expect(after?.trackCount).toBe(new Set(ids).size);
    expect(await source.listSnapshots(first.id)).toHaveLength(1);
    expect(commits).toEqual([1, 2]);
  });

  it("refuses to edit a followed playlist", async () => {
    const { source } = setup();
    const followed = (await source.listPlaylists()).find((p) => !p.editable);
    expect(followed).toBeDefined();
    await expect(source.replacePlaylistItems(followed?.id ?? "", [])).rejects.toThrow();
  });

  it("imports the sample export once", async () => {
    const { source } = setup();
    const file = { name: "Streaming_History_Audio_sample.json", entries: demoSampleExport(now) };
    const first = await source.importHistory([file]);
    const again = await source.importHistory([file]);
    expect(first.added).toBe(120);
    expect(again).toMatchObject({ added: 0, duplicates: 120 });
    expect(await source.listImports()).toHaveLength(2);
  });

  it("searches the catalog with at most 10 results", async () => {
    const { source } = setup();
    const results = await source.searchTracks("velvet");
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(10);
  });
});
