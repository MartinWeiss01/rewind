import { describe, expect, it } from "vitest";
import { NotAStreamingHistoryError, parseStreamingHistory, playKey } from "./streaming-history";

const entry = (overrides: Record<string, unknown> = {}) => ({
  ts: "2026-03-01T20:04:00Z",
  ms_played: 240_000,
  spotify_track_uri: "spotify:track:abc123",
  master_metadata_track_name: "Invented Song",
  ...overrides,
});

describe("parseStreamingHistory", () => {
  it("reads tracks and derives the start time", () => {
    const { entries, skipped } = parseStreamingHistory([entry()]);
    expect(skipped).toBe(0);
    expect(entries).toEqual([
      {
        trackId: "abc123",
        playedAt: new Date("2026-03-01T20:00:00Z"),
        msPlayed: 240_000,
        trackName: "Invented Song",
        artistName: null,
        albumName: null,
      },
    ]);
  });

  it("skips episodes and local files", () => {
    const { entries, skipped } = parseStreamingHistory([
      entry({ spotify_track_uri: null, episode_name: "Invented Podcast" }),
      entry({ spotify_track_uri: "spotify:local:x:y:z:1" }),
      entry(),
    ]);
    expect(entries).toHaveLength(1);
    expect(skipped).toBe(2);
  });

  it("rejects files that are not an export", () => {
    expect(() => parseStreamingHistory({ hello: "world" })).toThrow(NotAStreamingHistoryError);
    expect(() => parseStreamingHistory([{ endTime: "2026-01-01 10:00", msPlayed: 1 }])).toThrow(
      NotAStreamingHistoryError,
    );
  });

  it("keys plays by track and second", () => {
    expect(playKey({ trackId: "abc", playedAt: new Date("2026-03-01T20:00:00.900Z") })).toBe(
      "abc@1772395200",
    );
  });
});
