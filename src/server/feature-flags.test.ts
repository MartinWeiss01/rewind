import { describe, expect, it } from "vitest";
import { enabledFlags, FeatureFlag, flagRuleSchema, parseFlagRules } from "./feature-flags";

const spotify = (spotifyUserId: string) => ({ mode: "spotify", spotifyUserId }) as const;

describe("flagRuleSchema", () => {
  it("treats a missing or empty value as none", () => {
    expect(flagRuleSchema.parse(undefined)).toEqual({ kind: "none" });
    expect(flagRuleSchema.parse("  ")).toEqual({ kind: "none" });
  });

  it("reads all and none case-insensitively", () => {
    expect(flagRuleSchema.parse("ALL")).toEqual({ kind: "all" });
    expect(flagRuleSchema.parse("None")).toEqual({ kind: "none" });
  });

  it("reads a trimmed list of user IDs", () => {
    expect(flagRuleSchema.parse(" listener-a , ,listener-b")).toEqual({
      kind: "users",
      ids: ["listener-a", "listener-b"],
    });
  });
});

describe("enabledFlags", () => {
  const rules = parseFlagRules({ FEATURE_STATS: "listener-a", FEATURE_AI: "all" });

  it("enables every flag in demo mode", () => {
    expect([...enabledFlags({ mode: "demo" }, rules)]).toEqual(Object.values(FeatureFlag));
  });

  it("applies each flag's rule in Spotify mode", () => {
    const forA = enabledFlags(spotify("listener-a"), rules);
    expect(forA.has(FeatureFlag.Stats)).toBe(true);
    expect(forA.has(FeatureFlag.Ai)).toBe(true);
    expect(forA.has(FeatureFlag.PlaylistWrite)).toBe(false);

    const forB = enabledFlags(spotify("listener-b"), rules);
    expect(forB.has(FeatureFlag.Stats)).toBe(false);
    expect(forB.has(FeatureFlag.Ai)).toBe(true);
  });
});
