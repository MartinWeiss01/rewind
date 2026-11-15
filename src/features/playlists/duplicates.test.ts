import { describe, expect, it } from "vitest";
import {
  duplicateCount,
  findDuplicateGroups,
  keysToRemove,
  type MatchableItem,
  MatchLevel,
  matchLevels,
  normalizeArtist,
  normalizeTitle,
} from "./duplicates";

let counter = 0;
function item(
  name: string,
  artists: string[],
  options: { id?: string; isrc?: string | null; addedAt?: string | null } = {},
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
    addedAt: options.addedAt === null ? null : new Date(options.addedAt ?? "2026-01-01T00:00:00Z"),
  };
}

describe("normalizeTitle", () => {
  it.each([
    ["Glasshouse", "glasshouse"],
    ["GLASSHOUSE!", "glasshouse"],
    ["Café del Mar", "cafe del mar"],
    ["Příliš žluťoučký kůň", "prilis zlutoucky kun"],
    ["Don't Stop", "don t stop"],
    ["Glasshouse - Remastered 2011", "glasshouse"],
    ["Glasshouse – 2011 Remaster", "glasshouse"],
    ["Glasshouse (Remastered)", "glasshouse"],
    ["Glasshouse [Remastered 2009]", "glasshouse"],
    ["Glasshouse (Live)", "glasshouse"],
    ["Glasshouse - Live at the Roundhouse", "glasshouse"],
    ["Glasshouse - Radio Edit", "glasshouse"],
    ["Glasshouse (feat. Mira K.)", "glasshouse"],
    ["Glasshouse (ft. Mira K.)", "glasshouse"],
    ["Glasshouse (with Mira K.)", "glasshouse"],
    ["Glasshouse feat. Mira K.", "glasshouse"],
    ["Glasshouse (feat. Mira K.) - Remastered", "glasshouse"],
    ["Glasshouse - Single Version", "glasshouse"],
    ["Glasshouse (Mono)", "glasshouse"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeTitle(input)).toBe(expected);
  });

  it("keeps notes that make a different recording", () => {
    expect(normalizeTitle("Glasshouse (Night Drive Remix)")).toBe("glasshouse night drive remix");
    expect(normalizeTitle("Glasshouse - Acoustic")).toBe("glasshouse acoustic");
    expect(normalizeTitle("Part 2 (Reprise)")).toBe("part 2 reprise");
  });

  it("keeps dashes that are part of the title", () => {
    expect(normalizeTitle("Left - Right - Left")).toBe("left right left");
  });
});

describe("normalizeArtist", () => {
  it("ignores case, accents and punctuation", () => {
    expect(normalizeArtist("Kito & the Tides")).toBe(normalizeArtist("KITO & THE TIDES"));
    expect(normalizeArtist("Beyoncé")).toBe("beyonce");
  });
});

describe("findDuplicateGroups", () => {
  const exactA = item("Northbound", ["Low Orbit Club"], { id: "north", addedAt: "2026-07-08" });
  const exactB = item("Northbound", ["Low Orbit Club"], { id: "north", addedAt: "2026-10-02" });
  const isrcA = item("Low Tide", ["Neon Harbor"], { isrc: "XX0000001", addedAt: "2025-12-02" });
  const isrcB = item("Low Tide", ["Neon Harbor"], { isrc: "xx0000001", addedAt: "2026-03-22" });
  const remasterA = item("Glasshouse", ["Velvet Static", "Ojo Blue"], { isrc: "XX1" });
  const remasterB = item("Glasshouse - Remastered", ["Ojo Blue", "Velvet Static"], {
    isrc: "XX2",
  });
  const sharedA = item("Afterimage", ["Dusk Arcade"], { isrc: "XX3" });
  const sharedB = item("Afterimage (feat. Marlowe June)", ["Dusk Arcade", "Marlowe June"], {
    isrc: "XX4",
  });
  const titleA = item("Home", ["Static Bloom"], { isrc: "XX5" });
  const titleB = item("Home", ["The Late Signals"], { isrc: "XX6" });
  const unique = item("Marigold", ["The Late Signals"], { isrc: "XX7" });
  const all = [
    exactA,
    isrcA,
    remasterA,
    sharedA,
    titleA,
    unique,
    exactB,
    isrcB,
    remasterB,
    sharedB,
    titleB,
  ];

  const reasons = (level: MatchLevel) =>
    findDuplicateGroups(all, level).map((g) => [g.items.map((i) => i.key), g.reason]);

  it("matches only the same track at the exact level", () => {
    expect(reasons(MatchLevel.Exact)).toEqual([[[exactA.key, exactB.key], MatchLevel.Exact]]);
  });

  it("adds ISRC matches at the recording level", () => {
    expect(reasons(MatchLevel.Recording)).toEqual([
      [[exactA.key, exactB.key], MatchLevel.Exact],
      [[isrcA.key, isrcB.key], MatchLevel.Recording],
    ]);
  });

  it("adds same title and the same artists, in any order", () => {
    expect(reasons(MatchLevel.TitleAllArtists)).toContainEqual([
      [remasterA.key, remasterB.key],
      MatchLevel.TitleAllArtists,
    ]);
    expect(findDuplicateGroups(all, MatchLevel.TitleAllArtists)).toHaveLength(3);
  });

  it("adds same title with one shared artist", () => {
    expect(reasons(MatchLevel.TitleSharedArtist)).toContainEqual([
      [sharedA.key, sharedB.key],
      MatchLevel.TitleSharedArtist,
    ]);
    expect(findDuplicateGroups(all, MatchLevel.TitleSharedArtist)).toHaveLength(4);
  });

  it("adds same title only at the loosest level", () => {
    expect(reasons(MatchLevel.Title)).toContainEqual([[titleA.key, titleB.key], MatchLevel.Title]);
    expect(findDuplicateGroups(all, MatchLevel.Title)).toHaveLength(5);
  });

  it("never groups a unique track", () => {
    for (const level of matchLevels) {
      const keys = findDuplicateGroups(all, level).flatMap((g) => g.items.map((i) => i.key));
      expect(keys).not.toContain(unique.key);
    }
  });

  it("each looser level finds at least what the stricter one found", () => {
    let previous = 0;
    for (const level of matchLevels) {
      const count = keysToRemove(findDuplicateGroups(all, level)).size;
      expect(count).toBeGreaterThanOrEqual(previous);
      previous = count;
    }
  });

  it("joins chains into one group and reports the loosest link", () => {
    const a = item("Echo", ["Ojo Blue"], { id: "echo", isrc: "XXA" });
    const b = item("Echo", ["Ojo Blue"], { id: "echo", isrc: "XXA" });
    const c = item("Echo (Live)", ["Ojo Blue"], { isrc: "XXB" });
    const groups = findDuplicateGroups([a, b, c], MatchLevel.TitleAllArtists);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.items.map((i) => i.key)).toEqual([a.key, b.key, c.key]);
    expect(groups[0]?.reason).toBe(MatchLevel.TitleAllArtists);
  });

  it("keeps the oldest added item, then the first one", () => {
    const newer = item("Song", ["A"], { id: "s", addedAt: "2026-05-01" });
    const older = item("Song", ["A"], { id: "s", addedAt: "2026-01-01" });
    const unknown = item("Song", ["A"], { id: "s", addedAt: null });
    const [group] = findDuplicateGroups([newer, unknown, older], MatchLevel.Exact);
    expect(group?.keepKey).toBe(older.key);

    const sameA = item("Same", ["A"], { id: "same", addedAt: "2026-01-01" });
    const sameB = item("Same", ["A"], { id: "same", addedAt: "2026-01-01" });
    expect(findDuplicateGroups([sameA, sameB], MatchLevel.Exact)[0]?.keepKey).toBe(sameA.key);
  });

  it("does not match tracks whose titles normalize to nothing", () => {
    const a = item("!!!", ["A"], { isrc: "Y1" });
    const b = item("???", ["B"], { isrc: "Y2" });
    expect(findDuplicateGroups([a, b], MatchLevel.Title)).toEqual([]);
  });

  it("returns groups in playlist order", () => {
    const groups = findDuplicateGroups(all, MatchLevel.Title);
    expect(groups.map((g) => g.id)).toEqual([
      exactA.key,
      isrcA.key,
      remasterA.key,
      sharedA.key,
      titleA.key,
    ]);
  });
});

describe("keysToRemove", () => {
  const a = item("Song", ["A"], { id: "s", addedAt: "2026-01-01" });
  const b = item("Song", ["A"], { id: "s", addedAt: "2026-02-01" });
  const c = item("Song", ["A"], { id: "s", addedAt: "2026-03-01" });
  const groups = findDuplicateGroups([a, b, c], MatchLevel.Exact);

  it("removes everything but the default kept item", () => {
    expect([...keysToRemove(groups)]).toEqual([b.key, c.key]);
  });

  it("honours a chosen item to keep", () => {
    const group = groups[0];
    if (!group) throw new Error("missing group");
    expect([...keysToRemove(groups, { [group.id]: c.key })]).toEqual([a.key, b.key]);
  });

  it("ignores a choice that is not in the group", () => {
    const group = groups[0];
    if (!group) throw new Error("missing group");
    expect(keysToRemove(groups, { [group.id]: "elsewhere" }).size).toBe(2);
  });
});

describe("duplicateCount", () => {
  it("counts removable items at the badge level", () => {
    const a = item("Low Tide", ["Neon Harbor"], { isrc: "Z1" });
    const b = item("Low Tide (Deluxe)", ["Neon Harbor"], { isrc: "Z1" });
    const c = item("Other", ["Neon Harbor"], { isrc: "Z2" });
    expect(duplicateCount([a, b, c])).toBe(1);
    expect(duplicateCount([a, b, c], MatchLevel.Exact)).toBe(0);
  });
});
