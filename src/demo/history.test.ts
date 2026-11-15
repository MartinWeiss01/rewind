import { describe, expect, it } from "vitest";
import { dayKey } from "@/lib/time-zone";
import { buildCatalog } from "./catalog";
import { generateHistory } from "./history";
import { persona } from "./persona";

const now = new Date("2026-11-15T20:00:00Z");
const catalog = buildCatalog(persona);

describe("demo history", () => {
  it("is deterministic", () => {
    const a = generateHistory(persona, catalog, now);
    const b = generateHistory(persona, catalog, now);
    expect(a.length).toBe(b.length);
    expect(a.slice(0, 50)).toEqual(b.slice(0, 50));
  });

  it("only references catalog tracks and never plays in the future", () => {
    const plays = generateHistory(persona, catalog, now);
    expect(plays.length).toBeGreaterThan(8000);
    expect(plays.every((p) => catalog.trackById.has(p.trackId) && p.playedAt <= now)).toBe(true);
  });

  it("has a streak running up to today", () => {
    const days = new Set(
      generateHistory(persona, catalog, now).map((p) => dayKey(p.playedAt, persona.timeZone)),
    );
    expect(days.has(dayKey(now, persona.timeZone))).toBe(true);
  });
});
