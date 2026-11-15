import type { DashboardData } from "./build-dashboard";
import { DiscoveryCard } from "./discovery-card";
import { HeatmapCard } from "./heatmap-card";
import { OnRepeatCard } from "./on-repeat-card";
import { PosterHero } from "./poster-hero";
import { StreakCard } from "./streak-card";
import { TopCard } from "./top-card";
import { TrendCard } from "./trend-card";

/** The dashboard deck: poster, then a dense grid of tiles. */
export function DashboardView({
  data,
  periodLabel,
  greeting,
}: {
  data: DashboardData;
  periodLabel: string;
  greeting: string;
}) {
  return (
    <>
      <PosterHero
        periodLabel={periodLabel}
        greeting={greeting}
        overview={data.overview}
        activeDays={data.activeDays}
        tracks={data.top.plays.tracks.slice(0, 5)}
      />
      <div className="grid grid-flow-dense grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <HeatmapCard heatmap={data.heatmap} />
        <StreakCard streak={data.streak} />
        <DiscoveryCard discovery={data.discovery} />
        <TopCard top={data.top} />
        <OnRepeatCard items={data.onRepeat} timeZone={data.timeZone} />
        <TrendCard trend={data.trend} />
      </div>
    </>
  );
}
