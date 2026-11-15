"use client";

import { Button } from "@ui-sdk/react/button";
import { useTranslations } from "next-intl";
import { createContext, type ReactNode, use, useState, useTransition } from "react";
import { buttonClass } from "@/components/ui/styles";
import { restoreSnapshotAction } from "../actions";
import type { WriteResult } from "../changes";
import { WriteOutcome } from "./write-outcome";

/** A finished write to report: a success line with an optional undo, or a failure. */
export type Notice =
  | { kind: "done"; message: string; playlistId: string; snapshotId: string | null }
  | { kind: "failed"; result: Exclude<WriteResult, { status: "ok" }> };

const NoticeContext = createContext<(notice: Notice | null) => void>(() => {});

/** Lets tools and the track table report results in one place on the playlist screen. */
export function NoticeProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<Notice | null>(null);
  return (
    <NoticeContext value={setNotice}>
      <NoticeBar notice={notice} onDismiss={() => setNotice(null)} onChange={setNotice} />
      {children}
    </NoticeContext>
  );
}

export const useNotice = () => use(NoticeContext);

function NoticeBar({
  notice,
  onDismiss,
  onChange,
}: {
  notice: Notice | null;
  onDismiss: () => void;
  onChange: (notice: Notice | null) => void;
}) {
  const t = useTranslations("playlistTools.outcome");
  const [pending, startTransition] = useTransition();
  // The live region stays mounted so screen readers announce new messages.
  return (
    <div role="status" className="empty:hidden">
      {notice?.kind === "failed" ? (
        <WriteOutcome result={notice.result} onDismiss={onDismiss} />
      ) : null}
      {notice?.kind === "done" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-full bg-ink py-2.5 pr-3 pl-5 text-on-ink text-sm">
          <span>{notice.message}</span>
          <div className="flex gap-1.5">
            {notice.snapshotId ? (
              <Button
                className={buttonClass("ghost", "sm", "text-on-ink! hover:bg-white/10")}
                disabled={pending}
                onClick={() => {
                  const { playlistId, snapshotId } = notice;
                  if (!snapshotId) return;
                  startTransition(async () => {
                    const result = await restoreSnapshotAction({ playlistId, snapshotId });
                    onChange(
                      result.status === "ok"
                        ? { kind: "done", message: t("undone"), playlistId, snapshotId: null }
                        : { kind: "failed", result },
                    );
                  });
                }}
              >
                {pending ? t("restoring") : t("undo")}
              </Button>
            ) : null}
            <Button
              aria-label={t("dismiss")}
              className={buttonClass("ghost", "sm", "text-on-ink! hover:bg-white/10")}
              onClick={onDismiss}
            >
              ✕
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
