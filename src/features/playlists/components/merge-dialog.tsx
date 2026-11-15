"use client";

import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@ui-sdk/react/alert-dialog";
import { Button } from "@ui-sdk/react/button";
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
import { Field, FieldLabel } from "@ui-sdk/react/field";
import { Input } from "@ui-sdk/react/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@ui-sdk/react/select";
import { Switch, SwitchThumb } from "@ui-sdk/react/switch";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useMemo, useState, useTransition } from "react";
import { z } from "zod";
import { Skeleton } from "@/components/feedback/skeleton";
import { alert, buttonClass } from "@/components/ui/styles";
import { type MergePreview, mergeAction, previewMergeAction } from "../actions";
import type { WriteResult } from "../changes";
import { useNotice } from "./notice";
import {
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
import { WriteOutcome } from "./write-outcome";

/** A playlist offered as a merge source or target. */
export type MergeOption = {
  id: string;
  name: string;
  trackCount: number;
  editable: boolean;
  /** Whether its items can be read, so it can be a source. */
  readable: boolean;
};

const NEW_TARGET = "new";

/** Merge one or more playlists into an existing playlist or a new one. */
export function MergeDialog({
  open,
  onOpenChange,
  playlists,
  defaultTargetId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playlists: readonly MergeOption[];
  /** Preselected target; null starts with a new playlist. */
  defaultTargetId: string | null;
}) {
  const t = useTranslations("playlistTools.merge");
  const format = useFormatter();
  const router = useRouter();
  const notify = useNotice();
  const [target, setTarget] = useState<string>(defaultTargetId ?? NEW_TARGET);
  const [newName, setNewName] = useState("");
  const [sources, setSources] = useState<string[]>([]);
  const [skipExisting, setSkipExisting] = useState(true);
  const [deleteSources, setDeleteSources] = useState(false);
  const [preview, setPreview] = useState<MergePreview | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<WriteResult | null>(null);
  const [pending, startTransition] = useTransition();

  const targetId = target === NEW_TARGET ? null : target;
  const sourceOptions = playlists.filter((p) => p.readable && p.id !== targetId);
  const chosen = useMemo(() => sources.filter((id) => id !== targetId), [sources, targetId]);
  const nameOf = (id: string) => playlists.find((p) => p.id === id)?.name ?? id;

  useEffect(() => {
    if (!open || chosen.length === 0) {
      setPreview(null);
      return;
    }
    let current = true;
    setPreview(null);
    previewMergeAction({ targetId, sourceIds: chosen, skipExisting }).then((next) => {
      if (current) setPreview(next);
    });
    return () => {
      current = false;
    };
  }, [open, chosen, targetId, skipExisting]);

  const reset = () => {
    setTarget(defaultTargetId ?? NEW_TARGET);
    setNewName("");
    setSources([]);
    setSkipExisting(true);
    setDeleteSources(false);
    setResult(null);
  };

  const run = () => {
    startTransition(async () => {
      const outcome = await mergeAction({
        targetId,
        newName: targetId ? null : newName.trim() || null,
        sourceIds: chosen,
        skipExisting,
        deleteSources,
      });
      setResult(outcome);
      if (outcome.status === "ok") {
        onOpenChange(false);
        reset();
        if (outcome.playlistId === defaultTargetId) {
          notify({
            kind: "done",
            message: t("done", { count: outcome.count }),
            playlistId: outcome.playlistId,
            snapshotId: outcome.snapshotId,
          });
        } else {
          router.push(`/app/playlists/${encodeURIComponent(outcome.playlistId)}`);
        }
      }
    });
  };

  const canMerge =
    chosen.length > 0 &&
    (targetId !== null || newName.trim().length > 0) &&
    preview?.status === "ok" &&
    !pending;
  const added = preview?.status === "ok" ? preview.added : 0;

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          onOpenChange(next);
          if (!next) reset();
        }}
      >
        <DialogBackdrop className={dialogBackdrop} />
        <DialogContent className={dialogContent}>
          <div className="flex flex-col gap-1">
            <DialogTitle className={dialogTitle}>{t("title")}</DialogTitle>
            <DialogDescription className="m-0 text-muted text-sm">
              {t("description")}
            </DialogDescription>
          </div>

          <Combobox
            multiple
            value={sources}
            onValueChange={(value) => {
              const parsed = z.array(z.string()).safeParse(value);
              if (parsed.success) setSources(parsed.data);
            }}
            itemToLabel={(value) => nameOf(String(value))}
          >
            <div className="flex flex-col gap-1.5">
              <ComboboxLabel className={fieldLabel}>{t("sources")}</ComboboxLabel>
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
                          aria-label={t("removeSource", { name: state.labels[index] ?? "" })}
                          className="grid size-5 cursor-pointer place-items-center rounded-full hover:bg-line"
                        >
                          ×
                        </ComboboxChipRemove>
                      </ComboboxChip>
                    ))
                  }
                </ComboboxValue>
                <ComboboxInput
                  placeholder={t("sourcesPlaceholder")}
                  className="min-w-[140px] flex-1 border-0 bg-transparent outline-none"
                />
              </ComboboxChips>
              <span className={fieldHint}>{t("sourcesHint")}</span>
            </div>
            <ComboboxContent className={`${popup} max-h-72 overflow-auto`}>
              <ComboboxEmpty className="px-3 py-2 text-muted text-sm">
                {t("noSources")}
              </ComboboxEmpty>
              <ComboboxList>
                {sourceOptions.map((p) => (
                  <ComboboxItem
                    key={p.id}
                    value={p.id}
                    label={p.name}
                    className={`${popupItem} flex-row! items-center! justify-between`}
                  >
                    <span className="truncate">{p.name}</span>
                    <span className="flex items-center gap-2 font-mono text-muted text-xs">
                      {format.number(p.trackCount)}
                      <ComboboxItemIndicator>✓</ComboboxItemIndicator>
                    </span>
                  </ComboboxItem>
                ))}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>

          <Select
            value={target}
            onValueChange={(value) => {
              if (typeof value === "string") setTarget(value);
            }}
          >
            <div className="flex flex-col gap-1.5">
              <SelectLabel className={fieldLabel}>{t("into")}</SelectLabel>
              <SelectTrigger className={`${input} flex items-center justify-between text-left`}>
                <SelectValue placeholder={t("newPlaylist")} />
                <span aria-hidden="true">▾</span>
              </SelectTrigger>
            </div>
            <SelectContent className={`${popup} max-h-72 overflow-auto`}>
              <SelectItem
                value={NEW_TARGET}
                label={t("newPlaylist")}
                className={`${popupItem} flex-row!`}
              >
                {t("newPlaylist")}
                <SelectItemIndicator className="ms-auto">✓</SelectItemIndicator>
              </SelectItem>
              {playlists
                .filter((p) => p.editable)
                .map((p) => (
                  <SelectItem
                    key={p.id}
                    value={p.id}
                    label={p.name}
                    className={`${popupItem} flex-row!`}
                  >
                    <span className="truncate">{p.name}</span>
                    <SelectItemIndicator className="ms-auto">✓</SelectItemIndicator>
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>

          {targetId === null ? (
            <Field className="flex flex-col gap-1.5">
              <FieldLabel className={fieldLabel}>{t("newName")}</FieldLabel>
              <Input
                required
                maxLength={100}
                value={newName}
                onValueChange={setNewName}
                className={input}
              />
            </Field>
          ) : null}

          {/* biome-ignore lint/a11y/noLabelWithoutControl: the ui-sdk Switch inside is the labelled control */}
          <label className="flex items-center justify-between gap-4 text-sm">
            {t("skipExisting")}
            <Switch checked={skipExisting} onCheckedChange={setSkipExisting} className={switchRoot}>
              <SwitchThumb className={switchThumb} />
            </Switch>
          </label>
          {/* biome-ignore lint/a11y/noLabelWithoutControl: the ui-sdk Switch inside is the labelled control */}
          <label className="flex items-center justify-between gap-4 text-sm">
            {t("deleteSources")}
            <Switch
              checked={deleteSources}
              onCheckedChange={setDeleteSources}
              className={switchRoot}
            >
              <SwitchThumb className={switchThumb} />
            </Switch>
          </label>

          {chosen.length === 0 ? null : preview === null ? (
            <div aria-busy="true" className="grid grid-cols-3 gap-3">
              <Skeleton className="h-20 rounded-2xl" />
              <Skeleton className="h-20 rounded-2xl" />
              <Skeleton className="h-20 rounded-2xl" />
            </div>
          ) : preview.status === "error" ? (
            <div role="alert" className={`${alert.base} ${alert.tone.danger}`}>
              {t(`previewError.${preview.error}`)}
            </div>
          ) : (
            <dl className="m-0 grid grid-cols-3 gap-3">
              {[
                [t("added"), `+${format.number(preview.added)}`],
                [t("skipped"), format.number(preview.skipped)],
                [t("after"), format.number(preview.total)],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex flex-col-reverse gap-1 rounded-2xl border border-line p-4"
                >
                  <dt className="text-sm">{label}</dt>
                  <dd className="m-0 font-display font-extrabold text-3xl">{value}</dd>
                </div>
              ))}
            </dl>
          )}

          {result && result.status !== "ok" ? (
            <WriteOutcome result={result} onDismiss={() => setResult(null)} />
          ) : null}

          <div className="flex justify-end gap-2">
            <DialogClose className={buttonClass("ghost")}>{t("cancel")}</DialogClose>
            <Button
              className={buttonClass("primary")}
              disabled={!canMerge}
              onClick={() => (deleteSources ? setConfirming(true) : run())}
            >
              {pending ? t("merging") : t("submit", { count: added })}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirming}
        onOpenChange={(next, details) => {
          setConfirming(next);
          if (!next && details.returnValue === "confirm") run();
        }}
      >
        <AlertDialogBackdrop className={dialogBackdrop} />
        <AlertDialogContent className={`${dialogContent} max-w-[480px]`}>
          <AlertDialogTitle className={dialogTitle}>
            {t("confirmTitle", { count: chosen.length })}
          </AlertDialogTitle>
          <AlertDialogDescription className="m-0 text-sm">
            {t("confirmBody", { names: chosen.map(nameOf).join(", ") })}
          </AlertDialogDescription>
          <div className="flex justify-end gap-2">
            <AlertDialogClose className={buttonClass("ghost")}>{t("cancel")}</AlertDialogClose>
            <AlertDialogClose value="confirm" className={buttonClass("danger")}>
              {t("confirm")}
            </AlertDialogClose>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
