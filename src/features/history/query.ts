import { z } from "zod";
import { type PlayQuery, PlaySort } from "@/data/music-data-source";
import { PlaySource } from "@/domain/listening";
import { dayKeySchema, firstValues, type SearchParams } from "@/lib/search-params";
import { epochDay, keyFromEpochDay, zonedTimeToUtc } from "@/lib/time-zone";

export const HISTORY_PAGE_SIZE = 50;

export const SourceFilter = {
  All: "all",
  Synced: PlaySource.Synced,
  Imported: PlaySource.Imported,
} as const;
export type SourceFilter = (typeof SourceFilter)[keyof typeof SourceFilter];

/** Table filters as they live in the URL. */
export type HistoryFilters = {
  q: string;
  from: string | null;
  to: string | null;
  source: SourceFilter;
  skips: boolean;
  sort: PlaySort;
  page: number;
};

export const defaultHistoryFilters: HistoryFilters = {
  q: "",
  from: null,
  to: null,
  source: SourceFilter.All,
  skips: false,
  sort: PlaySort.Newest,
  page: 1,
};

const historySearchSchema = z.object({
  q: z.string().trim().max(100).catch(""),
  from: dayKeySchema.nullable().catch(null),
  to: dayKeySchema.nullable().catch(null),
  source: z.enum(SourceFilter).catch(SourceFilter.All),
  skips: z
    .literal("1")
    .transform(() => true)
    .catch(false),
  sort: z.enum(PlaySort).catch(PlaySort.Newest),
  page: z.coerce.number().int().min(1).max(1_000_000).catch(1),
});

/** Parses the history URL; invalid values fall back to defaults, a reversed range is swapped. */
export function parseHistorySearch(params: SearchParams): HistoryFilters {
  const raw = firstValues(params);
  const parsed = historySearchSchema.parse({ ...raw, from: raw.from ?? null, to: raw.to ?? null });
  if (parsed.from && parsed.to && parsed.from > parsed.to) {
    return { ...parsed, from: parsed.to, to: parsed.from };
  }
  return parsed;
}

/** Whether any filter narrows the list (page and sort don't). */
export function hasActiveFilters(filters: HistoryFilters): boolean {
  return (
    filters.q !== "" ||
    filters.from !== null ||
    filters.to !== null ||
    filters.source !== SourceFilter.All ||
    filters.skips
  );
}

/** URL for the history screen with some filters changed; defaults are left out. */
export function historyHref(filters: HistoryFilters, patch: Partial<HistoryFilters> = {}): string {
  const next = { ...filters, ...patch };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.from) params.set("from", next.from);
  if (next.to) params.set("to", next.to);
  if (next.source !== SourceFilter.All) params.set("source", next.source);
  if (next.skips) params.set("skips", "1");
  if (next.sort !== PlaySort.Newest) params.set("sort", next.sort);
  if (next.page > 1) params.set("page", String(next.page));
  const query = params.toString();
  return query ? `/app/history?${query}` : "/app/history";
}

function startOfDay(key: string, timeZone: string): Date {
  const [year = 1970, month = 1, day = 1] = key.split("-").map(Number);
  return zonedTimeToUtc({ year, month, day, hour: 0, minute: 0 }, timeZone);
}

/** The data source query for these filters. Days are whole local days in the listener's zone. */
export function toPlayQuery(filters: HistoryFilters, now: Date, timeZone: string): PlayQuery {
  const start = filters.from ? startOfDay(filters.from, timeZone) : new Date(0);
  const end = filters.to
    ? startOfDay(keyFromEpochDay(epochDay(filters.to) + 1), timeZone)
    : new Date(now.getTime() + 1);
  return {
    interval: { start, end: end > now ? new Date(now.getTime() + 1) : end },
    source: filters.source,
    search: filters.q,
    includeSkips: filters.skips,
    sort: filters.sort,
    page: filters.page,
    pageSize: HISTORY_PAGE_SIZE,
  };
}
