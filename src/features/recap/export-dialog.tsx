"use client";

import { Button } from "@ui-sdk/react/button";
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@ui-sdk/react/dialog";
import { Label } from "@ui-sdk/react/label";
import {
  SegmentedControl,
  SegmentedControlIndicator,
  SegmentedControlItem,
} from "@ui-sdk/react/segmented-control";
import { Switch, SwitchThumb } from "@ui-sdk/react/switch";
import { toPng } from "html-to-image";
import { useFormatter, useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import { z } from "zod";
import { segmentedIndicator, segmentedItem, segmentedRoot } from "@/components/ui/segmented";
import { alert, buttonClass, heading } from "@/components/ui/styles";
import { ExportCard, ExportFormat, ExportTheme, exportSize } from "./export-card";
import type { RecapData } from "./load-recap";

const formatSchema = z.enum(ExportFormat);
const themeSchema = z.enum(ExportTheme);
const PREVIEW_HEIGHT = 420;
// Shown instead of artwork the browser isn't allowed to read (cross-origin images without CORS).
const blankPixel =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

/** Export dialog: choose format, theme and name, then download a PNG made on the device. */
export function ExportDialog({ data, periodLabel }: { data: RecapData; periodLabel: string }) {
  const t = useTranslations("recap.export");
  const format = useFormatter();
  const [shape, setShape] = useState<ExportFormat>(ExportFormat.Story);
  const [theme, setTheme] = useState<ExportTheme>(ExportTheme.Paper);
  const [showName, setShowName] = useState(true);
  const [failed, setFailed] = useState(false);
  const id = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  const size = exportSize(shape);
  const scale = PREVIEW_HEIGHT / size.height;

  async function download() {
    const node = cardRef.current;
    if (!node) return;
    setFailed(false);
    try {
      const url = await toPng(node, {
        width: size.width,
        height: size.height,
        pixelRatio: 1,
        imagePlaceholder: blankPixel,
      });
      const link = document.createElement("a");
      link.href = url;
      link.download = `rewind-${periodLabel.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-")}-${shape}.png`;
      link.click();
    } catch (error) {
      console.error(error);
      setFailed(true);
    }
  }

  return (
    <Dialog onOpenChange={() => setFailed(false)}>
      <DialogTrigger className={buttonClass("primary", "lg")}>{t("open")}</DialogTrigger>
      <DialogBackdrop className="fixed inset-0 bg-[rgba(23,20,15,.42)] transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none" />
      <DialogContent className="m-auto max-h-[calc(100dvh-32px)] w-[min(760px,calc(100vw-32px))] overflow-auto rounded-[28px] border border-line bg-surface p-[26px] text-ink shadow-[0_40px_80px_-30px_rgba(0,0,0,.5)] backdrop:bg-transparent">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-6">
          <div
            role="img"
            aria-label={t("previewLabel")}
            className="relative mx-auto overflow-hidden rounded-[22px] border border-line"
            style={{ width: size.width * scale, height: PREVIEW_HEIGHT }}
          >
            <div style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
              <ExportCard
                ref={cardRef}
                data={data}
                shape={shape}
                theme={theme}
                showName={showName}
                labels={{
                  title: t("cardTitle", { period: periodLabel }),
                  topTrack: t("cardTopTrack"),
                  topArtist: t("cardTopArtist"),
                  minutes: t("cardMinutes"),
                  streak: t("cardStreak"),
                  minutesValue: format.number(Math.round(data.minutes)),
                  streakValue: t("cardStreakValue", { count: data.longestStreak?.days ?? 0 }),
                }}
              />
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <DialogTitle className={heading.h2}>{t("title")}</DialogTitle>
            <DialogDescription className="m-0 text-muted text-sm">{t("privacy")}</DialogDescription>
            <div className="flex flex-col gap-1.5">
              <span className="font-semibold text-sm">{t("format")}</span>
              <SegmentedControl
                aria-label={t("format")}
                className={segmentedRoot}
                value={shape}
                onValueChange={(next, details) => {
                  const parsed = formatSchema.safeParse(next);
                  if (!parsed.success) return details.cancel();
                  setShape(parsed.data);
                }}
              >
                <SegmentedControlIndicator className={segmentedIndicator} />
                {Object.values(ExportFormat).map((item) => (
                  <SegmentedControlItem key={item} value={item} className={segmentedItem}>
                    {t(`formats.${item}`)}
                  </SegmentedControlItem>
                ))}
              </SegmentedControl>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="font-semibold text-sm">{t("theme")}</span>
              <SegmentedControl
                aria-label={t("theme")}
                className={segmentedRoot}
                value={theme}
                onValueChange={(next, details) => {
                  const parsed = themeSchema.safeParse(next);
                  if (!parsed.success) return details.cancel();
                  setTheme(parsed.data);
                }}
              >
                <SegmentedControlIndicator className={segmentedIndicator} />
                {Object.values(ExportTheme).map((item) => (
                  <SegmentedControlItem key={item} value={item} className={segmentedItem}>
                    {t(`themes.${item}`)}
                  </SegmentedControlItem>
                ))}
              </SegmentedControl>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <Label htmlFor={`${id}-name`}>{t("showName")}</Label>
              <Switch
                id={`${id}-name`}
                checked={showName}
                onCheckedChange={setShowName}
                className="relative h-[26px] w-11 flex-none cursor-pointer rounded-full bg-line-strong transition-colors data-checked:bg-ink motion-reduce:transition-none"
              >
                <SwitchThumb className="absolute top-[3px] left-[3px] block size-5 rounded-full bg-surface transition-[left] data-checked:left-[21px] motion-reduce:transition-none" />
              </Switch>
            </div>
            {failed ? (
              <div role="alert" className={`${alert.base} ${alert.tone.danger}`}>
                {t("failed")}
              </div>
            ) : null}
            <div className="mt-auto flex flex-wrap gap-2.5">
              <Button
                onClick={download}
                pendingAnnouncement={t("preparing")}
                className={buttonClass("primary")}
              >
                {t("download")}
              </Button>
              <DialogClose className={buttonClass("ghost")}>{t("close")}</DialogClose>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
