import { z } from "zod";
import type { Track } from "@/domain/music";

/** Where a suggestion run starts from. */
export const DiscoverMode = {
  Vibe: "vibe",
  Playlist: "playlist",
} as const;
export type DiscoverMode = (typeof DiscoverMode)[keyof typeof DiscoverMode];

export const countBounds = { min: 5, max: 30, default: 20 } as const;
/** Share of extra candidates asked for, since some never match a track. */
export const candidateOverhead = 0.3;
export const maxPromptLength = 500;
/** Candidates matched per server round trip; the client shows progress between them. */
export const matchBatchSize = 6;

export const discoverRequestSchema = z.object({
  seed: z.discriminatedUnion("mode", [
    z.object({
      mode: z.literal(DiscoverMode.Vibe),
      prompt: z.string().trim().min(3).max(maxPromptLength),
    }),
    z.object({
      mode: z.literal(DiscoverMode.Playlist),
      playlistId: z.string().min(1).max(200),
    }),
  ]),
  count: z.number().int().min(countBounds.min).max(countBounds.max),
  /** Drop tracks played more than this many times; null keeps everything. */
  maxPlays: z.number().int().min(0).max(10_000).nullable(),
  newArtistsOnly: z.boolean(),
});
export type DiscoverRequest = z.infer<typeof discoverRequestSchema>;

/** One suggestion as the model returns it. Also the schema for structured output. */
export const candidateSchema = z.object({
  title: z.string().trim().min(1).max(200).describe("Exact track title as released"),
  artist: z.string().trim().min(1).max(200).describe("Main artist as credited"),
  reason: z
    .string()
    .trim()
    .min(1)
    .max(400)
    .describe("One short sentence on why it fits this listener"),
});
export type Candidate = z.infer<typeof candidateSchema>;

/** A candidate matched to a real track. */
export type Suggestion = {
  track: Track;
  reason: string;
  /** True when the best search result is not an exact title and artist match. */
  closestMatch: boolean;
};

export const candidatesNeeded = (count: number) => Math.ceil(count * (1 + candidateOverhead));

/** "Title — Artist", the form unmatched suggestions are listed and saved in. */
export const candidateLabel = (candidate: Pick<Candidate, "title" | "artist">) =>
  `${candidate.title} — ${candidate.artist}`;

/** Why a step failed, shown with a matching message and a retry. */
export const DiscoverError = {
  Timeout: "timeout",
  Provider: "provider",
  NotConfigured: "notConfigured",
  EmptyAnswer: "emptyAnswer",
  Invalid: "invalid",
  PlaylistMissing: "playlistMissing",
  Forbidden: "forbidden",
  Unknown: "unknown",
} as const;
export type DiscoverError = (typeof DiscoverError)[keyof typeof DiscoverError];

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: DiscoverError };
