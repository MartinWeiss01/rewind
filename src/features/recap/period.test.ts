import { describe, expect, it } from "vitest";
import {
  defaultRecapPeriod,
  parseRecapSearch,
  RecapPreset,
  recapInterval,
  recapSearch,
} from "./period";

const now = new Date("2026-11-15T12:00:00Z");
const zone = "Europe/Berlin";

describe("parseRecapSearch", () => {
  it("defaults to this year", () => {
    expect(parseRecapSearch({}, now, zone)).toEqual({ period: defaultRecapPeriod, invalid: false });
  });

  it("reads a preset", () => {
    expect(parseRecapSearch({ period: "summer" }, now, zone).period).toEqual({
      kind: "preset",
      preset: RecapPreset.Summer,
    });
  });

  it("flags an unknown preset", () => {
    expect(parseRecapSearch({ period: "decade" }, now, zone)).toEqual({
      period: defaultRecapPeriod,
      invalid: true,
    });
  });

  it("accepts a valid custom range", () => {
    expect(parseRecapSearch({ from: "2026-02-01", to: "2026-03-31" }, now, zone).period).toEqual({
      kind: "custom",
      from: "2026-02-01",
      to: "2026-03-31",
    });
  });

  it.each([
    [{ from: "2026-03-31", to: "2026-02-01" }],
    [{ from: "2026-02-01" }],
    [{ from: "2026-02-30", to: "2026-03-01" }],
    [{ from: "2026-11-01", to: "2026-11-20" }],
    [{ from: "2020-01-01", to: "2026-01-01" }],
  ])("rejects %j", (params) => {
    expect(parseRecapSearch(params, now, zone).invalid).toBe(true);
  });
});

describe("recapInterval", () => {
  it("starts this year at local midnight on Jan 1 and ends now", () => {
    const interval = recapInterval({ kind: "preset", preset: RecapPreset.ThisYear }, now, zone);
    expect(interval.start.toISOString()).toBe("2025-12-31T23:00:00.000Z");
    expect(interval.end).toEqual(now);
  });

  it("covers the whole of last year", () => {
    const interval = recapInterval({ kind: "preset", preset: RecapPreset.LastYear }, now, zone);
    expect(interval.start.toISOString()).toBe("2024-12-31T23:00:00.000Z");
    expect(interval.end.toISOString()).toBe("2025-12-31T23:00:00.000Z");
  });

  it("uses last summer before June", () => {
    const spring = new Date("2026-04-10T12:00:00Z");
    const interval = recapInterval({ kind: "preset", preset: RecapPreset.Summer }, spring, zone);
    expect(interval.start.toISOString()).toBe("2025-05-31T22:00:00.000Z");
    expect(interval.end.toISOString()).toBe("2025-08-31T22:00:00.000Z");
  });

  it("includes the whole last day of a custom range but never the future", () => {
    const interval = recapInterval(
      { kind: "custom", from: "2026-11-01", to: "2026-11-15" },
      now,
      zone,
    );
    expect(interval.start.toISOString()).toBe("2026-10-31T23:00:00.000Z");
    expect(interval.end).toEqual(now);
  });
});

describe("recapSearch", () => {
  it("leaves the default out of the URL", () => {
    expect(recapSearch(defaultRecapPeriod)).toBe("");
    expect(recapSearch({ kind: "custom", from: "2026-01-01", to: "2026-02-01" })).toBe(
      "?from=2026-01-01&to=2026-02-01",
    );
  });
});
