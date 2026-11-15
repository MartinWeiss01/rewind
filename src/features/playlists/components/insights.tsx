import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import type { PlaylistInsights } from "../tools";

const barColors = ["bg-violet", "bg-coral", "bg-mint", "bg-butter", "bg-ink-2"];

/** Side panels: artists by number of tracks, tracks added per month, your plays. */
export async function Insights({
  insights,
  plays,
}: {
  insights: PlaylistInsights;
  /** Plays from this list in the last year and how many tracks were never played; null without stats. */
  plays: { total: number; unplayed: number } | null;
}) {
  const t = await getTranslations("playlists.insights");
  const format = await getFormatter();
  const maxArtist = insights.topArtists[0]?.tracks ?? 1;
  const maxMonth = Math.max(1, ...insights.addedByMonth.map((m) => m.count));
  const busiest = insights.addedByMonth.reduce(
    (best, m) => (m.count > best.count ? m : best),
    insights.addedByMonth[0] ?? { month: "", count: 0 },
  );
  const monthLabel = (key: string) => {
    const [year = 2000, month = 1] = key.split("-").map(Number);
    return format.dateTime(new Date(Date.UTC(year, month - 1, 15)), {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    });
  };
  const first = insights.addedByMonth[0];
  const last = insights.addedByMonth.at(-1);
  const card = "flex flex-col gap-4 rounded-3xl border border-line bg-surface p-[22px]";

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-4">
      <section aria-labelledby="top-artists-heading" className={card}>
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="top-artists-heading" className="m-0 font-semibold text-[15px]">
            {t("topArtists")}
          </h2>
          <span className="eyebrow">{t("byTracks")}</span>
        </div>
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {insights.topArtists.map(({ artist, tracks }, i) => (
            <li key={artist.id} className="flex flex-col gap-1.5">
              <div className="flex justify-between gap-2 text-sm">
                <span className="truncate">{artist.name}</span>
                <span className="shrink-0 font-mono text-muted">
                  {t("tracks", { count: tracks })}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                <span
                  className={`block h-full rounded-full ${barColors[i % barColors.length]}`}
                  style={{ width: `${(tracks / maxArtist) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="added-heading" className={card}>
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="added-heading" className="m-0 font-semibold text-[15px]">
            {t("addedOverTime")}
          </h2>
          <span className="eyebrow">{t("perMonth")}</span>
        </div>
        <div
          role="img"
          aria-label={
            busiest.count > 0
              ? t("addedLabel", { month: monthLabel(busiest.month) })
              : t("addedNone")
          }
          className="flex h-[130px] items-end gap-[3px]"
        >
          {insights.addedByMonth.map((m) => (
            <span
              key={m.month}
              className="min-w-0 flex-1 rounded-t-md rounded-b-sm bg-coral"
              style={{
                height: `${Math.max(3, (m.count / maxMonth) * 100)}%`,
                opacity: m.count ? 1 : 0.25,
              }}
            />
          ))}
        </div>
        {first && last ? (
          <div className="flex justify-between font-mono text-muted text-xs">
            <span>{monthLabel(first.month)}</span>
            <span>{monthLabel(last.month)}</span>
          </div>
        ) : null}
      </section>

      {plays ? (
        <section aria-labelledby="plays-heading" className={card}>
          <h2 id="plays-heading" className="m-0 font-semibold text-[15px]">
            {t("yourPlays")}
          </h2>
          <div className="font-display font-extrabold text-[44px] leading-none">
            {format.number(plays.total)}
          </div>
          <div className="text-muted text-sm">{t("playsBody", { unplayed: plays.unplayed })}</div>
          <Link href="/app" className="text-ink text-sm">
            <b>{t("seeStats")}</b>
          </Link>
        </section>
      ) : null}
    </div>
  );
}
