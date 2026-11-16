"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { getLocale, getTranslations } from "next-intl/server";
import { match } from "ts-pattern";
import { z } from "zod";
import { DataMode } from "@/data/music-data-source";
import { buildCatalog, type Catalog } from "@/demo/catalog";
import { persona } from "@/demo/persona";
import { intervalFor, TimeRange } from "@/domain/time-range";
import { planMerge } from "@/features/playlists/tools";
import { readAiConfig } from "@/server/ai";
import { sha256 } from "@/server/crypto";
import { FeatureFlag } from "@/server/feature-flags";
import { takeRateLimit } from "@/server/rate-limit";
import { getRequestContext, type RequestContext } from "@/server/request-context";
import { demoCandidates, genreHint } from "./demo-suggestions";
import { filterSuggestions, matchCandidate, searchQuery } from "./matching";
import { askModel, classifyAiError } from "./model";
import {
  buildListeningIndex,
  buildPlaylistSeed,
  buildTasteProfile,
  type PlaylistSeed,
  seedSummary,
} from "./profile";
import { buildPrompt } from "./prompt";
import {
  type ActionResult,
  type Candidate,
  candidateSchema,
  candidatesNeeded,
  countBounds,
  DiscoverError,
  DiscoverMode,
  type DiscoverRequest,
  discoverRequestSchema,
  matchBatchSize,
  type Suggestion,
} from "./types";

/**
 * Server actions behind /app/discover. A run is three steps so the client can show
 * real progress: ask for candidates, match them in batches, then filter and save.
 */

const fail = (error: DiscoverError) => ({ ok: false, error }) as const;
const ok = <T>(data: T) => ({ ok: true, data }) as const;

async function contextWith(
  ...flags: FeatureFlag[]
): Promise<{ ok: true; context: RequestContext } | { ok: false }> {
  const context = await getRequestContext();
  return flags.every((flag) => context.flags.has(flag)) ? { ok: true, context } : { ok: false };
}

let demoCatalog: Catalog | null = null;
const catalogForDemo = () => {
  demoCatalog ??= buildCatalog(persona);
  return demoCatalog;
};

async function allListening(context: RequestContext) {
  const [rules, all] = await Promise.all([
    context.source.getListeningRules(),
    context.source.getListening(intervalFor(TimeRange.AllTime, context.now)),
  ]);
  return { rules, all };
}

async function loadSeed(context: RequestContext, request: DiscoverRequest) {
  return match(request.seed)
    .with({ mode: DiscoverMode.Vibe }, async () => ({ found: true, seed: null }) as const)
    .with({ mode: DiscoverMode.Playlist }, async ({ playlistId }) => {
      const playlist = await context.source.getPlaylist(playlistId);
      if (!playlist?.items?.length) return { found: false } as const;
      return { found: true, seed: buildPlaylistSeed(playlist) } as const;
    })
    .exhaustive();
}

export type CandidatesResult = {
  /** Counted plays the taste profile was built from. */
  profilePlays: number;
  candidates: Candidate[];
  /** False when the answer was pre-generated (demo without live AI). */
  live: boolean;
};

export async function requestCandidates(input: unknown): Promise<ActionResult<CandidatesResult>> {
  const parsed = discoverRequestSchema.safeParse(input);
  if (!parsed.success) return fail(DiscoverError.Invalid);
  const request = parsed.data;
  const access = await contextWith(FeatureFlag.Ai);
  if (!access.ok) return fail(DiscoverError.Forbidden);
  const { context } = access;

  const [{ rules, all }, seedResult, locale] = await Promise.all([
    allListening(context),
    loadSeed(context, request),
    getLocale(),
  ]);
  if (!seedResult.found) return fail(DiscoverError.PlaylistMissing);
  const seed: PlaylistSeed | null = seedResult.seed;
  const profile = buildTasteProfile(all, rules, context.now);
  const needed = candidatesNeeded(request.count);
  const ai = readAiConfig(process.env);
  const live = context.source.mode === DataMode.Spotify || ai.demoLiveAi;

  if (!live) {
    // Demo without live AI: nothing the visitor typed leaves the server.
    const t = await getTranslations("discover.demoReasons");
    const index = buildListeningIndex(all, rules);
    const seedArtists = seed
      ? seed.artists
      : [...profile.topArtists, ...profile.recentDiscoveries.slice(0, 2)];
    const candidates = demoCandidates({
      catalog: catalogForDemo(),
      seedArtistIds: seedArtists.map((a) => a.id),
      playCounts: index.playCounts,
      genre: request.seed.mode === DiscoverMode.Vibe ? genreHint(request.seed.prompt) : null,
      candidates: needed,
      maxPlays: request.maxPlays,
      salt: JSON.stringify(request.seed),
      formatReason: (reason, values) =>
        t(reason, { ...values, genre: t(`genres.${values.genre}`) }),
    });
    if (candidates.length === 0) return fail(DiscoverError.EmptyAnswer);
    return ok({ profilePlays: profile.plays, candidates, live });
  }

  // Model calls cost money: 20 per Spotify user and 3 per demo visitor per day.
  const day = 24 * 60 * 60 * 1000;
  const allowed =
    context.viewer.mode === "spotify"
      ? await takeRateLimit(`ai:user:${context.viewer.spotifyUserId}`, 20, day)
      : await takeRateLimit(
          `ai:demo:${sha256((await headers()).get("x-forwarded-for") ?? "local")}`,
          3,
          day,
        );
  if (!allowed) return fail(DiscoverError.RateLimited);

  try {
    const { system, prompt } = buildPrompt({
      request,
      profile,
      playlist: seed,
      candidates: needed,
      locale,
    });
    const candidates = await askModel(ai, { system, prompt, candidates: needed });
    if (candidates.length === 0) return fail(DiscoverError.EmptyAnswer);
    return ok({ profilePlays: profile.plays, candidates, live });
  } catch (error) {
    const code = classifyAiError(error);
    console.error(`Discover: model call failed (${code})`, error);
    return fail(code);
  }
}

const matchInputSchema = z.object({
  candidates: z.array(candidateSchema).min(1).max(matchBatchSize),
});

/** Searches each candidate (≤10 results) and keeps the best title and artist match, or null. */
export async function matchCandidates(
  input: unknown,
): Promise<ActionResult<(Suggestion | null)[]>> {
  const parsed = matchInputSchema.safeParse(input);
  if (!parsed.success) return fail(DiscoverError.Invalid);
  const access = await contextWith(FeatureFlag.Ai);
  if (!access.ok) return fail(DiscoverError.Forbidden);
  const { source } = access.context;
  try {
    const matches = await Promise.all(
      parsed.data.candidates.map(async (candidate) => {
        const results = (await source.searchTracks(searchQuery(candidate))).slice(0, 10);
        const best = matchCandidate(candidate, results);
        return best
          ? { track: best.track, reason: candidate.reason, closestMatch: !best.exact }
          : null;
      }),
    );
    return ok(matches);
  } catch (error) {
    console.error("Discover: track search failed", error);
    return fail(DiscoverError.Provider);
  }
}

const maxCandidates = candidatesNeeded(countBounds.max);

const finishInputSchema = z.object({
  request: discoverRequestSchema,
  matched: z
    .array(
      z.object({
        trackId: z.string().min(1).max(200),
        reason: z.string().max(400),
        closestMatch: z.boolean(),
      }),
    )
    .max(maxCandidates),
  unmatched: z.array(z.string().max(420)).max(maxCandidates),
});

export type RunResult = {
  generationId: string;
  title: string;
  suggestions: Suggestion[];
  unmatched: string[];
  /** Matches left out by the play-count or new-artist filters. */
  filteredOut: number;
  asked: number;
};

const truncate = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;

/** Applies the filters, trims to the requested count and saves the run. */
export async function finishRun(input: unknown): Promise<ActionResult<RunResult>> {
  const parsed = finishInputSchema.safeParse(input);
  if (!parsed.success) return fail(DiscoverError.Invalid);
  const access = await contextWith(FeatureFlag.Ai);
  if (!access.ok) return fail(DiscoverError.Forbidden);
  const { context } = access;
  const { request, matched, unmatched } = parsed.data;
  const t = await getTranslations("discover.titles");

  const [{ rules, all }, tracks, title] = await Promise.all([
    allListening(context),
    // Tracks are read again server-side; the client only sends IDs.
    context.source.getTracks(matched.map((m) => m.trackId)),
    match(request.seed)
      .with({ mode: DiscoverMode.Vibe }, async ({ prompt }) =>
        t("vibe", { prompt: truncate(prompt, 60) }),
      )
      .with({ mode: DiscoverMode.Playlist }, async ({ playlistId }) => {
        const playlist = await context.source.getPlaylist(playlistId);
        return t("playlist", { name: playlist?.name ?? "?" });
      })
      .exhaustive(),
  ]);
  const byId = new Map(tracks.map((track) => [track.id, track]));
  const suggestions = matched.flatMap((m) => {
    const track = byId.get(m.trackId);
    return track ? [{ track, reason: m.reason, closestMatch: m.closestMatch }] : [];
  });
  const { kept, filteredOut } = filterSuggestions(suggestions, buildListeningIndex(all, rules), {
    count: request.count,
    maxPlays: request.maxPlays,
    newArtistsOnly: request.newArtistsOnly,
  });

  try {
    const generation = await context.source.saveGeneration({
      title,
      request: match(request.seed)
        .with({ mode: DiscoverMode.Vibe }, ({ prompt }) => prompt)
        .with({ mode: DiscoverMode.Playlist }, () => title)
        .exhaustive(),
      trackIds: kept.map((s) => s.track.id),
      unmatched,
    });
    return ok({
      generationId: generation.id,
      title,
      suggestions: kept,
      unmatched,
      filteredOut,
      asked: matched.length + unmatched.length,
    });
  } catch (error) {
    console.error("Discover: saving the run failed", error);
    return fail(DiscoverError.Unknown);
  }
}

export type EarlierRun = {
  title: string;
  suggestions: Suggestion[];
  unmatched: string[];
};

/** Reopens a saved run. Reasons are not stored, so they come back empty. */
export async function openGeneration(id: unknown): Promise<ActionResult<EarlierRun>> {
  const parsed = z.string().min(1).max(200).safeParse(id);
  if (!parsed.success) return fail(DiscoverError.Invalid);
  const access = await contextWith(FeatureFlag.Ai);
  if (!access.ok) return fail(DiscoverError.Forbidden);
  const { source } = access.context;
  const generation = (await source.listGenerations(50)).find((g) => g.id === parsed.data);
  if (!generation) return fail(DiscoverError.Invalid);
  const tracks = await source.getTracks(generation.trackIds);
  return ok({
    title: generation.title,
    suggestions: tracks.map((track) => ({ track, reason: "", closestMatch: false })),
    unmatched: [...generation.unmatched],
  });
}

/** "Seeded from" artists for the playlist picker. */
export async function describePlaylistSeed(
  playlistId: unknown,
): Promise<ActionResult<{ artists: string[]; more: number }>> {
  const parsed = z.string().min(1).max(200).safeParse(playlistId);
  if (!parsed.success) return fail(DiscoverError.Invalid);
  const access = await contextWith(FeatureFlag.Ai);
  if (!access.ok) return fail(DiscoverError.Forbidden);
  const playlist = await access.context.source.getPlaylist(parsed.data);
  if (!playlist?.items?.length) return fail(DiscoverError.PlaylistMissing);
  return ok(seedSummary(buildPlaylistSeed(playlist)));
}

const trackIdsSchema = z.array(z.string().min(1).max(200)).min(1).max(countBounds.max);

const saveInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  trackIds: trackIdsSchema,
});

export async function saveAsPlaylist(
  input: unknown,
): Promise<ActionResult<{ id: string; name: string }>> {
  const parsed = saveInputSchema.safeParse(input);
  if (!parsed.success) return fail(DiscoverError.Invalid);
  const access = await contextWith(FeatureFlag.Ai, FeatureFlag.PlaylistWrite);
  if (!access.ok) return fail(DiscoverError.Forbidden);
  try {
    const created = await access.context.source.createPlaylist(
      { name: parsed.data.name, description: "", isPublic: false },
      parsed.data.trackIds,
    );
    playlistsChanged();
    return ok({ id: created.id, name: created.name });
  } catch (error) {
    console.error("Discover: creating the playlist failed", error);
    return fail(DiscoverError.Unknown);
  }
}

const addInputSchema = z.object({
  playlistId: z.string().min(1).max(200),
  trackIds: trackIdsSchema,
});

/** The playlist pickers here and the playlist screens list playlists rendered on the server. */
function playlistsChanged() {
  revalidatePath("/app/discover");
  revalidatePath("/app/playlists", "layout");
}

/** Appends the suggestions a playlist doesn't have yet. */
export async function addToPlaylist(
  input: unknown,
): Promise<ActionResult<{ name: string; added: number; skipped: number }>> {
  const parsed = addInputSchema.safeParse(input);
  if (!parsed.success) return fail(DiscoverError.Invalid);
  const access = await contextWith(FeatureFlag.Ai, FeatureFlag.PlaylistWrite);
  if (!access.ok) return fail(DiscoverError.Forbidden);
  const { source } = access.context;
  const playlist = await source.getPlaylist(parsed.data.playlistId);
  if (!playlist) return fail(DiscoverError.PlaylistMissing);
  if (!playlist.editable) return fail(DiscoverError.Forbidden);
  const existing = (playlist.items ?? []).map((item) => item.track.id);
  const plan = planMerge(existing, [parsed.data.trackIds], true);
  if (plan.added.length === 0) return ok({ name: playlist.name, added: 0, skipped: plan.skipped });
  try {
    await source.addPlaylistItems(playlist.id, plan.added);
    playlistsChanged();
    return ok({ name: playlist.name, added: plan.added.length, skipped: plan.skipped });
  } catch (error) {
    console.error("Discover: adding to the playlist failed", error);
    return fail(DiscoverError.Unknown);
  }
}
