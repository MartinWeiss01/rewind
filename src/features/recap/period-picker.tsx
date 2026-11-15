"use client";

import { Button } from "@ui-sdk/react/button";
import { Input } from "@ui-sdk/react/input";
import { Label } from "@ui-sdk/react/label";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@ui-sdk/react/popover";
import {
  SegmentedControl,
  SegmentedControlIndicator,
  SegmentedControlItem,
} from "@ui-sdk/react/segmented-control";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { z } from "zod";
import { segmentedIndicator, segmentedItem, segmentedRoot } from "@/components/ui/segmented";
import { buttonClass, heading } from "@/components/ui/styles";
import { type RecapPeriod, RecapPreset, recapSearch } from "./period";

const presetSchema = z.enum(RecapPreset);
const dateClass =
  "min-h-11 w-full rounded-full border border-line-strong bg-surface px-3 text-ink text-sm";

/** Preset periods as a segmented control, plus a custom from–to range in a popover. */
export function PeriodPicker({
  period,
  presetLabels,
  today,
}: {
  period: RecapPeriod;
  presetLabels: Record<RecapPreset, string>;
  /** "YYYY-MM-DD" in the listener's time zone; the custom range can't end later. */
  today: string;
}) {
  const t = useTranslations("recap");
  const router = useRouter();
  const id = useId();
  // Changing the period is URL navigation, not a client data call, so it stays a transition
  // (not TanStack Query): the Server Component reloads and loading.tsx covers the wait.
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState<RecapPreset | null>(
    period.kind === "preset" ? period.preset : null,
  );

  return (
    <div className="flex flex-wrap items-center gap-2.5" aria-busy={pending || undefined}>
      <SegmentedControl
        aria-label={t("periodLabel")}
        className={segmentedRoot}
        value={value}
        onValueChange={(next, details) => {
          const parsed = presetSchema.safeParse(next);
          if (!parsed.success) return details.cancel();
          setValue(parsed.data);
          startTransition(() => {
            router.push(
              `/app/rewind${recapSearch({ kind: "preset", preset: parsed.data })}` as Route,
            );
          });
        }}
      >
        <SegmentedControlIndicator className={segmentedIndicator} />
        {Object.values(RecapPreset).map((preset) => (
          <SegmentedControlItem key={preset} value={preset} className={segmentedItem}>
            {presetLabels[preset]}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
      <Popover>
        <PopoverTrigger
          className={buttonClass(period.kind === "custom" ? "primary" : "secondary", "sm")}
        >
          {t("customPeriod")}
        </PopoverTrigger>
        <PopoverContent
          side="bottom"
          align="end"
          sideOffset={8}
          className="w-[300px] rounded-3xl border border-line bg-surface p-5 text-ink shadow-[0_24px_48px_-24px_rgba(60,40,10,.35)]"
        >
          <PopoverTitle className={`${heading.h3} mb-3`}>{t("customTitle")}</PopoverTitle>
          {/* A plain GET form: the page validates the range with Zod and explains a bad one. */}
          <form action="/app/rewind" method="get" className="flex flex-col gap-3">
            <div className="flex flex-col gap-1 text-sm">
              <Label htmlFor={`${id}-from`}>{t("from")}</Label>
              <Input
                id={`${id}-from`}
                type="date"
                name="from"
                required
                max={today}
                defaultValue={period.kind === "custom" ? period.from : undefined}
                className={dateClass}
              />
            </div>
            <div className="flex flex-col gap-1 text-sm">
              <Label htmlFor={`${id}-to`}>{t("to")}</Label>
              <Input
                id={`${id}-to`}
                type="date"
                name="to"
                required
                max={today}
                defaultValue={period.kind === "custom" ? period.to : undefined}
                className={dateClass}
              />
            </div>
            <p className="m-0 text-muted text-xs">{t("customHint")}</p>
            <Button type="submit" className={buttonClass("primary", "sm")}>
              {t("apply")}
            </Button>
          </form>
        </PopoverContent>
      </Popover>
    </div>
  );
}
