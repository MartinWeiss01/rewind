import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { cache } from "react";
import { z } from "zod";
import { StatePanel } from "@/components/feedback/state-panel";
import { alert, buttonClass, chipClass } from "@/components/ui/styles";
import { AddTracks } from "@/features/playlists/components/add-tracks";
import { CoverMosaic } from "@/features/playlists/components/cover-mosaic";
import { Insights } from "@/features/playlists/components/insights";
import { durationFormatter } from "@/features/playlists/components/library-views";
import { NoticeProvider } from "@/features/playlists/components/notice";
import { PlaylistTools } from "@/features/playlists/components/playlist-tools";
import { TrackTable } from "@/features/playlists/components/track-table";
import {
  defaultBadgeLevel,
  findDuplicateGroups,
  keysToRemove,
} from "@/features/playlists/duplicates";
import { loadLibrary, loadPlays } from "@/features/playlists/load";
import { playlistInsights } from "@/features/playlists/tools";
import { FeatureFlag } from "@/server/feature-flags";
import { getRequestContext } from "@/server/request-context";

const paramsSchema = z.object({ id: z.string().min(1).max(200) });

type Props = { params: Promise<{ id: string }> };

const loadPlaylist = cache(async (id: string) => {
  const { source } = await getRequestContext();
  return source.getPlaylist(id);
});

async function playlistFrom(params: Props["params"]) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) notFound();
  const playlist = await loadPlaylist(parsed.data.id);
  if (!playlist) notFound();
  return playlist;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const parsed = paramsSchema.safeParse(await params);
  const playlist = parsed.success ? await loadPlaylist(parsed.data.id) : null;
  const t = await getTranslations("screens.playlists");
  return { title: playlist?.name ?? t("title") };
}

export default async function Page({ params }: Props) {
  const playlist = await playlistFrom(params);
  const context = await getRequestContext();
  const t = await getTranslations("playlists");
  const duration = await durationFormatter();
  const canWrite = context.flags.has(FeatureFlag.PlaylistWrite) && playlist.editable;
  const items = playlist.items;

  const [playMap, snapshots, library, rules] = await Promise.all([
    items ? loadPlays(context) : null,
    playlist.editable ? context.source.listSnapshots(playlist.id) : [],
    canWrite ? loadLibrary(context) : [],
    context.source.getListeningRules(),
  ]);
  const plays = playMap ? Object.fromEntries(playMap) : null;
  const duplicateKeys = items
    ? [...keysToRemove(findDuplicateGroups(items, defaultBadgeLevel))]
    : [];
  const insights = items ? playlistInsights(items, context.now, rules.timeZone) : null;
  const playTotals =
    items && playMap
      ? {
          total: items.reduce((sum, i) => sum + (playMap.get(i.track.id) ?? 0), 0),
          unplayed: new Set(items.filter((i) => !playMap.get(i.track.id)).map((i) => i.track.id))
            .size,
        }
      : null;

  const eyebrow = [
    t("detail.eyebrow"),
    playlist.editable ? t("detail.yours") : t("detail.byOwner", { owner: playlist.ownerName }),
    playlist.isPublic ? t("detail.public") : t("detail.private"),
  ].join(" · ");

  return (
    <NoticeProvider>
      <nav aria-label={t("detail.breadcrumb")} className="text-muted text-sm">
        <Link href="/app/playlists" className="text-ink">
          {t("detail.backToPlaylists")}
        </Link>{" "}
        / <span aria-current="page">{playlist.name}</span>
      </nav>

      <header className="flex flex-wrap items-end gap-7">
        <CoverMosaic
          covers={playlist.covers}
          size={220}
          className="shadow-[0_1px_0_rgba(23,20,15,.04),0_24px_48px_-24px_rgba(60,40,10,.22)]"
        />
        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-2.5">
          <span className="eyebrow">{eyebrow}</span>
          <h1 className="m-0 font-display font-extrabold text-[clamp(40px,5vw,72px)] leading-[0.95] tracking-tighter [overflow-wrap:anywhere]">
            {playlist.name}
          </h1>
          {playlist.description ? (
            <p className="m-0 max-w-[620px] text-muted">{playlist.description}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3.5 font-mono text-sm">
            <span>{t("tracks", { count: playlist.trackCount })}</span>
            {insights ? <span>{duration(insights.durationMs)}</span> : null}
            {duplicateKeys.length > 0 ? (
              <span className={chipClass("coral", "h-6 font-sans")}>
                {t("duplicates", { count: duplicateKeys.length })}
              </span>
            ) : null}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-2.5">
            {canWrite && items ? (
              <a href="#add-tracks" className={buttonClass("primary")}>
                <PlusIcon size={18} aria-hidden="true" />
                {t("add.title")}
              </a>
            ) : null}
            <PlaylistTools
              playlistId={playlist.id}
              playlistName={playlist.name}
              basedOn={playlist.snapshotId}
              items={items ?? []}
              plays={plays}
              snapshots={snapshots}
              canWrite={canWrite && items !== null}
              canUseAi={context.flags.has(FeatureFlag.Ai)}
              mergeOptions={library.map((p) => ({
                id: p.id,
                name: p.name,
                trackCount: p.trackCount,
                editable: p.editable,
                readable: p.durationMs !== null,
              }))}
            />
            {playlist.externalUrl ? (
              <a
                href={playlist.externalUrl}
                className={buttonClass("ghost")}
                rel="noreferrer"
                target="_blank"
              >
                {t("detail.openInSpotify")}
              </a>
            ) : null}
          </div>
        </div>
      </header>

      {items === null ? (
        <div className={`${alert.base} ${alert.tone.info}`}>
          <span>
            <b>{t("detail.readOnlyTitle")}</b> {t("detail.readOnlyBody")}
          </span>
        </div>
      ) : (
        <>
          {!playlist.editable ? (
            <div className={`${alert.base} ${alert.tone.neutral}`}>{t("detail.followedNote")}</div>
          ) : null}
          {insights && items.length > 0 ? (
            <Insights insights={insights} plays={playTotals} />
          ) : null}
          {items.length === 0 ? (
            <StatePanel
              title={t("detail.emptyTitle")}
              body={t("detail.emptyBody")}
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  {canWrite ? (
                    <a href="#add-tracks" className={buttonClass("primary", "sm")}>
                      {t("add.title")}
                    </a>
                  ) : null}
                  <Link href="/app/discover" className={buttonClass("ghost", "sm")}>
                    {t("detail.suggest")}
                  </Link>
                </div>
              }
            />
          ) : (
            <TrackTable
              key={playlist.snapshotId}
              playlistId={playlist.id}
              basedOn={playlist.snapshotId}
              items={items}
              plays={plays}
              duplicateKeys={duplicateKeys}
              canEdit={canWrite}
            />
          )}
          {canWrite ? (
            <AddTracks playlistId={playlist.id} existingTrackIds={items.map((i) => i.track.id)} />
          ) : null}
        </>
      )}
    </NoticeProvider>
  );
}
