import { match, P } from "ts-pattern";
import { z } from "zod";

/** Every feature flag the app knows. Add a flag here and in `.env.example`. */
export const FeatureFlag = {
  Stats: "stats",
  Ai: "ai",
  PlaylistWrite: "playlistWrite",
} as const;
export type FeatureFlag = (typeof FeatureFlag)[keyof typeof FeatureFlag];

/** Environment variable that holds each flag's rule in Spotify mode. */
const envNames = {
  stats: "FEATURE_STATS",
  ai: "FEATURE_AI",
  playlistWrite: "FEATURE_PLAYLIST_WRITE",
} as const satisfies Record<FeatureFlag, `FEATURE_${string}`>;

/** Who is looking at the app, resolved once per request. */
export type Viewer = { mode: "demo" } | { mode: "spotify"; spotifyUserId: string };

/**
 * A flag's rule in Spotify mode: `all`, `none` (also when unset), or a
 * comma-separated list of Spotify user IDs.
 */
export type FlagRule =
  | { kind: "all" }
  | { kind: "none" }
  | { kind: "users"; ids: readonly string[] };

export const flagRuleSchema = z
  .string()
  .optional()
  .transform((raw): FlagRule => {
    const value = (raw ?? "").trim();
    return match(value.toLowerCase())
      .with(P.union("", "none"), (): FlagRule => ({ kind: "none" }))
      .with("all", (): FlagRule => ({ kind: "all" }))
      .otherwise(
        (): FlagRule => ({
          kind: "users",
          ids: value
            .split(",")
            .map((id) => id.trim())
            .filter((id) => id.length > 0),
        }),
      );
  });

export type FlagRules = Record<FeatureFlag, FlagRule>;

const allFlags: readonly FeatureFlag[] = Object.values(FeatureFlag);

/** Reads every flag's rule from an environment object such as `process.env`. */
export function parseFlagRules(env: Record<string, string | undefined>): FlagRules {
  return {
    stats: flagRuleSchema.parse(env[envNames.stats]),
    ai: flagRuleSchema.parse(env[envNames.ai]),
    playlistWrite: flagRuleSchema.parse(env[envNames.playlistWrite]),
  };
}

const allows = (rule: FlagRule, spotifyUserId: string): boolean =>
  match(rule)
    .with({ kind: "all" }, () => true)
    .with({ kind: "none" }, () => false)
    .with({ kind: "users" }, ({ ids }) => ids.includes(spotifyUserId))
    .exhaustive();

/** Flags enabled for a viewer (ADR 0004). Demo mode enables every flag. */
export function enabledFlags(viewer: Viewer, rules: FlagRules): ReadonlySet<FeatureFlag> {
  return match(viewer)
    .with({ mode: "demo" }, () => new Set(allFlags))
    .with(
      { mode: "spotify" },
      ({ spotifyUserId }) => new Set(allFlags.filter((flag) => allows(rules[flag], spotifyUserId))),
    )
    .exhaustive();
}
