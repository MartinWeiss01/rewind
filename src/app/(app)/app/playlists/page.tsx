import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { match } from "ts-pattern";
import { StatePanel } from "@/components/feedback/state-panel";
import { buttonClass } from "@/components/ui/styles";
import { DataMode } from "@/data/music-data-source";
import { LibraryControls } from "@/features/playlists/components/library-controls";
import { LibraryGrid, LibraryList } from "@/features/playlists/components/library-views";
import { MergeButton } from "@/features/playlists/components/merge-button";
import { NewPlaylistDialog } from "@/features/playlists/components/new-playlist-dialog";
import { filterLibrary, LibraryView, parseLibraryParams } from "@/features/playlists/library";
import { loadLibrary } from "@/features/playlists/load";
import { FeatureFlag } from "@/server/feature-flags";
import { getRequestContext } from "@/server/request-context";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("screens.playlists");
  return { title: t("title") };
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [t, context, raw] = await Promise.all([
    getTranslations("playlists.library"),
    getRequestContext(),
    searchParams,
  ]);
  const params = parseLibraryParams(raw);
  const library = await loadLibrary(context);
  const shown = filterLibrary(library, params);
  const canWrite = context.flags.has(FeatureFlag.PlaylistWrite);
  const isDemo = context.source.mode === DataMode.Demo;
  const yours = library.filter((p) => p.editable).length;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="eyebrow">{t("count", { total: library.length, yours })}</span>
          <h1 className="m-0 font-display font-extrabold text-[40px] leading-[1.05] tracking-tight">
            {t("title")}
          </h1>
        </div>
        {canWrite ? (
          <div className="flex flex-wrap gap-2.5">
            <MergeButton
              playlists={library.map((p) => ({
                id: p.id,
                name: p.name,
                trackCount: p.trackCount,
                editable: p.editable,
                readable: p.durationMs !== null,
              }))}
            />
            <NewPlaylistDialog isDemo={isDemo} />
          </div>
        ) : null}
      </div>

      {library.length === 0 ? (
        <StatePanel
          title={t("emptyTitle")}
          body={t("emptyBody")}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {canWrite ? <NewPlaylistDialog isDemo={isDemo} /> : null}
              <Link href="/app/discover" className={buttonClass("ghost")}>
                {t("tryDiscover")}
              </Link>
            </div>
          }
        />
      ) : (
        <>
          <LibraryControls params={params} />
          {shown.length === 0 ? (
            <StatePanel title={t("noMatchTitle")} body={t("noMatchBody")} />
          ) : (
            match(params.view)
              .with(LibraryView.Grid, () => <LibraryGrid playlists={shown} />)
              .with(LibraryView.List, () => <LibraryList playlists={shown} />)
              .exhaustive()
          )}
          <p className="m-0 text-muted text-xs">{t("readOnlyNote")}</p>
        </>
      )}
    </>
  );
}
