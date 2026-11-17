"use client";

import { useMutation } from "@tanstack/react-query";
import { Button } from "@ui-sdk/react/button";
import { Checkbox, CheckboxIndicator } from "@ui-sdk/react/checkbox";
import {
  Combobox,
  ComboboxChip,
  ComboboxChipRemove,
  ComboboxChips,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxLabel,
  ComboboxList,
  ComboboxValue,
} from "@ui-sdk/react/combobox";
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
  SelectTrigger,
  SelectValue,
} from "@ui-sdk/react/select";
import { Switch, SwitchThumb } from "@ui-sdk/react/switch";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";
import { match } from "ts-pattern";
import { z } from "zod";
import { Skeleton } from "@/components/feedback/skeleton";
import { StatePanel } from "@/components/feedback/state-panel";
import { Cover } from "@/components/ui/cover";
import { segmentedIndicator, segmentedItem, segmentedRoot } from "@/components/ui/segmented";
import { alert, buttonClass, chipClass } from "@/components/ui/styles";
import type { Track } from "@/domain/music";
import type { PlaylistItem } from "@/domain/playlists";
import { writeFailure } from "../changes";
import {
  ConfidenceLevel,
  confidenceLevelSchema,
  confidenceThreshold,
  keepOption,
  SortIntoError,
  type SortSuggestion,
  sortIntoLimits,
} from "../sort-into";
import { applySortAction, suggestSortAction } from "../sort-into-actions";
import type { MergeOption } from "./merge-dialog";
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
  switchRoot,
  switchThumb,
} from "./ui";
import { usePlaylistWrite } from "./use-playlist-write";
import { WriteOutcome } from "./write-outcome";

const Step = { Setup: "setup", Review: "review", Done: "done" } as const;
type Step = (typeof Step)[keyof typeof Step];

const Filter = { All: "all", Unsure: "unsure" } as const;
type Filter = (typeof Filter)[keyof typeof Filter];
const filterSchema = z.enum(Filter);

/** Per track: where it goes (a target ID or `keep`) and whether it is ticked. */
type Choice = { to: string; on: boolean };

const CheckIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3.5"
    aria-hidden="true"
  >
    <path d="M5 12l5 5L20 7" />
  </svg>
);

const barColor = (confidence: number) =>
  confidence >= 0.75 ? "bg-ink" : confidence >= 0.5 ? "bg-violet" : "bg-coral";

/** Initial choices: a suggestion starts ticked when it is sure enough for the level. */
function defaultChoices(
  suggestions: readonly SortSuggestion[],
  level: ConfidenceLevel,
): Map<string, Choice> {
  const threshold = confidenceThreshold[level];
  return new Map(
    suggestions.map((s) => [
      s.trackId,
      {
        to: s.targetId ?? keepOption,
        on: s.targetId !== null && s.confidence >= threshold,
      },
    ]),
  );
}

/** Sorts this playlist's tracks into other playlists with AI suggestions, reviewed first. */
export function SortIntoDialog({
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
  playlists: readonly MergeOption[];
}) {
  const t = useTranslations("playlistTools.sortInto");
  const router = useRouter();
  const levelLabel = useId();
  const showLabel = useId();
  const [step, setStep] = useState<Step>(Step.Setup);
  const [targets, setTargets] = useState<string[]>([]);
  const [level, setLevel] = useState<ConfidenceLevel>(ConfidenceLevel.Balanced);
  const [removeFromSource, setRemoveFromSource] = useState(true);
  const [skipExisting, setSkipExisting] = useState(true);
  const [choices, setChoices] = useState<Map<string, Choice>>(new Map());
  const [filter, setFilter] = useState<Filter>(Filter.All);
  const [only, setOnly] = useState<string | null>(null);
  const [suggestedFor, setSuggestedFor] = useState<string | null>(null);

  const suggest = useMutation({ mutationFn: suggestSortAction });
  const write = usePlaylistWrite(applySortAction);
  const failure = writeFailure(write);

  const options = playlists.filter((p) => p.editable && p.readable && p.id !== playlistId);
  const nameOf = (id: string) => playlists.find((p) => p.id === id)?.name ?? id;
  const tracks = useMemo(() => {
    const seen = new Map<string, Track>();
    for (const item of items) if (!seen.has(item.track.id)) seen.set(item.track.id, item.track);
    return [...seen.values()];
  }, [items]);

  const suggestions = suggest.data?.status === "ok" ? suggest.data.suggestions : null;
  const confidenceOf = useMemo(
    () => new Map((suggestions ?? []).map((s) => [s.trackId, s.confidence])),
    [suggestions],
  );

  const reset = () => {
    setStep(Step.Setup);
    setTargets([]);
    setLevel(ConfidenceLevel.Balanced);
    setRemoveFromSource(true);
    setSkipExisting(true);
    setChoices(new Map());
    setFilter(Filter.All);
    setOnly(null);
    setSuggestedFor(null);
    suggest.reset();
    write.reset();
  };

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      if (step === Step.Done) router.refresh();
      reset();
    }
  };

  const runSuggest = () => {
    setStep(Step.Review);
    setFilter(Filter.All);
    setOnly(null);
    const key = targets.join("\n");
    // Same playlists as last time: reuse the answers, only the ticks follow the level.
    if (suggestedFor === key && suggestions) {
      setChoices(defaultChoices(suggestions, level));
      return;
    }
    suggest.mutate(
      { playlistId, targetIds: targets },
      {
        onSuccess: (result) => {
          if (result.status !== "ok") return;
          setSuggestedFor(key);
          setChoices(defaultChoices(result.suggestions, level));
        },
      },
    );
  };

  const moves = [...choices.entries()].flatMap(([trackId, c]) =>
    c.on && c.to !== keepOption ? [{ trackId, targetId: c.to }] : [],
  );
  const movedTo = (id: string) => moves.filter((m) => m.targetId === id).length;

  const apply = () => {
    write.mutate(
      { playlistId, basedOn, moves, removeFromSource, skipExisting },
      {
        onSuccess: (outcome) => {
          if (outcome.status === "ok") setStep(Step.Done);
        },
      },
    );
  };

  const setChoice = (trackId: string, next: Partial<Choice>) =>
    setChoices((current) => {
      const copy = new Map(current);
      const before = copy.get(trackId) ?? { to: keepOption, on: false };
      copy.set(trackId, { ...before, ...next });
      return copy;
    });

  const rows = useMemo(() => {
    const list = tracks.filter((track) => {
      if (!only) return true;
      return choices.get(track.id)?.to === only;
    });
    return filter === Filter.Unsure
      ? [...list].sort((a, b) => (confidenceOf.get(a.id) ?? 0) - (confidenceOf.get(b.id) ?? 0))
      : list;
  }, [tracks, only, filter, choices, confidenceOf]);

  const setup = (
    <>
      <div className="flex flex-col gap-1">
        <DialogTitle className={dialogTitle}>{t("title")}</DialogTitle>
        <DialogDescription className="m-0 text-muted text-sm leading-relaxed">
          {t("description", { count: tracks.length, name: playlistName })}
        </DialogDescription>
      </div>

      {options.length === 0 ? (
        <div className={`${alert.base} ${alert.tone.neutral}`}>{t("needTarget")}</div>
      ) : (
        <Combobox
          multiple
          value={targets}
          onValueChange={(value) => {
            const parsed = z.array(z.string()).max(sortIntoLimits.maxTargets).safeParse(value);
            if (parsed.success) setTargets(parsed.data);
          }}
          itemToLabel={(value) => nameOf(String(value))}
        >
          <div className="flex flex-col gap-1.5">
            <ComboboxLabel className={fieldLabel}>{t("targets")}</ComboboxLabel>
            <ComboboxChips className={`${input} flex flex-wrap items-center gap-1.5 py-1.5`}>
              <ComboboxValue>
                {(state) =>
                  (state.value as string[]).map((value, index) => (
                    <ComboboxChip
                      key={value}
                      value={value}
                      className="inline-flex h-7 items-center gap-1 rounded-full bg-surface-2 pr-1 pl-3 font-semibold text-xs"
                    >
                      {state.labels[index]}
                      <ComboboxChipRemove
                        aria-label={t("removeTarget", { name: state.labels[index] ?? "" })}
                        className="grid size-5 cursor-pointer place-items-center rounded-full hover:bg-line"
                      >
                        ×
                      </ComboboxChipRemove>
                    </ComboboxChip>
                  ))
                }
              </ComboboxValue>
              <ComboboxInput
                placeholder={t("targetsPlaceholder")}
                className="min-w-[140px] flex-1 border-0 bg-transparent outline-none"
              />
            </ComboboxChips>
            <span className={fieldHint}>
              {t("targetsHint", { max: sortIntoLimits.maxTargets })}
            </span>
          </div>
          <ComboboxContent className={`${popup} max-h-72 overflow-auto`}>
            <ComboboxEmpty className="px-3 py-2 text-muted text-sm">{t("noTargets")}</ComboboxEmpty>
            <ComboboxList>
              {options.map((p) => (
                <ComboboxItem
                  key={p.id}
                  value={p.id}
                  label={p.name}
                  className={`${popupItem} flex-row! items-center! justify-between`}
                >
                  <span className="truncate">{p.name}</span>
                  <ComboboxItemIndicator>✓</ComboboxItemIndicator>
                </ComboboxItem>
              ))}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      )}

      <div className="flex flex-col gap-2">
        <span id={levelLabel} className={fieldLabel}>
          {t("confidence")}
        </span>
        <SegmentedControl
          aria-labelledby={levelLabel}
          className={`${segmentedRoot} self-start`}
          value={level}
          onValueChange={(value, details) => {
            const parsed = confidenceLevelSchema.safeParse(value);
            if (!parsed.success) return details.cancel();
            setLevel(parsed.data);
          }}
        >
          <SegmentedControlIndicator className={segmentedIndicator} />
          {Object.values(ConfidenceLevel).map((value) => (
            <SegmentedControlItem key={value} value={value} className={segmentedItem}>
              {t(`level.${value}`)}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
        <span className={fieldHint}>{t(`levelHint.${level}`)}</span>
      </div>

      {/* biome-ignore lint/a11y/noLabelWithoutControl: the ui-sdk Switch inside is the labelled control */}
      <label className="flex items-center justify-between gap-4 text-sm">
        {t("removeFromSource", { name: playlistName })}
        <Switch
          checked={removeFromSource}
          onCheckedChange={setRemoveFromSource}
          className={switchRoot}
        >
          <SwitchThumb className={switchThumb} />
        </Switch>
      </label>
      {/* biome-ignore lint/a11y/noLabelWithoutControl: the ui-sdk Switch inside is the labelled control */}
      <label className="flex items-center justify-between gap-4 text-sm">
        {t("skipExisting")}
        <Switch checked={skipExisting} onCheckedChange={setSkipExisting} className={switchRoot}>
          <SwitchThumb className={switchThumb} />
        </Switch>
      </label>

      <div className="flex justify-end gap-2">
        <DialogClose className={buttonClass("ghost")}>{t("cancel")}</DialogClose>
        <Button
          className={buttonClass("primary")}
          disabled={targets.length === 0 || tracks.length === 0}
          onClick={runSuggest}
        >
          {t("suggest", { count: tracks.length })}
        </Button>
      </div>
    </>
  );

  const backButton = (
    <Button className={buttonClass("ghost")} onClick={() => setStep(Step.Setup)}>
      {t("back")}
    </Button>
  );

  const reviewBody = () => {
    if (suggest.isPending) {
      return (
        <div aria-busy="true" className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
            {targets.map((id) => (
              <Skeleton key={id} className="h-20 rounded-2xl" />
            ))}
          </div>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 rounded-xl" />
          ))}
          <span role="status" className="text-muted text-sm">
            {t("deciding", { tracks: tracks.length, targets: targets.length })}
          </span>
        </div>
      );
    }
    const error = suggest.isError
      ? SortIntoError.Provider
      : suggest.data?.status === "error"
        ? suggest.data.error
        : null;
    if (error) {
      const retryable = error === SortIntoError.Timeout || error === SortIntoError.Provider;
      return (
        <StatePanel
          tone={error === SortIntoError.NotConfigured ? "neutral" : "error"}
          title={
            error === SortIntoError.NotConfigured
              ? t("errorTitle.unavailable")
              : t("errorTitle.failed")
          }
          body={match(error)
            .with(SortIntoError.TooLarge, () =>
              t("error.tooLarge", { max: sortIntoLimits.maxTracks }),
            )
            .otherwise((code) => t(`error.${code}`))}
          action={
            <div className="flex gap-2">
              {retryable ? (
                <Button className={buttonClass("primary")} onClick={runSuggest}>
                  {t("retry")}
                </Button>
              ) : null}
              {backButton}
            </div>
          }
        />
      );
    }
    if (!suggestions) return null;
    if (suggestions.every((s) => s.targetId === null)) {
      return (
        <StatePanel
          title={t("emptyTitle")}
          body={t("emptyBody")}
          action={
            <Button className={buttonClass("secondary")} onClick={() => setStep(Step.Setup)}>
              {t("backToSettings")}
            </Button>
          }
        />
      );
    }

    const stay = tracks.length - moves.length;
    return (
      <>
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          {targets.map((id) => (
            <Button
              key={id}
              aria-pressed={only === id}
              aria-label={t("filterBy", { name: nameOf(id) })}
              onClick={() => setOnly(only === id ? null : id)}
              className={`flex cursor-pointer flex-col items-start gap-1 rounded-2xl border border-line p-3 text-left ${only === id ? "bg-surface-2" : "bg-transparent"}`}
            >
              <b className="w-full truncate text-sm">{nameOf(id)}</b>
              <span className="font-display font-extrabold text-[26px]">
                {t("added", { count: movedTo(id) })}
              </span>
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span>
            {t.rich("summary", {
              move: moves.length,
              stay,
              b: (chunks) => <b>{chunks}</b>,
            })}
          </span>
          <span className="flex items-center gap-2">
            <span id={showLabel} className="text-muted">
              {t("show")}
            </span>
            <SegmentedControl
              aria-labelledby={showLabel}
              className={segmentedRoot}
              value={filter}
              onValueChange={(value, details) => {
                const parsed = filterSchema.safeParse(value);
                if (!parsed.success) return details.cancel();
                setFilter(parsed.data);
              }}
            >
              <SegmentedControlIndicator className={segmentedIndicator} />
              <SegmentedControlItem value={Filter.All} className={segmentedItem}>
                {t("filterAll")}
              </SegmentedControlItem>
              <SegmentedControlItem value={Filter.Unsure} className={segmentedItem}>
                {t("filterUnsure")}
              </SegmentedControlItem>
            </SegmentedControl>
          </span>
        </div>
        <div className="max-h-[46dvh] overflow-auto rounded-[18px] border border-line">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="text-left font-mono text-[11px] text-muted uppercase tracking-[0.1em]">
                <th className="w-10 px-3.5 py-2.5">
                  <span className="sr-only">{t("colInclude")}</span>
                </th>
                <th className="px-1.5 py-2.5">{t("colTrack")}</th>
                <th className="w-36 px-1.5 py-2.5">{t("colConfidence")}</th>
                <th className="w-56 px-3.5 py-2.5">{t("colTarget")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((track) => {
                const choice = choices.get(track.id) ?? { to: keepOption, on: false };
                const confidence = confidenceOf.get(track.id) ?? 0;
                const percent = Math.round(confidence * 100);
                const moving = choice.on && choice.to !== keepOption;
                return (
                  <tr
                    key={track.id}
                    className={`border-line border-t ${moving ? "" : "bg-surface-2"}`}
                  >
                    <td className="px-3.5 py-2">
                      <Checkbox
                        aria-label={t("include", { name: track.name })}
                        checked={moving}
                        disabled={choice.to === keepOption}
                        onCheckedChange={(next) => setChoice(track.id, { on: next === true })}
                        className={checkbox}
                      >
                        <CheckboxIndicator>
                          <CheckIcon />
                        </CheckboxIndicator>
                      </Checkbox>
                    </td>
                    <td className="px-1.5 py-2">
                      <span className="flex min-w-0 items-center gap-2.5">
                        <Cover cover={track.album.cover} size={36} />
                        <span className="flex min-w-0 flex-col">
                          <b className="truncate">{track.name}</b>
                          <span className="truncate text-muted text-xs">
                            {track.artists.map((a) => a.name).join(", ")}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className="px-1.5 py-2">
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                          <span
                            className={`block h-full ${barColor(confidence)}`}
                            style={{ width: `${percent}%` }}
                          />
                        </span>
                        <span className="w-9 text-right font-mono text-xs">{percent}%</span>
                      </span>
                    </td>
                    <td className="px-3.5 py-2">
                      <Select
                        value={choice.to}
                        onValueChange={(value) => {
                          if (typeof value !== "string") return;
                          setChoice(track.id, { to: value, on: value !== keepOption });
                        }}
                      >
                        <SelectTrigger
                          aria-label={t("moveTo", { name: track.name })}
                          className={`${input} flex min-h-9 items-center justify-between gap-2 text-left`}
                        >
                          <span className="truncate">
                            <SelectValue />
                          </span>
                          <span aria-hidden="true">▾</span>
                        </SelectTrigger>
                        <SelectContent className={`${popup} max-h-72 overflow-auto`}>
                          {targets.map((id) => (
                            <SelectItem
                              key={id}
                              value={id}
                              label={nameOf(id)}
                              className={`${popupItem} flex-row!`}
                            >
                              <span className="truncate">{nameOf(id)}</span>
                              <SelectItemIndicator className="ms-auto">✓</SelectItemIndicator>
                            </SelectItem>
                          ))}
                          <SelectItem
                            value={keepOption}
                            label={t("keep", { name: playlistName })}
                            className={`${popupItem} flex-row!`}
                          >
                            <span className="truncate">{t("keep", { name: playlistName })}</span>
                            <SelectItemIndicator className="ms-auto">✓</SelectItemIndicator>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className={`${alert.base} ${alert.tone.neutral}`}>{t("snapshotNote")}</div>
        {failure ? <WriteOutcome result={failure} onDismiss={() => write.reset()} /> : null}
        <div className="flex flex-wrap justify-between gap-2">
          {backButton}
          <span className="flex gap-2">
            <DialogClose className={buttonClass("ghost")}>{t("cancel")}</DialogClose>
            <Button
              className={buttonClass("primary")}
              disabled={moves.length === 0 || write.isPending}
              onClick={apply}
            >
              {write.isPending ? t("moving") : t("submit", { count: moves.length })}
            </Button>
          </span>
        </div>
      </>
    );
  };

  const review = (
    <>
      <div className="flex items-center justify-between gap-3">
        <DialogTitle className={dialogTitle}>{t("reviewTitle")}</DialogTitle>
        {suggest.data?.status === "ok" && !suggest.data.live ? (
          <span className={chipClass("neutral")}>{t("demo")}</span>
        ) : null}
      </div>
      {suggest.data?.status === "ok" && !suggest.data.live ? (
        <div className={`${alert.base} ${alert.tone.info}`}>{t("demoNote")}</div>
      ) : null}
      {reviewBody()}
    </>
  );

  const done = (
    <>
      <DialogTitle className={dialogTitle}>{t("doneTitle", { count: moves.length })}</DialogTitle>
      <ul className="m-0 flex list-none flex-col p-0">
        {targets
          .filter((id) => movedTo(id) > 0)
          .map((id) => (
            <li
              key={id}
              className="flex items-center justify-between gap-3 border-line border-b py-2.5 text-sm last:border-b-0"
            >
              <span className="truncate">{nameOf(id)}</span>
              <span className="font-mono">{t("added", { count: movedTo(id) })}</span>
            </li>
          ))}
      </ul>
      <div className={`${alert.base} ${alert.tone.neutral}`}>{t("snapshotNote")}</div>
      <div className="flex justify-end">
        <DialogClose className={buttonClass("primary")}>{t("done")}</DialogClose>
      </div>
    </>
  );

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogBackdrop className={dialogBackdrop} />
      <DialogContent className={`${dialogContent} ${step === Step.Review ? "max-w-[960px]!" : ""}`}>
        {match(step)
          .with(Step.Setup, () => setup)
          .with(Step.Review, () => review)
          .with(Step.Done, () => done)
          .exhaustive()}
      </DialogContent>
    </Dialog>
  );
}
