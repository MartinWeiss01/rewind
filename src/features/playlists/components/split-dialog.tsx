"use client";

import { Button } from "@ui-sdk/react/button";
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@ui-sdk/react/dialog";
import { Field, FieldDescription, FieldLabel } from "@ui-sdk/react/field";
import {
  NumberInput,
  NumberInputControl,
  NumberInputDecrement,
  NumberInputGroup,
  NumberInputIncrement,
} from "@ui-sdk/react/number-input";
import {
  SegmentedControl,
  SegmentedControlIndicator,
  SegmentedControlItem,
} from "@ui-sdk/react/segmented-control";
import { MinusIcon, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";
import { segmentedIndicator, segmentedItem, segmentedRoot } from "@/components/ui/segmented";
import { buttonClass } from "@/components/ui/styles";
import type { PlaylistItem } from "@/domain/playlists";
import { splitAction } from "../actions";
import { writeFailure } from "../changes";
import { planSplit, SplitBy, splitBySchema } from "../tools";
import { useNotice } from "./notice";
import { dialogBackdrop, dialogContent, dialogTitle, fieldHint, fieldLabel, input } from "./ui";
import { usePlaylistWrite } from "./use-playlist-write";
import { WriteOutcome } from "./write-outcome";

/** Splits the playlist into new playlists by artist or release year; the original stays. */
export function SplitDialog({
  open,
  onOpenChange,
  playlistId,
  playlistName,
  items,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playlistId: string;
  playlistName: string;
  items: readonly PlaylistItem[];
}) {
  const t = useTranslations("playlistTools.split");
  const router = useRouter();
  const notify = useNotice();
  const byLabel = useId();
  const [by, setBy] = useState<SplitBy>(SplitBy.Artist);
  const [minSize, setMinSize] = useState(5);
  const write = usePlaylistWrite(splitAction);
  const failure = writeFailure(write);

  const groups = useMemo(() => planSplit(items, by, minSize), [items, by, minSize]);

  const apply = () => {
    write.mutate(
      { playlistId, by, minSize },
      {
        onSuccess: (outcome) => {
          if (outcome.status !== "ok") return;
          onOpenChange(false);
          write.reset();
          notify({
            kind: "done",
            message: t("done", { count: outcome.count }),
            playlistId,
            snapshotId: null,
          });
          router.refresh();
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) write.reset();
      }}
    >
      <DialogBackdrop className={dialogBackdrop} />
      <DialogContent className={dialogContent}>
        <DialogTitle className={dialogTitle}>{t("title")}</DialogTitle>
        <div className="flex flex-col gap-2">
          <span id={byLabel} className={fieldLabel}>
            {t("by")}
          </span>
          <SegmentedControl
            aria-labelledby={byLabel}
            className={`${segmentedRoot} self-start`}
            value={by}
            onValueChange={(value, details) => {
              const parsed = splitBySchema.safeParse(value);
              if (!parsed.success) return details.cancel();
              setBy(parsed.data);
            }}
          >
            <SegmentedControlIndicator className={segmentedIndicator} />
            <SegmentedControlItem value={SplitBy.Artist} className={segmentedItem}>
              {t("byArtist")}
            </SegmentedControlItem>
            <SegmentedControlItem value={SplitBy.Year} className={segmentedItem}>
              {t("byYear")}
            </SegmentedControlItem>
          </SegmentedControl>
        </div>
        <Field className="flex flex-col gap-1.5">
          <FieldLabel className={fieldLabel}>{t("minSize")}</FieldLabel>
          <NumberInput
            value={minSize}
            min={1}
            max={500}
            onValueChange={(value) => {
              if (value !== null) setMinSize(Math.round(value));
            }}
          >
            <NumberInputGroup className="flex items-center gap-1.5 self-start">
              <NumberInputDecrement
                aria-label={t("decrease")}
                className={buttonClass("secondary", "sm", "size-11 px-0")}
              >
                <MinusIcon size={16} aria-hidden="true" />
              </NumberInputDecrement>
              <NumberInputControl className={`${input} w-24 text-center`} />
              <NumberInputIncrement
                aria-label={t("increase")}
                className={buttonClass("secondary", "sm", "size-11 px-0")}
              >
                <PlusIcon size={16} aria-hidden="true" />
              </NumberInputIncrement>
            </NumberInputGroup>
          </NumberInput>
          <FieldDescription className={fieldHint}>{t("minSizeHint")}</FieldDescription>
        </Field>
        <span className={fieldLabel}>{t("creates", { count: groups.length })}</span>
        <ul className="m-0 flex max-h-[38dvh] list-none flex-col overflow-auto rounded-2xl border border-line p-2">
          {groups.map((group) => (
            <li
              key={group.key ?? "other"}
              className="flex items-center justify-between gap-3 border-line border-b px-2 py-2.5 text-sm last:border-b-0"
            >
              <b className="min-w-0 truncate">
                {t("newName", { name: playlistName, group: group.label ?? t("other") })}
              </b>
              <span className="shrink-0 font-mono text-muted text-xs">
                {t("tracks", { count: group.trackIds.length })}
              </span>
            </li>
          ))}
        </ul>
        {failure ? <WriteOutcome result={failure} onDismiss={() => write.reset()} /> : null}
        <div className="flex justify-end gap-2">
          <DialogClose className={buttonClass("ghost")}>{t("cancel")}</DialogClose>
          <Button
            className={buttonClass("primary")}
            disabled={groups.length === 0 || write.isPending}
            onClick={apply}
          >
            {write.isPending ? t("creating") : t("submit", { count: groups.length })}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
