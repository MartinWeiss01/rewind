"use client";

import { useMutation } from "@tanstack/react-query";
import {
  SegmentedControl,
  SegmentedControlIndicator,
  SegmentedControlItem,
} from "@ui-sdk/react/segmented-control";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { segmentedIndicator, segmentedItem, segmentedRoot } from "@/components/ui/segmented";
import { setLocale } from "@/i18n/actions";
import { locales } from "@/i18n/locale";

export function LocaleSwitch() {
  const t = useTranslations("shell");
  const locale = useLocale();
  const router = useRouter();
  const change = useMutation({
    mutationFn: setLocale,
    // The locale lives in a cookie; refreshing re-renders Server Components in it.
    onSuccess: () => router.refresh(),
  });

  return (
    <SegmentedControl
      aria-label={t("language")}
      aria-busy={change.isPending}
      className={segmentedRoot}
      value={locale}
      onValueChange={(next) => change.mutate(next)}
    >
      <SegmentedControlIndicator className={segmentedIndicator} />
      {locales.map((code) => (
        <SegmentedControlItem key={code} value={code} className={`${segmentedItem} uppercase`}>
          {code}
        </SegmentedControlItem>
      ))}
    </SegmentedControl>
  );
}
