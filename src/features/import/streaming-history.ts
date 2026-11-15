import { z } from "zod";

/**
 * One entry of Spotify's Extended Streaming History export
 * (Streaming_History_Audio_*.json). Only the fields Rewind needs are read; everything
 * else in the file (IP address, platform, country…) is ignored and never stored.
 */
const entrySchema = z.looseObject({
  ts: z.iso.datetime({ offset: true }),
  ms_played: z.number().int().nonnegative(),
  spotify_track_uri: z.string().nullable().optional(),
  master_metadata_track_name: z.string().nullable().optional(),
});

export type HistoryEntry = { trackId: string; playedAt: Date; msPlayed: number };

export type ParsedHistory = {
  entries: HistoryEntry[];
  /** Podcast episodes, audiobooks, local files and malformed rows. */
  skipped: number;
};

export class NotAStreamingHistoryError extends Error {
  constructor() {
    super("The file is not an Extended Streaming History JSON export.");
    this.name = "NotAStreamingHistoryError";
  }
}

const trackUri = /^spotify:track:([A-Za-z0-9-]+)$/;

/**
 * Parses the JSON content of one export file. `ts` is when playback ended,
 * so the play's start is `ts - ms_played`.
 */
export function parseStreamingHistory(content: unknown): ParsedHistory {
  if (!Array.isArray(content)) throw new NotAStreamingHistoryError();
  const entries: HistoryEntry[] = [];
  let skipped = 0;
  let recognised = 0;
  for (const raw of content) {
    const parsed = entrySchema.safeParse(raw);
    if (!parsed.success) {
      skipped++;
      continue;
    }
    recognised++;
    const match = parsed.data.spotify_track_uri?.match(trackUri);
    const trackId = match?.[1];
    if (!trackId) {
      skipped++;
      continue;
    }
    const endedAt = new Date(parsed.data.ts).getTime();
    entries.push({
      trackId,
      playedAt: new Date(endedAt - parsed.data.ms_played),
      msPlayed: parsed.data.ms_played,
    });
  }
  if (content.length > 0 && recognised === 0) throw new NotAStreamingHistoryError();
  return { entries, skipped };
}

/** Key that makes re-imports idempotent: the same track starting in the same second. */
export const playKey = (entry: { trackId: string; playedAt: Date }) =>
  `${entry.trackId}@${Math.floor(entry.playedAt.getTime() / 1000)}`;
