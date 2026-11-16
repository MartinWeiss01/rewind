import { describe, expect, it } from "vitest";
import { enabledFlags, FeatureFlag, knownFlags, parseAdminIds } from "./feature-flags";

const spotify = { mode: "spotify", spotifyUserId: "listener-a" } as const;

describe("parseAdminIds", () => {
  it("reads a trimmed list and ignores empty entries", () => {
    expect([...parseAdminIds({ ADMIN_SPOTIFY_IDS: " listener-a , ,listener-b" })]).toEqual([
      "listener-a",
      "listener-b",
    ]);
    expect(parseAdminIds({}).size).toBe(0);
  });
});

describe("knownFlags", () => {
  it("keeps known flags in their declared order", () => {
    expect(knownFlags(["playlistWrite", "retired", "stats"])).toEqual([
      FeatureFlag.Stats,
      FeatureFlag.PlaylistWrite,
    ]);
  });
});

describe("enabledFlags", () => {
  it("enables every flag in demo mode", () => {
    expect([...enabledFlags({ mode: "demo" }, { admin: false, granted: [] })]).toEqual(
      Object.values(FeatureFlag),
    );
  });

  it("enables every flag for admins", () => {
    expect(enabledFlags(spotify, { admin: true, granted: [] }).size).toBe(3);
  });

  it("enables only granted flags for everyone else", () => {
    const flags = enabledFlags(spotify, { admin: false, granted: [FeatureFlag.Ai] });
    expect([...flags]).toEqual([FeatureFlag.Ai]);
  });
});
