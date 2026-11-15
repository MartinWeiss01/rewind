import type { Track } from "@/domain/music";
import type { ListeningIndex } from "./profile";
import type { Candidate, Suggestion } from "./types";

/** Pure: matches model candidates to search results and filters the matches. */

/** Lowercase, no diacritics or punctuation, "&" as "and", single spaces. */
export function fold(value: string): string {
  return value
    .toLocaleLowerCase("en")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Title without version notes: "(Remastered 2011)", "- Live", "feat. X". */
export function normalizeTitle(title: string): string {
  const base = title
    .replace(/\s*[([][^)\]]*[)\]]/g, " ")
    .replace(/\s+-\s+.*$/, " ")
    .replace(/\s(feat|ft|featuring)\.?\s.*$/i, " ");
  const folded = fold(base);
  return folded.length > 0 ? folded : fold(title);
}

/** Splits "A & B", "A feat. B", "A, B", "A x B" into single artist names. */
export function splitArtists(artist: string): string[] {
  const parts = artist
    .split(/\s*(?:,|&|\band\b|\bfeat\.?|\bft\.?|\bfeaturing\b|\bx\b|\bwith\b|\/)\s*/i)
    .map(fold);
  // The full credit counts too: "Kito & the Tides" is one band, not two.
  return [...new Set([fold(artist), ...parts])].filter((name) => name.length > 0);
}

function bigrams(value: string): Map<string, number> {
  const padded = ` ${value} `;
  const grams = new Map<string, number>();
  for (let i = 0; i < padded.length - 1; i++) {
    const gram = padded.slice(i, i + 2);
    grams.set(gram, (grams.get(gram) ?? 0) + 1);
  }
  return grams;
}

/** Sørensen–Dice coefficient over character bigrams, 0..1. */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  const left = bigrams(a);
  const right = bigrams(b);
  let overlap = 0;
  let total = 0;
  for (const [gram, count] of left) {
    overlap += Math.min(count, right.get(gram) ?? 0);
    total += count;
  }
  for (const count of right.values()) total += count;
  return (2 * overlap) / total;
}

export const matchThresholds = { title: 0.7, artist: 0.6 } as const;

export type TrackMatch = { track: Track; exact: boolean; score: number };

/** The best search result for a candidate, or null when nothing is close enough. */
export function matchCandidate(candidate: Candidate, results: readonly Track[]): TrackMatch | null {
  const wantedTitle = normalizeTitle(candidate.title);
  const wantedArtists = splitArtists(candidate.artist);
  if (wantedArtists.length === 0) return null;
  let best: TrackMatch | null = null;
  for (const track of results) {
    const title = similarity(wantedTitle, normalizeTitle(track.name));
    const trackArtists = track.artists.map((a) => fold(a.name));
    let artist = 0;
    for (const wanted of wantedArtists) {
      for (const actual of trackArtists) artist = Math.max(artist, similarity(wanted, actual));
    }
    if (title < matchThresholds.title || artist < matchThresholds.artist) continue;
    const score = 0.6 * title + 0.4 * artist;
    if (best && score <= best.score) continue;
    best = {
      track,
      score,
      exact:
        wantedTitle === normalizeTitle(track.name) &&
        wantedArtists.some((name) => trackArtists.includes(name)),
    };
  }
  return best;
}

/** The search query for a candidate. */
export const searchQuery = (candidate: Candidate) =>
  `${candidate.title.replace(/\s*[([][^)\]]*[)\]]/g, " ").trim()} ${candidate.artist}`;

export type FilterOptions = {
  count: number;
  maxPlays: number | null;
  newArtistsOnly: boolean;
};

/**
 * Drops duplicates, tracks played more than `maxPlays` times and, with
 * `newArtistsOnly`, tracks by any known artist. Keeps order and trims to `count`.
 */
export function filterSuggestions(
  suggestions: readonly Suggestion[],
  index: ListeningIndex,
  options: FilterOptions,
): { kept: Suggestion[]; filteredOut: number } {
  const seen = new Set<string>();
  const kept: Suggestion[] = [];
  let filteredOut = 0;
  for (const suggestion of suggestions) {
    const { track } = suggestion;
    if (seen.has(track.id)) continue;
    seen.add(track.id);
    const plays = index.playCounts.get(track.id) ?? 0;
    const tooFamiliar = options.maxPlays !== null && plays > options.maxPlays;
    const knownArtist =
      options.newArtistsOnly && track.artists.some((a) => index.knownArtistIds.has(a.id));
    if (tooFamiliar || knownArtist) {
      filteredOut += 1;
      continue;
    }
    kept.push(suggestion);
  }
  return { kept: kept.slice(0, options.count), filteredOut };
}

/** Removes repeated candidates (same normalized title and artist). */
export function dedupeCandidates(candidates: readonly Candidate[]): Candidate[] {
  const seen = new Set<string>();
  return candidates.filter((c) => {
    const key = `${normalizeTitle(c.title)}|${fold(c.artist)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
