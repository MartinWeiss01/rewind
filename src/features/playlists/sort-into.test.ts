import { describe, expect, it } from "vitest";
import type { Track } from "@/domain/music";
import {
  buildSortQuestions,
  demoSortSuggestions,
  keepOption,
  planSortInto,
  type SortTarget,
  spread,
  suggestionsFromAnswers,
} from "./sort-into";

const track = (id: string, name: string, artist: string): Track => ({
  id,
  name,
  artists: [{ id: `a-${artist}`, name: artist }],
  album: {
    id: `al-${id}`,
    name: "Tape",
    cover: { kind: "generated", seed: 1 },
    releaseDate: "2024-05-01",
  },
  durationMs: 200_000,
  isrc: null,
  explicit: false,
  externalUrl: null,
});

const tracks = [track("t1", "Midnight Engine", "Neon Harbor"), track("t2", "Blue Hour", "Marlowe")];
const targets: SortTarget[] = [
  { id: "drive", name: "Late night drives", description: "Synths", trackIds: ["x1"] },
  { id: "jazz", name: "Focus jazz", description: "", trackIds: [] },
];
const byId = new Map([["x1", track("x1", "Neon Rain", "Velvet Static")]]);

describe("buildSortQuestions", () => {
  it("asks one question per track with every playlist and keep as options", () => {
    const { state, questions, targetOf } = buildSortQuestions(tracks, targets, byId);
    expect(questions.map((q) => q.id)).toEqual(["t0", "t1"]);
    expect(Object.keys(questions[0]?.options ?? {})).toEqual(["p01", "p02", keepOption]);
    expect(questions[0]?.instructions).toContain("Midnight Engine");
    expect(questions[0]?.instructions).toContain("2024");
    expect(targetOf.get("p02")).toBe("jazz");
    expect(targetOf.get(keepOption)).toBeNull();
    const parsed = JSON.parse(state);
    expect(parsed.playlists[0].exampleTracks).toEqual(["Neon Rain — Velvet Static"]);
  });
});

describe("suggestionsFromAnswers", () => {
  it("maps choices back to playlists with the chosen option's probability", () => {
    const { targetOf } = buildSortQuestions(tracks, targets, byId);
    const answers = new Map([
      ["t0", { choice: "p01", probabilities: { p01: 0.87, p02: 0.05, keep: 0.08 } }],
      ["t1", { choice: keepOption, probabilities: { p01: 0.2, p02: 0.3, keep: 0.5 } }],
    ]);
    expect(suggestionsFromAnswers(tracks, answers, targetOf)).toEqual([
      { trackId: "t1", targetId: "drive", confidence: 0.87 },
      { trackId: "t2", targetId: null, confidence: 0.5 },
    ]);
  });
});

describe("demoSortSuggestions", () => {
  const genres: Record<string, string> = {
    a: "jazz",
    b: "synth",
    j1: "jazz",
    j2: "jazz",
    s1: "synth",
  };
  const demoTargets: SortTarget[] = [
    { id: "jazz", name: "Jazz", description: "", trackIds: ["j1", "j2"] },
    { id: "synth", name: "Synth", description: "", trackIds: ["s1"] },
  ];
  const run = () => demoSortSuggestions(["a", "b", "z"], demoTargets, (id) => genres[id] ?? null);

  it("leans towards the playlist with the track's genre and is deterministic", () => {
    const result = run();
    expect(result[0]?.targetId).toBe("jazz");
    expect(result[1]?.targetId).toBe("synth");
    expect(result).toEqual(run());
    for (const s of result) {
      expect(s.confidence).toBeGreaterThan(0);
      expect(s.confidence).toBeLessThanOrEqual(1);
    }
  });
});

describe("planSortInto", () => {
  it("adds each moved track once, skips existing ones and takes all copies out of the source", () => {
    const plan = planSortInto({
      sourceIds: ["a", "b", "a", "c", "d"],
      targetIds: new Map([
        ["x", ["b"]],
        ["y", []],
      ]),
      moves: [
        { trackId: "a", targetId: "y" },
        { trackId: "b", targetId: "x" },
        { trackId: "c", targetId: "y" },
        { trackId: "d", targetId: "unknown" },
      ],
      skipExisting: true,
    });
    expect(plan.adds.get("y")).toEqual(["a", "c"]);
    expect(plan.adds.has("x")).toBe(false);
    expect(plan.remaining).toEqual(["d"]);
    expect(plan.moved).toBe(3);
  });

  it("keeps duplicates in the target when not skipping", () => {
    const plan = planSortInto({
      sourceIds: ["b"],
      targetIds: new Map([["x", ["b"]]]),
      moves: [{ trackId: "b", targetId: "x" }],
      skipExisting: false,
    });
    expect(plan.adds.get("x")).toEqual(["b"]);
  });
});

describe("spread", () => {
  it("samples evenly", () => {
    expect(spread([1, 2, 3, 4, 5, 6], 3)).toEqual([1, 3, 5]);
    expect(spread([1, 2], 5)).toEqual([1, 2]);
  });
});
