import { match } from "ts-pattern";
import { z } from "zod";
import type { Interval } from "./listening";

/** Preset ranges on the dashboard. */
export const TimeRange = {
  Last4Weeks: "4w",
  Last6Months: "6m",
  LastYear: "1y",
  AllTime: "all",
} as const;
export type TimeRange = (typeof TimeRange)[keyof typeof TimeRange];
export const timeRangeSchema = z.enum(TimeRange);

const day = 24 * 60 * 60 * 1000;

/** The interval a range covers, ending at `now`. All time starts at the epoch. */
export function intervalFor(range: TimeRange, now: Date): Interval {
  const days = match(range)
    .with(TimeRange.Last4Weeks, () => 28)
    .with(TimeRange.Last6Months, () => 182)
    .with(TimeRange.LastYear, () => 365)
    .with(TimeRange.AllTime, () => null)
    .exhaustive();
  return { start: days === null ? new Date(0) : new Date(now.getTime() - days * day), end: now };
}

/** The interval of the same length right before `interval`, for comparisons. */
export function previousInterval(interval: Interval): Interval {
  const length = interval.end.getTime() - interval.start.getTime();
  return { start: new Date(interval.start.getTime() - length), end: interval.start };
}
