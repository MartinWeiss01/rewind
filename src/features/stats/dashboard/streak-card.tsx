import { getFormatter, getTranslations } from "next-intl/server";
import { match } from "ts-pattern";
import { card } from "@/components/ui/styles";
import { dateFromKey } from "../labels";
import { num } from "../ui";
import type { DashboardData, DayLevel } from "./build-dashboard";

const levelClass = (level: DayLevel) =>
  match(level)
    .with(0, () => "bg-surface")
    .with(1, () => "bg-[color-mix(in_oklab,var(--ink)_20%,var(--butter-soft))]")
    .with(2, () => "bg-[color-mix(in_oklab,var(--ink)_45%,var(--butter-soft))]")
    .with(3, () => "bg-ink")
    .exhaustive();

/** Current streak, the last 8 weeks as 14 × 4 day squares, and the longest streak. */
export async function StreakCard({ streak }: { streak: DashboardData["streak"] }) {
  const t = await getTranslations("dashboard");
  const format = await getFormatter();
  const dayOptions = { month: "short", day: "numeric", timeZone: "UTC" } as const;
  const lastIndex = streak.days.length - 1;

  return (
    <section
      aria-labelledby="streak-title"
      className={`${card} flex flex-col gap-3 border-transparent bg-butter-soft`}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="streak-title" className="eyebrow m-0 text-ink">
          {t("streak")}
        </h2>
        <span className="font-mono text-sm">
          {t("activeDays", { active: streak.activeCount, total: streak.days.length })}
        </span>
      </div>
      <div className="flex items-baseline gap-2.5">
        <span className={`${num} text-[72px] leading-none`}>{format.number(streak.current)}</span>
        <span className="font-semibold text-[15px]">
          {t("daysInRow", { count: streak.current })}
        </span>
      </div>
      <ol aria-label={t("streakLabel")} className="m-0 grid list-none grid-cols-14 gap-1 p-0">
        {streak.days.map((day, i) => {
          const label = t("dayTitle", {
            date: format.dateTime(dateFromKey(day.day), dayOptions),
            minutes: Math.round(day.minutes),
          });
          return (
            <li
              key={day.day}
              title={label}
              aria-current={i === lastIndex ? "date" : undefined}
              className={`aspect-square rounded-[4px] ${levelClass(day.level)} aria-[current=date]:outline-2 aria-[current=date]:outline-ink aria-[current=date]:outline-offset-1`}
            >
              <span className="sr-only">{label}</span>
            </li>
          );
        })}
      </ol>
      <div className="flex justify-between font-mono text-sm">
        <span>{t("weeksAgo")}</span>
        <span>{t("today")}</span>
      </div>
      <p className="m-0 text-sm">
        {streak.longest
          ? t("longest", {
              count: streak.longest.days,
              range: format.dateTimeRange(
                dateFromKey(streak.longest.start),
                dateFromKey(streak.longest.end),
                { ...dayOptions, year: "numeric" },
              ),
            })
          : t("noStreak")}
      </p>
    </section>
  );
}
