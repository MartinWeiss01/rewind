import type { MusicDataSource } from "@/data/music-data-source";
import type { Cover } from "@/domain/music";
import { firstPlayedByArtist, heatmap, recap } from "@/features/stats/engine";
import {
  type RankedArtist,
  type RankedTrack,
  toRankedArtist,
  toRankedTrack,
} from "@/features/stats/view";
import { type RecapPeriod, recapInterval } from "./period";

/** A recap needs at least this many days with plays. */
export const MIN_ACTIVE_DAYS = 7;

export type RecapData = {
  displayName: string;
  avatar: Cover | null;
  timeZone: string;
  start: string;
  end: string;
  activeDays: number;
  minutes: number;
  plays: number;
  topTracks: RankedTrack[];
  topArtist: RankedArtist | null;
  peakHour: number | null;
  /** Weekday of the busiest heatmap cell, 0 = Monday … 6 = Sunday. */
  peakWeekday: number | null;
  nightShare: number;
  newArtistCount: number;
  firstFind: { name: string; firstPlayedAt: string } | null;
  longestStreak: { days: number; start: string; end: string } | null;
};

export async function loadRecap(
  source: MusicDataSource,
  period: RecapPeriod,
  now: Date,
): Promise<RecapData> {
  const [rules, profile] = await Promise.all([source.getListeningRules(), source.getProfile()]);
  const interval = recapInterval(period, now, rules.timeZone);
  const [data, all] = await Promise.all([
    source.getListening(interval),
    source.getListening({ start: new Date(0), end: interval.end }),
  ]);
  const firstPlayed = firstPlayedByArtist(all.plays, all.tracks, rules);
  const result = recap(data, all.plays, rules, interval, firstPlayed);
  const peak = heatmap(data, rules).peak;
  return {
    displayName: profile.displayName,
    avatar: profile.avatar,
    timeZone: rules.timeZone,
    start: interval.start.toISOString(),
    end: interval.end.toISOString(),
    activeDays: result.activeDays,
    minutes: result.minutes,
    plays: result.plays,
    topTracks: result.topTracks.map(toRankedTrack),
    topArtist: result.topArtist ? toRankedArtist(result.topArtist) : null,
    peakHour: result.peakHour,
    peakWeekday: peak?.weekday ?? null,
    nightShare: result.nightShare,
    newArtistCount: result.newArtistCount,
    firstFind: result.firstFind
      ? {
          name: result.firstFind.artist.name,
          firstPlayedAt: result.firstFind.firstPlayedAt.toISOString(),
        }
      : null,
    longestStreak: result.longestStreak,
  };
}
