import type { ListeningData } from "@/data/music-data-source";
import type { ListeningRules } from "@/domain/listening";
import type { ArtistRef, Track } from "@/domain/music";
import type { PlaylistDetail } from "@/domain/playlists";
import { intervalFor, TimeRange } from "@/domain/time-range";
import {
  discovery,
  firstPlayedByArtist,
  Metric,
  topArtists,
  topTracks,
} from "@/features/stats/engine";

/** Pure: turns listening history into the small context the model sees. */

export type TrackLine = { title: string; artist: string };

export type TasteProfile = {
  /** Counted plays in the profile window (last 6 months). */
  plays: number;
  topArtists: readonly ArtistRef[];
  topTracks: readonly TrackLine[];
  /** Artists first heard inside the window. */
  recentDiscoveries: readonly ArtistRef[];
  /** Tracks the listener starts often but mostly skips. */
  skipHeavy: readonly TrackLine[];
};

/** Everything needed to filter matched tracks, over the whole history. */
export type ListeningIndex = {
  /** Counted plays per track ID. */
  playCounts: ReadonlyMap<string, number>;
  /** Every artist with at least one play, skips included. */
  knownArtistIds: ReadonlySet<string>;
};

export const profileLimits = {
  topArtists: 12,
  topTracks: 12,
  discoveries: 6,
  skipHeavy: 6,
} as const;

const line = (track: Track): TrackLine => ({
  title: track.name,
  artist: track.artists.map((a) => a.name).join(", "),
});

export function buildTasteProfile(
  all: ListeningData,
  rules: ListeningRules,
  now: Date,
): TasteProfile {
  const window = intervalFor(TimeRange.Last6Months, now);
  const recent: ListeningData = {
    plays: all.plays.filter((p) => p.playedAt >= window.start && p.playedAt < window.end),
    tracks: all.tracks,
  };

  const starts = new Map<string, { track: Track; total: number; skips: number }>();
  let counted = 0;
  for (const play of recent.plays) {
    const track = recent.tracks.get(play.trackId);
    if (!track) continue;
    const skipped = play.msPlayed < rules.skipThresholdMs;
    if (!skipped) counted += 1;
    const entry = starts.get(track.id) ?? { track, total: 0, skips: 0 };
    entry.total += 1;
    if (skipped) entry.skips += 1;
    starts.set(track.id, entry);
  }
  const skipHeavy = [...starts.values()]
    .filter((e) => e.total >= 3 && e.skips / e.total >= 0.6)
    .sort((a, b) => b.skips - a.skips || a.track.name.localeCompare(b.track.name))
    .slice(0, profileLimits.skipHeavy)
    .map((e) => line(e.track));

  const firstPlayed = firstPlayedByArtist(all.plays, all.tracks, rules);
  return {
    plays: counted,
    topArtists: topArtists(recent, rules, Metric.Plays, profileLimits.topArtists).map(
      (a) => a.artist,
    ),
    topTracks: topTracks(recent, rules, Metric.Plays, profileLimits.topTracks).map((t) =>
      line(t.track),
    ),
    recentDiscoveries: discovery(recent, firstPlayed, window, rules)
      .newArtists.slice(0, profileLimits.discoveries)
      .map((a) => a.artist),
    skipHeavy,
  };
}

export function buildListeningIndex(all: ListeningData, rules: ListeningRules): ListeningIndex {
  const playCounts = new Map<string, number>();
  const knownArtistIds = new Set<string>();
  for (const play of all.plays) {
    const track = all.tracks.get(play.trackId);
    if (!track) continue;
    for (const artist of track.artists) knownArtistIds.add(artist.id);
    if (play.msPlayed >= rules.skipThresholdMs) {
      playCounts.set(track.id, (playCounts.get(track.id) ?? 0) + 1);
    }
  }
  return { playCounts, knownArtistIds };
}

export type PlaylistSeed = {
  name: string;
  /** Artists by how many of the playlist's tracks they appear on. */
  artists: readonly ArtistRef[];
  sampleTracks: readonly TrackLine[];
};

export const seedLimits = { artists: 10, sampleTracks: 12 } as const;

/** The playlist as seed for suggestions: its most frequent artists and a sample of tracks. */
export function buildPlaylistSeed(playlist: PlaylistDetail): PlaylistSeed {
  const items = playlist.items ?? [];
  const counts = new Map<string, { artist: ArtistRef; tracks: number; first: number }>();
  items.forEach(({ track }, index) => {
    for (const artist of track.artists) {
      const entry = counts.get(artist.id) ?? { artist, tracks: 0, first: index };
      entry.tracks += 1;
      counts.set(artist.id, entry);
    }
  });
  const artists = [...counts.values()]
    .sort((a, b) => b.tracks - a.tracks || a.first - b.first)
    .map((e) => e.artist);
  // Spread the sample across the playlist rather than taking only its start.
  const step = Math.max(1, Math.floor(items.length / seedLimits.sampleTracks));
  const sampleTracks = items
    .filter((_, i) => i % step === 0)
    .slice(0, seedLimits.sampleTracks)
    .map((item) => line(item.track));
  return { name: playlist.name, artists, sampleTracks };
}

/** The "Seeded from: A, B, C + N more" line under the playlist picker. */
export function seedSummary(seed: PlaylistSeed, shown = 4): { artists: string[]; more: number } {
  return {
    artists: seed.artists.slice(0, shown).map((a) => a.name),
    more: Math.max(0, seed.artists.length - shown),
  };
}
