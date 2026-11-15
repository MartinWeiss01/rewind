import { describe, expect, it } from "vitest";
import { formatClock, initials, splitHours } from "./format";

describe("format", () => {
  it("formats clock times", () => {
    expect(formatClock(227_000)).toBe("3:47");
    expect(formatClock(3_725_000)).toBe("1:02:05");
    expect(formatClock(-5)).toBe("0:00");
  });
  it("splits hours", () => {
    expect(splitHours(15_120_000)).toEqual({ hours: 4, minutes: 12 });
  });
  it("builds initials", () => {
    expect(initials("Juno  Park")).toBe("JP");
    expect(initials("Solo")).toBe("S");
  });
});
