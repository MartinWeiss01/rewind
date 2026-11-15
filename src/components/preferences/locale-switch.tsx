"use client";

import {
  SegmentedControl,
  SegmentedControlIndicator,
  SegmentedControlItem,
} from "@ui-sdk/react/segmented-control";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { segmentedIndicator, segmentedItem, segmentedRoot } from "@/components/ui/segmented";
import { setLocale } from "@/i18n/actions";
import { locales } from "@/i18n/locale";

export function LocaleSwitch() {
  const t = useTranslations("shell");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <SegmentedControl
      aria-label={t("language")}
      aria-busy={pending}
      className={segmentedRoot}
      value={locale}
      onValueChange={(next) => {
        startTransition(async () => {
          await setLocale(next);
          router.refresh();
        });
      }}
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
