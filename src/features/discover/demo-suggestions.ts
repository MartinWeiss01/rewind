import { match, P } from "ts-pattern";
import type { Catalog, CatalogTrack } from "@/demo/catalog";
import type { GenreKey } from "@/demo/persona";
import { hashString } from "@/demo/random";
import { fold } from "./matching";
import type { Candidate } from "./types";

/**
 * Pure: pre-generated suggestions for demo mode, without any model call.
 * Picks the least-played tracks of artists close to the seed and explains each
 * with a templated, localized reason.
 */

export const DemoReason = {
  /** A seed artist's track the listener has never played. */
  Unplayed: "unplayed",
  /** A seed artist's track played only a few times. */
  DeepCut: "deepCut",
  /** A seed artist's track the listener already knows well. */
  Familiar: "familiar",
  /** A track by a less-played artist in a matching genre. */
  Neighbor: "neighbor",
} as const;
export type DemoReason = (typeof DemoReason)[keyof typeof DemoReason];

export type DemoReasonFormatter = (
  reason: DemoReason,
  values: { artist: string; plays: number; genre: GenreKey },
) => string;

const genreKeywords: readonly [GenreKey, readonly string[]][] = [
  ["jazz", ["jazz", "swing", "sax", "trumpet", "lounge", "dzez", "jazzov"]],
  ["synthwave", ["synth", "80s", "retro", "neon", "night drive", "electro", "elektron"]],
  ["hiphop", ["hip hop", "hiphop", "rap", "beats", "boom bap"]],
  ["folk", ["folk", "acoustic", "akustick", "unplugged", "kytar", "campfire"]],
  ["indie", ["indie", "guitar", "alternative", "alternativ"]],
];

/** The genre a free-text request leans towards, if any keyword says so. */
export function genreHint(text: string): GenreKey | null {
  const folded = fold(text);
  for (const [genre, words] of genreKeywords) {
    if (words.some((word) => folded.includes(word))) return genre;
  }
  return null;
}

export type DemoSuggestionInput = {
  catalog: Catalog;
  /** Artists the run starts from, most relevant first. */
  seedArtistIds: readonly string[];
  playCounts: ReadonlyMap<string, number>;
  genre: GenreKey | null;
  candidates: number;
  /** Like the model prompt: leave out tracks played more often than this. */
  maxPlays: number | null;
  /** Varies the picks between different requests; same input, same output. */
  salt: string;
  formatReason: DemoReasonFormatter;
};

/** Up to this many plays a track still counts as a deep cut. */
const deepCutPlays = 5;

const isRerelease = (track: CatalogTrack) => track.id.endsWith("-remaster");

export function demoCandidates(input: DemoSuggestionInput): Candidate[] {
  const { catalog, playCounts } = input;
  const seeds = input.seedArtistIds.filter((id) => catalog.tracksByArtist.has(id));
  const seedSet = new Set(seeds);
  const seedGenres = new Set(
    catalog.artists.filter((a) => seedSet.has(a.id)).map((artist) => artist.genre),
  );
  const wantedGenres = input.genre ? new Set([input.genre]) : seedGenres;

  // Neighbours: other artists in the wanted genres, least affinity first (the ones heard less).
  const neighbors = catalog.artists
    .filter((a) => !seedSet.has(a.id) && wantedGenres.has(a.genre))
    .sort((a, b) => a.affinity - b.affinity || a.name.localeCompare(b.name))
    .map((a) => a.id);
  // With a genre hint, seeds in that genre go first.
  const genreOf = (id: string) => catalog.artists.find((a) => a.id === id)?.genre;
  // With a genre hint: seeds in that genre, then neighbours in it, then the other seeds.
  const head = input.genre ? seeds.filter((id) => genreOf(id) === input.genre) : seeds;
  const tail = input.genre
    ? [...neighbors, ...seeds.filter((id) => genreOf(id) !== input.genre)]
    : neighbors;
  if (head.length + tail.length === 0) return [];
  // Rotate the strongest few so different requests start from different artists.
  const offset = hashString(input.salt) % Math.max(1, Math.min(head.length, 4));
  const artists = [...head.slice(offset), ...head.slice(0, offset), ...tail];

  const queues = new Map(
    artists.map((id) => [
      id,
      [...(catalog.tracksByArtist.get(id) ?? [])]
        .filter((track) => !isRerelease(track))
        .filter(
          (track) => input.maxPlays === null || (playCounts.get(track.id) ?? 0) <= input.maxPlays,
        )
        .sort(
          (a, b) =>
            (playCounts.get(a.id) ?? 0) - (playCounts.get(b.id) ?? 0) ||
            b.pull - a.pull ||
            a.id.localeCompare(b.id),
        ),
    ]),
  );

  const picked: Candidate[] = [];
  // Round robin: one track per artist per round, so no artist dominates.
  for (let round = 0; picked.length < input.candidates; round++) {
    let added = false;
    for (const id of artists) {
      if (picked.length >= input.candidates) break;
      const track = queues.get(id)?.[round];
      const artist = track?.artists[0];
      if (!track || !artist) continue;
      added = true;
      const plays = playCounts.get(track.id) ?? 0;
      const reason = match({ seed: seedSet.has(id), plays })
        .with({ seed: true, plays: 0 }, () => DemoReason.Unplayed)
        .with({ seed: true, plays: P.number.lte(deepCutPlays) }, () => DemoReason.DeepCut)
        .with({ seed: true }, () => DemoReason.Familiar)
        .otherwise(() => DemoReason.Neighbor);
      picked.push({
        title: track.name,
        artist: artist.name,
        reason: input.formatReason(reason, { artist: artist.name, plays, genre: track.genre }),
      });
    }
    if (!added) break;
  }
  return picked;
}
