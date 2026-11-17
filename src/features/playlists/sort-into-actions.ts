"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { match } from "ts-pattern";
import { z } from "zod";
import { DataMode } from "@/data/music-data-source";
import { buildCatalog, type Catalog } from "@/demo/catalog";
import { persona } from "@/demo/persona";
import type { Track } from "@/domain/music";
import type { PlaylistDetail } from "@/domain/playlists";
import { AiFailure, aiFailureOf, decideChoices, readAiConfig } from "@/server/ai";
import { sha256 } from "@/server/crypto";
import { FeatureFlag } from "@/server/feature-flags";
import { takeRateLimit } from "@/server/rate-limit";
import { getRequestContext, type RequestContext } from "@/server/request-context";
import {
  ChangeKind,
  formatChangeLabel,
  PartialStage,
  WriteError,
  type WriteResult,
} from "./changes";
import {
  buildSortQuestions,
  demoSortSuggestions,
  planSortInto,
  SortIntoError,
  type SortTarget,
  type SuggestResult,
  sortIntoLimits,
  suggestionsFromAnswers,
} from "./sort-into";

const idSchema = z.string().trim().min(1).max(200);
const targetIdsSchema = z
  .array(idSchema)
  .min(sortIntoLimits.minTargets)
  .max(sortIntoLimits.maxTargets);

const suggestSchema = z.object({ playlistId: idSchema, targetIds: targetIdsSchema });

const fail = (error: SortIntoError): SuggestResult => ({ status: "error", error });

let demoCatalog: Catalog | null = null;
const catalogForDemo = () => {
  demoCatalog ??= buildCatalog(persona);
  return demoCatalog;
};

const distinctTracks = (playlist: PlaylistDetail): Track[] => {
  const seen = new Map<string, Track>();
  for (const item of playlist.items ?? []) seen.set(item.track.id, item.track);
  return [...seen.values()];
};

const asTarget = (playlist: PlaylistDetail): SortTarget => ({
  id: playlist.id,
  name: playlist.name,
  description: playlist.description,
  trackIds: playlist.items?.map((i) => i.track.id) ?? [],
});

/** Loads the playlists to sort into; they must be editable and readable. */
async function loadTargets(
  context: RequestContext,
  sourceId: string,
  ids: readonly string[],
): Promise<PlaylistDetail[] | "notFound" | "readOnly" | "invalid"> {
  const unique = [...new Set(ids)];
  if (unique.length !== ids.length || unique.includes(sourceId)) return "invalid";
  const targets = await Promise.all(unique.map((id) => context.source.getPlaylist(id)));
  if (targets.some((t) => t === null)) return "notFound";
  if (targets.some((t) => !t?.editable || !t.items)) return "readOnly";
  return targets.flatMap((t) => (t ? [t] : []));
}

/**
 * Suggests a target playlist for every distinct track of a playlist: the decision
 * model when live, pre-made answers from genres in the demo. Changes nothing.
 */
export async function suggestSortAction(input: unknown): Promise<SuggestResult> {
  const parsed = suggestSchema.safeParse(input);
  if (!parsed.success) return fail(SortIntoError.Invalid);
  const context = await getRequestContext();
  if (!context.flags.has(FeatureFlag.Ai) || !context.flags.has(FeatureFlag.PlaylistWrite)) {
    return fail(SortIntoError.Forbidden);
  }
  const source = await context.source.getPlaylist(parsed.data.playlistId);
  if (!source) return fail(SortIntoError.NotFound);
  if (!source.items) return fail(SortIntoError.ReadOnly);
  const tracks = distinctTracks(source);
  if (tracks.length > sortIntoLimits.maxTracks) return fail(SortIntoError.TooLarge);
  const loaded = await loadTargets(context, source.id, parsed.data.targetIds);
  if (typeof loaded === "string") return fail(loaded);
  const targets = loaded.map(asTarget);

  const ai = readAiConfig(process.env);
  const live = context.source.mode === DataMode.Spotify || ai.demoLiveAi;
  if (!live) {
    // Demo without live AI: answers come from the catalog's genres.
    const genres = new Map(catalogForDemo().tracks.map((t) => [t.id, t.genre]));
    return {
      status: "ok",
      live,
      suggestions: demoSortSuggestions(
        tracks.map((t) => t.id),
        targets,
        (id) => genres.get(id) ?? null,
      ),
    };
  }

  // One run counts like one Discover run against the daily AI allowance.
  const day = 24 * 60 * 60 * 1000;
  const allowed =
    context.viewer.mode === "spotify"
      ? await takeRateLimit(`ai:user:${context.viewer.spotifyUserId}`, 20, day)
      : await takeRateLimit(
          `ai:demo:${sha256((await headers()).get("x-forwarded-for") ?? "local")}`,
          3,
          day,
        );
  if (!allowed) return fail(SortIntoError.RateLimited);

  const trackById = new Map<string, Track>();
  for (const playlist of loaded) {
    for (const item of playlist.items ?? []) trackById.set(item.track.id, item.track);
  }
  const { state, questions, targetOf } = buildSortQuestions(tracks, targets, trackById);
  try {
    const answers = await decideChoices(ai, { state, questions, timeoutMs: 120_000 });
    return { status: "ok", live, suggestions: suggestionsFromAnswers(tracks, answers, targetOf) };
  } catch (error) {
    const failure = aiFailureOf(error);
    console.error(`Sort into playlists: decision call failed (${failure})`, error);
    return fail(
      match(failure)
        .with(AiFailure.NotConfigured, () => SortIntoError.NotConfigured)
        .with(AiFailure.Timeout, () => SortIntoError.Timeout)
        .with(AiFailure.Provider, () => SortIntoError.Provider)
        .exhaustive(),
    );
  }
}

const applySchema = z.object({
  playlistId: idSchema,
  /** The source version the suggestions were made for. */
  basedOn: z.string().max(200),
  moves: z
    .array(z.object({ trackId: idSchema, targetId: idSchema }))
    .min(1)
    .max(sortIntoLimits.maxTracks),
  removeFromSource: z.boolean(),
  skipExisting: z.boolean(),
});

const writeFail = (error: WriteError): WriteResult => ({ status: "error", error });

/**
 * Adds the chosen tracks to their target playlists and, when asked, takes them out
 * of the source. Every playlist that changes gets a snapshot first.
 */
export async function applySortAction(input: unknown): Promise<WriteResult> {
  const context = await getRequestContext();
  if (!context.flags.has(FeatureFlag.PlaylistWrite)) return writeFail(WriteError.Forbidden);
  const parsed = applySchema.safeParse(input);
  if (!parsed.success) return writeFail(WriteError.Invalid);
  const { playlistId, basedOn, moves, removeFromSource, skipExisting } = parsed.data;

  const source = await context.source.getPlaylist(playlistId);
  if (!source) return writeFail(WriteError.NotFound);
  if (!source.items) return writeFail(WriteError.ReadOnly);
  if (source.snapshotId !== basedOn) return writeFail(WriteError.Stale);
  if (removeFromSource && (!source.editable || source.hiddenItems > 0)) {
    return writeFail(source.editable ? WriteError.HiddenItems : WriteError.ReadOnly);
  }
  const sourceIds = source.items.map((i) => i.track.id);
  const inSource = new Set(sourceIds);
  if (moves.some((m) => !inSource.has(m.trackId))) return writeFail(WriteError.Invalid);

  const targetIds = [...new Set(moves.map((m) => m.targetId))];
  const loaded = await loadTargets(context, playlistId, targetIds);
  if (loaded === "invalid") return writeFail(WriteError.Invalid);
  if (loaded === "notFound") return writeFail(WriteError.NotFound);
  if (loaded === "readOnly") return writeFail(WriteError.ReadOnly);

  const plan = planSortInto({
    sourceIds,
    targetIds: new Map(loaded.map((t) => [t.id, t.items?.map((i) => i.track.id) ?? []])),
    moves,
    skipExisting,
  });
  const revalidate = () => revalidatePath("/app/playlists", "layout");

  let done = 0;
  for (const target of loaded) {
    const adds = plan.adds.get(target.id) ?? [];
    if (adds.length > 0) {
      try {
        await context.source.saveSnapshot(
          target.id,
          formatChangeLabel({ kind: ChangeKind.MoveIn, count: adds.length }),
          target.items?.map((i) => i.track.id) ?? [],
        );
        await context.source.addPlaylistItems(target.id, adds);
      } catch (error) {
        console.error(error);
        revalidate();
        return {
          status: "partial",
          stage: PartialStage.Items,
          playlistId: target.id,
          snapshotId: null,
          done,
          total: loaded.length,
        };
      }
    }
    done += 1;
  }

  let snapshotId: string | null = null;
  if (removeFromSource && plan.moved > 0) {
    try {
      snapshotId = (
        await context.source.saveSnapshot(
          playlistId,
          formatChangeLabel({ kind: ChangeKind.MoveOut, count: plan.moved }),
          sourceIds,
        )
      ).id;
    } catch (error) {
      console.error(error);
      revalidate();
      return {
        status: "partial",
        stage: PartialStage.Items,
        playlistId,
        snapshotId: null,
        done,
        total: loaded.length + 1,
      };
    }
    try {
      await context.source.replacePlaylistItems(playlistId, plan.remaining);
    } catch (error) {
      console.error(error);
      revalidate();
      return {
        status: "partial",
        stage: PartialStage.Items,
        playlistId,
        snapshotId,
        done,
        total: loaded.length + 1,
      };
    }
  }
  revalidate();
  return { status: "ok", count: plan.moved, playlistId, snapshotId };
}
