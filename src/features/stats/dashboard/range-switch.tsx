"use client";

import {
  SegmentedControl,
  SegmentedControlIndicator,
  SegmentedControlItem,
} from "@ui-sdk/react/segmented-control";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { segmentedIndicator, segmentedItem, segmentedRoot } from "@/components/ui/segmented";
import { TimeRange, timeRangeSchema } from "@/domain/time-range";

const ranges = Object.values(TimeRange);

/** Dashboard range picker; the range lives in `?range=` so it can be shared and reloaded. */
export function RangeSwitch({ range }: { range: TimeRange }) {
  const t = useTranslations("dashboard");
  const router = useRouter();
  const [value, setValue] = useState<TimeRange>(range);
  // Changing the range is URL navigation, not a client data call, so it stays a transition
  // (not TanStack Query): the Server Component reloads and loading.tsx covers the wait.
  const [pending, startTransition] = useTransition();

  return (
    <SegmentedControl
      aria-label={t("rangeLabel")}
      aria-busy={pending || undefined}
      className={segmentedRoot}
      value={value}
      onValueChange={(next, details) => {
        const parsed = timeRangeSchema.safeParse(next);
        if (!parsed.success) return details.cancel();
        setValue(parsed.data);
        startTransition(() => {
          router.push(parsed.data === TimeRange.Last4Weeks ? "/app" : `/app?range=${parsed.data}`, {
            scroll: false,
          });
        });
      }}
    >
      <SegmentedControlIndicator className={segmentedIndicator} />
      {ranges.map((item) => (
        <SegmentedControlItem key={item} value={item} className={segmentedItem}>
          {t(`ranges.${item}`)}
        </SegmentedControlItem>
      ))}
    </SegmentedControl>
  );
}
