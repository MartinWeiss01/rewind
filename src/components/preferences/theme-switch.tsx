"use client";

import { usePreference } from "@ui-sdk/react/preferences";
import {
  SegmentedControl,
  SegmentedControlIndicator,
  SegmentedControlItem,
} from "@ui-sdk/react/segmented-control";
import { useTranslations } from "next-intl";
import { z } from "zod";
import { segmentedIndicator, segmentedItem, segmentedRoot } from "@/components/ui/segmented";
import { colorScheme } from "./color-scheme";

const choiceSchema = z.enum(["system", "light", "dark"]);

export function ThemeSwitch() {
  const t = useTranslations("settings");
  const { value } = usePreference(colorScheme);

  return (
    <SegmentedControl
      aria-label={t("theme")}
      className={segmentedRoot}
      value={value}
      onValueChange={(next, details) => {
        const parsed = choiceSchema.safeParse(next);
        if (!parsed.success) return details.cancel();
        colorScheme.set(parsed.data);
      }}
    >
      <SegmentedControlIndicator className={segmentedIndicator} />
      <SegmentedControlItem value="system" className={segmentedItem}>
        {t("themeSystem")}
      </SegmentedControlItem>
      <SegmentedControlItem value="light" className={segmentedItem}>
        {t("themeLight")}
      </SegmentedControlItem>
      <SegmentedControlItem value="dark" className={segmentedItem}>
        {t("themeDark")}
      </SegmentedControlItem>
    </SegmentedControl>
  );
}
