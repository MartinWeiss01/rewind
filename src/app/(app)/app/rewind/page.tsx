import { ChevronLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { match } from "ts-pattern";
import { StatePanel } from "@/components/feedback/state-panel";
import { alert, buttonClass } from "@/components/ui/styles";
import { loadRecap, MIN_ACTIVE_DAYS } from "@/features/recap/load-recap";
import { parseRecapSearch, RecapPreset, summerYear } from "@/features/recap/period";
import { PeriodPicker } from "@/features/recap/period-picker";
import { RecapDeck } from "@/features/recap/recap-deck";
import { dateFromKey } from "@/features/stats/labels";
import type { SearchParams } from "@/lib/search-params";
import { dayKey, zonedParts } from "@/lib/time-zone";
import { FeatureFlag } from "@/server/feature-flags";
import { requireFlag } from "@/server/require-flag";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("recap");
  return { title: t("metaTitle") };
}

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { source, now } = await requireFlag(FeatureFlag.Stats);
  const rules = await source.getListeningRules();
  const { period, invalid } = parseRecapSearch(await searchParams, now, rules.timeZone);
  const [t, format, data] = await Promise.all([
    getTranslations("recap"),
    getFormatter(),
    loadRecap(source, period, now),
  ]);

  const shortDay = (key: string) =>
    format.dateTime(dateFromKey(key), {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  const year = zonedParts(now, rules.timeZone).year;
  const presetLabels: Record<RecapPreset, string> = {
    [RecapPreset.ThisYear]: t("presets.year", { year: String(year) }),
    [RecapPreset.LastYear]: t("presets.year", { year: String(year - 1) }),
    [RecapPreset.Last30Days]: t("presets.last30Days"),
    [RecapPreset.Summer]: t("presets.summer", { year: String(summerYear(now, rules.timeZone)) }),
  };
  const periodLabel = match(period)
    .with({ kind: "preset" }, ({ preset }) => presetLabels[preset])
    .with({ kind: "custom" }, ({ from, to }) =>
      format.dateTimeRange(dateFromKey(from), dateFromKey(to), {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      }),
    )
    .exhaustive();

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link href="/app" className={buttonClass("secondary", "sm")}>
          <ChevronLeftIcon size={16} aria-hidden="true" />
          {t("back")}
        </Link>
        <PeriodPicker
          period={period}
          presetLabels={presetLabels}
          today={dayKey(now, rules.timeZone)}
        />
      </div>
      {invalid ? (
        <div role="alert" className={`${alert.base} ${alert.tone.danger}`}>
          {t("invalidPeriod")}
        </div>
      ) : null}
      {data.activeDays < MIN_ACTIVE_DAYS ? (
        <>
          <h1 className="sr-only">{t("title", { period: periodLabel })}</h1>
          <StatePanel
            title={t("emptyTitle")}
            body={t("emptyBody", { days: MIN_ACTIVE_DAYS })}
            action={
              <Link href="/app/history" className={buttonClass("primary", "sm")}>
                {t("importHistory")}
              </Link>
            }
          />
        </>
      ) : (
        <RecapDeck
          data={data}
          periodLabel={periodLabel}
          dates={{
            firstFind: data.firstFind
              ? format.dateTime(new Date(data.firstFind.firstPlayedAt), {
                  month: "short",
                  day: "numeric",
                  timeZone: rules.timeZone,
                })
              : null,
            longestStreak: data.longestStreak
              ? `${shortDay(data.longestStreak.start)} – ${shortDay(data.longestStreak.end)}`
              : null,
          }}
        />
      )}
    </>
  );
}
