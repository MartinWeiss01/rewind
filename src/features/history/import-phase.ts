import { match } from "ts-pattern";
import { ImportFileError } from "./import-file";
import type { ImportTotals } from "./import-result";

export type ImportErrorCode = ImportFileError | "forbidden" | "tooMany";

export type FileState =
  | { name: string; state: "waiting" | "importing" }
  | { name: string; state: "done"; added: number }
  | { name: string; state: "failed"; error: ImportErrorCode };

export type FileFailure = { name: string; error: ImportErrorCode };

/** What an import run returns once every file has been tried (or it was cancelled). */
export type ImportOutcome = { totals: ImportTotals; failed: FileFailure[] };

export type ImportPhase =
  | { kind: "idle" }
  | { kind: "importing"; files: FileState[] }
  | { kind: "done"; totals: ImportTotals; failed: FileFailure[] }
  | { kind: "error"; name: string; error: ImportErrorCode };

/**
 * The import panel's screen, from the import mutation's status, its per-file
 * progress and a file the picker refused before anything was sent.
 */
export function importPhase({
  status,
  progress,
  outcome,
  rejected,
  firstFile,
}: {
  status: "idle" | "pending" | "success" | "error";
  progress: FileState[];
  outcome: ImportOutcome | undefined;
  rejected: FileFailure | null;
  /** Name of the first file of the run, for an unexpected failure. */
  firstFile: string;
}): ImportPhase {
  return match(status)
    .returnType<ImportPhase>()
    .with("idle", () => (rejected ? { kind: "error", ...rejected } : { kind: "idle" }))
    .with("pending", () => ({ kind: "importing", files: progress }))
    .with("success", () => {
      if (!outcome) return { kind: "idle" };
      const first = outcome.failed[0];
      // Nothing went in: show why the first file failed instead of an empty summary.
      if (outcome.totals.files === 0 && first) return { kind: "error", ...first };
      return { kind: "done", totals: outcome.totals, failed: outcome.failed };
    })
    .with("error", () => ({ kind: "error", name: firstFile, error: ImportFileError.Failed }))
    .exhaustive();
}
