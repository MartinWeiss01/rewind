"use client";

import {
  SegmentedControl,
  SegmentedControlIndicator,
  SegmentedControlItem,
} from "@ui-sdk/react/segmented-control";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { match } from "ts-pattern";
import { z } from "zod";
import { segmentedIndicator, segmentedItem, segmentedRoot } from "@/components/ui/segmented";
import { card, heading } from "@/components/ui/styles";
import { Bucket, type TrendPoint } from "../engine";
import { dateFromKey } from "../labels";
import { cardHeader } from "../ui";

const bucketSchema = z.enum(Bucket);

/** Minutes listened per day, week or month across the range. One series, so no legend. */
export function TrendCard({ trend }: { trend: Record<Bucket, TrendPoint[]> }) {
  const t = useTranslations("dashboard");
  const format = useFormatter();
  const [bucket, setBucket] = useState<Bucket>(Bucket.Week);
  const points = trend[bucket];
  const empty = points.every((point) => point.minutes === 0);

  const label = (key: string, long: boolean) =>
    match(bucket)
      .with(Bucket.Month, () =>
        format.dateTime(dateFromKey(key), {
          month: long ? "long" : "short",
          year: "numeric",
          timeZone: "UTC",
        }),
      )
      .with(Bucket.Week, () =>
        long
          ? t("weekOf", {
              date: format.dateTime(dateFromKey(key), {
                month: "short",
                day: "numeric",
                year: "numeric",
                timeZone: "UTC",
              }),
            })
          : format.dateTime(dateFromKey(key), { month: "short", day: "numeric", timeZone: "UTC" }),
      )
      .with(Bucket.Day, () =>
        format.dateTime(dateFromKey(key), {
          month: "short",
          day: "numeric",
          ...(long ? { weekday: "short", year: "numeric" } : {}),
          timeZone: "UTC",
        }),
      )
      .exhaustive();

  const peak = points.reduce<TrendPoint | null>(
    (best, point) => (!best || point.minutes > best.minutes ? point : best),
    null,
  );

  return (
    <section aria-labelledby="trend-title" className={`${card} col-span-full`}>
      <div className={cardHeader}>
        <h2 id="trend-title" className={heading.h2}>
          {t("overTime")}
        </h2>
        <SegmentedControl
          aria-label={t("bucketLabel")}
          className={segmentedRoot}
          value={bucket}
          onValueChange={(next, details) => {
            const parsed = bucketSchema.safeParse(next);
            if (!parsed.success) return details.cancel();
            setBucket(parsed.data);
          }}
        >
          <SegmentedControlIndicator className={segmentedIndicator} />
          {Object.values(Bucket).map((item) => (
            <SegmentedControlItem key={item} value={item} className={segmentedItem}>
              {t(`bucket.${item}`)}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
      </div>
      {empty ? (
        <p className="m-0 py-16 text-center text-muted text-sm">{t("trendEmpty")}</p>
      ) : (
        <figure className="m-0">
          <figcaption className="sr-only">
            {t("trendSummary", {
              count: points.length,
              peak: peak ? label(peak.key, true) : "",
              minutes: Math.round(peak?.minutes ?? 0),
            })}
          </figcaption>
          <div className="h-[220px] text-muted text-xs" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={points}
                margin={{ top: 8, right: 4, bottom: 0, left: 0 }}
                barCategoryGap={2}
              >
                <CartesianGrid vertical={false} stroke="var(--line)" />
                <XAxis
                  dataKey="key"
                  tickFormatter={(key: string) => label(key, false)}
                  tickLine={false}
                  axisLine={{ stroke: "var(--line-strong)" }}
                  tick={{ fill: "var(--muted)", fontSize: 11 }}
                  minTickGap={24}
                />
                <YAxis
                  width={44}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--muted)", fontSize: 11 }}
                  tickFormatter={(value: number) => format.number(value, { notation: "compact" })}
                />
                <Tooltip
                  cursor={{ fill: "var(--surface-2)" }}
                  content={({ active, payload }) => {
                    const point = payload?.[0]?.payload as TrendPoint | undefined;
                    if (!active || !point) return null;
                    return (
                      <div className="rounded-xl border border-line bg-surface px-3 py-2 text-ink text-sm shadow-lg">
                        <div className="font-semibold">{label(point.key, true)}</div>
                        <div className="font-mono text-muted">
                          {t("minutes", { count: Math.round(point.minutes) })}
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="minutes"
                  fill="var(--ink)"
                  activeBar={{ fill: "var(--violet)" }}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </figure>
      )}
    </section>
  );
}
