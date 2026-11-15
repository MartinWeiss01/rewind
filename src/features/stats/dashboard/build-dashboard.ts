import { match, P } from "ts-pattern";
import type { ListeningData } from "@/data/music-data-source";
import type { Interval, ListeningRules } from "@/domain/listening";
import { TimeRange } from "@/domain/time-range";
import { epochDay, keyFromEpochDay, dayKey as toDayKey, zonedParts } from "@/lib/time-zone";
import {
  Bucket,
  discovery,
  firstPlayedByArtist,
  type Heatmap,
  heatmap,
  Metric,
  type Overview,
  onRepeat,
  overview,
  streaks,
  type TrendPoint,
  topAlbums,
  topArtists,
  topTracks,
  trend,
} from "../engine";
import {
  type RankedAlbum,
  type RankedArtist,
  type RankedTrack,
  type TrackItem,
  toRankedAlbum,
  toRankedArtist,
  toRankedTrack,
  toTrackItem,
} from "../view";

export const Greeting = {
  Morning: "morning",
  Afternoon: "afternoon",
  Evening: "evening",
  Night: "night",
} as const;
export type Greeting = (typeof Greeting)[keyof typeof Greeting];

export function greetingFor(hour: number): Greeting {
  return match(hour)
    .with(P.number.between(5, 11), () => Greeting.Morning)
    .with(P.number.between(12, 17), () => Greeting.Afternoon)
    .with(P.number.between(18, 22), () => Greeting.Evening)
    .otherwise(() => Greeting.Night);
}

/** 0 = silent, 1 = under 20 minutes, 2 = under an hour, 3 = an hour or more. */
export type DayLevel = 0 | 1 | 2 | 3;
export function dayLevel(minutes: number): DayLevel {
  if (minutes <= 0) return 0;
  if (minutes < 20) return 1;
  if (minutes < 60) return 2;
  return 3;
}

export const STREAK_DAYS = 56;
const TOP_LIMIT = 8;
const DISCOVERY_AVATARS = 5;

export type TopLists = { tracks: RankedTrack[]; artists: RankedArtist[]; albums: RankedAlbum[] };

export type DashboardData = {
  range: TimeRange;
  /** ISO bounds of the selected range; the start is null for all time. */
  start: string | null;
  end: string;
  timeZone: string;
  displayName: string;
  greeting: Greeting;
  overview: Overview;
  activeDays: number;
  top: Record<Metric, TopLists>;
  heatmap: Heatmap;
  streak: {
    current: number;
    longest: { days: number; start: string; end: string } | null;
    days: { day: string; minutes: number; level: DayLevel }[];
    activeCount: number;
  };
  discovery: {
    /** Discovery always looks at a bounded window; all time uses the last 4 weeks. */
    scope: "range" | "last4Weeks";
    share: number;
    previousShare: number | null;
    newArtistCount: number;
    artists: { id: string; name: string; cover: RankedArtist["cover"] }[];
  };
  onRepeat: { track: TrackItem; plays: number; lastPlayedAt: string }[];
  trend: Record<Bucket, TrendPoint[]>;
};

export type DashboardInput = {
  range: TimeRange;
  interval: Interval;
  previous: Interval;
  now: Date;
  rules: ListeningRules;
  displayName: string;
  current: ListeningData;
  before: ListeningData;
  /** Every play up to now, for streaks, first listens and "on repeat". */
  all: ListeningData;
};

function slice(data: ListeningData, interval: Interval): ListeningData {
  return {
    plays: data.plays.filter(
      (play) => play.playedAt >= interval.start && play.playedAt < interval.end,
    ),
    tracks: data.tracks,
  };
}

function topLists(data: ListeningData, rules: ListeningRules, metric: Metric): TopLists {
  return {
    tracks: topTracks(data, rules, metric, TOP_LIMIT).map(toRankedTrack),
    artists: topArtists(data, rules, metric, TOP_LIMIT).map(toRankedArtist),
    albums: topAlbums(data, rules, metric, TOP_LIMIT).map(toRankedAlbum),
  };
}

/** Everything the dashboard shows, computed with the stats engine. Pure. */
export function buildDashboard(input: DashboardInput): DashboardData {
  const { range, interval, previous, now, rules, current, before, all } = input;
  const allTime = range === TimeRange.AllTime;
  const firstPlayed = firstPlayedByArtist(all.plays, all.tracks, rules);

  const dailyMinutes = trend(current, rules, interval, Bucket.Day);
  const activeDays = dailyMinutes.filter((point) => point.minutes > 0).length;

  const today = epochDay(toDayKey(now, rules.timeZone));
  const streakWindow: Interval = {
    start: new Date(now.getTime() - (STREAK_DAYS + 1) * 86_400_000),
    end: new Date(now.getTime() + 1),
  };
  const minutesByDay = new Map(
    trend(slice(all, streakWindow), rules, streakWindow, Bucket.Day).map((p) => [p.key, p.minutes]),
  );
  const streakStats = streaks(all.plays, rules, now, STREAK_DAYS);
  const days = Array.from({ length: STREAK_DAYS }, (_, i) => {
    const day = keyFromEpochDay(today - STREAK_DAYS + 1 + i);
    const minutes = minutesByDay.get(day) ?? 0;
    return { day, minutes, level: dayLevel(minutes) };
  });

  const discoveryWindow: Interval = allTime
    ? { start: new Date(now.getTime() - 28 * 86_400_000), end: now }
    : interval;
  const discoveryPrevious: Interval = allTime
    ? { start: new Date(now.getTime() - 56 * 86_400_000), end: discoveryWindow.start }
    : previous;
  const discoveryData = allTime ? slice(all, discoveryWindow) : current;
  const previousData = allTime ? slice(all, discoveryPrevious) : before;
  const found = discovery(discoveryData, firstPlayed, discoveryWindow, rules);
  const foundBefore = discovery(previousData, firstPlayed, discoveryPrevious, rules);
  const hadPrevious = previousData.plays.length > 0;

  return {
    range,
    start: allTime ? null : interval.start.toISOString(),
    end: interval.end.toISOString(),
    timeZone: rules.timeZone,
    displayName: input.displayName,
    greeting: greetingFor(zonedParts(now, rules.timeZone).hour),
    overview: overview(current, before, rules),
    activeDays,
    top: {
      [Metric.Plays]: topLists(current, rules, Metric.Plays),
      [Metric.Minutes]: topLists(current, rules, Metric.Minutes),
    },
    heatmap: heatmap(current, rules),
    streak: {
      current: streakStats.current,
      longest: streakStats.longest,
      days,
      activeCount: days.filter((day) => day.level > 0).length,
    },
    discovery: {
      scope: allTime ? "last4Weeks" : "range",
      share: found.newArtistPlayShare,
      previousShare: hadPrevious ? foundBefore.newArtistPlayShare : null,
      newArtistCount: found.newArtists.length,
      artists: found.newArtists.slice(0, DISCOVERY_AVATARS).map(({ artist, cover }) => ({
        id: artist.id,
        name: artist.name,
        cover,
      })),
    },
    onRepeat: onRepeat(all, rules, now, 4).map(({ track, plays, lastPlayedAt }) => ({
      track: toTrackItem(track),
      plays,
      lastPlayedAt: lastPlayedAt.toISOString(),
    })),
    trend: {
      [Bucket.Day]: dailyMinutes,
      [Bucket.Week]: trend(current, rules, interval, Bucket.Week),
      [Bucket.Month]: trend(current, rules, interval, Bucket.Month),
    },
  };
}
