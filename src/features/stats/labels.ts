import type { DateTimeFormatOptions } from "next-intl";

/** Localised labels for weekdays and hours; works with next-intl's `useFormatter` and `getFormatter`. */
type DateFormatter = {
  dateTime(date: Date, options: DateTimeFormatOptions): string;
};

/** 0 = Monday … 6 = Sunday. 2024-01-01 was a Monday. */
export function weekdayLabel(
  format: DateFormatter,
  weekday: number,
  width: "short" | "long" = "short",
): string {
  return format.dateTime(new Date(Date.UTC(2024, 0, 1 + weekday, 12)), {
    weekday: width,
    timeZone: "UTC",
  });
}

/** "21:00" for an hour of the day, always on the 24-hour clock like the design. */
export function hourLabel(format: DateFormatter, hour: number): string {
  return format.dateTime(new Date(Date.UTC(2024, 0, 1, hour)), {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "UTC",
  });
}

/** A "YYYY-MM-DD" or "YYYY-MM" key as a UTC date, for formatting with `timeZone: "UTC"`. */
export function dateFromKey(key: string): Date {
  const [year = 1970, month = 1, day = 1] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}
