import { describe, expect, it } from "vitest";
import { createDemoDataSource } from "@/data/demo/demo-data-source";
import { buildCatalog } from "@/demo/catalog";
import { generateHistory } from "@/demo/history";
import { persona } from "@/demo/persona";
import { generatePlaylists } from "@/demo/playlists";
import { emptyDemoSessionState } from "@/demo/session-state";
import { defaultListeningRules } from "@/domain/listening";
import { demoCandidates, genreHint } from "./demo-suggestions";
import { matchCandidate, searchQuery } from "./matching";
import {
  buildListeningIndex,
  buildPlaylistSeed,
  buildTasteProfile,
  profileLimits,
  seedSummary,
} from "./profile";
import { buildPrompt } from "./prompt";
import { candidatesNeeded, DiscoverMode, type DiscoverRequest } from "./types";

const now = new Date("2026-11-15T12:00:00Z");
const catalog = buildCatalog(persona);
const all = { plays: generateHistory(persona, catalog, now), tracks: catalog.trackById };
const rules = { ...defaultListeningRules, timeZone: persona.timeZone };

const vibe = (prompt: string): DiscoverRequest => ({
  seed: { mode: DiscoverMode.Vibe, prompt },
  count: 20,
  maxPlays: 3,
  newArtistsOnly: false,
});

describe("taste profile", () => {
  const profile = buildTasteProfile(all, rules, now);

  it("stays compact", () => {
    expect(profile.plays).toBeGreaterThan(0);
    expect(profile.topArtists.length).toBeLessThanOrEqual(profileLimits.topArtists);
    expect(profile.topTracks.length).toBeLessThanOrEqual(profileLimits.topTracks);
    expect(profile.recentDiscoveries.length).toBeLessThanOrEqual(profileLimits.discoveries);
    expect(profile.skipHeavy.length).toBeLessThanOrEqual(profileLimits.skipHeavy);
  });

  it("ranks the persona's favourite artist first", () => {
    expect(profile.topArtists[0]?.name).toBe("Velvet Static");
  });

  it("indexes play counts and known artists over the whole history", () => {
    const index = buildListeningIndex(all, rules);
    expect(index.knownArtistIds.has("demo-artist-001")).toBe(true);
    expect([...index.playCounts.values()].every((n) => n > 0)).toBe(true);
  });
});

describe("prompt", () => {
  const profile = buildTasteProfile(all, rules, now);

  it("contains the request, the profile and the number of candidates", () => {
    const { system, prompt } = buildPrompt({
      request: { ...vibe("Rainy <b>evening</b>"), newArtistsOnly: true },
      profile,
      playlist: null,
      candidates: candidatesNeeded(20),
      locale: "cs",
    });
    expect(system).toContain("Czech");
    expect(prompt).toContain("‹b>evening‹/b>");
    expect(prompt).toContain("Velvet Static");
    expect(prompt).toContain("Suggest exactly 26 tracks.");
    expect(prompt).toContain("do not appear anywhere in this profile");
  });

  it("stays small", () => {
    const { system, prompt } = buildPrompt({
      request: vibe("Sunday morning coffee"),
      profile,
      playlist: null,
      candidates: 39,
      locale: "en",
    });
    expect(system.length + prompt.length).toBeLessThan(3000);
  });

  it("describes the playlist in playlist mode", () => {
    const playlist = generatePlaylists(persona, catalog, now).find((p) => p.items?.length);
    if (!playlist) throw new Error("demo has no playlist with items");
    const seed = buildPlaylistSeed(playlist);
    const { prompt } = buildPrompt({
      request: {
        ...vibe("unused"),
        seed: { mode: DiscoverMode.Playlist, playlistId: playlist.id },
      },
      profile,
      playlist: seed,
      candidates: 26,
      locale: "en",
    });
    expect(prompt).toContain(`"${playlist.name}"`);
    const summary = seedSummary(seed);
    expect(summary.artists.length).toBeLessThanOrEqual(4);
    expect(summary.more).toBe(Math.max(0, seed.artists.length - 4));
  });
});

describe("demo suggestions", () => {
  const profile = buildTasteProfile(all, rules, now);
  const index = buildListeningIndex(all, rules);
  const input = {
    catalog,
    seedArtistIds: profile.topArtists.map((a) => a.id),
    playCounts: index.playCounts,
    genre: null,
    candidates: 26,
    maxPlays: null,
    salt: "rainy evening",
    formatReason: (reason: string, values: { artist: string }) => `${reason}:${values.artist}`,
  };

  it("finds every pre-generated candidate through the demo search", async () => {
    const source = createDemoDataSource({
      state: emptyDemoSessionState(persona.timeZone),
      commit: async () => {},
      now,
    });
    for (const candidate of demoCandidates(input)) {
      const results = await source.searchTracks(searchQuery(candidate));
      expect(matchCandidate(candidate, results.slice(0, 10))?.exact).toBe(true);
    }
  });

  it("is deterministic and returns the requested number of catalog tracks", () => {
    const first = demoCandidates(input);
    expect(first).toHaveLength(26);
    expect(demoCandidates(input)).toEqual(first);
    for (const candidate of first) {
      const results = catalog.tracks.filter((t) => t.name === candidate.title);
      expect(matchCandidate(candidate, results)?.exact).toBe(true);
    }
  });

  it("prefers least-played tracks and spreads across artists", () => {
    const picks = demoCandidates(input);
    const artists = new Set(picks.map((c) => c.artist));
    expect(artists.size).toBeGreaterThan(5);
    const firstRound = picks.slice(0, artists.size);
    for (const pick of firstRound) {
      const track = catalog.tracks.find(
        (t) => t.name === pick.title && t.artists[0]?.name === pick.artist,
      );
      const own = catalog.tracks.filter(
        (t) => t.artists[0]?.name === pick.artist && !t.id.endsWith("-remaster"),
      );
      const min = Math.min(...own.map((t) => index.playCounts.get(t.id) ?? 0));
      expect(index.playCounts.get(track?.id ?? "") ?? 0).toBe(min);
    }
  });

  it("leaves out tracks played more than the limit", () => {
    const picks = demoCandidates({ ...input, maxPlays: 3 });
    expect(picks.length).toBeGreaterThan(0);
    for (const pick of picks) {
      const track = catalog.tracks.find(
        (t) => t.name === pick.title && t.artists[0]?.name === pick.artist,
      );
      expect(index.playCounts.get(track?.id ?? "") ?? 0).toBeLessThanOrEqual(3);
    }
  });

  it("leans towards a genre named in the request", () => {
    expect(genreHint("Late night jazz, nothing loud")).toBe("jazz");
    expect(genreHint("Akustická kytara u ohně")).toBe("folk");
    expect(genreHint("Sunday morning coffee")).toBeNull();
    const picks = demoCandidates({ ...input, genre: "jazz" });
    const jazzArtists = new Set(
      catalog.artists.filter((a) => a.genre === "jazz").map((a) => a.name),
    );
    expect(jazzArtists.has(picks[0]?.artist ?? "")).toBe(true);
  });
});
