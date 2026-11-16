import { describe, expect, it } from "vitest";
import { findCrossMatches } from "./compare";
import { type MatchableItem, MatchLevel } from "./duplicates";

let counter = 0;
function item(
  name: string,
  artists: string[],
  options: { id?: string; isrc?: string | null } = {},
): MatchableItem {
  counter += 1;
  const id = options.id ?? `track-${counter}`;
  return {
    key: `${id}#${counter}`,
    track: {
      id,
      name,
      isrc: options.isrc ?? null,
      artists: artists.map((a) => ({ id: `artist-${a}`, name: a })),
    },
    addedAt: null,
  };
}

describe("findCrossMatches", () => {
  it("finds tracks the other playlist also has", () => {
    const shared = item("Paper Lanterns", ["Odd Harbor"], { id: "a" });
    const copy = item("Paper Lanterns", ["Odd Harbor"], { id: "a" });
    const result = findCrossMatches([item("Other", ["X"]), shared], [copy], MatchLevel.Exact);
    expect(result).toEqual([{ item: shared, reason: MatchLevel.Exact, matches: [copy] }]);
  });

  it("ignores duplicates within one playlist", () => {
    const first = item("Paper Lanterns", ["Odd Harbor"], { id: "a" });
    const second = item("Paper Lanterns", ["Odd Harbor"], { id: "a" });
    expect(findCrossMatches([first, second], [item("Other", ["X"])], MatchLevel.Title)).toEqual([]);
  });

  it("matches looser levels only when asked", () => {
    const remaster = item("Paper Lanterns - Remastered 2011", ["Odd Harbor"], { id: "a" });
    const original = item("Paper Lanterns", ["Odd Harbor"], { id: "b" });
    expect(findCrossMatches([remaster], [original], MatchLevel.Recording)).toEqual([]);
    expect(findCrossMatches([remaster], [original], MatchLevel.TitleAllArtists)).toEqual([
      { item: remaster, reason: MatchLevel.TitleAllArtists, matches: [original] },
    ]);
  });

  it("matches the same recording by ISRC", () => {
    const single = item("Glasshouse", ["Mira K."], { id: "a", isrc: "XX0000000001" });
    const album = item("Glasshouse", ["Mira K."], { id: "b", isrc: "xx0000000001" });
    expect(findCrossMatches([single], [album], MatchLevel.Recording)[0]?.reason).toBe(
      MatchLevel.Recording,
    );
  });

  it("reports the strictest match and only the tracks matched by it", () => {
    const mine = item("Coastline", ["Low Orbit Club"], { id: "a" });
    const same = item("Coastline", ["Low Orbit Club"], { id: "a" });
    const namesake = item("Coastline", ["Solar Parade"], { id: "b" });
    expect(findCrossMatches([mine], [namesake, same], MatchLevel.Title)).toEqual([
      { item: mine, reason: MatchLevel.Exact, matches: [same] },
    ]);
  });

  it("judges each track by its own matches, not by chains", () => {
    const original = item("Coastline", ["Low Orbit Club"], { id: "a" });
    const unrelated = item("Coastline", ["Marlowe June"], { id: "c" });
    const copy = item("Coastline", ["Low Orbit Club"], { id: "a" });
    const result = findCrossMatches([original, unrelated], [copy], MatchLevel.TitleSharedArtist);
    expect(result.map((m) => m.item)).toEqual([original]);
    expect(findCrossMatches([original, unrelated], [copy], MatchLevel.Title)[1]?.reason).toBe(
      MatchLevel.Title,
    );
  });
});
