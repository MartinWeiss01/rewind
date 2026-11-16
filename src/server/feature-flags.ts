import { match } from "ts-pattern";
import { z } from "zod";

/** Every feature flag the app knows. Add a flag here and in the admin copy. */
export const FeatureFlag = {
  Stats: "stats",
  Ai: "ai",
  PlaylistWrite: "playlistWrite",
} as const;
export type FeatureFlag = (typeof FeatureFlag)[keyof typeof FeatureFlag];

export const featureFlags: readonly FeatureFlag[] = Object.values(FeatureFlag);
export const featureFlagSchema = z.enum(FeatureFlag);

/** Who is looking at the app, resolved once per request. */
export type Viewer = { mode: "demo" } | { mode: "spotify"; spotifyUserId: string };

/** Spotify user IDs from `ADMIN_SPOTIFY_IDS`, a comma-separated list. */
export function parseAdminIds(env: Record<string, string | undefined>): ReadonlySet<string> {
  return new Set(
    (env.ADMIN_SPOTIFY_IDS ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0),
  );
}

/** Keeps the known flags from a stored list, dropping names the app no longer has. */
export function knownFlags(stored: readonly string[]): FeatureFlag[] {
  return featureFlags.filter((flag) => stored.includes(flag));
}

/**
 * Flags enabled for a viewer (ADR 0004). Demo mode and admins get every flag; other
 * Spotify users get the flags granted to them.
 */
export function enabledFlags(
  viewer: Viewer,
  access: { admin: boolean; granted: readonly FeatureFlag[] },
): ReadonlySet<FeatureFlag> {
  return match(viewer)
    .with({ mode: "demo" }, () => new Set(featureFlags))
    .with({ mode: "spotify" }, () =>
      access.admin ? new Set(featureFlags) : new Set(access.granted),
    )
    .exhaustive();
}
