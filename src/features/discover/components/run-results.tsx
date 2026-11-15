"use client";

import { Button } from "@ui-sdk/react/button";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@ui-sdk/react/collapsible";
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
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@ui-sdk/react/menu";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { StatePanel } from "@/components/feedback/state-panel";
import { Cover } from "@/components/ui/cover";
import { alert, buttonClass, cardFlat, chipClass, heading } from "@/components/ui/styles";
import { addToPlaylist, saveAsPlaylist } from "../actions";
import type { Suggestion } from "../types";

export type RunView = {
  title: string;
  suggestions: Suggestion[];
  unmatched: string[];
  /** Matched tracks before filters; null for reopened runs. */
  matched: number | null;
  asked: number | null;
  filteredOut: number;
  reopened: boolean;
  /** How many suggestions the run returned, before the listener removed any. */
  initialCount: number;
  /** Pre-generated demo answers rather than a model call. */
  pregenerated: boolean;
};

export type PlaylistTarget = { id: string; name: string };

type Notice = { tone: "info" | "danger"; text: string } | null;

export function RunResults({
  run,
  onRemove,
  onRegenerate,
  canRegenerate,
  canWrite,
  editablePlaylists,
}: {
  run: RunView;
  onRemove: (trackId: string) => void;
  onRegenerate: () => void;
  canRegenerate: boolean;
  canWrite: boolean;
  editablePlaylists: readonly PlaylistTarget[];
}) {
  const t = useTranslations("discover.results");
  const tShell = useTranslations("shell");
  const [notice, setNotice] = useState<Notice>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState(run.title.replace(/[“”„]/g, ""));
  const [saving, setSaving] = useState(false);
  const trackIds = run.suggestions.map((s) => s.track.id);
  const empty = run.suggestions.length === 0;

  const save = async () => {
    setSaving(true);
    try {
      const result = await saveAsPlaylist({ name, trackIds });
      if (result.ok) {
        setNotice({ tone: "info", text: t("saved", { name: result.data.name }) });
        setSaveOpen(false);
      } else {
        setNotice({ tone: "danger", text: t("writeFailed") });
      }
    } catch {
      setNotice({ tone: "danger", text: t("writeFailed") });
    } finally {
      setSaving(false);
    }
  };

  const add = async (playlistId: string) => {
    const result = await addToPlaylist({ playlistId, trackIds }).catch(() => null);
    setNotice(
      result?.ok
        ? { tone: "info", text: t("added", { count: trackIds.length, name: result.data.name }) }
        : { tone: "danger", text: t("writeFailed") },
    );
  };

  return (
    <section aria-labelledby="discover-results" className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="discover-results" className={heading.h2}>
            {t("heading", { count: run.suggestions.length, title: run.title })}
          </h2>
          <span className="text-muted text-sm">
            {run.reopened || run.asked === null || run.matched === null
              ? t("reopened")
              : t("summary", { matched: run.matched, asked: run.asked })}
          </span>
          {run.filteredOut > 0 ? (
            <span className="text-muted text-sm">{t("filtered", { count: run.filteredOut })}</span>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {canRegenerate ? (
            <Button type="button" onClick={onRegenerate} className={buttonClass("ghost", "sm")}>
              {t("regenerate")}
            </Button>
          ) : null}
          {canWrite ? (
            <>
              <Menu
                onAction={async (playlistId) => {
                  await add(playlistId);
                }}
              >
                <MenuTrigger disabled={empty} className={buttonClass("secondary", "sm")}>
                  {t("addToPlaylist")}
                </MenuTrigger>
                <MenuContent
                  sideOffset={6}
                  className="z-50 max-h-[min(360px,var(--available-height))] min-w-56 overflow-auto rounded-2xl border border-line bg-surface p-1.5 shadow-lg"
                >
                  {editablePlaylists.length === 0 ? (
                    <MenuItem value="" disabled className="px-3 py-2.5 text-muted text-sm">
                      {t("noEditable")}
                    </MenuItem>
                  ) : (
                    editablePlaylists.map((playlist) => (
                      <MenuItem
                        key={playlist.id}
                        value={playlist.id}
                        className="cursor-pointer rounded-xl px-3 py-2.5 text-sm data-highlighted:bg-surface-2 data-pending:opacity-60"
                      >
                        {playlist.name}
                      </MenuItem>
                    ))
                  )}
                </MenuContent>
              </Menu>
              <Button
                type="button"
                disabled={empty}
                onClick={() => setSaveOpen(true)}
                className={buttonClass("primary", "sm")}
              >
                {t("saveAsNew")}
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {notice ? (
        <div
          role={notice.tone === "danger" ? "alert" : "status"}
          className={`${alert.base} ${notice.tone === "danger" ? alert.tone.danger : alert.tone.neutral}`}
        >
          {notice.text}
        </div>
      ) : null}

      {run.pregenerated ? (
        <div className={`${alert.base} ${alert.tone.info}`}>
          <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-ink px-2.5 font-semibold text-on-ink text-xs">
            {tShell("demo")}
          </span>
          <span>{t("demoNotice")}</span>
        </div>
      ) : null}

      {empty ? (
        run.initialCount > 0 ? (
          <StatePanel title={t("allRemovedTitle")} body={t("allRemovedBody")} />
        ) : (
          <StatePanel title={t("emptyTitle")} body={t("emptyBody")} />
        )
      ) : (
        <ul className={`${cardFlat} m-0 list-none px-[18px] py-1`}>
          {run.suggestions.map(({ track, reason, closestMatch }) => (
            <li
              key={track.id}
              className="flex items-start gap-3.5 border-line border-b py-3.5 last:border-b-0"
            >
              <Cover cover={track.album.cover} size={56} />
              <div className="flex min-w-0 grow flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <b className="truncate">{track.name}</b>
                  <span className="text-muted text-sm">
                    {track.artists.map((a) => a.name).join(", ")}
                  </span>
                  {closestMatch ? (
                    <span className={chipClass("butter", "h-[22px]")}>{t("closestMatch")}</span>
                  ) : null}
                </div>
                {reason ? (
                  <p className="m-0 max-w-[720px] text-sm leading-normal">{reason}</p>
                ) : null}
              </div>
              {track.externalUrl ? (
                <a
                  href={track.externalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonClass("ghost", "sm", "size-9 px-0")}
                >
                  <span className="sr-only">{t("open", { title: track.name })}</span>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
                  </svg>
                </a>
              ) : null}
              <Button
                type="button"
                aria-label={t("remove", { title: track.name })}
                onClick={() => onRemove(track.id)}
                className={buttonClass("ghost", "sm", "size-9 px-0")}
              >
                <span aria-hidden="true">✕</span>
              </Button>
            </li>
          ))}
        </ul>
      )}

      {run.unmatched.length > 0 ? (
        <Collapsible className={`${cardFlat} px-[18px] py-3.5`}>
          <CollapsibleTrigger className="flex min-h-6 w-full cursor-pointer items-center justify-between gap-3 text-left text-sm">
            <span>
              <b>{t("unmatchedSummary", { count: run.unmatched.length })}</b>
              <span className="text-muted"> — {t("unmatchedHint")}</span>
            </span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </CollapsibleTrigger>
          <CollapsiblePanel>
            <ul className="mt-2.5 mb-0 text-muted text-sm leading-[1.8]">
              {run.unmatched.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </CollapsiblePanel>
        </Collapsible>
      ) : null}

      {canWrite ? (
        <Dialog open={saveOpen} onOpenChange={(open) => setSaveOpen(open)}>
          <DialogBackdrop className="fixed inset-0 z-40 bg-black/30" />
          <DialogContent className="fixed top-1/2 left-1/2 z-50 flex w-[min(440px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-3xl border border-line bg-surface p-6 text-ink shadow-2xl">
            <div className="flex flex-col gap-1">
              <DialogTitle className={heading.h2}>{t("saveDialog.title")}</DialogTitle>
              <DialogDescription className="m-0 text-muted text-sm">
                {t("saveDialog.description", { count: trackIds.length })}
              </DialogDescription>
            </div>
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (name.trim() && !saving) void save();
              }}
            >
              <Field className="flex flex-col gap-2">
                <FieldLabel className="font-semibold text-sm">
                  {t("saveDialog.nameLabel")}
                </FieldLabel>
                <Input
                  value={name}
                  onValueChange={setName}
                  maxLength={100}
                  required
                  className="min-h-11 w-full rounded-2xl border border-line-strong bg-surface px-4 text-base focus-visible:outline-2 focus-visible:outline-violet"
                />
              </Field>
              <div className="flex justify-end gap-2">
                <DialogClose className={buttonClass("ghost", "sm")}>
                  {t("saveDialog.cancel")}
                </DialogClose>
                <Button
                  type="submit"
                  disabled={!name.trim() || saving}
                  data-pending={saving ? "" : undefined}
                  className={buttonClass("primary", "sm")}
                >
                  {t("saveDialog.confirm")}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}
    </section>
  );
}
