"use client";

import { Input } from "@ui-sdk/react/input";
import { Label } from "@ui-sdk/react/label";
import {
  SegmentedControl,
  SegmentedControlIndicator,
  SegmentedControlItem,
} from "@ui-sdk/react/segmented-control";
import { Switch, SwitchThumb } from "@ui-sdk/react/switch";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { z } from "zod";
import { segmentedIndicator, segmentedItem, segmentedRoot } from "@/components/ui/segmented";
import { dayKeySchema } from "@/lib/search-params";
import { type HistoryFilters as Filters, historyHref, SourceFilter } from "./query";

const sourceSchema = z.enum(SourceFilter);
const inputClass =
  "min-h-11 w-full rounded-full border border-line-strong bg-surface px-4 text-ink text-sm placeholder:text-muted";
const dateClass =
  "min-h-11 rounded-full border border-line-strong bg-surface px-3 text-ink text-sm";

/** Search, date range, source and skip filters. Every change rewrites the URL (page resets to 1). */
export function HistoryFilters({ filters }: { filters: Filters }) {
  const t = useTranslations("history");
  const router = useRouter();
  const id = useId();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(filters.q);
  const [source, setSource] = useState<SourceFilter>(filters.source);
  const [skips, setSkips] = useState(filters.skips);
  const latest = useRef(filters);
  latest.current = filters;

  const apply = (patch: Partial<Filters>) => {
    startTransition(() => {
      router.replace(historyHref(latest.current, { ...patch, page: 1 }) as Route, {
        scroll: false,
      });
    });
  };

  // Search waits for a pause in typing so each keystroke doesn't trigger a request.
  useEffect(() => {
    if (search.trim() === latest.current.q) return;
    const timer = setTimeout(() => {
      startTransition(() => {
        router.replace(historyHref(latest.current, { q: search.trim(), page: 1 }) as Route, {
          scroll: false,
        });
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [search, router]);

  const onDate = (key: "from" | "to") => (value: string) => {
    // Date fields report "" while a date is only partly typed; only a complete change navigates.
    const parsed = dayKeySchema.safeParse(value);
    const next = value === "" ? null : parsed.success ? parsed.data : undefined;
    if (next !== undefined && next !== latest.current[key]) apply({ [key]: next });
  };

  return (
    <search
      aria-label={t("filters")}
      aria-busy={pending || undefined}
      className="flex flex-wrap items-center gap-2.5"
    >
      <div className="flex-[1_1_260px]">
        <Label htmlFor={`${id}-q`} className="sr-only">
          {t("search")}
        </Label>
        <Input
          id={`${id}-q`}
          type="search"
          value={search}
          onValueChange={(value) => setSearch(value.slice(0, 100))}
          placeholder={t("searchPlaceholder")}
          className={inputClass}
        />
      </div>
      <div className="flex items-center gap-2 text-sm">
        <Label htmlFor={`${id}-from`}>{t("from")}</Label>
        <Input
          id={`${id}-from`}
          type="date"
          defaultValue={filters.from ?? ""}
          max={filters.to ?? undefined}
          onValueChange={onDate("from")}
          className={dateClass}
        />
      </div>
      <div className="flex items-center gap-2 text-sm">
        <Label htmlFor={`${id}-to`}>{t("to")}</Label>
        <Input
          id={`${id}-to`}
          type="date"
          defaultValue={filters.to ?? ""}
          min={filters.from ?? undefined}
          onValueChange={onDate("to")}
          className={dateClass}
        />
      </div>
      <SegmentedControl
        aria-label={t("sourceLabel")}
        className={segmentedRoot}
        value={source}
        onValueChange={(next, details) => {
          const parsed = sourceSchema.safeParse(next);
          if (!parsed.success) return details.cancel();
          setSource(parsed.data);
          apply({ source: parsed.data });
        }}
      >
        <SegmentedControlIndicator className={segmentedIndicator} />
        {Object.values(SourceFilter).map((item) => (
          <SegmentedControlItem key={item} value={item} className={segmentedItem}>
            {t(`sourceFilter.${item}`)}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
      <div className="flex items-center gap-2 text-sm">
        <Switch
          id={`${id}-skips`}
          checked={skips}
          onCheckedChange={(checked) => {
            setSkips(checked);
            apply({ skips: checked });
          }}
          className="relative h-[26px] w-11 flex-none cursor-pointer rounded-full bg-line-strong transition-colors data-checked:bg-ink motion-reduce:transition-none"
        >
          <SwitchThumb className="absolute top-[3px] left-[3px] block size-5 rounded-full bg-surface transition-[left] data-checked:left-[21px] motion-reduce:transition-none" />
        </Switch>
        <Label htmlFor={`${id}-skips`}>{t("showSkips")}</Label>
      </div>
    </search>
  );
}
