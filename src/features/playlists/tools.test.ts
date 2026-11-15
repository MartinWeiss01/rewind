import { describe, expect, it } from "vitest";
import type { Track } from "@/domain/music";
import type { PlaylistSummary } from "@/domain/playlists";
import { filterLibrary, LibrarySort, OwnerFilter, parseLibraryParams } from "./library";
import {
  planMerge,
  planSplit,
  playlistInsights,
  SortDirection,
  SortKey,
  SplitBy,
  sortItems,
} from "./tools";

function track(
  id: string,
  options: { artist?: string; name?: string; release?: string | null; ms?: number } = {},
): Track {
  const artist = options.artist ?? "Fake Artist";
  return {
    id,
    name: options.name ?? id,
    artists: [{ id: `ar-${artist}`, name: artist }],
    album: {
      id: `al-${id}`,
      name: "Invented",
      cover: { kind: "generated", seed: 1 },
      releaseDate: options.release === undefined ? "2020-01-01" : options.release,
    },
    durationMs: options.ms ?? 180_000,
    isrc: null,
    explicit: false,
    externalUrl: null,
  };
}

const at = (iso: string | null) => (iso ? new Date(iso) : null);

describe("planMerge", () => {
  it("skips tracks already in the target and repeated across sources", () => {
    expect(
      planMerge(
        ["a", "b"],
        [
          ["b", "c"],
          ["c", "d"],
        ],
        true,
      ),
    ).toEqual({
      added: ["c", "d"],
      skipped: 2,
      total: 4,
    });
  });

  it("keeps everything when skipping is off", () => {
    expect(planMerge(["a"], [["a", "b"]], false)).toEqual({
      added: ["a", "b"],
      skipped: 0,
      total: 3,
    });
  });
});

describe("sortItems", () => {
  const items = [
    { track: track("one", { artist: "Bravo", release: "2019" }), addedAt: at("2026-02-01") },
    { track: track("two", { artist: "alpha", release: "2021-05-02" }), addedAt: at(null) },
    { track: track("three", { artist: "Charlie", release: null }), addedAt: at("2026-03-01") },
    { track: track("four", { artist: "Alpha", release: "2019-06" }), addedAt: at("2026-01-01") },
  ];
  const ids = (list: typeof items) => list.map((i) => i.track.id);

  it("sorts by date added, unknown dates last", () => {
    expect(ids(sortItems(items, SortKey.Added, SortDirection.Desc))).toEqual([
      "three",
      "one",
      "four",
      "two",
    ]);
    expect(ids(sortItems(items, SortKey.Added, SortDirection.Asc))).toEqual([
      "four",
      "one",
      "three",
      "two",
    ]);
  });

  it("sorts by artist A to Z, case-insensitively, then title", () => {
    expect(ids(sortItems(items, SortKey.Artist, SortDirection.Desc))).toEqual([
      "four",
      "two",
      "one",
      "three",
    ]);
    expect(ids(sortItems(items, SortKey.Artist, SortDirection.Asc))).toEqual([
      "three",
      "one",
      "two",
      "four",
    ]);
  });

  it("sorts by release date with partial dates, unknown last", () => {
    expect(ids(sortItems(items, SortKey.Release, SortDirection.Desc))).toEqual([
      "two",
      "four",
      "one",
      "three",
    ]);
    expect(ids(sortItems(items, SortKey.Release, SortDirection.Asc))).toEqual([
      "one",
      "four",
      "two",
      "three",
    ]);
  });

  it("sorts by plays and keeps ties in place", () => {
    const plays = new Map([
      ["two", 9],
      ["four", 3],
    ]);
    expect(ids(sortItems(items, SortKey.Plays, SortDirection.Desc, plays))).toEqual([
      "two",
      "four",
      "one",
      "three",
    ]);
    expect(ids(sortItems(items, SortKey.Plays, SortDirection.Asc, plays))).toEqual([
      "one",
      "three",
      "four",
      "two",
    ]);
  });
});

describe("planSplit", () => {
  const items = [
    { track: track("a1", { artist: "A", release: "2020" }) },
    { track: track("a2", { artist: "A", release: "2021-02-03" }) },
    { track: track("a1", { artist: "A", release: "2020" }) },
    { track: track("b1", { artist: "B", release: "2020-07" }) },
    { track: track("c1", { artist: "C", release: null }) },
    { track: track("a3", { artist: "A", release: "2020" }) },
  ];

  it("splits by first artist, sending small groups to Other", () => {
    expect(planSplit(items, SplitBy.Artist, 2)).toEqual([
      { key: "ar-A", label: "A", trackIds: ["a1", "a2", "a3"] },
      { key: null, label: null, trackIds: ["b1", "c1"] },
    ]);
  });

  it("splits by release year; unknown years go to Other", () => {
    expect(planSplit(items, SplitBy.Year, 1)).toEqual([
      { key: "2020", label: "2020", trackIds: ["a1", "b1", "a3"] },
      { key: "2021", label: "2021", trackIds: ["a2"] },
      { key: null, label: null, trackIds: ["c1"] },
    ]);
  });

  it("omits Other when nothing is left over", () => {
    expect(planSplit(items.slice(0, 3), SplitBy.Artist, 1)).toHaveLength(1);
  });
});

describe("playlistInsights", () => {
  it("totals duration, ranks artists and buckets additions by month", () => {
    const insights = playlistInsights(
      [
        { track: track("x", { artist: "A", ms: 1000 }), addedAt: at("2026-11-02T10:00:00Z") },
        { track: track("y", { artist: "B", ms: 2000 }), addedAt: at("2026-10-31T23:30:00Z") },
        { track: track("z", { artist: "A", ms: 3000 }), addedAt: null },
      ],
      new Date("2026-11-15T12:00:00Z"),
      "Europe/Prague",
      { months: 3 },
    );
    expect(insights.durationMs).toBe(6000);
    expect(insights.topArtists.map((a) => [a.artist.name, a.tracks])).toEqual([
      ["A", 2],
      ["B", 1],
    ]);
    // 23:30 UTC on Oct 31 is already November in Prague.
    expect(insights.addedByMonth).toEqual([
      { month: "2026-09", count: 0 },
      { month: "2026-10", count: 0 },
      { month: "2026-11", count: 2 },
    ]);
  });
});

describe("library", () => {
  const playlist = (name: string, editable: boolean, trackCount: number): PlaylistSummary => ({
    id: name,
    name,
    description: "",
    ownerName: editable ? "Me" : "Someone",
    editable,
    isPublic: true,
    trackCount,
    covers: [],
    snapshotId: "",
    externalUrl: null,
  });
  const all = [
    playlist("Žluté ráno", true, 10),
    playlist("bravo", false, 30),
    playlist("Alpha", true, 20),
  ];

  it("parses search params with fallbacks", () => {
    expect(parseLibraryParams({ q: [" hi ", "x"], owner: "nope", sort: "size" })).toEqual({
      q: "hi",
      owner: "all",
      sort: "size",
      view: "grid",
    });
  });

  it("filters by owner and accent-insensitive text, then sorts", () => {
    const names = (list: PlaylistSummary[]) => list.map((p) => p.name);
    expect(
      names(filterLibrary(all, { q: "", owner: OwnerFilter.Mine, sort: LibrarySort.Name })),
    ).toEqual(["Alpha", "Žluté ráno"]);
    expect(
      names(filterLibrary(all, { q: "zlute", owner: OwnerFilter.All, sort: LibrarySort.Recent })),
    ).toEqual(["Žluté ráno"]);
    expect(
      names(filterLibrary(all, { q: "", owner: OwnerFilter.Followed, sort: LibrarySort.Size })),
    ).toEqual(["bravo"]);
    expect(
      names(filterLibrary(all, { q: "", owner: OwnerFilter.All, sort: LibrarySort.Size })),
    ).toEqual(["bravo", "Alpha", "Žluté ráno"]);
  });
});
