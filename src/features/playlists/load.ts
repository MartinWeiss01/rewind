import type { PlaylistSummary } from "@/domain/playlists";
import { intervalFor, TimeRange } from "@/domain/time-range";
import { Metric, topTracks } from "@/features/stats/engine";
import { FeatureFlag } from "@/server/feature-flags";
import type { RequestContext } from "@/server/request-context";
import { duplicateCount } from "./duplicates";

/** A library card: the summary plus what needs the items, when they can be read. */
export type LibraryEntry = PlaylistSummary & {
  durationMs: number | null;
  duplicates: number | null;
};

/**
 * Every playlist with its total duration and duplicate count. Followed playlists
 * whose items can't be read get nulls.
 */
export async function loadLibrary({ source }: RequestContext): Promise<LibraryEntry[]> {
  const summaries = await source.listPlaylists();
  const details = await Promise.all(summaries.map((s) => source.getPlaylist(s.id)));
  return summaries.map((summary, index) => {
    const items = details[index]?.items ?? null;
    return {
      ...summary,
      durationMs: items ? items.reduce((sum, i) => sum + i.track.durationMs, 0) : null,
      duplicates: items ? duplicateCount(items) : null,
    };
  });
}

/** The viewer's counted plays per track over the last year, or null without the stats flag. */
export async function loadPlays(context: RequestContext): Promise<Map<string, number> | null> {
  if (!context.flags.has(FeatureFlag.Stats)) return null;
  const { source, now } = context;
  const [data, rules] = await Promise.all([
    source.getListening(intervalFor(TimeRange.LastYear, now)),
    source.getListeningRules(),
  ]);
  return new Map(
    topTracks(data, rules, Metric.Plays, Number.POSITIVE_INFINITY).map((t) => [
      t.track.id,
      t.plays,
    ]),
  );
}
