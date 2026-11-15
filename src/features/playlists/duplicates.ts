import { match } from "ts-pattern";
import { z } from "zod";
import type { Track } from "@/domain/music";

/**
 * How loosely two playlist items count as the same song, strictest first.
 * Every level also matches everything the stricter levels match.
 */
export const MatchLevel = {
  /** The same Spotify track ID. */
  Exact: "exact",
  /** The same ISRC: one recording released on several albums. */
  Recording: "recording",
  /** Same normalized title and the same set of artists. */
  TitleAllArtists: "titleAllArtists",
  /** Same normalized title and at least one shared artist. */
  TitleSharedArtist: "titleSharedArtist",
  /** Same normalized title, any artist. */
  Title: "title",
} as const;
export type MatchLevel = (typeof MatchLevel)[keyof typeof MatchLevel];

export const matchLevels: readonly MatchLevel[] = [
  MatchLevel.Exact,
  MatchLevel.Recording,
  MatchLevel.TitleAllArtists,
  MatchLevel.TitleSharedArtist,
  MatchLevel.Title,
];
export const matchLevelSchema = z.enum(MatchLevel);

/** Position of a level from strict (0) to loose. */
export const levelRank = (level: MatchLevel): number => matchLevels.indexOf(level);

/** The level the playlist screens use for the "duplicates" badge and chips. */
export const defaultBadgeLevel: MatchLevel = MatchLevel.Recording;

/** The minimum a playlist row needs for duplicate matching. */
export type MatchableItem = {
  key: string;
  track: Pick<Track, "id" | "name" | "isrc" | "artists">;
  addedAt: Date | null;
};

export type DuplicateGroup<T extends MatchableItem = MatchableItem> = {
  /** Stable ID: the key of the group's first item in playlist order. */
  id: string;
  /** The loosest rule needed to connect the group, i.e. why it matched. */
  reason: MatchLevel;
  /** Members in playlist order, at least two. */
  items: readonly T[];
  /** The member kept by default: the oldest added, then the first in the list. */
  keepKey: string;
};

const stripAccents = (value: string) => value.normalize("NFKD").replace(/\p{Diacritic}/gu, "");

/** Words that mark a version of the same song rather than a different one. */
const versionWords =
  /\b(?:remaster(?:ed)?|live|radio edit|single edit|edit|single version|album version|version|mono|stereo|explicit|clean|bonus track|deluxe)\b/;
const featuring = /^(?:feat\.?|ft\.?|featuring|with)\s/;

const isVersionNote = (note: string) => {
  const text = note.trim();
  return versionWords.test(text) || featuring.test(text);
};

/**
 * Normalizes a track title for matching: lower case, no accents or punctuation,
 * and without version notes such as "- Remastered 2011", "(Live)", "- Radio Edit"
 * or "(feat. X)". Remixes and other different recordings keep their notes.
 */
export function normalizeTitle(title: string): string {
  let text = stripAccents(title).toLowerCase();
  // Bracketed notes: "(Remastered)", "[Live at Somewhere]", "(feat. X)".
  text = text.replace(/\s*[([]([^()[\]]*)[)\]]/g, (whole, note: string) =>
    isVersionNote(note) ? "" : whole,
  );
  // Dash notes: "Song - Remastered 2011", "Song – Radio Edit". Applied repeatedly from the end.
  for (;;) {
    const dash = text.match(/\s+[-–—]\s+([^-–—]+)$/);
    if (!dash || dash.index === undefined || !isVersionNote(dash[1] ?? "")) break;
    text = text.slice(0, dash.index);
  }
  // Unbracketed "feat. X" at the end.
  text = text.replace(/\s+(?:feat\.?|ft\.|featuring)\s.*$/, "");
  return text
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Normalizes an artist name for matching across releases. */
export function normalizeArtist(name: string): string {
  return stripAccents(name)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Union–find over item indexes that remembers the loosest edge per component. */
function createUnion(size: number) {
  const parent = Array.from({ length: size }, (_, i) => i);
  const loosest = new Array<number>(size).fill(-1);
  const find = (i: number): number => {
    let root = i;
    while (parent[root] !== root) root = parent[root] ?? root;
    let node = i;
    while (parent[node] !== root) {
      const next = parent[node] ?? root;
      parent[node] = root;
      node = next;
    }
    return root;
  };
  const union = (a: number, b: number, rank: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return;
    parent[rb] = ra;
    loosest[ra] = Math.max(loosest[ra] ?? -1, loosest[rb] ?? -1, rank);
  };
  return { find, union, loosest: (root: number) => loosest[root] ?? -1 };
}

/** Bucket keys an item contributes at one level; items sharing a key match. */
function keysAt(level: MatchLevel, track: MatchableItem["track"]): string[] {
  return match(level)
    .with(MatchLevel.Exact, () => [track.id])
    .with(MatchLevel.Recording, () => (track.isrc ? [track.isrc.toUpperCase()] : []))
    .with(MatchLevel.TitleAllArtists, () => {
      const artists = [...new Set(track.artists.map((a) => normalizeArtist(a.name)))].sort();
      return [`${normalizeTitle(track.name)}\u0000${artists.join("\u0001")}`];
    })
    .with(MatchLevel.TitleSharedArtist, () =>
      track.artists.map((a) => `${normalizeTitle(track.name)}\u0000${normalizeArtist(a.name)}`),
    )
    .with(MatchLevel.Title, () => [normalizeTitle(track.name)])
    .exhaustive();
}

const addedTime = (item: MatchableItem) => item.addedAt?.getTime() ?? Number.POSITIVE_INFINITY;

/**
 * Groups playlist items that are the same song at the given strictness.
 * Groups come in playlist order of their first item.
 */
export function findDuplicateGroups<T extends MatchableItem>(
  items: readonly T[],
  level: MatchLevel,
): DuplicateGroup<T>[] {
  const union = createUnion(items.length);
  const maxRank = levelRank(level);
  for (let rank = 0; rank <= maxRank; rank++) {
    const current = matchLevels[rank];
    if (!current) continue;
    const firstByKey = new Map<string, number>();
    items.forEach((item, index) => {
      for (const key of keysAt(current, item.track)) {
        if (key === "" || key.startsWith("\u0000")) continue;
        const first = firstByKey.get(key);
        if (first === undefined) firstByKey.set(key, index);
        else union.union(first, index, rank);
      }
    });
  }

  const members = new Map<number, number[]>();
  items.forEach((_, index) => {
    const root = union.find(index);
    const list = members.get(root) ?? [];
    list.push(index);
    members.set(root, list);
  });

  const groups: DuplicateGroup<T>[] = [];
  for (const [root, indexes] of members) {
    if (indexes.length < 2) continue;
    const groupItems = indexes.flatMap((i) => {
      const item = items[i];
      return item ? [item] : [];
    });
    const keep = groupItems.reduce((best, item) =>
      addedTime(item) < addedTime(best) ? item : best,
    );
    const first = groupItems[0];
    if (!first) continue;
    groups.push({
      id: first.key,
      reason: matchLevels[union.loosest(root)] ?? MatchLevel.Exact,
      items: groupItems,
      keepKey: keep.key,
    });
  }
  return groups.sort(
    (a, b) => items.findIndex((i) => i.key === a.id) - items.findIndex((i) => i.key === b.id),
  );
}

/** Keys to remove: every member except the kept one, per group. `keep` overrides the default. */
export function keysToRemove(
  groups: readonly DuplicateGroup[],
  keep: Readonly<Record<string, string>> = {},
): Set<string> {
  const remove = new Set<string>();
  for (const group of groups) {
    const chosen = keep[group.id];
    const keepKey = chosen && group.items.some((i) => i.key === chosen) ? chosen : group.keepKey;
    for (const item of group.items) if (item.key !== keepKey) remove.add(item.key);
  }
  return remove;
}

/** How many items the default removal would drop, for badges. */
export function duplicateCount(
  items: readonly MatchableItem[],
  level: MatchLevel = defaultBadgeLevel,
): number {
  return keysToRemove(findDuplicateGroups(items, level)).size;
}
