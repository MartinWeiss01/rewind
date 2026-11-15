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
