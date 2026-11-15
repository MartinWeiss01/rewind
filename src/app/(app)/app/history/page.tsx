import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { StatePanel } from "@/components/feedback/state-panel";
import { buttonClass, chipClass } from "@/components/ui/styles";
import { DataMode } from "@/data/music-data-source";
import { HistoryFilters } from "@/features/history/history-filters";
import { HistoryPagination } from "@/features/history/history-pagination";
import { ImportPanel } from "@/features/history/import-panel";
import { type HistoryRow, PlaysTable } from "@/features/history/plays-table";
import { hasActiveFilters, parseHistorySearch, toPlayQuery } from "@/features/history/query";
import { toTrackItem } from "@/features/stats/view";
import { formatClock } from "@/lib/format";
import type { SearchParams } from "@/lib/search-params";
import { zonedParts } from "@/lib/time-zone";
import { FeatureFlag } from "@/server/feature-flags";
import { requireFlag } from "@/server/require-flag";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("screens.history");
  return { title: t("title") };
}

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { source, now } = await requireFlag(FeatureFlag.Stats);
  const filters = parseHistorySearch(await searchParams);
  const rules = await source.getListeningRules();
  const [t, format, page, lastSyncAt] = await Promise.all([
    getTranslations(),
    getFormatter(),
    source.listPlays(toPlayQuery(filters, now, rules.timeZone)),
    source.getLastSyncAt(),
  ]);

  const thisYear = zonedParts(now, rules.timeZone).year;
  const rows: HistoryRow[] = page.rows.map((play) => ({
    key: `${play.trackId}@${play.playedAt.getTime()}@${play.source}`,
    played: format.dateTime(play.playedAt, {
      month: "short",
      day: "numeric",
      year: zonedParts(play.playedAt, rules.timeZone).year === thisYear ? undefined : "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: rules.timeZone,
    }),
    listened: formatClock(play.msPlayed),
    skipped: play.skipped,
    source: play.source,
    album: play.track.album.name,
    track: toTrackItem(play.track),
  }));

  const filtered = hasActiveFilters(filters);

  return (
    <>
      <ImportPanel
        eyebrow={t("screens.history.eyebrow")}
        title={t("screens.history.title")}
        isDemo={source.mode === DataMode.Demo}
        status={
          lastSyncAt ? (
            <span className={chipClass("mint")}>
              <span aria-hidden="true" className="size-2 rounded-full bg-mint" />
              {t("history.synced", { when: format.relativeTime(lastSyncAt, now) })}
            </span>
          ) : null
        }
      />
      <section aria-labelledby="plays-title" className="flex flex-col gap-3.5">
        <h2 id="plays-title" className="sr-only">
          {t("history.plays")}
        </h2>
        <HistoryFilters filters={filters} />
        {page.total === 0 || rows.length === 0 ? (
          <StatePanel
            title={t(filtered ? "history.noMatchTitle" : "history.emptyTitle")}
            body={t(filtered ? "history.noMatchBody" : "history.emptyBody")}
            action={
              filtered || page.total > 0 ? (
                <Link href="/app/history" className={buttonClass("secondary", "sm")}>
                  {t("history.clearFilters")}
                </Link>
              ) : null
            }
          />
        ) : (
          <>
            <PlaysTable rows={rows} filters={filters} />
            <HistoryPagination filters={filters} total={page.total} />
          </>
        )}
      </section>
    </>
  );
}
