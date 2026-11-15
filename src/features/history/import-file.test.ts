import { describe, expect, it } from "vitest";
import {
  ImportFileError,
  MAX_IMPORT_FILE_BYTES,
  precheckHistoryFile,
  readHistoryFile,
} from "./import-file";
import { addTotals, emptyTotals } from "./import-result";

describe("precheckHistoryFile", () => {
  it("catches ZIPs, empty and oversized files by name and size", () => {
    expect(precheckHistoryFile("my_data.ZIP", 100)).toBe(ImportFileError.Zip);
    expect(precheckHistoryFile("a.json", 0)).toBe(ImportFileError.Empty);
    expect(precheckHistoryFile("a.json", MAX_IMPORT_FILE_BYTES + 1)).toBe(ImportFileError.TooLarge);
    expect(precheckHistoryFile("a.json", 10)).toBeNull();
  });
});

describe("readHistoryFile", () => {
  it("parses a JSON array", () => {
    expect(readHistoryFile("a.json", '[{"ts":"x"}]')).toEqual({ ok: true, entries: [{ ts: "x" }] });
  });

  it("recognises a renamed ZIP by its signature", () => {
    expect(readHistoryFile("a.json", "PK\u0003\u0004rest")).toEqual({
      ok: false,
      error: ImportFileError.Zip,
    });
  });

  it("rejects text that is not JSON", () => {
    expect(readHistoryFile("a.json", "hello")).toEqual({
      ok: false,
      error: ImportFileError.NotJson,
    });
  });

  it("rejects JSON that is not a list of plays", () => {
    expect(readHistoryFile("a.json", '{"plays":[]}')).toEqual({
      ok: false,
      error: ImportFileError.NotHistory,
    });
  });
});

describe("addTotals", () => {
  it("sums counts and widens the date span", () => {
    const a = {
      files: 1,
      added: 5,
      duplicates: 1,
      skipped: 2,
      firstPlayedAt: "2026-02-01T00:00:00.000Z",
      lastPlayedAt: "2026-03-01T00:00:00.000Z",
    };
    const b = {
      ...a,
      firstPlayedAt: "2026-01-01T00:00:00.000Z",
      lastPlayedAt: "2026-02-15T00:00:00.000Z",
    };
    expect(addTotals(addTotals(emptyTotals, a), b)).toEqual({
      files: 2,
      added: 10,
      duplicates: 2,
      skipped: 4,
      firstPlayedAt: "2026-01-01T00:00:00.000Z",
      lastPlayedAt: "2026-03-01T00:00:00.000Z",
    });
  });
});
