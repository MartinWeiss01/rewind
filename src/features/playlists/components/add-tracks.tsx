"use client";

import { useAsyncOptions } from "@ui-sdk/react/async-options";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxStatus,
} from "@ui-sdk/react/combobox";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { Cover } from "@/components/ui/cover";
import { chipClass } from "@/components/ui/styles";
import type { Track } from "@/domain/music";
import { addTracksAction, searchTracksAction } from "../actions";
import { useNotice } from "./notice";
import { fieldHint, fieldLabel, input, popup } from "./ui";

/**
 * Search the catalog (up to ten results) and add a track by choosing it.
 * Tracks already in the playlist are marked; adding one again is allowed.
 */
export function AddTracks({
  playlistId,
  existingTrackIds,
}: {
  playlistId: string;
  existingTrackIds: readonly string[];
}) {
  const t = useTranslations("playlists.add");
  const notify = useNotice();
  const [query, setQuery] = useState("");
  const [, startTransition] = useTransition();
  const [adding, setAdding] = useState<string | null>(null);
  const existing = new Set(existingTrackIds);

  // Results are listed by track ID; the tracks themselves are kept here for rendering.
  const found = useRef(new Map<string, Track>());
  const results = useAsyncOptions<{ value: string; label: string }>(
    async (text, { signal }) => {
      const tracks = await searchTracksAction(text);
      signal.throwIfAborted();
      for (const track of tracks) found.current.set(track.id, track);
      return tracks.map((track) => ({ value: track.id, label: track.name }));
    },
    { debounce: 250 },
  );

  const add = (track: Track) => {
    setAdding(track.id);
    startTransition(async () => {
      const result = await addTracksAction({ playlistId, trackIds: [track.id] });
      setAdding(null);
      notify(
        result.status === "ok"
          ? {
              kind: "done",
              message: t("added", { title: track.name }),
              playlistId,
              snapshotId: null,
            }
          : { kind: "failed", result },
      );
    });
  };

  return (
    <section
      id="add-tracks"
      aria-labelledby="add-tracks-heading"
      className="flex flex-col gap-3 rounded-3xl border border-line bg-surface p-[22px]"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="add-tracks-heading" className="m-0 font-bold font-display text-2xl tracking-tight">
          {t("title")}
        </h2>
        <span className="eyebrow">{t("eyebrow")}</span>
      </div>
      <Combobox
        items={results.items}
        filter={false}
        status={results.status}
        query={query}
        value={null}
        onQueryChange={(next, details) => {
          // Only typing and clearing change the search; choosing a track keeps it.
          if (details.reason !== "input-change" && details.reason !== "clear-press") return;
          setQuery(next);
          results.setQuery(next);
        }}
        onValueChange={(value) => {
          const track = typeof value === "string" ? found.current.get(value) : undefined;
          if (track) add(track);
        }}
      >
        <div className="flex flex-col gap-1.5">
          <ComboboxLabel className={fieldLabel}>{t("search")}</ComboboxLabel>
          <ComboboxInput placeholder={t("placeholder")} className={input} />
          <span className={fieldHint}>{t("hint")}</span>
        </div>
        <ComboboxContent
          className={`${popup} max-h-[420px] w-(--anchor-width) overflow-auto`}
          sideOffset={6}
        >
          <ComboboxStatus className="px-3 py-1.5 text-muted text-xs">
            {(state) =>
              state.status === "error"
                ? t("error")
                : state.loading
                  ? t("searching")
                  : t("results", { count: state.count })
            }
          </ComboboxStatus>
          <ComboboxEmpty className="px-3 py-2 text-muted text-sm">
            {(state) =>
              state.empty && !state.loading && state.query.trim()
                ? t("empty", { query: state.query })
                : null
            }
          </ComboboxEmpty>
          <ComboboxList>
            {(state) =>
              (state.items as { value: string; label: string }[]).flatMap(({ value }) => {
                const track = found.current.get(value);
                if (!track) return [];
                return [
                  <ComboboxItem
                    key={track.id}
                    value={track.id}
                    label={track.name}
                    disabled={adding !== null}
                    className="flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 data-disabled:opacity-60 data-highlighted:bg-surface-2"
                  >
                    <Cover cover={track.album.cover} size={40} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-semibold text-sm">{track.name}</span>
                      <span className="truncate text-muted text-xs">
                        {track.artists.map((a) => a.name).join(", ")} · {track.album.name}
                      </span>
                    </span>
                    {existing.has(track.id) ? (
                      <span className={chipClass("neutral", "h-6 shrink-0")}>{t("already")}</span>
                    ) : null}
                    <span className="shrink-0 font-semibold text-xs">
                      {adding === track.id ? t("adding") : t("add")}
                    </span>
                  </ComboboxItem>,
                ];
              })
            }
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </section>
  );
}
