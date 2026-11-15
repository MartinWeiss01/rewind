import { describe, expect, it } from "vitest";
import { dayKey, epochDay, keyFromEpochDay, zonedParts, zonedTimeToUtc } from "./time-zone";

describe("time zone helpers", () => {
  it("reads local parts with Monday as 0", () => {
    // 2026-11-15 is a Sunday.
    const parts = zonedParts(new Date("2026-11-15T23:30:00Z"), "Europe/Berlin");
    expect(parts).toMatchObject({ year: 2026, month: 11, day: 16, hour: 0, weekday: 0 });
  });

  it("keys days in the given zone", () => {
    expect(dayKey(new Date("2026-11-15T23:30:00Z"), "UTC")).toBe("2026-11-15");
    expect(dayKey(new Date("2026-11-15T23:30:00Z"), "Europe/Berlin")).toBe("2026-11-16");
  });

  it("round-trips epoch days", () => {
    expect(keyFromEpochDay(epochDay("2026-03-29"))).toBe("2026-03-29");
  });

  it("converts local wall time to an instant across daylight saving", () => {
    expect(
      zonedTimeToUtc(
        { year: 2026, month: 7, day: 1, hour: 21, minute: 0 },
        "Europe/Berlin",
      ).toISOString(),
    ).toBe("2026-07-01T19:00:00.000Z");
    expect(
      zonedTimeToUtc(
        { year: 2026, month: 1, day: 1, hour: 21, minute: 0 },
        "Europe/Berlin",
      ).toISOString(),
    ).toBe("2026-01-01T20:00:00.000Z");
  });
});
