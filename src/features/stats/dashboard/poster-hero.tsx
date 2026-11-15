"use client";

import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { Cover } from "@/components/ui/cover";
import { buttonClass } from "@/components/ui/styles";
import type { Overview } from "../engine";
import { blob, blobLine, num, rule } from "../ui";
import type { RankedTrack } from "../view";

const tints = ["bg-violet-soft", "bg-coral-soft", "bg-mint-soft", "bg-butter-soft"] as const;

function Arrow({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d={direction === "left" ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} />
    </svg>
  );
}

/** The dashboard's poster: listening time, top five tracks with a featured cover, and KPIs. */
export function PosterHero({
  periodLabel,
  greeting,
  overview,
  activeDays,
  tracks,
}: {
  periodLabel: string;
  greeting: string;
  overview: Overview;
  activeDays: number;
  tracks: readonly RankedTrack[];
}) {
  const t = useTranslations("dashboard");
  const format = useFormatter();
  const [index, setIndex] = useState(0);
  const current = tracks[index];
  const hours = Math.round(overview.minutes / 60);
  const go = (next: number) => setIndex((next + tracks.length) % tracks.length);

  const change =
    overview.minutesChange === null
      ? t("noComparison")
      : t(overview.minutesChange >= 0 ? "changeUp" : "changeDown", {
          percent: format.number(Math.abs(overview.minutesChange), {
            style: "percent",
            maximumFractionDigits: 0,
          }),
        });

  const kpis = [
    { key: "plays", value: overview.plays },
    { key: "tracks", value: overview.distinctTracks },
    { key: "artists", value: overview.distinctArtists },
    { key: "activeDays", value: activeDays },
  ] as const;

  return (
    <section
      aria-labelledby="hero-title"
      className="relative grid min-h-[600px] min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] items-stretch overflow-hidden rounded-[36px] border border-line bg-surface shadow-[0_1px_0_rgba(23,20,15,.04),0_24px_48px_-24px_rgba(60,40,10,.22)]"
    >
      <div aria-hidden="true" className={`${rule} top-[70%] left-0 w-[140%] -rotate-[11deg]`} />
      <div
        aria-hidden="true"
        className={`${rule} -top-[60px] left-[38%] w-[900px] rotate-[80deg]`}
      />
      <div
        aria-hidden="true"
        className={`${rule} -top-[60px] left-[70%] w-[900px] rotate-[98deg]`}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[14%] -left-[1%] -rotate-[11deg] whitespace-nowrap font-display font-extrabold text-[clamp(90px,13vw,200px)] text-transparent leading-[0.95] tracking-[-0.03em] opacity-90 [-webkit-text-stroke:2px_var(--ink)]"
      >
        {t("hoursBig", { hours })}
      </div>

      <div className="relative z-[2] flex flex-col gap-3.5 p-8">
        <span className="eyebrow">{periodLabel}</span>
        <h1
          id="hero-title"
          className="m-0 font-display font-extrabold text-[40px] leading-[1.05] tracking-tight"
        >
          {greeting}
        </h1>
        {tracks.length > 0 ? (
          <ol aria-label={t("topTracks")} className="m-0 mt-2.5 flex list-none flex-col gap-1 p-0">
            {tracks.map((track, i) => (
              <li key={track.id}>
                <button
                  type="button"
                  aria-pressed={i === index}
                  onClick={() => setIndex(i)}
                  className="flex min-h-9 cursor-pointer items-baseline gap-2.5 border-0 bg-transparent py-1.5 text-left text-base text-muted aria-pressed:font-bold aria-pressed:text-ink"
                >
                  <span className="font-mono text-xs">{String(i + 1).padStart(2, "0")}</span>
                  {track.name}
                </button>
              </li>
            ))}
          </ol>
        ) : null}
        <div className="mt-auto flex flex-col gap-0.5">
          <span className="eyebrow">{t("listeningTime")}</span>
          <span className={`${num} text-[52px] leading-none`}>
            {format.number(hours, { style: "unit", unit: "hour", unitDisplay: "narrow" })}
          </span>
          <span className="text-muted text-sm">{change}</span>
        </div>
      </div>

      <div className="relative z-[2] grid place-items-center px-5 py-10">
        {current ? (
          <>
            <div className="absolute top-7 left-1/2 flex -translate-x-1/2 flex-nowrap items-center gap-3">
              <button
                type="button"
                aria-label={t("previousTrack")}
                onClick={() => go(index - 1)}
                className={buttonClass("secondary", "sm", "size-9 bg-surface px-0")}
              >
                <Arrow direction="left" />
              </button>
              <span className="min-w-[140px] truncate text-center font-semibold text-[15px]">
                {current.artists}
              </span>
              <button
                type="button"
                aria-label={t("nextTrack")}
                onClick={() => go(index + 1)}
                className={buttonClass("secondary", "sm", "size-9 bg-surface px-0")}
              >
                <Arrow direction="right" />
              </button>
            </div>
            <div className="relative mt-[30px] size-[min(300px,70vw)]">
              <div
                aria-hidden="true"
                className={`${blob} ${tints[index % tints.length]} -top-0 -left-[30px] h-[96%] w-[110%] translate-y-5`}
              />
              <div
                aria-hidden="true"
                className={`${blobLine} -left-4 h-[96%] w-[110%] translate-y-8`}
              />
              <div
                aria-hidden="true"
                className={`${blob} -top-[30px] -right-[60px] h-24 w-28 rotate-[24deg] bg-butter-soft`}
              />
              <Cover
                cover={current.cover}
                size={300}
                className="relative size-full! shadow-[0_24px_48px_-24px_rgba(60,40,10,.4)]"
              />
            </div>
            <div aria-live="polite" className="relative mt-[26px] text-center">
              <div className="font-display font-bold text-2xl tracking-tight">{current.name}</div>
              <div className="mt-1 font-mono text-muted text-sm">
                {t("plays", { count: current.plays })}
              </div>
            </div>
          </>
        ) : null}
      </div>

      <div className="relative z-[2] flex flex-col items-end gap-[18px] p-8">
        {tracks.length > 0 ? (
          <span className="eyebrow rotate-180 [writing-mode:vertical-rl]">
            {t("topTracksCounter", {
              index: String(index + 1).padStart(2, "0"),
              count: String(tracks.length).padStart(2, "0"),
            })}
          </span>
        ) : null}
        <dl className="m-0 mt-auto grid w-full max-w-[320px] grid-cols-2 gap-2.5">
          {kpis.map((kpi) => (
            <div key={kpi.key} className="rounded-[18px] border border-line bg-surface-2 p-3.5">
              <dt className="eyebrow">{t(`kpi.${kpi.key}`)}</dt>
              <dd className={`${num} m-0 mt-1 text-[28px] leading-none`}>
                {format.number(kpi.value)}
              </dd>
            </div>
          ))}
        </dl>
        <Link href="/app/rewind" className={buttonClass("primary")}>
          {t("openRewind")}
        </Link>
      </div>
    </section>
  );
}
