"use client";

import { Button } from "@ui-sdk/react/button";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { match } from "ts-pattern";
import { alert, buttonClass } from "@/components/ui/styles";
import { restoreSnapshotAction } from "../actions";
import { PartialStage, type WriteResult } from "../changes";

type Failure = Exclude<WriteResult, { status: "ok" }>;

/**
 * Shows why a write failed. A partial failure explains what went through and,
 * when a snapshot was saved first, offers to restore it.
 */
export function WriteOutcome({ result, onDismiss }: { result: Failure; onDismiss?: () => void }) {
  const t = useTranslations("playlistTools.outcome");
  const [restoring, startRestore] = useTransition();
  const [restored, setRestored] = useState<WriteResult | null>(null);

  if (result.status === "error") {
    return (
      <div role="alert" className={`${alert.base} ${alert.tone.danger}`}>
        <span>{t(`error.${result.error}`)}</span>
      </div>
    );
  }

  const body = match(result.stage)
    .with(PartialStage.Items, () => t("partialItems"))
    .with(PartialStage.Sources, () =>
      t("partialSources", { done: result.done ?? 0, total: result.total ?? 0 }),
    )
    .with(PartialStage.Playlists, () =>
      t("partialPlaylists", { done: result.done ?? 0, total: result.total ?? 0 }),
    )
    .exhaustive();

  const snapshotId = result.snapshotId;
  return (
    <div role="alert" className={`${alert.base} ${alert.tone.danger} flex-col`}>
      <b>{t("partialTitle")}</b>
      <span>{body}</span>
      {restored?.status === "ok" ? (
        <span role="status">{t("restored")}</span>
      ) : restored ? (
        <span>{t("restoreFailed")}</span>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {snapshotId && restored?.status !== "ok" ? (
          <Button
            className={buttonClass("primary", "sm")}
            disabled={restoring}
            onClick={() =>
              startRestore(async () => {
                setRestored(
                  await restoreSnapshotAction({ playlistId: result.playlistId, snapshotId }),
                );
              })
            }
          >
            {restoring ? t("restoring") : t("restore")}
          </Button>
        ) : null}
        {onDismiss ? (
          <Button className={buttonClass("ghost", "sm")} onClick={onDismiss}>
            {t("leave")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
