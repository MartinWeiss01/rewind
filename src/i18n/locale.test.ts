import { describe, expect, it } from "vitest";
import { localeFromAcceptLanguage, resolveLocale } from "./locale";

describe("localeFromAcceptLanguage", () => {
  it("picks the highest ranked supported language", () => {
    expect(localeFromAcceptLanguage("de-DE,cs;q=0.8,en;q=0.5")).toBe("cs");
  });

  it("ignores languages with zero weight", () => {
    expect(localeFromAcceptLanguage("cs;q=0,en;q=0.4")).toBe("en");
  });

  it("returns undefined when nothing matches", () => {
    expect(localeFromAcceptLanguage("de,fr")).toBeUndefined();
    expect(localeFromAcceptLanguage(null)).toBeUndefined();
  });
});

describe("resolveLocale", () => {
  it("prefers a valid cookie over the header", () => {
    expect(resolveLocale("cs", "en-US")).toBe("cs");
  });

  it("ignores an invalid cookie", () => {
    expect(resolveLocale("xx", "cs-CZ")).toBe("cs");
  });

  it("falls back to English", () => {
    expect(resolveLocale(undefined, null)).toBe("en");
  });
});
