import { match } from "ts-pattern";
import type { ListeningData } from "@/data/music-data-source";
import type { Interval, ListeningRules, Play } from "@/domain/listening";
import type { AlbumRef, ArtistRef, Cover, Track } from "@/domain/music";
import { dayKey, dayKeyFromParts, epochDay, keyFromEpochDay, zonedParts } from "@/lib/time-zone";

/** Pure statistics over plays. No I/O; every function is deterministic for its inputs. */

export const Metric = {
  Plays: "plays",
  Minutes: "minutes",
} as const;
export type Metric = (typeof Metric)[keyof typeof Metric];

export const Bucket = {
  Day: "day",
  Week: "week",
  Month: "month",
} as const;
export type Bucket = (typeof Bucket)[keyof typeof Bucket];

export type Overview = {
  minutes: number;
  plays: number;
  distinctTracks: number;
  distinctArtists: number;
  /** Relative change against the previous period, null when the previous period is empty. */
  minutesChange: number | null;
};
export type TopTrack = { track: Track; plays: number; ms: number };
export type TopArtist = { artist: ArtistRef; plays: number; ms: number; cover: Cover };
export type TopAlbum = {
  album: AlbumRef;
  artists: readonly ArtistRef[];
  plays: number;
  ms: number;
};
export type Heatmap = {
  /** 7 rows (Monday..Sunday) × 24 hours of counted plays. */
  cells: number[][];
  max: number;
  peak: { weekday: number; hour: number } | null;
};
export type StreakRange = { days: number; start: string; end: string };
export type Streaks = {
  current: number;
  longest: StreakRange | null;
  recent: { day: string; active: boolean }[];
};
export type NewArtist = { artist: ArtistRef; firstPlayedAt: Date; plays: number; cover: Cover };
export type Discovery = { newArtists: NewArtist[]; newArtistPlayShare: number };
export type TrendPoint = { key: string; minutes: number };
export type RepeatTrack = { track: Track; plays: number; lastPlayedAt: Date };
export type Recap = {
  minutes: number;
  plays: number;
  topTracks: TopTrack[];
  topArtist: TopArtist | null;
  peakHour: number | null;
  /** Share of counted plays between 20:00 and 04:59 local time. */
  nightShare: number;
  newArtistCount: number;
  firstFind: { artist: ArtistRef; firstPlayedAt: Date } | null;
  longestStreak: StreakRange | null;
  activeDays: number;
};

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;

function counts(play: Play, rules: ListeningRules): boolean {
  return play.msPlayed >= rules.skipThresholdMs;
}

/** Counted plays whose track is known, paired with the track. */
function* countedWithTrack(
  data: ListeningData,
  rules: ListeningRules,
): Generator<{ play: Play; track: Track }> {
  for (const play of data.plays) {
    if (!counts(play, rules)) continue;
    const track = data.tracks.get(play.trackId);
    if (track) yield { play, track };
  }
}

function metricValue(item: { plays: number; ms: number }, metric: Metric): number {
  return match(metric)
    .with(Metric.Plays, () => item.plays)
    .with(Metric.Minutes, () => item.ms)
    .exhaustive();
}

function byMetric<T extends { plays: number; ms: number }>(
  metric: Metric,
  name: (item: T) => string,
): (a: T, b: T) => number {
  return (a, b) =>
    metricValue(b, metric) - metricValue(a, metric) ||
    b.plays - a.plays ||
    name(a).localeCompare(name(b));
}

/** Per-track totals of counted plays, in first-seen order. */
function aggregateTracks(data: ListeningData, rules: ListeningRules): Map<string, TopTrack> {
  const totals = new Map<string, TopTrack>();
  for (const { play, track } of countedWithTrack(data, rules)) {
    const entry = totals.get(track.id);
    if (entry) {
      entry.plays += 1;
      entry.ms += play.msPlayed;
    } else {
      totals.set(track.id, { track, plays: 1, ms: play.msPlayed });
    }
  }
  return totals;
}

type ArtistTotal = TopArtist & { bestTrackPlays: number; bestTrackMs: number };

/** Credits every artist on a track; the cover follows each artist's most played track. */
function aggregateArtists(tracks: Iterable<TopTrack>): Map<string, ArtistTotal> {
  const totals = new Map<string, ArtistTotal>();
  for (const { track, plays, ms } of tracks) {
    for (const artist of track.artists) {
      const entry = totals.get(artist.id);
      if (!entry) {
        totals.set(artist.id, {
          artist,
          plays,
          ms,
          cover: track.album.cover,
          bestTrackPlays: plays,
          bestTrackMs: ms,
        });
        continue;
      }
      entry.plays += plays;
      entry.ms += ms;
      if (
        plays > entry.bestTrackPlays ||
        (plays === entry.bestTrackPlays && ms > entry.bestTrackMs)
      ) {
        entry.cover = track.album.cover;
        entry.bestTrackPlays = plays;
        entry.bestTrackMs = ms;
      }
    }
  }
  return totals;
}

function toTopArtist({ artist, plays, ms, cover }: ArtistTotal): TopArtist {
  return { artist, plays, ms, cover };
}

function sumCounted(data: ListeningData, rules: ListeningRules): { ms: number; plays: number } {
  let ms = 0;
  let plays = 0;
  for (const { play } of countedWithTrack(data, rules)) {
    ms += play.msPlayed;
    plays += 1;
  }
  return { ms, plays };
}

export function overview(
  current: ListeningData,
  previous: ListeningData,
  rules: ListeningRules,
): Overview {
  const tracks = new Set<string>();
  const artists = new Set<string>();
  let ms = 0;
  let plays = 0;
  for (const { play, track } of countedWithTrack(current, rules)) {
    ms += play.msPlayed;
    plays += 1;
    tracks.add(track.id);
    for (const artist of track.artists) artists.add(artist.id);
  }
  const previousMinutes = sumCounted(previous, rules).ms / MS_PER_MINUTE;
  const minutes = ms / MS_PER_MINUTE;
  return {
    minutes,
    plays,
    distinctTracks: tracks.size,
    distinctArtists: artists.size,
    minutesChange: previousMinutes === 0 ? null : (minutes - previousMinutes) / previousMinutes,
  };
}

export function topTracks(
  data: ListeningData,
  rules: ListeningRules,
  metric: Metric,
  limit: number,
): TopTrack[] {
  return [...aggregateTracks(data, rules).values()]
    .sort(byMetric(metric, (item) => item.track.name))
    .slice(0, limit);
}

export function topArtists(
  data: ListeningData,
  rules: ListeningRules,
  metric: Metric,
  limit: number,
): TopArtist[] {
  return [...aggregateArtists(aggregateTracks(data, rules).values()).values()]
    .sort(byMetric(metric, (item) => item.artist.name))
    .slice(0, limit)
    .map(toTopArtist);
}

export function topAlbums(
  data: ListeningData,
  rules: ListeningRules,
  metric: Metric,
  limit: number,
): TopAlbum[] {
  const totals = new Map<string, TopAlbum>();
  for (const { track, plays, ms } of aggregateTracks(data, rules).values()) {
    const entry = totals.get(track.album.id);
    if (entry) {
      entry.plays += plays;
      entry.ms += ms;
    } else {
      totals.set(track.album.id, { album: track.album, artists: track.artists, plays, ms });
    }
  }
  return [...totals.values()].sort(byMetric(metric, (item) => item.album.name)).slice(0, limit);
}

export function heatmap(data: ListeningData, rules: ListeningRules): Heatmap {
  const cells = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  for (const { play } of countedWithTrack(data, rules)) {
    const { weekday, hour } = zonedParts(play.playedAt, rules.timeZone);
    const row = cells[weekday];
    if (row) row[hour] = (row[hour] ?? 0) + 1;
  }
  let max = 0;
  let peak: Heatmap["peak"] = null;
  cells.forEach((row, weekday) => {
    row.forEach((value, hour) => {
      if (value > max) {
        max = value;
        peak = { weekday, hour };
      }
    });
  });
  return { cells, max, peak };
}

/** Longest run of consecutive epoch days; the earliest run wins ties. */
function longestRun(days: Iterable<number>): StreakRange | null {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  let best: { days: number; start: number } | null = null;
  let runStart = 0;
  for (let i = 0; i < sorted.length; i++) {
    const day = sorted[i] as number;
    if (i === 0 || day !== (sorted[i - 1] as number) + 1) runStart = day;
    const length = day - runStart + 1;
    if (!best || length > best.days) best = { days: length, start: runStart };
  }
  if (!best) return null;
  return {
    days: best.days,
    start: keyFromEpochDay(best.start),
    end: keyFromEpochDay(best.start + best.days - 1),
  };
}

function activeEpochDays(plays: readonly Play[], rules: ListeningRules): Set<number> {
  const days = new Set<number>();
  for (const play of plays) {
    if (counts(play, rules)) days.add(epochDay(dayKey(play.playedAt, rules.timeZone)));
  }
  return days;
}

export function streaks(
  allPlays: readonly Play[],
  rules: ListeningRules,
  now: Date,
  recentDays = 56,
): Streaks {
  const active = activeEpochDays(allPlays, rules);
  const today = epochDay(dayKey(now, rules.timeZone));
  // A streak survives until a full day passes without a play.
  let cursor = active.has(today) ? today : today - 1;
  let current = 0;
  while (active.has(cursor)) {
    current += 1;
    cursor -= 1;
  }
  const recent = Array.from({ length: Math.max(0, recentDays) }, (_, i) => {
    const day = today - recentDays + 1 + i;
    return { day: keyFromEpochDay(day), active: active.has(day) };
  });
  return { current, longest: longestRun(active), recent };
}

export function firstPlayedByArtist(
  allPlays: readonly Play[],
  tracks: ReadonlyMap<string, Track>,
  rules: ListeningRules,
): Map<string, Date> {
  const first = new Map<string, Date>();
  for (const { play, track } of countedWithTrack({ plays: allPlays, tracks }, rules)) {
    for (const artist of track.artists) {
      const known = first.get(artist.id);
      if (!known || play.playedAt < known) first.set(artist.id, play.playedAt);
    }
  }
  return first;
}

function inInterval(date: Date, interval: Interval): boolean {
  return date >= interval.start && date < interval.end;
}

export function discovery(
  data: ListeningData,
  firstPlayed: ReadonlyMap<string, Date>,
  interval: Interval,
  rules: ListeningRules,
): Discovery {
  const isNew = (artistId: string): boolean => {
    const first = firstPlayed.get(artistId);
    return first !== undefined && inInterval(first, interval);
  };
  let total = 0;
  let fromNew = 0;
  for (const { track } of countedWithTrack(data, rules)) {
    total += 1;
    const main = track.artists[0];
    if (main && isNew(main.id)) fromNew += 1;
  }
  const newArtists: NewArtist[] = [];
  for (const entry of aggregateArtists(aggregateTracks(data, rules).values()).values()) {
    const firstPlayedAt = firstPlayed.get(entry.artist.id);
    if (!firstPlayedAt || !inInterval(firstPlayedAt, interval)) continue;
    newArtists.push({
      artist: entry.artist,
      firstPlayedAt,
      plays: entry.plays,
      cover: entry.cover,
    });
  }
  newArtists.sort(
    (a, b) => b.plays - a.plays || a.firstPlayedAt.getTime() - b.firstPlayedAt.getTime(),
  );
  return { newArtists, newArtistPlayShare: total === 0 ? 0 : fromNew / total };
}

/** Day key of the Monday starting the week that contains the given epoch day. */
function weekKey(day: number): string {
  // 1970-01-01 was a Thursday, so (day + 3) mod 7 is 0 on Mondays.
  return keyFromEpochDay(day - ((((day + 3) % 7) + 7) % 7));
}

function bucketKey(day: string, bucket: Bucket): string {
  return match(bucket)
    .with(Bucket.Day, () => day)
    .with(Bucket.Week, () => weekKey(epochDay(day)))
    .with(Bucket.Month, () => day.slice(0, 7))
    .exhaustive();
}

/** Every bucket key from the first to the last day, inclusive. */
function bucketRange(firstDay: number, lastDay: number, bucket: Bucket): string[] {
  return match(bucket)
    .with(Bucket.Day, () =>
      Array.from({ length: lastDay - firstDay + 1 }, (_, i) => keyFromEpochDay(firstDay + i)),
    )
    .with(Bucket.Week, () => {
      const keys: string[] = [];
      for (let day = epochDay(weekKey(firstDay)); day <= lastDay; day += 7) {
        keys.push(keyFromEpochDay(day));
      }
      return keys;
    })
    .with(Bucket.Month, () => {
      const keys: string[] = [];
      const last = keyFromEpochDay(lastDay).slice(0, 7);
      const start = keyFromEpochDay(firstDay);
      let year = Number(start.slice(0, 4));
      let month = Number(start.slice(5, 7));
      for (;;) {
        const key = `${year}-${String(month).padStart(2, "0")}`;
        keys.push(key);
        if (key >= last) break;
        month += 1;
        if (month > 12) {
          month = 1;
          year += 1;
        }
      }
      return keys;
    })
    .exhaustive();
}

export function trend(
  data: ListeningData,
  rules: ListeningRules,
  interval: Interval,
  bucket: Bucket,
): TrendPoint[] {
  const msByKey = new Map<string, number>();
  let earliest: number | null = null;
  for (const { play } of countedWithTrack(data, rules)) {
    const day = dayKey(play.playedAt, rules.timeZone);
    const key = bucketKey(day, bucket);
    msByKey.set(key, (msByKey.get(key) ?? 0) + play.msPlayed);
    const value = epochDay(day);
    if (earliest === null || value < earliest) earliest = value;
  }
  const allTime = interval.start.getTime() <= 0;
  const firstDay = allTime ? earliest : epochDay(dayKey(interval.start, rules.timeZone));
  if (firstDay === null) return [];
  const lastDay = epochDay(dayKey(new Date(interval.end.getTime() - 1), rules.timeZone));
  if (lastDay < firstDay) return [];
  return bucketRange(firstDay, lastDay, bucket).map((key) => ({
    key,
    minutes: (msByKey.get(key) ?? 0) / MS_PER_MINUTE,
  }));
}

export function onRepeat(
  data: ListeningData,
  rules: ListeningRules,
  now: Date,
  limit: number,
  days = 14,
): RepeatTrack[] {
  const since = now.getTime() - days * MS_PER_DAY;
  const totals = new Map<string, RepeatTrack>();
  for (const { play, track } of countedWithTrack(data, rules)) {
    const at = play.playedAt.getTime();
    if (at <= since || at > now.getTime()) continue;
    const entry = totals.get(track.id);
    if (!entry) {
      totals.set(track.id, { track, plays: 1, lastPlayedAt: play.playedAt });
      continue;
    }
    entry.plays += 1;
    if (play.playedAt > entry.lastPlayedAt) entry.lastPlayedAt = play.playedAt;
  }
  return [...totals.values()]
    .filter((entry) => entry.plays >= 3)
    .sort((a, b) => b.plays - a.plays || b.lastPlayedAt.getTime() - a.lastPlayedAt.getTime())
    .slice(0, limit);
}

export function recap(
  data: ListeningData,
  allPlays: readonly Play[],
  rules: ListeningRules,
  interval: Interval,
  firstPlayed: ReadonlyMap<string, Date>,
): Recap {
  const hours = new Array<number>(24).fill(0);
  const days = new Set<string>();
  let ms = 0;
  let plays = 0;
  let night = 0;
  for (const { play } of countedWithTrack(data, rules)) {
    const parts = zonedParts(play.playedAt, rules.timeZone);
    hours[parts.hour] = (hours[parts.hour] ?? 0) + 1;
    days.add(dayKeyFromParts(parts));
    ms += play.msPlayed;
    plays += 1;
    if (parts.hour >= 20 || parts.hour < 5) night += 1;
  }

  let peakHour: number | null = null;
  hours.forEach((value, hour) => {
    if (value > 0 && (peakHour === null || value > (hours[peakHour] ?? 0))) peakHour = hour;
  });

  const { newArtists } = discovery(data, firstPlayed, interval, rules);
  let firstFind: Recap["firstFind"] = null;
  for (const { artist, firstPlayedAt } of newArtists) {
    if (!firstFind || firstPlayedAt < firstFind.firstPlayedAt)
      firstFind = { artist, firstPlayedAt };
  }

  const insideInterval = allPlays.filter((play) => inInterval(play.playedAt, interval));

  return {
    minutes: ms / MS_PER_MINUTE,
    plays,
    topTracks: topTracks(data, rules, Metric.Plays, 5),
    topArtist: topArtists(data, rules, Metric.Plays, 1)[0] ?? null,
    peakHour,
    nightShare: plays === 0 ? 0 : night / plays,
    newArtistCount: newArtists.length,
    firstFind,
    longestStreak: longestRun(activeEpochDays(insideInterval, rules)),
    activeDays: days.size,
  };
}
