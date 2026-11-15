import { z } from "zod";

/** What Next.js passes as `searchParams` to a page. */
export type SearchParams = Record<string, string | string[] | undefined>;

/** First value of a repeated search param, so schemas only ever see a string or nothing. */
export function firstValues(params: SearchParams): Record<string, string | undefined> {
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  );
}

/** A calendar day as "YYYY-MM-DD" that actually exists (no 2026-02-30). */
export const dayKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
  }, "Not a calendar day");
