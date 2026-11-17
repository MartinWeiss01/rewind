import { z } from "zod";
import type { Track } from "@/domain/music";
import type { ChoiceAnswer, ChoiceQuestion } from "@/server/ai";

/**
 * Pure: sorting the tracks of one playlist into other playlists. Each distinct track
 * becomes one multiple-choice question whose options are the target playlists and
 * "keep it where it is"; the answer's probability is the suggestion's confidence.
 */

export const sortIntoLimits = { minTargets: 1, maxTargets: 12, maxTracks: 2000 } as const;

/** Option ID for "none of the playlists fits". */
export const keepOption = "keep";

/** How sure a suggestion has to be before it starts ticked. */
export const ConfidenceLevel = {
  Strict: "strict",
  Balanced: "balanced",
  Loose: "loose",
} as const;
export type ConfidenceLevel = (typeof ConfidenceLevel)[keyof typeof ConfidenceLevel];
export const confidenceLevelSchema = z.enum(ConfidenceLevel);

export const confidenceThreshold: Record<ConfidenceLevel, number> = {
  strict: 0.8,
  balanced: 0.6,
  loose: 0.4,
};

/** A playlist tracks can be sorted into, as the model sees it. */
export type SortTarget = {
  id: string;
  name: string;
  description: string;
  trackIds: readonly string[];
};

export type SortSuggestion = {
  trackId: string;
  /** Null when the track should stay where it is. */
  targetId: string | null;
  /** Probability of the suggested option, 0..1. */
  confidence: number;
};

const describeTrack = (track: Track) =>
  `${track.name} — ${track.artists.map((a) => a.name).join(", ")}`;

/** Up to `count` items spread evenly over the list, so samples aren't all from the top. */
export function spread<T>(items: readonly T[], count: number): T[] {
  if (items.length <= count) return [...items];
  const step = items.length / count;
  return Array.from({ length: count }, (_, i) => items[Math.floor(i * step)] as T);
}

const optionId = (index: number) => `p${String(index + 1).padStart(2, "0")}`;

/** The shared state and one question per track for the decision model. */
export function buildSortQuestions(
  tracks: readonly Track[],
  targets: readonly SortTarget[],
  trackById: ReadonlyMap<string, Track>,
): { state: string; questions: ChoiceQuestion[]; targetOf: ReadonlyMap<string, string | null> } {
  const targetOf = new Map<string, string | null>([[keepOption, null]]);
  const options: Record<string, string> = {};
  const playlists = targets.map((target, index) => {
    const id = optionId(index);
    targetOf.set(id, target.id);
    options[id] = `Playlist "${target.name}"`;
    return {
      option: id,
      name: target.name,
      description: target.description,
      exampleTracks: spread(target.trackIds, 12).flatMap((tid) => {
        const track = trackById.get(tid);
        return track ? [describeTrack(track)] : [];
      }),
    };
  });
  options[keepOption] = "None of the playlists fits clearly; keep the track where it is";

  const state = JSON.stringify({
    task: "Sort each track into the playlist whose mood, genre and style it fits best, judging by each playlist's name, description and example tracks.",
    playlists,
  });
  const questions = tracks.map((track, index) => ({
    id: `t${index}`,
    instructions: `Which playlist does the track "${track.name}" by ${track.artists.map((a) => a.name).join(", ")} (album "${track.album.name}"${track.album.releaseDate ? `, ${track.album.releaseDate.slice(0, 4)}` : ""}) fit best?`,
    options,
  }));
  return { state, questions, targetOf };
}

/** Turns the model's answers back into suggestions, in track order. */
export function suggestionsFromAnswers(
  tracks: readonly Track[],
  answers: ReadonlyMap<string, ChoiceAnswer>,
  targetOf: ReadonlyMap<string, string | null>,
): SortSuggestion[] {
  return tracks.map((track, index) => {
    const answer = answers.get(`t${index}`);
    const targetId = answer ? (targetOf.get(answer.choice) ?? null) : null;
    const confidence = answer ? (answer.probabilities[answer.choice] ?? 0) : 0;
    return { trackId: track.id, targetId, confidence };
  });
}

/** A stable number in [0, 1) from a string, for demo answers that look varied. */
function unit(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 2 ** 32;
}

/**
 * Pre-made suggestions for the demo, without a model: a track leans towards the
 * playlists that hold the most tracks of its genre. Same input, same output.
 */
export function demoSortSuggestions<G extends string>(
  trackIds: readonly string[],
  targets: readonly SortTarget[],
  genreOf: (trackId: string) => G | null,
): SortSuggestion[] {
  const shares = targets.map((target) => {
    const counts = new Map<G, number>();
    for (const id of target.trackIds) {
      const genre = genreOf(id);
      if (genre) counts.set(genre, (counts.get(genre) ?? 0) + 1);
    }
    return { target, counts, size: Math.max(target.trackIds.length, 1) };
  });
  return trackIds.map((trackId) => {
    const genre = genreOf(trackId);
    const scores = shares.map(({ target, counts, size }) => {
      const share = genre ? (counts.get(genre) ?? 0) / size : 0;
      return {
        targetId: target.id,
        score: (share + 0.05) ** 2 * (0.8 + 0.4 * unit(trackId + target.id)),
      };
    });
    const keep = 0.04 + 0.06 * unit(`${trackId}:keep`);
    const total = scores.reduce((sum, s) => sum + s.score, keep);
    const best = scores.reduce<{ targetId: string | null; score: number }>(
      (top, s) => (s.score > top.score ? s : top),
      { targetId: null, score: keep },
    );
    return { trackId, targetId: best.targetId, confidence: best.score / total };
  });
}

/** What applying the chosen moves does to each playlist. */
export type SortPlan = {
  /** Tracks appended to each target, in source order. */
  adds: ReadonlyMap<string, readonly string[]>;
  /** The source after the moved tracks are taken out. */
  remaining: readonly string[];
  /** Distinct tracks moved. */
  moved: number;
};

export function planSortInto(input: {
  sourceIds: readonly string[];
  targetIds: ReadonlyMap<string, readonly string[]>;
  moves: readonly { trackId: string; targetId: string }[];
  skipExisting: boolean;
}): SortPlan {
  const destination = new Map<string, string>();
  for (const move of input.moves) {
    if (input.targetIds.has(move.targetId)) destination.set(move.trackId, move.targetId);
  }
  const adds = new Map<string, string[]>();
  const added = new Set<string>();
  for (const trackId of input.sourceIds) {
    const targetId = destination.get(trackId);
    if (!targetId || added.has(trackId)) continue;
    added.add(trackId);
    const existing = input.targetIds.get(targetId) ?? [];
    if (input.skipExisting && existing.includes(trackId)) continue;
    adds.set(targetId, [...(adds.get(targetId) ?? []), trackId]);
  }
  return {
    adds,
    remaining: input.sourceIds.filter((id) => !destination.has(id)),
    moved: added.size,
  };
}

/** Why suggestions couldn't be made, translated on the client. */
export const SortIntoError = {
  Forbidden: "forbidden",
  Invalid: "invalid",
  NotFound: "notFound",
  ReadOnly: "readOnly",
  TooLarge: "tooLarge",
  NotConfigured: "notConfigured",
  Timeout: "timeout",
  Provider: "provider",
  RateLimited: "rateLimited",
} as const;
export type SortIntoError = (typeof SortIntoError)[keyof typeof SortIntoError];

export type SuggestResult =
  | {
      status: "ok";
      /** False when the answers are pre-made (demo without live AI). */
      live: boolean;
      suggestions: SortSuggestion[];
    }
  | { status: "error"; error: SortIntoError };
