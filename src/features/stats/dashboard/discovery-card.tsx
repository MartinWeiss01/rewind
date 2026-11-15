import { getFormatter, getTranslations } from "next-intl/server";
import { Cover } from "@/components/ui/cover";
import { card, chipClass } from "@/components/ui/styles";
import { num } from "../ui";
import type { DashboardData } from "./build-dashboard";

function Bar({ label, share, strong }: { label: string; share: number; strong: boolean }) {
  return (
    <div className="flex flex-nowrap items-center gap-2 text-sm">
      <span className="w-16 font-mono">{label}</span>
      <div className="h-2 grow overflow-hidden rounded-full bg-surface">
        <span
          className={`block h-full rounded-full ${strong ? "bg-ink" : "bg-[color-mix(in_oklab,var(--ink)_45%,var(--surface))]"}`}
          style={{ width: `${Math.round(share * 100)}%` }}
        />
      </div>
    </div>
  );
}

/** Share of plays from artists first heard in the period, compared with the period before. */
export async function DiscoveryCard({ discovery }: { discovery: DashboardData["discovery"] }) {
  const t = await getTranslations("dashboard");
  const format = await getFormatter();
  const percent = (value: number) =>
    format.number(value, { style: "percent", maximumFractionDigits: 0 });
  const more = discovery.newArtistCount - discovery.artists.length;

  return (
    <section
      aria-labelledby="disc-title"
      className={`${card} flex flex-col gap-3 border-transparent bg-violet-soft`}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="disc-title" className="eyebrow m-0 text-ink">
          {t("discovery")}
        </h2>
        {discovery.previousShare !== null ? (
          <span className={chipClass("neutral", "h-6 border-0 bg-surface")}>
            {t("previousShare", { percent: percent(discovery.previousShare) })}
          </span>
        ) : null}
      </div>
      <span className={`${num} text-[72px] leading-none`}>{percent(discovery.share)}</span>
      <p className="m-0 text-sm">
        {t(discovery.scope === "range" ? "discoveryText" : "discoveryTextLast4Weeks", {
          count: discovery.newArtistCount,
        })}
      </p>
      <div className="flex flex-col gap-1.5" aria-hidden="true">
        <Bar label={t("nowLabel")} share={discovery.share} strong />
        {discovery.previousShare !== null ? (
          <Bar label={t("beforeLabel")} share={discovery.previousShare} strong={false} />
        ) : null}
      </div>
      {discovery.artists.length > 0 ? (
        <div className="mt-auto flex items-center">
          <ul aria-label={t("newArtists")} className="m-0 flex list-none p-0">
            {discovery.artists.map((artist) => (
              <li key={artist.id} title={artist.name} className="-mr-2">
                <Cover
                  cover={artist.cover}
                  size={36}
                  shape="round"
                  className="border-2 border-violet-soft"
                />
                <span className="sr-only">{artist.name}</span>
              </li>
            ))}
          </ul>
          {more > 0 ? (
            <span className="ml-[18px] font-semibold text-sm">
              {t("moreArtists", { count: more })}
            </span>
          ) : null}
        </div>
      ) : (
        <p className="m-0 mt-auto text-muted text-sm">{t("noDiscoveries")}</p>
      )}
    </section>
  );
}
