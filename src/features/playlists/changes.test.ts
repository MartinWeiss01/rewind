import { describe, expect, it } from "vitest";
import {
  PartialStage,
  thrownWriteFailure,
  WriteError,
  type WriteResult,
  writeFailure,
} from "./changes";

const ok: WriteResult = { status: "ok", count: 2, playlistId: "pl-1", snapshotId: null };
const refused: WriteResult = { status: "error", error: WriteError.Stale };
const partial: WriteResult = {
  status: "partial",
  stage: PartialStage.Items,
  playlistId: "pl-1",
  snapshotId: "snap-1",
  done: null,
  total: null,
};

describe("writeFailure", () => {
  it("is null while idle and after success", () => {
    expect(writeFailure({ data: undefined, isError: false })).toBeNull();
    expect(writeFailure({ data: ok, isError: false })).toBeNull();
  });

  it("returns refused and partial results as they are", () => {
    expect(writeFailure({ data: refused, isError: false })).toBe(refused);
    expect(writeFailure({ data: partial, isError: false })).toBe(partial);
  });

  it("reports a thrown call as a plain failure", () => {
    expect(writeFailure({ data: undefined, isError: true })).toEqual({
      status: "error",
      error: WriteError.Failed,
    });
    expect(writeFailure({ data: undefined, isError: true })).toBe(thrownWriteFailure);
  });
});
