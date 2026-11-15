/** Calendar parts of an instant in a time zone. Weekday: 0 = Monday … 6 = Sunday. */
export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
};

const formatters = new Map<string, Intl.DateTimeFormat>();
const weekdayIndex: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const cached = formatters.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
  });
  formatters.set(timeZone, formatter);
  return formatter;
}

export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts: Record<string, string> = {};
  for (const part of formatterFor(timeZone).formatToParts(date)) parts[part.type] = part.value;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: weekdayIndex[parts.weekday ?? "Mon"] ?? 0,
  };
}

/** "2026-11-15" for the calendar day an instant falls on in a time zone. */
export function dayKey(date: Date, timeZone: string): string {
  return dayKeyFromParts(zonedParts(date, timeZone));
}

/** "2026-11-15" from already computed calendar parts. */
export function dayKeyFromParts(parts: { year: number; month: number; day: number }): string {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

/** Days since 1970-01-01 for a "YYYY-MM-DD" key, so day keys can be compared and stepped. */
export function epochDay(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Math.floor(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) / 86_400_000);
}

export function keyFromEpochDay(value: number): string {
  return new Date(value * 86_400_000).toISOString().slice(0, 10);
}

/** The instant of a local wall-clock time in a time zone. */
export function zonedTimeToUtc(
  local: { year: number; month: number; day: number; hour: number; minute: number },
  timeZone: string,
): Date {
  const guess = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
  // Two passes settle the offset, including around daylight saving changes.
  let result = guess;
  for (let i = 0; i < 2; i++) {
    const p = zonedParts(new Date(result), timeZone);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    result = guess - (asUtc - result);
  }
  return new Date(result);
}
