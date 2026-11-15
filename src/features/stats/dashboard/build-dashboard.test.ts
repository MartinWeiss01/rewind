import { describe, expect, it } from "vitest";
import { createDemoDataSource } from "@/data/demo/demo-data-source";
import { persona } from "@/demo/persona";
import { emptyDemoSessionState } from "@/demo/session-state";
import { TimeRange } from "@/domain/time-range";
import { Bucket, Metric } from "../engine";
import { dayLevel, Greeting, greetingFor, STREAK_DAYS } from "./build-dashboard";
import { loadDashboard } from "./load-dashboard";

describe("greetingFor", () => {
  it.each([
    [6, Greeting.Morning],
    [12, Greeting.Afternoon],
    [21, Greeting.Evening],
    [2, Greeting.Night],
  ])("hour %i is %s", (hour, greeting) => {
    expect(greetingFor(hour)).toBe(greeting);
  });
});

describe("dayLevel", () => {
  it("buckets minutes", () => {
    expect([0, 5, 30, 90].map(dayLevel)).toEqual([0, 1, 2, 3]);
  });
});

describe("loadDashboard with demo data", () => {
  const now = new Date("2026-11-15T18:00:00Z");
  const source = createDemoDataSource({
    state: emptyDemoSessionState(persona.timeZone),
    commit: async () => {},
    now,
  });

  it("fills every section for the last 4 weeks", async () => {
    const data = await loadDashboard(source, TimeRange.Last4Weeks, now);
    expect(data.overview.plays).toBeGreaterThan(0);
    expect(data.top[Metric.Plays].tracks.length).toBeGreaterThan(0);
    expect(data.streak.days).toHaveLength(STREAK_DAYS);
    expect(data.streak.days.at(-1)?.day).toBe("2026-11-15");
    expect(data.trend[Bucket.Day].length).toBeGreaterThanOrEqual(28);
    expect(data.heatmap.cells).toHaveLength(7);
    // Everything crosses to client components, so it must survive JSON.
    expect(JSON.parse(JSON.stringify(data))).toEqual(data);
  });

  it("uses a 4-week discovery window for all time", async () => {
    const data = await loadDashboard(source, TimeRange.AllTime, now);
    expect(data.start).toBeNull();
    expect(data.discovery.scope).toBe("last4Weeks");
  });
});
