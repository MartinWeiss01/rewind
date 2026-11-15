import { match } from "ts-pattern";
import { z } from "zod";
import type { Interval } from "@/domain/listening";
import { dayKeySchema, firstValues, type SearchParams } from "@/lib/search-params";
import { dayKey, epochDay, keyFromEpochDay, zonedParts, zonedTimeToUtc } from "@/lib/time-zone";

/** Ready-made recap periods. */
export const RecapPreset = {
  ThisYear: "year",
  LastYear: "last-year",
  Last30Days: "30d",
  Summer: "summer",
} as const;
export type RecapPreset = (typeof RecapPreset)[keyof typeof RecapPreset];

export type RecapPeriod =
  | { kind: "preset"; preset: RecapPreset }
  | { kind: "custom"; from: string; to: string };

/** Longest custom period, so one request never loads more than about two years of plays. */
export const MAX_CUSTOM_DAYS = 731;

export const defaultRecapPeriod: RecapPeriod = { kind: "preset", preset: RecapPreset.ThisYear };

const searchSchema = z.object({
  period: z.enum(RecapPreset).optional().catch(undefined),
  from: dayKeySchema.optional().catch(undefined),
  to: dayKeySchema.optional().catch(undefined),
});

/**
 * Reads `?period=` or `?from=&to=`. A custom range must be in order, end no later than
 * today and span at most MAX_CUSTOM_DAYS; otherwise the default is used and `invalid` is set.
 */
export function parseRecapSearch(
  params: SearchParams,
  now: Date,
  timeZone: string,
): { period: RecapPeriod; invalid: boolean } {
  const raw = firstValues(params);
  const { period, from, to } = searchSchema.parse(raw);
  if (raw.from !== undefined || raw.to !== undefined) {
    const today = dayKey(now, timeZone);
    const valid =
      from !== undefined &&
      to !== undefined &&
      from <= to &&
      to <= today &&
      epochDay(to) - epochDay(from) + 1 <= MAX_CUSTOM_DAYS;
    return valid
      ? { period: { kind: "custom", from, to }, invalid: false }
      : { period: defaultRecapPeriod, invalid: true };
  }
  if (raw.period !== undefined && period === undefined) {
    return { period: defaultRecapPeriod, invalid: true };
  }
  return {
    period: period ? { kind: "preset", preset: period } : defaultRecapPeriod,
    invalid: false,
  };
}

function startOf(year: number, month: number, day: number, timeZone: string): Date {
  return zonedTimeToUtc({ year, month, day, hour: 0, minute: 0 }, timeZone);
}

function startOfKey(key: string, timeZone: string): Date {
  const [year = 1970, month = 1, day = 1] = key.split("-").map(Number);
  return startOf(year, month, day, timeZone);
}

/** The year a summer preset refers to: this summer once June has started, otherwise last one. */
export function summerYear(now: Date, timeZone: string): number {
  const { year, month } = zonedParts(now, timeZone);
  return month >= 6 ? year : year - 1;
}

/** The interval a period covers, never reaching past `now`. */
export function recapInterval(period: RecapPeriod, now: Date, timeZone: string): Interval {
  const { year } = zonedParts(now, timeZone);
  const raw = match(period)
    .with({ kind: "preset", preset: RecapPreset.ThisYear }, () => ({
      start: startOf(year, 1, 1, timeZone),
      end: now,
    }))
    .with({ kind: "preset", preset: RecapPreset.LastYear }, () => ({
      start: startOf(year - 1, 1, 1, timeZone),
      end: startOf(year, 1, 1, timeZone),
    }))
    .with({ kind: "preset", preset: RecapPreset.Last30Days }, () => ({
      start: new Date(now.getTime() - 30 * 86_400_000),
      end: now,
    }))
    .with({ kind: "preset", preset: RecapPreset.Summer }, () => {
      const summer = summerYear(now, timeZone);
      return { start: startOf(summer, 6, 1, timeZone), end: startOf(summer, 9, 1, timeZone) };
    })
    .with({ kind: "custom" }, ({ from, to }) => ({
      start: startOfKey(from, timeZone),
      end: startOfKey(keyFromEpochDay(epochDay(to) + 1), timeZone),
    }))
    .exhaustive();
  return { start: raw.start, end: raw.end > now ? now : raw.end };
}

/** Search string for a period, for links and the picker. */
export function recapSearch(period: RecapPeriod): string {
  return match(period)
    .with({ kind: "preset" }, ({ preset }) =>
      preset === RecapPreset.ThisYear ? "" : `?period=${preset}`,
    )
    .with({ kind: "custom" }, ({ from, to }) => `?from=${from}&to=${to}`)
    .exhaustive();
}
