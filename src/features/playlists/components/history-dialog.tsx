"use client";

import { Button } from "@ui-sdk/react/button";
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@ui-sdk/react/dialog";
import { useFormatter, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { match } from "ts-pattern";
import { StatePanel } from "@/components/feedback/state-panel";
import { alert, buttonClass } from "@/components/ui/styles";
import type { PlaylistSnapshot } from "@/domain/playlists";
import { restoreSnapshotAction } from "../actions";
import { ChangeKind, parseChangeLabel, type WriteResult } from "../changes";
import { useNotice } from "./notice";
import { dialogBackdrop, dialogContent, dialogTitle } from "./ui";
import { WriteOutcome } from "./write-outcome";

const dotColor = (kind: ChangeKind | null) =>
  match(kind)
    .with(ChangeKind.RemoveDuplicates, () => "bg-coral")
    .with(ChangeKind.Sort, () => "bg-violet")
    .with(ChangeKind.Merge, () => "bg-mint")
    .with(ChangeKind.Restore, () => "bg-butter")
    .with(ChangeKind.Edit, null, () => "bg-ink-2")
    .exhaustive();

/** Snapshots saved before bulk changes, newest first, each restorable. */
export function HistoryDialog({
  open,
  onOpenChange,
  playlistId,
  snapshots,
  canRestore,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playlistId: string;
  snapshots: readonly PlaylistSnapshot[];
  canRestore: boolean;
}) {
  const t = useTranslations("playlistTools.history");
  const format = useFormatter();
  const notify = useNotice();
  const [restoring, setRestoring] = useState<string | null>(null);
  const [result, setResult] = useState<WriteResult | null>(null);
  const [, startTransition] = useTransition();

  const restore = (snapshot: PlaylistSnapshot) => {
    setRestoring(snapshot.id);
    startTransition(async () => {
      const outcome = await restoreSnapshotAction({ playlistId, snapshotId: snapshot.id });
      setRestoring(null);
      if (outcome.status === "ok") {
        onOpenChange(false);
        setResult(null);
        notify({
          kind: "done",
          message: t("done", {
            date: format.dateTime(snapshot.createdAt, { dateStyle: "medium", timeStyle: "short" }),
          }),
          playlistId,
          snapshotId: outcome.snapshotId,
        });
      } else {
        setResult(outcome);
      }
    });
  };

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
        <div className="flex flex-col gap-1">
          <DialogTitle className={dialogTitle}>{t("title")}</DialogTitle>
          <DialogDescription className="m-0 text-muted text-sm">
            {t("description")}
          </DialogDescription>
        </div>
        {snapshots.length === 0 ? (
          <StatePanel title={t("emptyTitle")} body={t("emptyBody")} />
        ) : (
          <ol className="m-0 flex max-h-[50dvh] list-none flex-col overflow-auto p-0">
            {snapshots.map((snapshot) => {
              const label = parseChangeLabel(snapshot.label);
              return (
                <li
                  key={snapshot.id}
                  className="flex items-center gap-3.5 border-line border-b px-1 py-3 last:border-b-0"
                >
                  <span
                    aria-hidden="true"
                    className={`size-2 shrink-0 rounded-full ${dotColor(label?.kind ?? null)}`}
                  />
                  <div className="min-w-0 flex-1">
                    <b className="block truncate">
                      {label ? t(`kind.${label.kind}`, { count: label.count }) : snapshot.label}
                    </b>
                    <span className="text-muted text-sm">
                      {t("meta", {
                        date: format.dateTime(snapshot.createdAt, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }),
                        count: snapshot.trackIds.length,
                      })}
                    </span>
                  </div>
                  {canRestore ? (
                    <Button
                      className={buttonClass("secondary", "sm")}
                      disabled={restoring !== null}
                      onClick={() => restore(snapshot)}
                    >
                      {restoring === snapshot.id ? t("restoring") : t("restore")}
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
        <div className={`${alert.base} ${alert.tone.info}`}>{t("note")}</div>
        {result && result.status !== "ok" ? (
          <WriteOutcome result={result} onDismiss={() => setResult(null)} />
        ) : null}
        <div className="flex justify-end">
          <DialogClose className={buttonClass("ghost")}>{t("close")}</DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
