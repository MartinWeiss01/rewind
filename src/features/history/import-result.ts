import type { ImportSummary } from "@/data/music-data-source";
import type { ImportFileError } from "./import-file";

/** Import counts in a form that crosses the server action boundary. */
export type ImportTotals = {
  files: number;
  added: number;
  duplicates: number;
  skipped: number;
  /** ISO timestamps of the earliest and latest added play. */
  firstPlayedAt: string | null;
  lastPlayedAt: string | null;
};

export type ImportResult =
  | { ok: true; totals: ImportTotals }
  | { ok: false; error: ImportFileError | "forbidden" };

export const emptyTotals: ImportTotals = {
  files: 0,
  added: 0,
  duplicates: 0,
  skipped: 0,
  firstPlayedAt: null,
  lastPlayedAt: null,
};

export function toTotals(summary: ImportSummary): ImportTotals {
  return {
    files: summary.files,
    added: summary.added,
    duplicates: summary.duplicates,
    skipped: summary.skipped,
    firstPlayedAt: summary.firstPlayedAt?.toISOString() ?? null,
    lastPlayedAt: summary.lastPlayedAt?.toISOString() ?? null,
  };
}

function pick(a: string | null, b: string | null, preferA: (a: string, b: string) => boolean) {
  if (!a) return b;
  if (!b) return a;
  return preferA(a, b) ? a : b;
}

/** Sums the results of files imported one by one. */
export function addTotals(a: ImportTotals, b: ImportTotals): ImportTotals {
  return {
    files: a.files + b.files,
    added: a.added + b.added,
    duplicates: a.duplicates + b.duplicates,
    skipped: a.skipped + b.skipped,
    firstPlayedAt: pick(a.firstPlayedAt, b.firstPlayedAt, (x, y) => x < y),
    lastPlayedAt: pick(a.lastPlayedAt, b.lastPlayedAt, (x, y) => x > y),
  };
}
