import { describe, expect, it } from "vitest";
import { capabilitiesFor, capabilityEnvSchema } from "./capabilities";

const env = (value?: string) => capabilityEnvSchema.parse({ FEATURE_STATS_USER_IDS: value });

describe("capabilitiesFor", () => {
  it("enables every capability in demo mode", () => {
    expect(capabilitiesFor({ mode: "demo" }, env()).has("stats")).toBe(true);
  });

  it("enables stats only for listed Spotify accounts", () => {
    const allowed = env(" listener-a , listener-b ");
    expect(
      capabilitiesFor({ mode: "spotify", spotifyUserId: "listener-b" }, allowed).has("stats"),
    ).toBe(true);
    expect(
      capabilitiesFor({ mode: "spotify", spotifyUserId: "listener-c" }, allowed).has("stats"),
    ).toBe(false);
  });

  it("disables stats for everyone when the list is empty", () => {
    expect(
      capabilitiesFor({ mode: "spotify", spotifyUserId: "listener-a" }, env("")).has("stats"),
    ).toBe(false);
  });
});
