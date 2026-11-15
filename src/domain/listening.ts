import { z } from "zod";

export const PlaySource = {
  Synced: "synced",
  Imported: "imported",
} as const;
export type PlaySource = (typeof PlaySource)[keyof typeof PlaySource];

/** One listen of one track. */
export type Play = {
  trackId: string;
  /** When playback started. */
  playedAt: Date;
  msPlayed: number;
  source: PlaySource;
};

/** Half-open interval [start, end). */
export type Interval = { start: Date; end: Date };

/** Per-user rules that change how plays are counted. */
export type ListeningRules = {
  /** Plays shorter than this count as skips and are left out of stats. */
  skipThresholdMs: number;
  /** IANA time zone used for heatmaps, streaks and day buckets. */
  timeZone: string;
};

export const defaultListeningRules: ListeningRules = {
  skipThresholdMs: 30_000,
  timeZone: "UTC",
};

export const listeningRulesSchema = z.object({
  skipThresholdMs: z.number().int().min(0).max(300_000),
  timeZone: z.string().refine((tz) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, "Unknown time zone"),
});
