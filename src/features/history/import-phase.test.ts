import { describe, expect, it } from "vitest";
import { ImportFileError } from "./import-file";
import { type FileState, importPhase } from "./import-phase";
import { emptyTotals } from "./import-result";

const base = { progress: [], outcome: undefined, rejected: null, firstFile: "history-a.json" };

describe("importPhase", () => {
  it("is idle before a run, or shows a file the picker refused", () => {
    expect(importPhase({ ...base, status: "idle" })).toEqual({ kind: "idle" });
    expect(
      importPhase({
        ...base,
        status: "idle",
        rejected: { name: "notes.txt", error: ImportFileError.NotJson },
      }),
    ).toEqual({ kind: "error", name: "notes.txt", error: ImportFileError.NotJson });
  });

  it("shows per-file progress while running", () => {
    const progress: FileState[] = [{ name: "history-a.json", state: "importing" }];
    expect(importPhase({ ...base, status: "pending", progress })).toEqual({
      kind: "importing",
      files: progress,
    });
  });

  it("summarises a finished run, listing failed files", () => {
    const totals = { ...emptyTotals, files: 1, added: 12 };
    const failed = [{ name: "history-b.json", error: ImportFileError.Empty }];
    expect(importPhase({ ...base, status: "success", outcome: { totals, failed } })).toEqual({
      kind: "done",
      totals,
      failed,
    });
  });

  it("shows the first failure when no file went in", () => {
    const failed = [{ name: "history-b.json", error: ImportFileError.NotHistory }];
    expect(
      importPhase({ ...base, status: "success", outcome: { totals: emptyTotals, failed } }),
    ).toEqual({ kind: "error", name: "history-b.json", error: ImportFileError.NotHistory });
  });

  it("reports an unexpected failure against the first file", () => {
    expect(importPhase({ ...base, status: "error" })).toEqual({
      kind: "error",
      name: "history-a.json",
      error: ImportFileError.Failed,
    });
  });
});
