import { describe, expect, it } from "vitest";
import { syncedPlayStart } from "./sync";

describe("syncedPlayStart", () => {
  it("subtracts the track length from Spotify's end time", () => {
    expect(syncedPlayStart("2024-03-01T12:04:00.000Z", 240_000)).toBe("2024-03-01T12:00:00.000Z");
  });

  it("truncates to the second like imported plays", () => {
    expect(syncedPlayStart("2024-03-01T12:04:00.950Z", 200)).toBe("2024-03-01T12:04:00.000Z");
  });
});
