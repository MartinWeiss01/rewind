import { describe, expect, it } from "vitest";
import type { Track } from "@/domain/music";
import {
  dedupeCandidates,
  filterSuggestions,
  fold,
  matchCandidate,
  normalizeTitle,
  searchQuery,
  similarity,
  splitArtists,
} from "./matching";
import type { Suggestion } from "./types";

const track = (id: string, name: string, ...artists: string[]): Track => ({
  id,
  name,
  artists: artists.map((artist, i) => ({ id: `${id}-artist-${i}`, name: artist })),
  album: { id: `${id}-album`, name: "Album", cover: { kind: "generated", seed: 1 } },
  durationMs: 200_000,
  isrc: null,
  explicit: false,
  externalUrl: null,
});

const candidate = (title: string, artist: string) => ({ title, artist, reason: "Fits." });

describe("normalization", () => {
  it("folds case, diacritics, punctuation and ampersands", () => {
    expect(fold("Kito & the Tides")).toBe("kito and the tides");
    expect(fold("Žluťoučký  kůň!")).toBe("zlutoucky kun");
  });

  it("drops version notes from titles", () => {
    expect(normalizeTitle("Overcast (Remastered 2011)")).toBe("overcast");
    expect(normalizeTitle("Overcast - Live at the Roundhouse")).toBe("overcast");
    expect(normalizeTitle("Overcast feat. Someone")).toBe("overcast");
    expect(normalizeTitle("(Untitled)")).toBe("untitled");
  });

  it("splits combined artist credits", () => {
    expect(splitArtists("Velvet Static feat. Marlowe June")).toEqual([
      "velvet static feat marlowe june",
      "velvet static",
      "marlowe june",
    ]);
    expect(splitArtists("A, B & C")).toEqual(["a b and c", "a", "b", "c"]);
    expect(splitArtists("Kito & the Tides")).toContain("kito and the tides");
  });

  it("scores similar strings close to 1", () => {
    expect(similarity("overcast", "overcast")).toBe(1);
    expect(similarity("overcast", "overcasts")).toBeGreaterThan(0.8);
    expect(similarity("overcast", "lullaby")).toBeLessThan(0.3);
  });

  it("builds a search query without version notes", () => {
    expect(searchQuery(candidate("Overcast (Live)", "Velvet Static"))).toBe(
      "Overcast Velvet Static",
    );
  });
});

describe("matchCandidate", () => {
  const results = [
    track("t1", "Overcast (Remastered)", "Velvet Static"),
    track("t2", "Overcast", "Someone Else"),
    track("t3", "Lullaby", "Velvet Static"),
  ];

  it("picks the result with the right title and artist", () => {
    const best = matchCandidate(candidate("Overcast", "Velvet Static"), results);
    expect(best?.track.id).toBe("t1");
    expect(best?.exact).toBe(true);
  });

  it("flags a near match as not exact", () => {
    const best = matchCandidate(candidate("Overcasts", "Velvet Statics"), results);
    expect(best?.track.id).toBe("t1");
    expect(best?.exact).toBe(false);
  });

  it("returns null when no result is close enough", () => {
    expect(matchCandidate(candidate("Overcast", "Nobody Known"), results)).toBeNull();
    expect(matchCandidate(candidate("Heatwave", "Velvet Static"), results)).toBeNull();
    expect(matchCandidate(candidate("Overcast", "Velvet Static"), [])).toBeNull();
  });

  it("matches a featured artist credit", () => {
    const best = matchCandidate(candidate("Lullaby", "Marlowe June & Velvet Static"), results);
    expect(best?.track.id).toBe("t3");
  });
});

describe("filterSuggestions", () => {
  const suggestions: Suggestion[] = [
    { track: track("a", "A", "Known"), reason: "", closestMatch: false },
    { track: track("b", "B", "Fresh"), reason: "", closestMatch: false },
    { track: track("a", "A", "Known"), reason: "", closestMatch: false },
    { track: track("c", "C", "Fresh"), reason: "", closestMatch: true },
  ];
  const index = {
    playCounts: new Map([
      ["a", 10],
      ["b", 2],
    ]),
    knownArtistIds: new Set(["a-artist-0", "b-artist-0"]),
  };

  it("keeps everything without filters, minus duplicates", () => {
    const { kept, filteredOut } = filterSuggestions(suggestions, index, {
      count: 10,
      maxPlays: null,
      newArtistsOnly: false,
    });
    expect(kept.map((s) => s.track.id)).toEqual(["a", "b", "c"]);
    expect(filteredOut).toBe(0);
  });

  it("drops tracks played more than the limit", () => {
    const { kept, filteredOut } = filterSuggestions(suggestions, index, {
      count: 10,
      maxPlays: 2,
      newArtistsOnly: false,
    });
    expect(kept.map((s) => s.track.id)).toEqual(["b", "c"]);
    expect(filteredOut).toBe(1);
  });

  it("keeps only unknown artists when asked", () => {
    const { kept } = filterSuggestions(suggestions, index, {
      count: 10,
      maxPlays: null,
      newArtistsOnly: true,
    });
    expect(kept.map((s) => s.track.id)).toEqual(["c"]);
  });

  it("trims to the requested count", () => {
    const { kept } = filterSuggestions(suggestions, index, {
      count: 1,
      maxPlays: null,
      newArtistsOnly: false,
    });
    expect(kept).toHaveLength(1);
  });
});

describe("dedupeCandidates", () => {
  it("removes repeats regardless of case and version notes", () => {
    expect(
      dedupeCandidates([
        candidate("Overcast", "Velvet Static"),
        candidate("overcast (Live)", "VELVET STATIC"),
        candidate("Lullaby", "Velvet Static"),
      ]).map((c) => c.title),
    ).toEqual(["Overcast", "Lullaby"]);
  });
});
