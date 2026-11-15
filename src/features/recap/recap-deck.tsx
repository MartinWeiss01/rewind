"use client";

import {
  Carousel,
  CarouselContent,
  CarouselIndicator,
  CarouselIndicatorGroup,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  CarouselViewport,
} from "@ui-sdk/react/carousel";
import { useFormatter, useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import { match } from "ts-pattern";
import { Cover } from "@/components/ui/cover";
import { buttonClass } from "@/components/ui/styles";
import { hourLabel, weekdayLabel } from "@/features/stats/labels";
import { num } from "@/features/stats/ui";
import { ExportDialog } from "./export-dialog";
import { listenerKind } from "./listener";
import type { RecapData } from "./load-recap";

export const Slide = {
  Intro: "intro",
  Minutes: "minutes",
  TopTrack: "topTrack",
  TopArtist: "topArtist",
  Peak: "peak",
  Discoveries: "discoveries",
  Streak: "streak",
  MostPlayed: "mostPlayed",
} as const;
export type Slide = (typeof Slide)[keyof typeof Slide];
const slides = Object.values(Slide);

const arches = [
  "w-[120%] bg-butter-soft",
  "w-full bg-mint-soft",
  "w-[80%] bg-violet-soft",
  "w-[60%] bg-coral-soft",
];

function Big({ children }: { children: ReactNode }) {
  return <span className={`${num} text-[clamp(72px,10vw,150px)] leading-none`}>{children}</span>;
}

function Arrow({ forward }: { forward: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={forward ? "M13 6v12l9-6zM3 6v12l9-6z" : "M11 6v12L2 12zM21 6v12l-9-6z"} />
    </svg>
  );
}

/** The recap as a deck of slides; arrow keys page it, reduced motion pages without animating. */
/**
 * Dates shown in the slides, formatted on the server: Node and browsers ship different
 * ICU data, so formatting them here would break hydration.
 */
export type RecapDates = { firstFind: string | null; longestStreak: string | null };

export function RecapDeck({
  data,
  dates,
  periodLabel,
}: {
  data: RecapData;
  dates: RecapDates;
  periodLabel: string;
}) {
  const t = useTranslations("recap");
  const format = useFormatter();
  const [page, setPage] = useState(1);
  const topTrack = data.topTracks[0] ?? null;
  const kind = listenerKind(data.nightShare, data.peakHour);
  const percent = (value: number) =>
    format.number(value, { style: "percent", maximumFractionDigits: 0 });

  const body = (slide: Slide): ReactNode =>
    match(slide)
      .with(Slide.Intro, () => (
        <>
          <Cover cover={data.avatar} size={200} shape="round" className="border-2 border-ink" />
          <div>
            <div className="eyebrow">{t("introEyebrow")}</div>
            <div className="mt-1.5 font-display font-bold text-3xl tracking-tight">
              {t("title", { period: periodLabel })}
            </div>
            <p className="m-0 mt-1 text-muted">{t("subtitle")}</p>
          </div>
        </>
      ))
      .with(Slide.Minutes, () => (
        <>
          <Big>{format.number(Math.round(data.minutes))}</Big>
          <div className="font-display font-bold text-2xl">{t("minutesListened")}</div>
          <p className="m-0 max-w-[320px] text-muted">
            {t("minutesText", { plays: data.plays, days: data.activeDays })}
          </p>
        </>
      ))
      .with(Slide.TopTrack, () =>
        topTrack ? (
          <>
            <Cover
              cover={topTrack.cover}
              size={240}
              className="shadow-[0_24px_48px_-24px_rgba(60,40,10,.4)]"
            />
            <div>
              <div className="eyebrow">{t("topTrack", { count: topTrack.plays })}</div>
              <div className="mt-1.5 font-display font-bold text-2xl tracking-tight">
                {topTrack.name}
              </div>
              <div className="text-muted">{topTrack.artists}</div>
            </div>
          </>
        ) : null,
      )
      .with(Slide.TopArtist, () =>
        data.topArtist ? (
          <>
            <Cover
              cover={data.topArtist.cover}
              size={240}
              shape="round"
              className="border-2 border-ink"
            />
            <div>
              <div className="eyebrow">
                {t("topArtist", {
                  hours: format.number(data.topArtist.minutes / 60, { maximumFractionDigits: 0 }),
                })}
              </div>
              <div className="mt-1.5 font-display font-bold text-2xl tracking-tight">
                {data.topArtist.name}
              </div>
              <div className="text-muted">
                {t("topArtistPlays", { count: data.topArtist.plays })}
              </div>
            </div>
          </>
        ) : null,
      )
      .with(Slide.Peak, () => (
        <>
          <Big>{data.peakHour === null ? "–" : hourLabel(format, data.peakHour)}</Big>
          <div className="font-display font-bold text-2xl">{t(`listener.${kind}`)}</div>
          <p className="m-0 max-w-[340px] text-muted">
            {data.peakWeekday !== null && data.peakHour !== null
              ? t("peakText", {
                  day: weekdayLabel(format, data.peakWeekday, "long"),
                  time: hourLabel(format, data.peakHour),
                  share: percent(data.nightShare),
                })
              : null}
          </p>
        </>
      ))
      .with(Slide.Discoveries, () => (
        <>
          <Big>{format.number(data.newArtistCount)}</Big>
          <div className="font-display font-bold text-2xl">
            {t("newArtists", { count: data.newArtistCount })}
          </div>
          <p className="m-0 max-w-[320px] text-muted">
            {data.firstFind
              ? t("firstFind", {
                  name: data.firstFind.name,
                  date: dates.firstFind ?? "",
                })
              : t("noFirstFind")}
          </p>
        </>
      ))
      .with(Slide.Streak, () => (
        <>
          <Big>{format.number(data.longestStreak?.days ?? 0)}</Big>
          <div className="font-display font-bold text-2xl">
            {t("daysInRow", { count: data.longestStreak?.days ?? 0 })}
          </div>
          {data.longestStreak ? (
            <p className="m-0 max-w-[320px] text-muted">
              {t("streakText", {
                range: dates.longestStreak ?? "",
              })}
            </p>
          ) : null}
        </>
      ))
      .with(Slide.MostPlayed, () => (
        <>
          <div className="font-display font-bold text-2xl">{t("chapters.mostPlayed")}</div>
          <ol className="m-0 flex w-full max-w-[340px] list-none flex-col gap-2 p-0 text-left">
            {data.topTracks.map((track, i) => (
              <li key={track.id} className="flex items-center gap-3 rounded-2xl bg-surface/80 p-2">
                <span className="w-5 text-right font-mono text-muted text-xs">{i + 1}</span>
                <Cover cover={track.cover} size={44} />
                <div className="min-w-0 grow">
                  <div className="truncate font-semibold text-sm">{track.name}</div>
                  <div className="truncate text-muted text-xs">{track.artists}</div>
                </div>
                <span className="font-mono text-xs">{t("playsShort", { count: track.plays })}</span>
              </li>
            ))}
          </ol>
        </>
      ))
      .exhaustive();

  return (
    <Carousel
      aria-label={t("deckLabel", { period: periodLabel })}
      page={page}
      onPageChange={setPage}
      className="grid min-h-[720px] flex-1 grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-7 rounded-[36px] border border-line bg-surface p-[clamp(20px,3vw,44px)]"
    >
      <div className="relative z-[2] flex flex-col gap-[18px]">
        <span className="eyebrow">{t("eyebrow", { period: periodLabel })}</span>
        <h1 className="m-0 font-display font-extrabold text-[clamp(44px,5vw,80px)] leading-[0.95] tracking-[-0.03em]">
          {t("title", { period: periodLabel })}
        </h1>
        <p className="m-0 text-[17px] text-muted">{t("subtitle")}</p>
        <CarouselIndicatorGroup aria-label={t("chaptersLabel")} className="mt-[18px] flex flex-col">
          {slides.map((slide, i) => (
            <CarouselIndicator
              key={slide}
              page={i + 1}
              className="flex min-h-12 cursor-pointer items-center justify-between border-0 border-line border-b bg-transparent p-0 text-left text-[17px] text-ink data-selected:font-bold"
            >
              {t(`chapters.${slide}`)}
              <span className="font-mono text-muted text-sm">{String(i + 1).padStart(2, "0")}</span>
            </CarouselIndicator>
          ))}
        </CarouselIndicatorGroup>
        <div className="mt-auto flex flex-col gap-1">
          <span className="eyebrow">{t("minutesListened")}</span>
          <span className={`${num} text-[56px] leading-none`}>
            {format.number(Math.round(data.minutes))}
          </span>
        </div>
      </div>

      <div className="relative grid min-h-[520px] place-items-center overflow-hidden">
        {arches.map((arch) => (
          <div
            key={arch}
            aria-hidden="true"
            className={`absolute bottom-0 left-1/2 aspect-[2/1.1] -translate-x-1/2 rounded-t-full ${arch}`}
          />
        ))}
        <CarouselViewport className="relative w-full self-stretch [scrollbar-width:none]">
          <CarouselContent className="flex h-full">
            {slides.map((slide) => (
              <CarouselItem
                key={slide}
                aria-label={t(`chapters.${slide}`)}
                className="flex basis-full flex-col items-center justify-center gap-4 px-4 pb-24 text-center"
              >
                {body(slide)}
              </CarouselItem>
            ))}
          </CarouselContent>
        </CarouselViewport>
        <div className="absolute bottom-2.5 left-1/2 z-[3] flex -translate-x-1/2 flex-nowrap gap-3.5">
          <CarouselPrevious
            aria-label={t("previousSlide")}
            className={buttonClass(
              "secondary",
              "md",
              "size-11 bg-surface px-0 data-disabled:opacity-40",
            )}
          >
            <Arrow forward={false} />
          </CarouselPrevious>
          <CarouselNext
            aria-label={t("nextSlide")}
            className={buttonClass("primary", "md", "size-11 px-0 data-disabled:opacity-40")}
          >
            <Arrow forward />
          </CarouselNext>
        </div>
      </div>

      <div className="relative z-[2] flex flex-col items-end gap-[18px] text-right">
        <span aria-hidden="true" className="font-light font-mono text-5xl tracking-[-0.04em]">
          {String(page).padStart(2, "0")}/{String(slides.length).padStart(2, "0")}
        </span>
        <h2 className="m-0 font-semibold text-[15px]">{t("chapters.mostPlayed")}</h2>
        <ol className="m-0 flex list-none flex-col gap-[18px] border-line-strong border-r p-0 pr-3.5">
          {data.topTracks.map((track, i) => (
            <li key={track.id} className={i === 0 ? "text-ink" : "text-muted"}>
              <div className="font-semibold text-sm">{track.name}</div>
              <div className="text-sm">{track.artists}</div>
            </li>
          ))}
        </ol>
        <div className="mt-auto flex flex-col items-end gap-2.5">
          <ExportDialog data={data} periodLabel={periodLabel} />
          <span className="text-muted text-sm">{t("exportHint")}</span>
        </div>
      </div>
    </Carousel>
  );
}
