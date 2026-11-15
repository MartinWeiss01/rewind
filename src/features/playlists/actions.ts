"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import type { Track } from "@/domain/music";
import type { PlaylistDetail } from "@/domain/playlists";
import { FeatureFlag } from "@/server/feature-flags";
import { getRequestContext, type RequestContext } from "@/server/request-context";
import {
  ChangeKind,
  formatChangeLabel,
  isSubsetOf,
  PartialStage,
  WriteError,
  type WriteResult,
} from "./changes";
import { planMerge, planSplit, splitBySchema } from "./tools";

const idSchema = z.string().trim().min(1).max(200);
const trackIdsSchema = z.array(idSchema).max(10_000);

const fail = (error: WriteError): WriteResult => ({ status: "error", error });

/** The request context when the viewer may write playlists (ADR 0004), else null. */
async function writer(): Promise<RequestContext | null> {
  const context = await getRequestContext();
  return context.flags.has(FeatureFlag.PlaylistWrite) ? context : null;
}

function revalidate() {
  revalidatePath("/app/playlists", "layout");
}

const trackIds = (playlist: PlaylistDetail) => playlist.items?.map((i) => i.track.id) ?? [];

/** Loads a playlist the viewer can change, or the reason it can't be changed. */
async function editable(
  context: RequestContext,
  id: string,
): Promise<{ playlist: PlaylistDetail; ids: string[] } | WriteError> {
  const playlist = await context.source.getPlaylist(id);
  if (!playlist) return WriteError.NotFound;
  if (!playlist.editable || !playlist.items) return WriteError.ReadOnly;
  return { playlist, ids: trackIds(playlist) };
}

/* ---------- New playlist ---------- */

const newPlaylistSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(300),
  isPublic: z.boolean(),
});

export async function createPlaylistAction(input: unknown): Promise<WriteResult> {
  const context = await writer();
  if (!context) return fail(WriteError.Forbidden);
  const parsed = newPlaylistSchema.safeParse(input);
  if (!parsed.success) return fail(WriteError.Invalid);
  try {
    const created = await context.source.createPlaylist(parsed.data, []);
    revalidate();
    return { status: "ok", count: 0, playlistId: created.id, snapshotId: null };
  } catch (error) {
    console.error(error);
    return fail(WriteError.Failed);
  }
}

/* ---------- Edit items (table edits, duplicates, sort) ---------- */

const applyEditSchema = z.object({
  playlistId: idSchema,
  /** The playlist version the client edited, to refuse edits on a stale list. */
  basedOn: z.string().max(200),
  trackIds: trackIdsSchema,
  kind: z.enum([ChangeKind.Edit, ChangeKind.RemoveDuplicates, ChangeKind.Sort]),
});

/**
 * Replaces a playlist's items with a reordered or reduced copy of them. Saves a
 * snapshot first; the new list may only drop or reorder existing items.
 */
export async function applyEditAction(input: unknown): Promise<WriteResult> {
  const context = await writer();
  if (!context) return fail(WriteError.Forbidden);
  const parsed = applyEditSchema.safeParse(input);
  if (!parsed.success) return fail(WriteError.Invalid);
  const { playlistId, basedOn, kind } = parsed.data;

  const current = await editable(context, playlistId);
  if (typeof current === "string") return fail(current);
  if (current.playlist.snapshotId !== basedOn) return fail(WriteError.Stale);
  if (!isSubsetOf(parsed.data.trackIds, current.ids)) return fail(WriteError.Invalid);

  const count =
    kind === ChangeKind.Sort
      ? current.ids.length
      : current.ids.length - parsed.data.trackIds.length;
  return replaceWithSnapshot(context, playlistId, current.ids, parsed.data.trackIds, {
    kind,
    count,
  });
}

async function replaceWithSnapshot(
  context: RequestContext,
  playlistId: string,
  before: readonly string[],
  after: readonly string[],
  label: { kind: ChangeKind; count: number },
): Promise<WriteResult> {
  let snapshotId: string;
  try {
    snapshotId = (await context.source.saveSnapshot(playlistId, formatChangeLabel(label), before))
      .id;
  } catch (error) {
    console.error(error);
    return fail(WriteError.Failed);
  }
  try {
    await context.source.replacePlaylistItems(playlistId, after);
  } catch (error) {
    console.error(error);
    revalidate();
    return {
      status: "partial",
      stage: PartialStage.Items,
      playlistId,
      snapshotId,
      done: null,
      total: null,
    };
  }
  revalidate();
  return { status: "ok", count: label.count, playlistId, snapshotId };
}

/* ---------- Restore ---------- */

const restoreSchema = z.object({ playlistId: idSchema, snapshotId: idSchema });

/** Restores a snapshot, saving the current list as a snapshot first so it can be undone. */
export async function restoreSnapshotAction(input: unknown): Promise<WriteResult> {
  const context = await writer();
  if (!context) return fail(WriteError.Forbidden);
  const parsed = restoreSchema.safeParse(input);
  if (!parsed.success) return fail(WriteError.Invalid);
  const { playlistId, snapshotId } = parsed.data;

  const current = await editable(context, playlistId);
  if (typeof current === "string") return fail(current);
  const snapshot = (await context.source.listSnapshots(playlistId)).find(
    (s) => s.id === snapshotId,
  );
  if (!snapshot) return fail(WriteError.NotFound);
  return replaceWithSnapshot(context, playlistId, current.ids, snapshot.trackIds, {
    kind: ChangeKind.Restore,
    count: snapshot.trackIds.length,
  });
}

/* ---------- Add tracks ---------- */

const addSchema = z.object({ playlistId: idSchema, trackIds: z.array(idSchema).min(1).max(100) });

export async function addTracksAction(input: unknown): Promise<WriteResult> {
  const context = await writer();
  if (!context) return fail(WriteError.Forbidden);
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return fail(WriteError.Invalid);
  const current = await editable(context, parsed.data.playlistId);
  if (typeof current === "string") return fail(current);
  const known = await context.source.getTracks(parsed.data.trackIds);
  if (known.length !== new Set(parsed.data.trackIds).size) return fail(WriteError.Invalid);
  try {
    await context.source.addPlaylistItems(parsed.data.playlistId, parsed.data.trackIds);
  } catch (error) {
    console.error(error);
    return fail(WriteError.Failed);
  }
  revalidate();
  return {
    status: "ok",
    count: parsed.data.trackIds.length,
    playlistId: parsed.data.playlistId,
    snapshotId: null,
  };
}

const searchSchema = z.string().trim().max(100);

/** Up to ten tracks for the "Add tracks" search. Read-only, so it needs no write flag. */
export async function searchTracksAction(query: unknown): Promise<readonly Track[]> {
  const parsed = searchSchema.safeParse(query);
  if (!parsed.success || parsed.data.length === 0) return [];
  const { source } = await getRequestContext();
  return (await source.searchTracks(parsed.data)).slice(0, 10);
}

/* ---------- Merge ---------- */

const mergeSchema = z.object({
  /** Null merges into a new playlist named `newName`. */
  targetId: idSchema.nullable(),
  newName: z.string().trim().min(1).max(100).nullable(),
  sourceIds: z.array(idSchema).min(1).max(20),
  skipExisting: z.boolean(),
  deleteSources: z.boolean(),
});

export type MergePreview =
  | { status: "ok"; added: number; skipped: number; total: number }
  | { status: "error"; error: WriteError };

async function readSources(context: RequestContext, ids: readonly string[]) {
  const sources = await Promise.all(ids.map((id) => context.source.getPlaylist(id)));
  if (sources.some((s) => s === null)) return WriteError.NotFound;
  if (sources.some((s) => s?.items === null)) return WriteError.ReadOnly;
  return sources.flatMap((s) => (s ? [s] : []));
}

/** Counts for the merge dialog's preview. */
export async function previewMergeAction(input: unknown): Promise<MergePreview> {
  const parsed = mergeSchema
    .pick({ targetId: true, sourceIds: true, skipExisting: true })
    .safeParse(input);
  if (!parsed.success) return { status: "error", error: WriteError.Invalid };
  const context = await getRequestContext();
  const sources = await readSources(context, parsed.data.sourceIds);
  if (typeof sources === "string") return { status: "error", error: sources };
  const target = parsed.data.targetId
    ? await context.source.getPlaylist(parsed.data.targetId)
    : null;
  if (parsed.data.targetId && !target?.items)
    return { status: "error", error: WriteError.ReadOnly };
  const plan = planMerge(
    target ? trackIds(target) : [],
    sources.map(trackIds),
    parsed.data.skipExisting,
  );
  return { status: "ok", added: plan.added.length, skipped: plan.skipped, total: plan.total };
}

/**
 * Appends the tracks of the sources to the target (snapshotting it first) or creates
 * a new playlist with them, then optionally deletes the editable sources.
 */
export async function mergeAction(input: unknown): Promise<WriteResult> {
  const context = await writer();
  if (!context) return fail(WriteError.Forbidden);
  const parsed = mergeSchema.safeParse(input);
  if (!parsed.success) return fail(WriteError.Invalid);
  const { targetId, newName, skipExisting, deleteSources } = parsed.data;
  const sourceIds = parsed.data.sourceIds.filter((id) => id !== targetId);
  if (sourceIds.length === 0 || (!targetId && !newName)) return fail(WriteError.Invalid);

  const sources = await readSources(context, sourceIds);
  if (typeof sources === "string") return fail(sources);

  let resultId: string;
  let snapshotId: string | null = null;
  let added: number;
  if (targetId) {
    const target = await editable(context, targetId);
    if (typeof target === "string") return fail(target);
    const plan = planMerge(target.ids, sources.map(trackIds), skipExisting);
    added = plan.added.length;
    resultId = targetId;
    if (added > 0) {
      try {
        snapshotId = (
          await context.source.saveSnapshot(
            targetId,
            formatChangeLabel({ kind: ChangeKind.Merge, count: added }),
            target.ids,
          )
        ).id;
      } catch (error) {
        console.error(error);
        return fail(WriteError.Failed);
      }
      try {
        await context.source.addPlaylistItems(targetId, plan.added);
      } catch (error) {
        console.error(error);
        revalidate();
        return {
          status: "partial",
          stage: PartialStage.Items,
          playlistId: targetId,
          snapshotId,
          done: null,
          total: null,
        };
      }
    }
  } else {
    const plan = planMerge([], sources.map(trackIds), skipExisting);
    added = plan.added.length;
    try {
      const created = await context.source.createPlaylist(
        { name: newName ?? "", description: "", isPublic: false },
        plan.added,
      );
      resultId = created.id;
    } catch (error) {
      console.error(error);
      return fail(WriteError.Failed);
    }
  }

  if (deleteSources) {
    const deletable = sources.filter((s) => s.editable);
    let deleted = 0;
    for (const source of deletable) {
      try {
        await context.source.removePlaylist(source.id);
        deleted += 1;
      } catch (error) {
        console.error(error);
      }
    }
    if (deleted < deletable.length) {
      revalidate();
      return {
        status: "partial",
        stage: PartialStage.Sources,
        playlistId: resultId,
        snapshotId,
        done: deleted,
        total: deletable.length,
      };
    }
  }
  revalidate();
  return { status: "ok", count: added, playlistId: resultId, snapshotId };
}

/* ---------- Split ---------- */

const splitSchema = z.object({
  playlistId: idSchema,
  by: splitBySchema,
  minSize: z.number().int().min(1).max(500),
});

/** Creates one playlist per group; the original stays as is. */
export async function splitAction(input: unknown): Promise<WriteResult> {
  const context = await writer();
  if (!context) return fail(WriteError.Forbidden);
  const parsed = splitSchema.safeParse(input);
  if (!parsed.success) return fail(WriteError.Invalid);
  const playlist = await context.source.getPlaylist(parsed.data.playlistId);
  if (!playlist) return fail(WriteError.NotFound);
  if (!playlist.items) return fail(WriteError.ReadOnly);

  const t = await getTranslations("playlistTools.split");
  const groups = planSplit(playlist.items, parsed.data.by, parsed.data.minSize);
  let created = 0;
  for (const group of groups) {
    try {
      await context.source.createPlaylist(
        {
          name: t("newName", { name: playlist.name, group: group.label ?? t("other") }).slice(
            0,
            100,
          ),
          description: t("newDescription", { name: playlist.name }),
          isPublic: false,
        },
        group.trackIds,
      );
      created += 1;
    } catch (error) {
      console.error(error);
      revalidate();
      return {
        status: "partial",
        stage: PartialStage.Playlists,
        playlistId: playlist.id,
        snapshotId: null,
        done: created,
        total: groups.length,
      };
    }
  }
  revalidate();
  return { status: "ok", count: created, playlistId: playlist.id, snapshotId: null };
}
