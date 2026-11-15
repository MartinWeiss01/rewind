import { z } from "zod";

export const locales = ["en", "cs"] as const;
export const defaultLocale = "en" satisfies Locale;
export const localeCookie = "locale";

export const localeSchema = z.enum(locales);
export type Locale = z.infer<typeof localeSchema>;

/** Picks the first supported language from an `Accept-Language` header. */
export function localeFromAcceptLanguage(header: string | null): Locale | undefined {
  if (!header) return undefined;
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag = "", ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      return { language: tag.toLowerCase().split("-")[0], weight: q ? Number(q.split("=")[1]) : 1 };
    })
    .filter((entry) => Number.isFinite(entry.weight) && entry.weight > 0)
    .sort((a, b) => b.weight - a.weight);

  for (const { language } of ranked) {
    const parsed = localeSchema.safeParse(language);
    if (parsed.success) return parsed.data;
  }
  return undefined;
}

/** Cookie wins, then the browser's languages, then the default. */
export function resolveLocale(
  cookieValue: string | undefined,
  acceptLanguage: string | null,
): Locale {
  const fromCookie = localeSchema.safeParse(cookieValue);
  if (fromCookie.success) return fromCookie.data;
  return localeFromAcceptLanguage(acceptLanguage) ?? defaultLocale;
}
