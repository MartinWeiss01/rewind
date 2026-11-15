import type { MusicDataSource } from "@/data/music-data-source";
import { intervalFor, previousInterval, type TimeRange } from "@/domain/time-range";
import { buildDashboard, type DashboardData } from "./build-dashboard";

/** Reads what the dashboard needs from the data source and computes it. */
export async function loadDashboard(
  source: MusicDataSource,
  range: TimeRange,
  now: Date,
): Promise<DashboardData> {
  const interval = intervalFor(range, now);
  const previous = previousInterval(interval);
  const [rules, profile, current, before, all] = await Promise.all([
    source.getListeningRules(),
    source.getProfile(),
    source.getListening(interval),
    source.getListening(previous),
    source.getListening({ start: new Date(0), end: new Date(now.getTime() + 1) }),
  ]);
  return buildDashboard({
    range,
    interval,
    previous,
    now,
    rules,
    displayName: profile.displayName,
    current,
    before,
    all,
  });
}
