import { describe, expect, it } from "vitest";
import type { ListeningData } from "@/data/music-data-source";
import type { Interval, ListeningRules, Play } from "@/domain/listening";
import type { AlbumRef, ArtistRef, Track } from "@/domain/music";
import {
  Bucket,
  discovery,
  firstPlayedByArtist,
  heatmap,
  Metric,
  onRepeat,
  overview,
  recap,
  streaks,
  topAlbums,
  topArtists,
  topTracks,
  trend,
} from "./engine";

const alpha: ArtistRef = { id: "ar-alpha", name: "Fake Alpha" };
const beta: ArtistRef = { id: "ar-beta", name: "Fake Beta" };
const gamma: ArtistRef = { id: "ar-gamma", name: "Fake Gamma" };

const albumOne: AlbumRef = {
  id: "al-one",
  name: "Invented One",
  cover: { kind: "generated", seed: 1 },
  releaseDate: null,
};
const albumTwo: AlbumRef = {
  id: "al-two",
  name: "Invented Two",
  cover: { kind: "generated", seed: 2 },
  releaseDate: null,
};
const albumThree: AlbumRef = {
  id: "al-three",
  name: "Invented Three",
  cover: { kind: "generated", seed: 3 },
  releaseDate: null,
};

function makeTrack(id: string, name: string, artists: ArtistRef[], album: AlbumRef): Track {
  return {
    id,
    name,
    artists,
    album,
    durationMs: 200_000,
    isrc: null,
    explicit: false,
    externalUrl: null,
  };
}

const solo = makeTrack("tr-solo", "Song Solo", [alpha], albumOne);
const duet = makeTrack("tr-duet", "Song Duet", [alpha, beta], albumOne);
const other = makeTrack("tr-other", "Song Other", [gamma], albumTwo);
const featured = makeTrack("tr-feat", "Song Feat", [beta], albumThree);

const tracks: ReadonlyMap<string, Track> = new Map(
  [solo, duet, other, featured].map((track) => [track.id, track]),
);

const utc: ListeningRules = { skipThresholdMs: 30_000, timeZone: "UTC" };
const berlin: ListeningRules = { skipThresholdMs: 30_000, timeZone: "Europe/Berlin" };

function play(trackId: string, iso: string, msPlayed = 60_000): Play {
  return { trackId, playedAt: new Date(iso), msPlayed, source: "synced" };
}

function data(plays: Play[]): ListeningData {
  return { plays, tracks };
}

const empty = data([]);

describe("overview", () => {
  it("sums counted plays and compares with the previous period", () => {
    const current = data([
      play(solo.id, "2026-11-10T10:00:00Z", 120_000),
      play(duet.id, "2026-11-10T11:00:00Z", 60_000),
      play(other.id, "2026-11-10T12:00:00Z", 10_000), // skip
      play("tr-missing", "2026-11-10T13:00:00Z", 60_000),
    ]);
    const previous = data([play(solo.id, "2026-11-01T10:00:00Z", 120_000)]);
    expect(overview(current, previous, utc)).toEqual({
      minutes: 3,
      plays: 2,
      distinctTracks: 2,
      distinctArtists: 2,
      minutesChange: 0.5,
    });
  });

  it("handles empty input", () => {
    expect(overview(empty, empty, utc)).toEqual({
      minutes: 0,
      plays: 0,
      distinctTracks: 0,
      distinctArtists: 0,
      minutesChange: null,
    });
  });

  it("respects the skip threshold exactly", () => {
    const current = data([play(solo.id, "2026-11-10T10:00:00Z", 30_000)]);
    expect(overview(current, empty, utc).plays).toBe(1);
    expect(overview(current, empty, { ...utc, skipThresholdMs: 30_001 }).plays).toBe(0);
  });
});

describe("top lists", () => {
  const sample = data([
    play(solo.id, "2026-11-10T10:00:00Z", 60_000),
    play(solo.id, "2026-11-10T11:00:00Z", 60_000),
    play(duet.id, "2026-11-10T12:00:00Z", 300_000),
    play(other.id, "2026-11-10T13:00:00Z", 60_000),
    play(other.id, "2026-11-10T14:00:00Z", 5_000),
  ]);

  it("ranks tracks by plays or minutes", () => {
    expect(topTracks(sample, utc, Metric.Plays, 10).map((t) => [t.track.id, t.plays])).toEqual([
      [solo.id, 2],
      [duet.id, 1],
      [other.id, 1],
    ]);
    expect(topTracks(sample, utc, Metric.Minutes, 1)).toEqual([
      { track: duet, plays: 1, ms: 300_000 },
    ]);
  });

  it("breaks ties by plays then name", () => {
    const tie = data([
      play(other.id, "2026-11-10T10:00:00Z", 60_000),
      play(solo.id, "2026-11-10T11:00:00Z", 60_000),
    ]);
    expect(topTracks(tie, utc, Metric.Minutes, 10).map((t) => t.track.name)).toEqual([
      "Song Other",
      "Song Solo",
    ]);
  });

  it("credits featured artists and picks the cover of their most played track", () => {
    const withFeature = data([
      play(duet.id, "2026-11-10T10:00:00Z"),
      play(featured.id, "2026-11-10T11:00:00Z"),
      play(featured.id, "2026-11-10T12:00:00Z"),
    ]);
    const result = topArtists(withFeature, utc, Metric.Plays, 10);
    expect(result.map((a) => [a.artist.id, a.plays])).toEqual([
      [beta.id, 3],
      [alpha.id, 1],
    ]);
    expect(result[0]?.cover).toEqual(albumThree.cover);
    expect(result[1]?.cover).toEqual(albumOne.cover);
  });

  it("ranks artists by minutes", () => {
    const result = topArtists(sample, utc, Metric.Minutes, 2);
    expect(result.map((a) => [a.artist.id, a.ms])).toEqual([
      [alpha.id, 420_000],
      [beta.id, 300_000],
    ]);
  });

  it("groups albums and keeps the first seen track's artists", () => {
    expect(topAlbums(sample, utc, Metric.Plays, 10)).toEqual([
      { album: albumOne, artists: [alpha], plays: 3, ms: 420_000 },
      { album: albumTwo, artists: [gamma], plays: 1, ms: 60_000 },
    ]);
  });

  it("returns empty lists for empty input", () => {
    expect(topTracks(empty, utc, Metric.Plays, 5)).toEqual([]);
    expect(topArtists(empty, utc, Metric.Plays, 5)).toEqual([]);
    expect(topAlbums(empty, utc, Metric.Minutes, 5)).toEqual([]);
  });
});

describe("heatmap", () => {
  it("buckets by weekday and hour in the rules' time zone", () => {
    // Sunday 23:30 UTC is Monday 00:30 in Berlin.
    const late = data([
      play(solo.id, "2026-11-15T23:30:00Z"),
      play(solo.id, "2026-11-15T23:40:00Z"),
      play(solo.id, "2026-11-15T23:50:00Z", 1_000),
    ]);
    const inUtc = heatmap(late, utc);
    expect(inUtc.cells[6]?.[23]).toBe(2);
    expect(inUtc.peak).toEqual({ weekday: 6, hour: 23 });
    expect(inUtc.max).toBe(2);

    const inBerlin = heatmap(late, berlin);
    expect(inBerlin.cells[0]?.[0]).toBe(2);
    expect(inBerlin.peak).toEqual({ weekday: 0, hour: 0 });
  });

  it("returns a zero grid for empty input", () => {
    const result = heatmap(empty, utc);
    expect(result.cells).toHaveLength(7);
    expect(result.cells.every((row) => row.length === 24 && row.every((v) => v === 0))).toBe(true);
    expect(result.max).toBe(0);
    expect(result.peak).toBeNull();
  });
});

describe("streaks", () => {
  const now = new Date("2026-11-15T12:00:00Z");

  it("counts back from today when today is active", () => {
    const plays = [
      play(solo.id, "2026-11-13T10:00:00Z"),
      play(solo.id, "2026-11-14T10:00:00Z"),
      play(solo.id, "2026-11-15T10:00:00Z"),
    ];
    expect(streaks(plays, utc, now).current).toBe(3);
  });

  it("keeps the streak alive when today has no play yet", () => {
    const plays = [play(solo.id, "2026-11-13T10:00:00Z"), play(solo.id, "2026-11-14T10:00:00Z")];
    expect(streaks(plays, utc, now).current).toBe(2);
  });

  it("breaks the streak after a full empty day", () => {
    const plays = [play(solo.id, "2026-11-12T10:00:00Z"), play(solo.id, "2026-11-13T10:00:00Z")];
    expect(streaks(plays, utc, now).current).toBe(0);
  });

  it("ignores skips and finds the longest run across gaps", () => {
    const plays = [
      play(solo.id, "2026-10-01T10:00:00Z"),
      play(solo.id, "2026-10-02T10:00:00Z"),
      play(solo.id, "2026-10-03T10:00:00Z"),
      play(solo.id, "2026-10-04T10:00:00Z", 1_000),
      play(solo.id, "2026-10-10T10:00:00Z"),
      play(solo.id, "2026-10-11T10:00:00Z"),
      play(solo.id, "2026-11-15T10:00:00Z"),
    ];
    const result = streaks(plays, utc, now);
    expect(result.longest).toEqual({ days: 3, start: "2026-10-01", end: "2026-10-03" });
    expect(result.current).toBe(1);
  });

  it("uses the time zone for day boundaries", () => {
    // 23:30 UTC on the 14th is already the 15th in Berlin.
    const plays = [play(solo.id, "2026-11-13T12:00:00Z"), play(solo.id, "2026-11-14T23:30:00Z")];
    expect(streaks(plays, utc, now).current).toBe(2);
    // In Berlin the 14th is empty, so only today (the 15th) counts.
    expect(streaks(plays, berlin, now).current).toBe(1);
  });

  it("lists recent days oldest first, ending today", () => {
    const result = streaks([play(solo.id, "2026-11-14T10:00:00Z")], utc, now, 3);
    expect(result.recent).toEqual([
      { day: "2026-11-13", active: false },
      { day: "2026-11-14", active: true },
      { day: "2026-11-15", active: false },
    ]);
    expect(streaks([], utc, now).recent).toHaveLength(56);
  });

  it("handles empty input", () => {
    const result = streaks([], utc, now, 2);
    expect(result.current).toBe(0);
    expect(result.longest).toBeNull();
    expect(result.recent.every((d) => !d.active)).toBe(true);
  });
});

describe("firstPlayedByArtist and discovery", () => {
  const history = [
    play(solo.id, "2026-09-01T10:00:00Z"),
    play(featured.id, "2026-10-20T10:00:00Z", 1_000), // skip, not a first listen
    play(duet.id, "2026-11-03T10:00:00Z"),
    play(other.id, "2026-11-05T10:00:00Z"),
    play(other.id, "2026-11-06T10:00:00Z"),
    play(solo.id, "2026-11-07T10:00:00Z"),
  ];
  const november: Interval = {
    start: new Date("2026-11-01T00:00:00Z"),
    end: new Date("2026-12-01T00:00:00Z"),
  };
  const inNovember = data(history.filter((p) => p.playedAt >= november.start));

  it("records the first counted play per artist, featured included", () => {
    const first = firstPlayedByArtist(history, tracks, utc);
    expect(first.get(alpha.id)?.toISOString()).toBe("2026-09-01T10:00:00.000Z");
    expect(first.get(beta.id)?.toISOString()).toBe("2026-11-03T10:00:00.000Z");
    expect(first.get(gamma.id)?.toISOString()).toBe("2026-11-05T10:00:00.000Z");
    expect(firstPlayedByArtist([], tracks, utc).size).toBe(0);
  });

  it("lists new artists by plays and the share of plays led by them", () => {
    const first = firstPlayedByArtist(history, tracks, utc);
    const result = discovery(inNovember, first, november, utc);
    expect(result.newArtists.map((a) => [a.artist.id, a.plays])).toEqual([
      [gamma.id, 2],
      [beta.id, 1],
    ]);
    expect(result.newArtists[0]?.cover).toEqual(albumTwo.cover);
    // Main artist new: the two gamma plays; the duet is led by alpha (not new).
    expect(result.newArtistPlayShare).toBeCloseTo(2 / 4);
  });

  it("handles empty input", () => {
    expect(discovery(empty, new Map(), november, utc)).toEqual({
      newArtists: [],
      newArtistPlayShare: 0,
    });
  });
});

describe("trend", () => {
  const week: Interval = {
    start: new Date("2026-11-09T00:00:00Z"),
    end: new Date("2026-11-16T00:00:00Z"),
  };

  it("zero-fills every day in the interval", () => {
    const result = trend(
      data([play(solo.id, "2026-11-10T10:00:00Z", 120_000)]),
      utc,
      week,
      Bucket.Day,
    );
    expect(result).toHaveLength(7);
    expect(result[0]).toEqual({ key: "2026-11-09", minutes: 0 });
    expect(result[1]).toEqual({ key: "2026-11-10", minutes: 2 });
    expect(result[6]).toEqual({ key: "2026-11-15", minutes: 0 });
  });

  it("keys weeks by their Monday", () => {
    const interval: Interval = {
      start: new Date("2026-11-04T00:00:00Z"), // Wednesday
      end: new Date("2026-11-17T00:00:00Z"),
    };
    const result = trend(
      data([play(solo.id, "2026-11-15T10:00:00Z", 60_000)]),
      utc,
      interval,
      Bucket.Week,
    );
    expect(result).toEqual([
      { key: "2026-11-02", minutes: 0 },
      { key: "2026-11-09", minutes: 1 },
      { key: "2026-11-16", minutes: 0 },
    ]);
  });

  it("buckets months and crosses year ends", () => {
    const interval: Interval = {
      start: new Date("2025-11-01T00:00:00Z"),
      end: new Date("2026-02-01T00:00:00Z"),
    };
    const result = trend(
      data([play(solo.id, "2026-01-31T10:00:00Z", 60_000)]),
      utc,
      interval,
      Bucket.Month,
    );
    expect(result.map((p) => p.key)).toEqual(["2025-11", "2025-12", "2026-01"]);
    expect(result[2]?.minutes).toBe(1);
  });

  it("uses the time zone for the day of a play", () => {
    const late = data([play(solo.id, "2026-11-15T23:30:00Z", 60_000)]);
    const interval: Interval = {
      start: new Date("2026-11-15T00:00:00Z"),
      end: new Date("2026-11-17T00:00:00Z"),
    };
    expect(trend(late, utc, interval, Bucket.Day).find((p) => p.minutes > 0)?.key).toBe(
      "2026-11-15",
    );
    expect(trend(late, berlin, interval, Bucket.Day).find((p) => p.minutes > 0)?.key).toBe(
      "2026-11-16",
    );
  });

  it("starts an all-time interval at the first play", () => {
    const allTime: Interval = { start: new Date(0), end: new Date("2026-11-13T00:00:00Z") };
    const result = trend(data([play(solo.id, "2026-11-10T10:00:00Z")]), utc, allTime, Bucket.Day);
    expect(result.map((p) => p.key)).toEqual(["2026-11-10", "2026-11-11", "2026-11-12"]);
    expect(trend(empty, utc, allTime, Bucket.Day)).toEqual([]);
  });

  it("zero-fills an empty bounded interval", () => {
    expect(trend(empty, utc, week, Bucket.Day).every((p) => p.minutes === 0)).toBe(true);
    expect(trend(empty, utc, week, Bucket.Day)).toHaveLength(7);
  });
});

describe("onRepeat", () => {
  const now = new Date("2026-11-15T12:00:00Z");

  it("keeps tracks with at least three recent counted plays", () => {
    const result = onRepeat(
      data([
        play(solo.id, "2026-11-14T10:00:00Z"),
        play(solo.id, "2026-11-13T10:00:00Z"),
        play(solo.id, "2026-11-12T10:00:00Z"),
        play(solo.id, "2026-11-12T11:00:00Z"),
        play(duet.id, "2026-11-14T10:00:00Z"),
        play(duet.id, "2026-11-13T10:00:00Z"),
        play(duet.id, "2026-11-12T10:00:00Z", 1_000), // skip
        play(other.id, "2026-10-01T10:00:00Z"), // too old
        play(other.id, "2026-10-02T10:00:00Z"),
        play(other.id, "2026-11-14T10:00:00Z"),
      ]),
      utc,
      now,
      10,
    );
    expect(result).toEqual([
      { track: solo, plays: 4, lastPlayedAt: new Date("2026-11-14T10:00:00Z") },
    ]);
  });

  it("handles empty input", () => {
    expect(onRepeat(empty, utc, now, 5)).toEqual([]);
  });
});

describe("recap", () => {
  const interval: Interval = {
    start: new Date("2026-11-01T00:00:00Z"),
    end: new Date("2026-12-01T00:00:00Z"),
  };
  const before = [play(solo.id, "2026-10-31T10:00:00Z"), play(solo.id, "2026-10-30T10:00:00Z")];
  const inside = [
    play(solo.id, "2026-11-01T21:00:00Z"),
    play(solo.id, "2026-11-02T21:30:00Z"),
    play(other.id, "2026-11-03T03:00:00Z"),
    play(duet.id, "2026-11-05T12:00:00Z"),
    play(duet.id, "2026-11-06T12:00:00Z", 1_000), // skip
  ];
  const all = [...before, ...inside];

  it("summarises the interval", () => {
    const first = firstPlayedByArtist(all, tracks, utc);
    const result = recap(data(inside), all, utc, interval, first);
    expect(result.plays).toBe(4);
    expect(result.minutes).toBe(4);
    expect(result.topTracks[0]?.track.id).toBe(solo.id);
    expect(result.topArtist?.artist.id).toBe(alpha.id);
    expect(result.topArtist?.plays).toBe(3);
    expect(result.peakHour).toBe(21);
    expect(result.nightShare).toBeCloseTo(3 / 4);
    expect(result.newArtistCount).toBe(2);
    expect(result.firstFind).toEqual({
      artist: gamma,
      firstPlayedAt: new Date("2026-11-03T03:00:00Z"),
    });
    // The October days before the interval do not extend the streak.
    expect(result.longestStreak).toEqual({ days: 3, start: "2026-11-01", end: "2026-11-03" });
    expect(result.activeDays).toBe(4);
  });

  it("handles empty input", () => {
    expect(recap(empty, [], utc, interval, new Map())).toEqual({
      minutes: 0,
      plays: 0,
      topTracks: [],
      topArtist: null,
      peakHour: null,
      nightShare: 0,
      newArtistCount: 0,
      firstFind: null,
      longestStreak: null,
      activeDays: 0,
    });
  });
});
