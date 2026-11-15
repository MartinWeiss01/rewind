import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { ScreenHeader } from "@/components/feedback/screen-header";
import { StatePanel } from "@/components/feedback/state-panel";
import { buttonClass } from "@/components/ui/styles";
import { DashboardView } from "@/features/stats/dashboard/dashboard-view";
import { loadDashboard } from "@/features/stats/dashboard/load-dashboard";
import { RangeSwitch } from "@/features/stats/dashboard/range-switch";
import { parseDashboardSearch } from "@/features/stats/dashboard/search";
import type { SearchParams } from "@/lib/search-params";
import { FeatureFlag } from "@/server/feature-flags";
import { getRequestContext } from "@/server/request-context";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("screens.dashboard");
  return { title: t("title") };
}

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { source, flags, now } = await getRequestContext();
  // The dashboard is all statistics; without the flag the app starts at playlists (ADR 0004).
  if (!flags.has(FeatureFlag.Stats)) redirect("/app/playlists");

  const { range } = parseDashboardSearch(await searchParams);
  const [t, format, data] = await Promise.all([
    getTranslations(),
    getFormatter(),
    loadDashboard(source, range, now),
  ]);

  const firstDay = data.trend.day.find((point) => point.minutes > 0)?.key;
  const rangeName = t(`dashboard.ranges.${range}`);
  const periodLabel = data.start
    ? `${rangeName} · ${format.dateTimeRange(new Date(data.start), new Date(data.end), {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: data.timeZone,
      })}`
    : firstDay
      ? `${rangeName} · ${t("dashboard.since", {
          date: format.dateTime(new Date(`${firstDay}T12:00:00Z`), {
            month: "short",
            year: "numeric",
            timeZone: "UTC",
          }),
        })}`
      : rangeName;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <ScreenHeader
          eyebrow={t("screens.dashboard.eyebrow")}
          title={t("screens.dashboard.title")}
        />
        <RangeSwitch range={range} />
      </div>
      {data.overview.plays === 0 ? (
        <StatePanel
          title={t("dashboard.emptyTitle")}
          body={t("dashboard.emptyBody")}
          action={
            <Link href="/app/history" className={buttonClass("primary", "sm")}>
              {t("dashboard.importHistory")}
            </Link>
          }
        />
      ) : (
        <DashboardView
          data={data}
          periodLabel={periodLabel}
          greeting={t(`dashboard.greeting.${data.greeting}`, {
            name: data.displayName.split(/\s+/)[0] ?? data.displayName,
          })}
        />
      )}
    </>
  );
}
