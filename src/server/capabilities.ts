import { match } from "ts-pattern";
import { z } from "zod";

export const capabilities = ["stats"] as const;
export type Capability = (typeof capabilities)[number];

/** Who is looking at the app, resolved once per request. */
export type Viewer = { mode: "demo" } | { mode: "spotify"; spotifyUserId: string };

const idList = z
  .string()
  .optional()
  .transform((value) =>
    (value ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0),
  );

export const capabilityEnvSchema = z.object({
  FEATURE_STATS_USER_IDS: idList,
});
export type CapabilityEnv = z.infer<typeof capabilityEnvSchema>;

const allowListFor = (capability: Capability, env: CapabilityEnv): readonly string[] =>
  match(capability)
    .with("stats", () => env.FEATURE_STATS_USER_IDS)
    .exhaustive();

/** Capabilities enabled for a viewer (ADR 0004). Demo mode enables everything. */
export function capabilitiesFor(viewer: Viewer, env: CapabilityEnv): ReadonlySet<Capability> {
  return match(viewer)
    .with({ mode: "demo" }, () => new Set(capabilities))
    .with(
      { mode: "spotify" },
      ({ spotifyUserId }) =>
        new Set(capabilities.filter((c) => allowListFor(c, env).includes(spotifyUserId))),
    )
    .exhaustive();
}
