import { getFormatter, getTranslations } from "next-intl/server";
import { Cover } from "@/components/ui/cover";
import { card, chipClass, heading } from "@/components/ui/styles";
import { cardHeader } from "../ui";
import type { DashboardData } from "./build-dashboard";

/** Tracks played three or more times in the last two weeks. */
export async function OnRepeatCard({
  items,
  timeZone,
}: {
  items: DashboardData["onRepeat"];
  timeZone: string;
}) {
  const t = await getTranslations("dashboard");
  const format = await getFormatter();

  return (
    <section aria-labelledby="repeat-title" className={`${card} md:col-span-2`}>
      <div className={cardHeader}>
        <h2 id="repeat-title" className={heading.h2}>
          {t("onRepeat")}
        </h2>
        <span className="eyebrow">{t("onRepeatHint")}</span>
      </div>
      {items.length === 0 ? (
        <p className="m-0 py-6 text-center text-muted text-sm">{t("onRepeatEmpty")}</p>
      ) : (
        <ul className="m-0 grid list-none grid-cols-1 gap-2.5 p-0 sm:grid-cols-2">
          {items.map(({ track, plays, lastPlayedAt }) => (
            <li key={track.id} className="flex items-center gap-3 rounded-[18px] bg-surface-2 p-3">
              <Cover cover={track.cover} size={72} />
              <div className="min-w-0">
                <div className="truncate font-semibold text-[15px]">{track.name}</div>
                <div className="truncate text-muted text-sm">{track.artists}</div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className={chipClass("coral", "h-[22px]")}>
                    {t("times", { count: plays })}
                  </span>
                  <span className="font-mono text-muted text-xs">
                    {t("lastPlayed", {
                      date: format.dateTime(new Date(lastPlayedAt), {
                        month: "short",
                        day: "numeric",
                        timeZone,
                      }),
                    })}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
