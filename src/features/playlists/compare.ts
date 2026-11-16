import {
  isUsableKey,
  keysAt,
  levelRank,
  type MatchableItem,
  type MatchLevel,
  matchLevels,
} from "./duplicates";

/** The two playlists being compared. */
export const CompareSide = {
  /** The playlist the comparison was opened from. */
  Here: "here",
  /** The playlist picked to compare with. */
  There: "there",
} as const;
export type CompareSide = (typeof CompareSide)[keyof typeof CompareSide];
export const compareSides = Object.values(CompareSide);

/** A track that the other playlist also has. */
export type CrossMatch<T extends MatchableItem = MatchableItem> = {
  item: T;
  /** The strictest rule it matches the other playlist by. */
  reason: MatchLevel;
  /** The other playlist's tracks it matches by that rule, in playlist order. */
  matches: readonly T[];
};

/**
 * Every track in `items` that `others` also has at the given strictness, in
 * playlist order. Each track is judged on its own by its strictest direct match, so
 * a loose level never pulls in tracks that only resemble another match.
 */
export function findCrossMatches<T extends MatchableItem>(
  items: readonly T[],
  others: readonly T[],
  level: MatchLevel,
): CrossMatch<T>[] {
  const found = new Map<number, CrossMatch<T>>();
  const maxRank = levelRank(level);
  for (let rank = 0; rank <= maxRank; rank++) {
    const current = matchLevels[rank];
    if (!current) continue;
    const byKey = new Map<string, number[]>();
    others.forEach((other, index) => {
      for (const key of keysAt(current, other.track)) {
        if (isUsableKey(key)) byKey.set(key, [...(byKey.get(key) ?? []), index]);
      }
    });
    items.forEach((item, index) => {
      if (found.has(index)) return;
      const hits = new Set(
        keysAt(current, item.track).flatMap((key) =>
          isUsableKey(key) ? (byKey.get(key) ?? []) : [],
        ),
      );
      if (hits.size === 0) return;
      const matches = [...hits]
        .sort((a, b) => a - b)
        .flatMap((i) => {
          const other = others[i];
          return other ? [other] : [];
        });
      found.set(index, { item, reason: current, matches });
    });
  }
  return [...found.entries()].sort(([a], [b]) => a - b).map(([, match]) => match);
}
