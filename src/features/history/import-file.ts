/** Checks an uploaded history file before its entries reach the data source. Pure. */

export const MAX_IMPORT_FILE_BYTES = 30 * 1024 * 1024;
export const MAX_IMPORT_FILES = 20;

export const ImportFileError = {
  Zip: "zip",
  NotJson: "notJson",
  NotHistory: "notHistory",
  TooLarge: "tooLarge",
  Empty: "empty",
  Failed: "failed",
} as const;
export type ImportFileError = (typeof ImportFileError)[keyof typeof ImportFileError];

export type ReadHistoryFileResult =
  | { ok: true; entries: unknown[] }
  | { ok: false; error: ImportFileError };

const ZIP_MAGIC = "PK\u0003\u0004";

/** Error for a file judged by name and size alone, before reading it. */
export function precheckHistoryFile(name: string, size: number): ImportFileError | null {
  if (/\.zip$/i.test(name)) return ImportFileError.Zip;
  if (size === 0) return ImportFileError.Empty;
  if (size > MAX_IMPORT_FILE_BYTES) return ImportFileError.TooLarge;
  return null;
}

/** Parses a file's text into raw export entries, or says why it can't be imported. */
export function readHistoryFile(name: string, text: string): ReadHistoryFileResult {
  const early = precheckHistoryFile(name, text.length);
  if (early) return { ok: false, error: early };
  if (text.startsWith(ZIP_MAGIC)) return { ok: false, error: ImportFileError.Zip };
  let content: unknown;
  try {
    content = JSON.parse(text);
  } catch {
    return { ok: false, error: ImportFileError.NotJson };
  }
  if (!Array.isArray(content)) return { ok: false, error: ImportFileError.NotHistory };
  return { ok: true, entries: content };
}

/** Entries per server action call; keeps every request well under hosting body limits. */
export const IMPORT_CHUNK_SIZE = 8000;

/** The only export fields Rewind reads; everything else never leaves the browser. */
export type CompactHistoryEntry = {
  ts: string;
  ms_played: number;
  spotify_track_uri: string | null;
  master_metadata_track_name: string | null;
  master_metadata_album_artist_name: string | null;
  master_metadata_album_album_name: string | null;
};

const text = (value: unknown) => (typeof value === "string" ? value.slice(0, 300) : null);

/**
 * Reduces raw export entries to the fields the import uses, dropping IP address,
 * platform, country and the rest before anything is uploaded. Malformed rows are kept
 * as-is in shape so the server can count them as skipped.
 */
export function compactHistoryEntries(entries: readonly unknown[]): CompactHistoryEntry[] {
  return entries.map((raw) => {
    const entry = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
    return {
      ts: typeof entry.ts === "string" ? entry.ts : "",
      ms_played: typeof entry.ms_played === "number" ? entry.ms_played : -1,
      spotify_track_uri: text(entry.spotify_track_uri),
      master_metadata_track_name: text(entry.master_metadata_track_name),
      master_metadata_album_artist_name: text(entry.master_metadata_album_artist_name),
      master_metadata_album_album_name: text(entry.master_metadata_album_album_name),
    };
  });
}
