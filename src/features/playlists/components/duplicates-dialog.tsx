"use client";

import { Button } from "@ui-sdk/react/button";
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@ui-sdk/react/dialog";
import { Radio, RadioGroup, RadioIndicator } from "@ui-sdk/react/radio";
import {
  SegmentedControl,
  SegmentedControlIndicator,
  SegmentedControlItem,
} from "@ui-sdk/react/segmented-control";
import { useFormatter, useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";
import { match } from "ts-pattern";
import { StatePanel } from "@/components/feedback/state-panel";
import { Cover } from "@/components/ui/cover";
import { segmentedIndicator, segmentedItem, segmentedRoot } from "@/components/ui/segmented";
import { alert, buttonClass, chipClass } from "@/components/ui/styles";
import type { PlaylistItem } from "@/domain/playlists";
import { applyEditAction } from "../actions";
import { ChangeKind, writeFailure } from "../changes";
import {
  findDuplicateGroups,
  keysToRemove,
  MatchLevel,
  matchLevelSchema,
  matchLevels,
} from "../duplicates";
import { useNotice } from "./notice";
import { dialogBackdrop, dialogContent, dialogTitle, fieldHint, fieldLabel } from "./ui";
import { usePlaylistWrite } from "./use-playlist-write";
import { WriteOutcome } from "./write-outcome";

const reasonTone = (level: MatchLevel) =>
  match(level)
    .with(MatchLevel.Exact, () => "neutral" as const)
    .with(MatchLevel.Recording, () => "violet" as const)
    .with(MatchLevel.TitleAllArtists, () => "butter" as const)
    .with(MatchLevel.TitleSharedArtist, () => "mint" as const)
    .with(MatchLevel.Title, () => "coral" as const)
    .exhaustive();

/** Finds duplicate groups at a chosen strictness and removes all but one per group. */
export function DuplicatesDialog({
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
  plays: Readonly<Record<string, number>> | null;
}) {
  const t = useTranslations("playlistTools.duplicates");
  const format = useFormatter();
  const notify = useNotice();
  const levelLabel = useId();
  const [level, setLevel] = useState<MatchLevel>(MatchLevel.Recording);
  const [keep, setKeep] = useState<Record<string, string>>({});
  const write = usePlaylistWrite(applyEditAction);
  const failure = writeFailure(write);

  const groups = useMemo(() => findDuplicateGroups(items, level), [items, level]);
  const removing = useMemo(() => keysToRemove(groups, keep), [groups, keep]);

  const apply = () => {
    const trackIds = items.filter((i) => !removing.has(i.key)).map((i) => i.track.id);
    write.mutate(
      { playlistId, basedOn, trackIds, kind: ChangeKind.RemoveDuplicates },
      {
        onSuccess: (outcome) => {
          if (outcome.status !== "ok") return;
          onOpenChange(false);
          setKeep({});
          write.reset();
          notify({
            kind: "done",
            message: t("done", { count: outcome.count }),
            playlistId,
            snapshotId: outcome.snapshotId,
          });
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
          <span id={levelLabel} className={fieldLabel}>
            {t("strictness")}
          </span>
          <SegmentedControl
            aria-labelledby={levelLabel}
            className={`${segmentedRoot} flex-wrap self-start rounded-3xl`}
            value={level}
            onValueChange={(value, details) => {
              const parsed = matchLevelSchema.safeParse(value);
              if (!parsed.success) return details.cancel();
              setLevel(parsed.data);
              setKeep({});
            }}
          >
            <SegmentedControlIndicator className={segmentedIndicator} />
            {matchLevels.map((l) => (
              <SegmentedControlItem key={l} value={l} className={segmentedItem}>
                {t(`level.${l}`)}
              </SegmentedControlItem>
            ))}
          </SegmentedControl>
          <span className={fieldHint}>{t(`hint.${level}`)}</span>
        </div>

        {groups.length === 0 ? (
          <StatePanel title={t("emptyTitle")} body={t("emptyBody")} />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>
                <b>{t("groups", { count: groups.length })}</b> ·{" "}
                {t("willRemove", { count: removing.size })}
              </span>
              <Button className={buttonClass("ghost", "sm")} onClick={() => setKeep({})}>
                {t("keepOldest")}
              </Button>
            </div>
            <div className="flex max-h-[46dvh] flex-col gap-3 overflow-auto pr-1">
              {groups.map((group) => {
                const kept = keep[group.id] ?? group.keepKey;
                return (
                  <fieldset
                    key={group.id}
                    className="m-0 flex flex-col gap-1 rounded-2xl border border-line p-3"
                  >
                    <legend className="px-1">
                      <span className={chipClass(reasonTone(group.reason), "h-6")}>
                        {t(`reason.${group.reason}`)}
                      </span>
                    </legend>
                    <RadioGroup
                      aria-label={t("keepLabel", { title: group.items[0]?.track.name ?? "" })}
                      value={kept}
                      onValueChange={(value) => {
                        if (typeof value === "string") setKeep({ ...keep, [group.id]: value });
                      }}
                      className="flex flex-col gap-1"
                    >
                      {group.items.map((item) => {
                        const isKept = item.key === kept;
                        const meta = [
                          item.track.album.name,
                          item.addedAt
                            ? t("addedOn", {
                                date: format.dateTime(item.addedAt, { dateStyle: "medium" }),
                              })
                            : null,
                          plays ? t("plays", { count: plays[item.track.id] ?? 0 }) : null,
                        ]
                          .filter(Boolean)
                          .join(" · ");
                        return (
                          // biome-ignore lint/a11y/noLabelWithoutControl: the ui-sdk Radio inside is the labelled control
                          <label
                            key={item.key}
                            className={`flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 ${isKept ? "bg-surface-2" : ""}`}
                          >
                            <Radio
                              value={item.key}
                              className="grid size-[18px] shrink-0 place-items-center rounded-full border-[1.5px] border-line-strong data-checked:border-ink"
                            >
                              <RadioIndicator className="size-2.5 rounded-full bg-ink" />
                            </Radio>
                            <Cover cover={item.track.album.cover} size={40} />
                            <span className="flex min-w-0 flex-1 flex-col">
                              <span className="truncate font-semibold">{item.track.name}</span>
                              <span className="truncate text-muted text-sm">{meta}</span>
                            </span>
                            <span className={chipClass(isKept ? "mint" : "coral", "h-6 shrink-0")}>
                              {isKept ? t("keep") : t("remove")}
                            </span>
                          </label>
                        );
                      })}
                    </RadioGroup>
                  </fieldset>
                );
              })}
            </div>
            <div className={`${alert.base} ${alert.tone.neutral}`}>{t("snapshotNote")}</div>
          </>
        )}

        {failure ? <WriteOutcome result={failure} onDismiss={() => write.reset()} /> : null}

        <div className="flex justify-end gap-2">
          <DialogClose className={buttonClass("ghost")}>{t("cancel")}</DialogClose>
          <Button
            className={buttonClass("danger")}
            disabled={removing.size === 0 || write.isPending}
            onClick={apply}
          >
            {write.isPending ? t("removing") : t("submit", { count: removing.size })}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
