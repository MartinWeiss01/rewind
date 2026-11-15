"use client";

import {
  SegmentedControl,
  SegmentedControlIndicator,
  SegmentedControlItem,
} from "@ui-sdk/react/segmented-control";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@ui-sdk/react/tabs";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { z } from "zod";
import { Cover } from "@/components/ui/cover";
import { segmentedIndicator, segmentedItem, segmentedRoot } from "@/components/ui/segmented";
import { card, heading, tabs } from "@/components/ui/styles";
import { Metric } from "../engine";
import { cardHeader, listRow, rank } from "../ui";
import type { RankedAlbum } from "../view";
import type { TopLists } from "./build-dashboard";

const metricSchema = z.enum(Metric);
const kinds = ["tracks", "artists", "albums"] as const;

/** Top tracks, artists and albums for the range, ranked by plays or minutes. */
export function TopCard({ top }: { top: Record<Metric, TopLists> }) {
  const t = useTranslations("dashboard");
  const [metric, setMetric] = useState<Metric>(Metric.Plays);
  const lists = top[metric];
  const value = (item: { plays: number; minutes: number }) =>
    metric === Metric.Plays
      ? t("plays", { count: item.plays })
      : t("minutes", { count: Math.round(item.minutes) });

  const empty = <p className="m-0 py-6 text-center text-muted text-sm">{t("emptyTop")}</p>;
  const rows = (items: readonly RankedAlbum[]) =>
    items.length === 0 ? (
      empty
    ) : (
      <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-x-7 p-0">
        {items.map((item, i) => (
          <li key={item.id} className={listRow}>
            <span className={rank}>{String(i + 1).padStart(2, "0")}</span>
            <Cover cover={item.cover} size={44} />
            <div className="min-w-0 grow">
              <div className="truncate font-semibold text-[15px]">{item.name}</div>
              <div className="truncate text-muted text-sm">{item.artists}</div>
            </div>
            <span className="whitespace-nowrap font-mono text-sm">{value(item)}</span>
          </li>
        ))}
      </ol>
    );

  return (
    <section aria-labelledby="top-title" className={`${card} md:col-span-2`}>
      <div className={cardHeader}>
        <h2 id="top-title" className={heading.h2}>
          {t("top")}
        </h2>
        <SegmentedControl
          aria-label={t("rankBy")}
          className={segmentedRoot}
          value={metric}
          onValueChange={(next, details) => {
            const parsed = metricSchema.safeParse(next);
            if (!parsed.success) return details.cancel();
            setMetric(parsed.data);
          }}
        >
          <SegmentedControlIndicator className={segmentedIndicator} />
          {Object.values(Metric).map((item) => (
            <SegmentedControlItem key={item} value={item} className={segmentedItem}>
              {t(`metric.${item}`)}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
      </div>
      <Tabs defaultValue="tracks">
        <TabsList aria-label={t("top")} className={`${tabs.list} mb-2`}>
          {kinds.map((kind) => (
            <TabsTab key={kind} value={kind} className={tabs.tab}>
              {t(`kinds.${kind}`)}
            </TabsTab>
          ))}
        </TabsList>
        <TabsPanel value="tracks">{rows(lists.tracks)}</TabsPanel>
        <TabsPanel value="artists">
          {lists.artists.length === 0 ? (
            empty
          ) : (
            <ol className="m-0 flex list-none flex-nowrap gap-[18px] overflow-x-auto p-0 pt-2 pb-1">
              {lists.artists.map((artist, i) => (
                <li
                  key={artist.id}
                  className="relative flex min-w-[104px] flex-col items-center gap-2 text-center"
                >
                  <span className="absolute top-0 left-1 z-[1] rounded-full bg-ink px-[7px] py-0.5 font-mono text-on-ink text-xs">
                    {i + 1}
                  </span>
                  <Cover cover={artist.cover} size={92} shape="round" />
                  <span className="font-semibold text-sm">{artist.name}</span>
                  <span className="font-mono text-muted text-xs">{value(artist)}</span>
                </li>
              ))}
            </ol>
          )}
        </TabsPanel>
        <TabsPanel value="albums">{rows(lists.albums)}</TabsPanel>
      </Tabs>
    </section>
  );
}
