"use server";

import { z } from "zod";
import { demoSampleExport } from "@/data/demo/demo-data-source";
import { DataMode } from "@/data/music-data-source";
import { NotAStreamingHistoryError } from "@/features/import/streaming-history";
import { FeatureFlag } from "@/server/feature-flags";
import { getRequestContext } from "@/server/request-context";
import { IMPORT_CHUNK_SIZE, ImportFileError } from "./import-file";
import { type ImportResult, toTotals } from "./import-result";

const chunkSchema = z.object({
  fileName: z.string().min(1).max(200),
  entries: z
    .array(
      z.object({
        ts: z.string().max(40),
        ms_played: z.number(),
        spotify_track_uri: z.string().max(300).nullable(),
        master_metadata_track_name: z.string().max(300).nullable(),
        master_metadata_album_artist_name: z.string().max(300).nullable(),
        master_metadata_album_album_name: z.string().max(300).nullable(),
      }),
    )
    .min(1)
    .max(IMPORT_CHUNK_SIZE),
});

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

/**
 * Imports one chunk of an Extended Streaming History file. The browser parses the file,
 * keeps only the fields Rewind uses and sends it in chunks, so requests stay small and
 * the rest of the export (IP address, platform…) is never uploaded.
 */
export async function importHistoryChunk(input: unknown): Promise<ImportResult> {
  const { flags } = await getRequestContext();
  if (!flags.has(FeatureFlag.Stats)) return { ok: false, error: "forbidden" };
  const parsed = chunkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: ImportFileError.NotHistory };
  return importEntries(parsed.data.fileName, parsed.data.entries);
}

/** Demo only: imports a generated sample export into the visitor's demo session. */
export async function importSampleHistory(): Promise<ImportResult> {
  const { flags, source, now } = await getRequestContext();
  if (!flags.has(FeatureFlag.Stats) || source.mode !== DataMode.Demo) {
    return { ok: false, error: "forbidden" };
  }
  return importEntries("Streaming_History_Audio_sample.json", demoSampleExport(now));
}
