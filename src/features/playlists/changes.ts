import { z } from "zod";

/**
 * Kinds of bulk change a snapshot is saved before. Stored in the snapshot label
 * as `kind:count`, so the label stays language-neutral and is translated when shown.
 */
export const ChangeKind = {
  Edit: "edit",
  RemoveDuplicates: "removeDuplicates",
  Sort: "sort",
  Merge: "merge",
  Restore: "restore",
} as const;
export type ChangeKind = (typeof ChangeKind)[keyof typeof ChangeKind];
export const changeKindSchema = z.enum(ChangeKind);

export type ChangeLabel = { kind: ChangeKind; count: number };

export const formatChangeLabel = ({ kind, count }: ChangeLabel) => `${kind}:${count}`;

/** Reads a stored label; labels written elsewhere come back as null and are shown as is. */
export function parseChangeLabel(label: string): ChangeLabel | null {
  const [kind, count] = label.split(":");
  const parsed = z
    .object({ kind: changeKindSchema, count: z.coerce.number().int().min(0) })
    .safeParse({ kind, count });
  return parsed.success ? parsed.data : null;
}

/** Why a write failed, translated on the client. */
export const WriteError = {
  /** The viewer lacks the playlistWrite flag. */
  Forbidden: "forbidden",
  Invalid: "invalid",
  NotFound: "notFound",
  ReadOnly: "readOnly",
  /** The playlist changed since the screen loaded. */
  Stale: "stale",
  Failed: "failed",
} as const;
export type WriteError = (typeof WriteError)[keyof typeof WriteError];

/** Which step of a multi-step write stopped part way. */
export const PartialStage = {
  /** Changing the playlist's items; it may hold some of the change. */
  Items: "items",
  /** Deleting merge sources after a successful merge. */
  Sources: "sources",
  /** Creating the playlists of a split. */
  Playlists: "playlists",
} as const;
export type PartialStage = (typeof PartialStage)[keyof typeof PartialStage];

/**
 * Outcome of a server action that writes. `partial` means something was written
 * before a failure; `snapshotId` (when set) restores the playlist to before the change.
 */
export type WriteResult =
  | {
      status: "ok";
      count: number;
      playlistId: string;
      /** The snapshot saved before the change, for an undo. */
      snapshotId: string | null;
    }
  | { status: "error"; error: WriteError }
  | {
      status: "partial";
      stage: PartialStage;
      playlistId: string;
      snapshotId: string | null;
      /** Steps that went through, when they can be counted. */
      done: number | null;
      total: number | null;
    };

/** True when `next` only drops or reorders items of `current` (as a multiset). */
export function isSubsetOf(next: readonly string[], current: readonly string[]): boolean {
  const remaining = new Map<string, number>();
  for (const id of current) remaining.set(id, (remaining.get(id) ?? 0) + 1);
  for (const id of next) {
    const left = remaining.get(id) ?? 0;
    if (left === 0) return false;
    remaining.set(id, left - 1);
  }
  return true;
}
