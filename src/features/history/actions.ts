"use server";

import { z } from "zod";
import { demoSampleExport } from "@/data/demo/demo-data-source";
import { DataMode } from "@/data/music-data-source";
import { NotAStreamingHistoryError } from "@/features/import/streaming-history";
import { FeatureFlag } from "@/server/feature-flags";
import { getRequestContext } from "@/server/request-context";
import { ImportFileError, precheckHistoryFile, readHistoryFile } from "./import-file";
import { type ImportResult, toTotals } from "./import-result";

const uploadSchema = z.object({ file: z.file() });

async function importEntries(name: string, entries: unknown[]): Promise<ImportResult> {
  const { source } = await getRequestContext();
  try {
    const summary = await source.importHistory([{ name, entries }]);
    return { ok: true, totals: toTotals(summary) };
  } catch (error) {
    if (error instanceof NotAStreamingHistoryError) {
      return { ok: false, error: ImportFileError.NotHistory };
    }
    console.error(error);
    return { ok: false, error: ImportFileError.Failed };
  }
}

/** Imports one Extended Streaming History JSON file. The client sends files one at a time. */
export async function importHistoryFile(formData: FormData): Promise<ImportResult> {
  const { flags } = await getRequestContext();
  if (!flags.has(FeatureFlag.Stats)) return { ok: false, error: "forbidden" };

  const parsed = uploadSchema.safeParse({ file: formData.get("file") });
  if (!parsed.success) return { ok: false, error: ImportFileError.Empty };
  const { file } = parsed.data;

  const early = precheckHistoryFile(file.name, file.size);
  if (early) return { ok: false, error: early };

  const read = readHistoryFile(file.name, await file.text());
  if (!read.ok) return read;
  return importEntries(file.name, read.entries);
}

/** Demo only: imports a generated sample export into the visitor's demo session. */
export async function importSampleHistory(): Promise<ImportResult> {
  const { flags, source, now } = await getRequestContext();
  if (!flags.has(FeatureFlag.Stats) || source.mode !== DataMode.Demo) {
    return { ok: false, error: "forbidden" };
  }
  return importEntries("Streaming_History_Audio_sample.json", demoSampleExport(now));
}
