"use client";

import { useQuery } from "@tanstack/react-query";
import { Button } from "@ui-sdk/react/button";
import { Checkbox, CheckboxGroup, CheckboxIndicator } from "@ui-sdk/react/checkbox";
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@ui-sdk/react/dialog";
import {
  SegmentedControl,
  SegmentedControlIndicator,
  SegmentedControlItem,
} from "@ui-sdk/react/segmented-control";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@ui-sdk/react/select";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";
import { match } from "ts-pattern";
import { z } from "zod";
import { Skeleton } from "@/components/feedback/skeleton";
import { StatePanel } from "@/components/feedback/state-panel";
import { Cover } from "@/components/ui/cover";
import { segmentedIndicator, segmentedItem, segmentedRoot } from "@/components/ui/segmented";
import { alert, buttonClass, chipClass } from "@/components/ui/styles";
import type { PlaylistItem } from "@/domain/playlists";
import { queryKeys } from "@/lib/query-keys";
import { applyEditAction, comparePlaylistAction } from "../actions";
import { ChangeKind, writeFailure } from "../changes";
import { CompareSide, compareSides, findCrossMatches } from "../compare";
import { MatchLevel, matchLevelSchema, matchLevels } from "../duplicates";
import type { MergeOption } from "./merge-dialog";
import { useNotice } from "./notice";
import {
  checkbox,
  dialogBackdrop,
  dialogContent,
  dialogTitle,
  fieldHint,
  fieldLabel,
  input,
  popup,
  popupItem,
} from "./ui";
import { usePlaylistWrite } from "./use-playlist-write";
import { WriteOutcome } from "./write-outcome";

const sideSchema = z.enum(CompareSide);

const reasonTone = (level: MatchLevel) =>
  match(level)
    .with(MatchLevel.Exact, () => "neutral" as const)
    .with(MatchLevel.Recording, () => "violet" as const)
    .with(MatchLevel.TitleAllArtists, () => "butter" as const)
    .with(MatchLevel.TitleSharedArtist, () => "mint" as const)
    .with(MatchLevel.Title, () => "coral" as const)
    .exhaustive();

const CheckMark = () => <CheckIcon size={12} strokeWidth={3} aria-hidden="true" />;

/**
 * Finds songs this playlist shares with another one, at a chosen strictness, and
 * removes the selected matches from either playlist.
 */
export function CompareDialog({
  open,
  onOpenChange,
  playlistId,
  playlistName,
  basedOn,
  items,
  playlists,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playlistId: string;
  playlistName: string;
  basedOn: string;
  items: readonly PlaylistItem[];
  /** Playlists to compare with; the ones whose items can't be read are left out. */
  playlists: readonly MergeOption[];
}) {
  const t = useTranslations("playlistTools.compare");
  const td = useTranslations("playlistTools.duplicates");
  const te = useTranslations("playlistTools.outcome.error");
  const notify = useNotice();
  const levelLabel = useId();
  const sideLabel = useId();
  const [otherId, setOtherId] = useState<string | null>(null);
  const [level, setLevel] = useState<MatchLevel>(MatchLevel.Recording);
  const [side, setSide] = useState<CompareSide>(CompareSide.Here);
  /** Keys of found tracks left out of the removal; everything else is selected. */
  const [excluded, setExcluded] = useState<string[]>([]);
  const write = usePlaylistWrite(applyEditAction);
  const failure = writeFailure(write);

  const options = playlists.filter((p) => p.readable && p.id !== playlistId);
  const other = useQuery({
    queryKey: queryKeys.playlists.compare(otherId ?? ""),
    queryFn: () => comparePlaylistAction(otherId),
    enabled: open && otherId !== null,
  });
  const loaded = other.data?.status === "ok" ? other.data.playlist : null;

  const found = useMemo(() => {
    if (!loaded) return [];
    return side === CompareSide.Here
      ? findCrossMatches(items, loaded.items, level)
      : findCrossMatches(loaded.items, items, level);
  }, [items, loaded, level, side]);
  const removing = useMemo(
    () => new Set(found.map((m) => m.item.key).filter((key) => !excluded.includes(key))),
    [found, excluded],
  );
  const target = side === CompareSide.Here ? null : loaded;
  const targetEditable = side === CompareSide.Here || (loaded?.editable ?? false);
  const nameOf = (s: CompareSide) => (s === CompareSide.Here ? playlistName : (loaded?.name ?? ""));
  const otherSide = side === CompareSide.Here ? CompareSide.There : CompareSide.Here;

  const reset = () => {
    setOtherId(null);
    setLevel(MatchLevel.Recording);
    setSide(CompareSide.Here);
    setExcluded([]);
    write.reset();
  };

  const apply = () => {
    const targetItems = target ? target.items : items;
    const trackIds = targetItems.filter((i) => !removing.has(i.key)).map((i) => i.track.id);
    const targetId = target ? target.id : playlistId;
    const targetName = nameOf(side);
    write.mutate(
      {
        playlistId: targetId,
        basedOn: target ? target.snapshotId : basedOn,
        trackIds,
        kind: ChangeKind.RemoveMatches,
      },
      {
        onSuccess: (outcome) => {
          if (outcome.status !== "ok") return;
          onOpenChange(false);
          reset();
          notify({
            kind: "done",
            message: t("done", { count: outcome.count, name: targetName }),
            playlistId: targetId,
            snapshotId: outcome.snapshotId,
          });
        },
      },
    );
  };

  const body = () => {
    if (otherId === null) return <StatePanel title={t("pickTitle")} body={t("pickBody")} />;
    if (other.isPending)
      return (
        <div aria-busy="true" className="flex flex-col gap-3">
          <span className="sr-only" role="status">
            {t("loading")}
          </span>
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      );
    if (other.isError || other.data.status === "error")
      return (
        <StatePanel
          tone="error"
          title={t("errorTitle")}
          body={other.data?.status === "error" ? te(other.data.error) : t("errorBody")}
          action={
            <Button className={buttonClass("secondary", "sm")} onClick={() => void other.refetch()}>
              {t("retry")}
            </Button>
          }
        />
      );
    if (found.length === 0) return <StatePanel title={t("emptyTitle")} body={t("emptyBody")} />;
    return (
      <>
        <div className="flex flex-col gap-2">
          <span id={sideLabel} className={fieldLabel}>
            {t("removeFrom")}
          </span>
          <SegmentedControl
            aria-labelledby={sideLabel}
            className={`${segmentedRoot} flex-wrap self-start rounded-3xl`}
            value={side}
            onValueChange={(value, details) => {
              const parsed = sideSchema.safeParse(value);
              if (!parsed.success) return details.cancel();
              setSide(parsed.data);
              setExcluded([]);
              write.reset();
            }}
          >
            <SegmentedControlIndicator className={segmentedIndicator} />
            {compareSides.map((s) => (
              <SegmentedControlItem
                key={s}
                value={s}
                className={`${segmentedItem} max-w-60 truncate`}
              >
                {nameOf(s)}
              </SegmentedControlItem>
            ))}
          </SegmentedControl>
          {targetEditable ? null : <span className={fieldHint}>{t("readOnly")}</span>}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span>
            <b>
              {t("found", { count: found.length, name: nameOf(side), other: nameOf(otherSide) })}
            </b>{" "}
            · {t("selected", { count: removing.size })}
          </span>
          <Button
            className={buttonClass("ghost", "sm")}
            onClick={() =>
              setExcluded(removing.size === found.length ? found.map((m) => m.item.key) : [])
            }
          >
            {removing.size === found.length ? t("selectNone") : t("selectAll")}
          </Button>
        </div>

        <CheckboxGroup
          aria-label={t("listLabel", { name: nameOf(side) })}
          value={[...removing]}
          onValueChange={(value) =>
            setExcluded(found.map((m) => m.item.key).filter((key) => !value.includes(key)))
          }
          className="flex max-h-[46dvh] min-h-48 flex-col gap-2 overflow-auto pr-1"
        >
          {found.map(({ item, reason, matches }) => {
            const chosen = removing.has(item.key);
            const describe = (track: PlaylistItem["track"]) =>
              [track.artists.map((a) => a.name).join(", "), track.album.name].join(" · ");
            return (
              // biome-ignore lint/a11y/noLabelWithoutControl: the ui-sdk Checkbox inside is the labelled control
              <label
                key={item.key}
                className={`flex cursor-pointer items-start gap-3 rounded-2xl border border-line p-3 ${chosen ? "" : "opacity-60"}`}
              >
                <Checkbox value={item.key} className={`${checkbox} mt-3`}>
                  <CheckboxIndicator>
                    <CheckMark />
                  </CheckboxIndicator>
                </Checkbox>
                <Cover cover={item.track.album.cover} size={40} />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-semibold">{item.track.name}</span>
                    <span
                      className={chipClass(reasonTone(reason), "h-5 shrink-0 px-2 text-[11px]")}
                    >
                      {td(`reason.${reason}`)}
                    </span>
                  </span>
                  <span className="truncate text-muted text-sm">{describe(item.track)}</span>
                  {matches.map((m) => (
                    <span key={m.key} className="truncate text-muted text-xs">
                      {t("alsoIn", {
                        name: nameOf(otherSide),
                        title: m.track.name,
                        details: describe(m.track),
                      })}
                    </span>
                  ))}
                </span>
              </label>
            );
          })}
        </CheckboxGroup>
        <div className={`${alert.base} ${alert.tone.neutral}`}>{t("snapshotNote")}</div>
      </>
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogBackdrop className={dialogBackdrop} />
      <DialogContent className={`${dialogContent} sm:max-w-[760px]`}>
        <DialogTitle className={dialogTitle}>{t("title")}</DialogTitle>
        <DialogDescription className="m-0 text-muted text-sm">
          {t("description", { name: playlistName })}
        </DialogDescription>

        <Select
          value={otherId}
          onValueChange={(value) => {
            if (typeof value !== "string") return;
            setOtherId(value);
            setExcluded([]);
            setSide(CompareSide.Here);
            write.reset();
          }}
        >
          <div className="flex flex-col gap-1.5">
            <SelectLabel className={fieldLabel}>{t("with")}</SelectLabel>
            <SelectTrigger className={`${input} flex items-center justify-between text-left`}>
              <SelectValue placeholder={t("pick")} />
              <ChevronDownIcon size={16} aria-hidden="true" />
            </SelectTrigger>
          </div>
          <SelectContent className={`${popup} max-h-72 overflow-auto`}>
            {options.map((p) => (
              <SelectItem
                key={p.id}
                value={p.id}
                label={p.name}
                className={`${popupItem} flex-row!`}
              >
                <span className="truncate">{p.name}</span>
                <SelectItemIndicator className="ms-auto">
                  <CheckIcon size={14} aria-hidden="true" />
                </SelectItemIndicator>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex flex-col gap-2">
          <span id={levelLabel} className={fieldLabel}>
            {td("strictness")}
          </span>
          <SegmentedControl
            aria-labelledby={levelLabel}
            className={`${segmentedRoot} flex-wrap self-start rounded-3xl`}
            value={level}
            onValueChange={(value, details) => {
              const parsed = matchLevelSchema.safeParse(value);
              if (!parsed.success) return details.cancel();
              setLevel(parsed.data);
              setExcluded([]);
            }}
          >
            <SegmentedControlIndicator className={segmentedIndicator} />
            {matchLevels.map((l) => (
              <SegmentedControlItem key={l} value={l} className={segmentedItem}>
                {td(`level.${l}`)}
              </SegmentedControlItem>
            ))}
          </SegmentedControl>
          <span className={fieldHint}>{td(`hint.${level}`)}</span>
        </div>

        {body()}

        {failure ? <WriteOutcome result={failure} onDismiss={() => write.reset()} /> : null}

        <div className="flex justify-end gap-2">
          <DialogClose className={buttonClass("ghost")}>{t("cancel")}</DialogClose>
          <Button
            className={buttonClass("danger")}
            disabled={removing.size === 0 || !targetEditable || write.isPending}
            onClick={apply}
          >
            {write.isPending ? t("removing") : t("submit", { count: removing.size })}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
