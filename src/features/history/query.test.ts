import { describe, expect, it } from "vitest";
import { PlaySort } from "@/data/music-data-source";
import {
  defaultHistoryFilters,
  HISTORY_PAGE_SIZE,
  hasActiveFilters,
  historyHref,
  parseHistorySearch,
  SourceFilter,
  toPlayQuery,
} from "./query";

describe("parseHistorySearch", () => {
  it("returns defaults for an empty URL", () => {
    expect(parseHistorySearch({})).toEqual(defaultHistoryFilters);
  });

  it("reads every filter", () => {
    expect(
      parseHistorySearch({
        q: "  invented ",
        from: "2026-01-01",
        to: "2026-02-01",
        source: "imported",
        skips: "1",
        sort: "longest",
        page: "3",
      }),
    ).toEqual({
      q: "invented",
      from: "2026-01-01",
      to: "2026-02-01",
      source: SourceFilter.Imported,
      skips: true,
      sort: PlaySort.Longest,
      page: 3,
    });
  });

  it("falls back on invalid values and swaps a reversed range", () => {
    expect(
      parseHistorySearch({
        from: "2026-03-01",
        to: "2026-01-01",
        source: "radio",
        sort: "random",
        page: "-2",
        skips: "yes",
      }),
    ).toEqual({ ...defaultHistoryFilters, from: "2026-01-01", to: "2026-03-01" });
  });

  it("takes the first of repeated params", () => {
    expect(parseHistorySearch({ page: ["2", "5"] }).page).toBe(2);
  });
});

describe("historyHref", () => {
  it("omits defaults", () => {
    expect(historyHref(defaultHistoryFilters)).toBe("/app/history");
  });

  it("applies a patch", () => {
    expect(historyHref({ ...defaultHistoryFilters, q: "lo fi" }, { page: 2 })).toBe(
      "/app/history?q=lo+fi&page=2",
    );
  });
});

describe("hasActiveFilters", () => {
  it("ignores page and sort", () => {
    expect(hasActiveFilters({ ...defaultHistoryFilters, page: 4, sort: PlaySort.Oldest })).toBe(
      false,
    );
    expect(hasActiveFilters({ ...defaultHistoryFilters, skips: true })).toBe(true);
  });
});

describe("toPlayQuery", () => {
  const now = new Date("2026-11-15T12:00:00Z");

  it("maps whole local days to an interval", () => {
    const query = toPlayQuery(
      { ...defaultHistoryFilters, from: "2026-11-01", to: "2026-11-02" },
      now,
      "Europe/Berlin",
    );
    expect(query.interval.start.toISOString()).toBe("2026-10-31T23:00:00.000Z");
    expect(query.interval.end.toISOString()).toBe("2026-11-02T23:00:00.000Z");
    expect(query.pageSize).toBe(HISTORY_PAGE_SIZE);
  });

  it("includes plays up to now without a range", () => {
    const query = toPlayQuery(defaultHistoryFilters, now, "UTC");
    expect(query.interval.start.getTime()).toBe(0);
    expect(query.interval.end.getTime()).toBeGreaterThan(now.getTime());
  });
});
