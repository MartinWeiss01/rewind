"use client";

import { Button } from "@ui-sdk/react/button";
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@ui-sdk/react/dialog";
import {
  SegmentedControl,
  SegmentedControlIndicator,
  SegmentedControlItem,
} from "@ui-sdk/react/segmented-control";
import { useFormatter, useTranslations } from "next-intl";
import { useId, useMemo, useState, useTransition } from "react";
import { match } from "ts-pattern";
import { segmentedIndicator, segmentedItem, segmentedRoot } from "@/components/ui/segmented";
import { buttonClass } from "@/components/ui/styles";
import type { PlaylistItem } from "@/domain/playlists";
import { applyEditAction } from "../actions";
import { ChangeKind, type WriteResult } from "../changes";
import { SortDirection, SortKey, sortDirectionSchema, sortItems, sortKeySchema } from "../tools";
import { useNotice } from "./notice";
import { dialogBackdrop, dialogContent, dialogTitle, fieldLabel } from "./ui";
import { WriteOutcome } from "./write-outcome";

const PREVIEW = 6;

/** Sorts the playlist by one key, with a before → after preview of the top rows. */
export function SortDialog({
  open,
  onOpenChange,
  playlistId,
  basedOn,
  items,
  plays,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playlistId: string;
  basedOn: string;
  items: readonly PlaylistItem[];
  /** Your plays per track ID; null hides sorting by plays. */
  plays: Readonly<Record<string, number>> | null;
}) {
  const t = useTranslations("playlistTools.sort");
  const format = useFormatter();
  const notify = useNotice();
  const keyLabel = useId();
  const directionLabel = useId();
  const [key, setKey] = useState<SortKey>(SortKey.Added);
  const [direction, setDirection] = useState<SortDirection>(SortDirection.Desc);
  const [result, setResult] = useState<WriteResult | null>(null);
  const [pending, startTransition] = useTransition();

  const playMap = useMemo(() => new Map(Object.entries(plays ?? {})), [plays]);
  const sorted = useMemo(
    () => sortItems(items, key, direction, playMap),
    [items, key, direction, playMap],
  );
  const unchanged = sorted.every((item, i) => item.key === items[i]?.key);
  const keys = [SortKey.Added, SortKey.Artist, SortKey.Release, ...(plays ? [SortKey.Plays] : [])];

  const detail = (item: PlaylistItem) =>
    match(key)
      .with(SortKey.Plays, () => format.number(playMap.get(item.track.id) ?? 0))
      .with(SortKey.Release, () => item.track.album.releaseDate?.slice(0, 4) ?? "—")
      .with(SortKey.Artist, () => item.track.artists[0]?.name ?? "")
      .with(SortKey.Added, () =>
        item.addedAt ? format.dateTime(item.addedAt, { dateStyle: "short" }) : "—",
      )
      .exhaustive();

  const apply = () => {
    startTransition(async () => {
      const outcome = await applyEditAction({
        playlistId,
        basedOn,
        trackIds: sorted.map((i) => i.track.id),
        kind: ChangeKind.Sort,
      });
      if (outcome.status === "ok") {
        onOpenChange(false);
        setResult(null);
        notify({ kind: "done", message: t("done"), playlistId, snapshotId: outcome.snapshotId });
      } else {
        setResult(outcome);
      }
    });
  };

  const list = (rows: readonly PlaylistItem[], label: string, withDetail: boolean) => (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="eyebrow">{label}</span>
      <ol className="m-0 flex list-none flex-col rounded-2xl border border-line p-2">
        {rows.slice(0, PREVIEW).map((item, i) => (
          <li
            key={item.key}
            className="flex items-center gap-3 border-line border-b px-1 py-2 text-sm last:border-b-0"
          >
            <span className="w-5 shrink-0 text-right font-mono text-muted text-xs">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate">{item.track.name}</span>
            {withDetail ? (
              <span className="shrink-0 font-mono text-muted text-xs">{detail(item)}</span>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setResult(null);
      }}
    >
      <DialogBackdrop className={dialogBackdrop} />
      <DialogContent className={dialogContent}>
        <DialogTitle className={dialogTitle}>{t("title")}</DialogTitle>
        <div className="flex flex-col gap-2">
          <span id={keyLabel} className={fieldLabel}>
            {t("by")}
          </span>
          <SegmentedControl
            aria-labelledby={keyLabel}
            className={`${segmentedRoot} flex-wrap self-start rounded-3xl`}
            value={key}
            onValueChange={(value, details) => {
              const parsed = sortKeySchema.safeParse(value);
              if (!parsed.success) return details.cancel();
              setKey(parsed.data);
            }}
          >
            <SegmentedControlIndicator className={segmentedIndicator} />
            {keys.map((k) => (
              <SegmentedControlItem key={k} value={k} className={segmentedItem}>
                {t(`key.${k}`)}
              </SegmentedControlItem>
            ))}
          </SegmentedControl>
        </div>
        <div className="flex flex-col gap-2">
          <span id={directionLabel} className={fieldLabel}>
            {t("order")}
          </span>
          <SegmentedControl
            aria-labelledby={directionLabel}
            className={`${segmentedRoot} self-start`}
            value={direction}
            onValueChange={(value, details) => {
              const parsed = sortDirectionSchema.safeParse(value);
              if (!parsed.success) return details.cancel();
              setDirection(parsed.data);
            }}
          >
            <SegmentedControlIndicator className={segmentedIndicator} />
            <SegmentedControlItem value={SortDirection.Desc} className={segmentedItem}>
              {t(`desc.${key}`)}
            </SegmentedControlItem>
            <SegmentedControlItem value={SortDirection.Asc} className={segmentedItem}>
              {t(`asc.${key}`)}
            </SegmentedControlItem>
          </SegmentedControl>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {list(items, t("before"), false)}
          {list(sorted, t("after"), true)}
        </div>
        {result && result.status !== "ok" ? (
          <WriteOutcome result={result} onDismiss={() => setResult(null)} />
        ) : null}
        <div className="flex justify-end gap-2">
          <DialogClose className={buttonClass("ghost")}>{t("cancel")}</DialogClose>
          <Button
            className={buttonClass("primary")}
            disabled={unchanged || pending}
            onClick={apply}
          >
            {pending ? t("applying") : unchanged ? t("alreadySorted") : t("submit")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
