import { match } from "ts-pattern";
import { z } from "zod";
import type { ArtistRef, Track } from "@/domain/music";
import type { PlaylistItem } from "@/domain/playlists";

/* ---------- Merge ---------- */

export type MergePlan = {
  /** Track IDs to append to the target, in source order. */
  added: string[];
  /** Source tracks left out because the target (or an earlier source) already has them. */
  skipped: number;
  /** Tracks in the target after the merge. */
  total: number;
};

/** Plans appending the tracks of several sources to a target. */
export function planMerge(
  target: readonly string[],
  sources: readonly (readonly string[])[],
  skipExisting: boolean,
): MergePlan {
  const seen = new Set(target);
  const added: string[] = [];
  let skipped = 0;
  for (const source of sources) {
    for (const id of source) {
      if (skipExisting && seen.has(id)) {
        skipped += 1;
        continue;
      }
      seen.add(id);
      added.push(id);
    }
  }
  return { added, skipped, total: target.length + added.length };
}

/* ---------- Sort ---------- */

export const SortKey = {
  Added: "added",
  Artist: "artist",
  Release: "release",
  Plays: "plays",
} as const;
export type SortKey = (typeof SortKey)[keyof typeof SortKey];
export const sortKeySchema = z.enum(SortKey);

export const SortDirection = {
  /** Newest, A first, latest release, most plays. */
  Desc: "desc",
  Asc: "asc",
} as const;
export type SortDirection = (typeof SortDirection)[keyof typeof SortDirection];
export const sortDirectionSchema = z.enum(SortDirection);

const firstArtist = (track: Track) => track.artists[0]?.name ?? "";

/** "2019" → "2019-00-00", so partial release dates still compare. Unknown dates are null. */
const releaseKey = (track: Track) => {
  const date = track.album.releaseDate;
  if (!date) return null;
  const [year = "0000", month = "00", day = "00"] = date.split("-");
  return `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
};

/**
 * Sorts items by a key. `desc` puts the newest, most played or latest released first;
 * for artists it means A to Z. Items without a value go last either way; ties keep
 * their current order.
 */
export function sortItems<T extends Pick<PlaylistItem, "track" | "addedAt">>(
  items: readonly T[],
  key: SortKey,
  direction: SortDirection,
  plays: ReadonlyMap<string, number> = new Map(),
): T[] {
  const sign = direction === SortDirection.Desc ? -1 : 1;
  const compareNullable = <V extends number | string>(a: V | null, b: V | null): number => {
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    if (a === b) return 0;
    return (a < b ? -1 : 1) * sign;
  };
  const compare = match(key)
    .with(
      SortKey.Added,
      () => (a: T, b: T) => compareNullable(a.addedAt?.getTime() ?? null, b.addedAt?.getTime() ?? null),
    )
    .with(SortKey.Artist, () => (a: T, b: T) => {
      const byArtist = firstArtist(a.track).localeCompare(firstArtist(b.track), undefined, {
        sensitivity: "base",
      });
      const byName = a.track.name.localeCompare(b.track.name, undefined, { sensitivity: "base" });
      // Artists read A to Z for "desc" (the default), Z to A otherwise.
      return (byArtist || byName) * -sign;
    })
    .with(SortKey.Release, () => (a: T, b: T) => compareNullable(releaseKey(a.track), releaseKey(b.track)))
    .with(
      SortKey.Plays,
      () => (a: T, b: T) => compareNullable(plays.get(a.track.id) ?? 0, plays.get(b.track.id) ?? 0),
    )
    .exhaustive();
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => compare(a.item, b.item) || a.index - b.index)
    .map(({ item }) => item);
}

/* ---------- Split ---------- */

export const SplitBy = {
  Artist: "artist",
  Year: "year",
} as const;
export type SplitBy = (typeof SplitBy)[keyof typeof SplitBy];
export const splitBySchema = z.enum(SplitBy);

/** One playlist a split creates. `key` is null for the "Other" group. */
export type SplitGroup = {
  key: string | null;
  /** Artist name or release year; null for "Other". */
  label: string | null;
  trackIds: string[];
};

const releaseYear = (track: Track) => track.album.releaseDate?.slice(0, 4) || null;

/**
 * Splits items by their first artist or release year. Groups smaller than
 * `minSize` (and tracks without a year) go to one "Other" group at the end.
 * Big groups come first; a track appears once per group.
 */
export function planSplit(
  items: readonly Pick<PlaylistItem, "track">[],
  by: SplitBy,
  minSize: number,
): SplitGroup[] {
  const groups = new Map<string, { label: string; ids: string[]; seen: Set<string> }>();
  const other: string[] = [];
  const otherSeen = new Set<string>();
  for (const { track } of items) {
    const found = match(by)
      .with(SplitBy.Artist, () => {
        const artist: ArtistRef | undefined = track.artists[0];
        return artist ? { key: artist.id, label: artist.name } : null;
      })
      .with(SplitBy.Year, () => {
        const year = releaseYear(track);
        return year ? { key: year, label: year } : null;
      })
      .exhaustive();
    if (!found) {
      if (!otherSeen.has(track.id)) {
        otherSeen.add(track.id);
        other.push(track.id);
      }
      continue;
    }
    const group = groups.get(found.key) ?? { label: found.label, ids: [], seen: new Set() };
    if (!group.seen.has(track.id)) {
      group.seen.add(track.id);
      group.ids.push(track.id);
    }
    groups.set(found.key, group);
  }

  const result: SplitGroup[] = [];
  for (const [key, group] of groups) {
    if (group.ids.length >= minSize) {
      result.push({ key, label: group.label, trackIds: group.ids });
    } else {
      for (const id of group.ids) {
        if (!otherSeen.has(id)) {
          otherSeen.add(id);
          other.push(id);
        }
      }
    }
  }
  result.sort(
    (a, b) =>
      b.trackIds.length - a.trackIds.length ||
      (by === SplitBy.Year
        ? (b.label ?? "").localeCompare(a.label ?? "")
        : (a.label ?? "").localeCompare(b.label ?? "")),
  );
  if (other.length > 0) result.push({ key: null, label: null, trackIds: other });
  return result;
}

/* ---------- Insights ---------- */

export type PlaylistInsights = {
  durationMs: number;
  topArtists: { artist: ArtistRef; tracks: number }[];
  /** Tracks added per month, oldest first, as "YYYY-MM" keys; at most `months` entries. */
  addedByMonth: { month: string; count: number }[];
};

const monthKey = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "0000";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${year}-${month}`;
};

const previousMonth = (key: string) => {
  const [y = 0, m = 1] = key.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
};

/** Total duration, artists by number of tracks, and tracks added per month up to `now`. */
export function playlistInsights(
  items: readonly Pick<PlaylistItem, "track" | "addedAt">[],
  now: Date,
  timeZone: string,
  { artists = 5, months = 12 }: { artists?: number; months?: number } = {},
): PlaylistInsights {
  let durationMs = 0;
  const byArtist = new Map<string, { artist: ArtistRef; tracks: number }>();
  const byMonth = new Map<string, number>();
  for (const { track, addedAt } of items) {
    durationMs += track.durationMs;
    for (const artist of track.artists) {
      const entry = byArtist.get(artist.id) ?? { artist, tracks: 0 };
      entry.tracks += 1;
      byArtist.set(artist.id, entry);
    }
    if (addedAt) {
      const key = monthKey(addedAt, timeZone);
      byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
    }
  }
  const addedByMonth: { month: string; count: number }[] = [];
  let key = monthKey(now, timeZone);
  for (let i = 0; i < months; i++) {
    addedByMonth.unshift({ month: key, count: byMonth.get(key) ?? 0 });
    key = previousMonth(key);
  }
  return {
    durationMs,
    topArtists: [...byArtist.values()]
      .sort((a, b) => b.tracks - a.tracks || a.artist.name.localeCompare(b.artist.name))
      .slice(0, artists),
    addedByMonth,
  };
}
