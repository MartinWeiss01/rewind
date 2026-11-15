import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { DataMode } from "@/data/music-data-source";
import { DiscoverScreen } from "@/features/discover/components/discover-screen";
import { readAiConfig } from "@/server/ai";
import { FeatureFlag } from "@/server/feature-flags";
import { requireFlag } from "@/server/require-flag";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("screens.discover");
  return { title: t("title") };
}

const earlierLimit = 5;

export default async function Page() {
  const { source, flags } = await requireFlag(FeatureFlag.Ai);
  const [t, format, playlists, generations, rules] = await Promise.all([
    getTranslations("discover"),
    getFormatter(),
    source.listPlaylists(),
    source.listGenerations(earlierLimit),
    source.getListeningRules(),
  ]);
  const isDemo = source.mode === DataMode.Demo;
  const ai = readAiConfig(process.env);
  const note = isDemo
    ? ai.demoLiveAi
      ? t("form.noteDemoLive")
      : t("form.noteDemo")
    : t("form.noteLive");

  return (
    <>
      <div className="relative flex flex-col gap-2">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-12 right-[6%] hidden h-[170px] w-[200px] rounded-[48%_52%_45%_55%] bg-butter-soft md:block"
        />
        <span className="eyebrow relative">{t("eyebrow")}</span>
        <h1 className="relative m-0 font-display font-extrabold text-[40px] leading-[1.05] tracking-tight">
          {t("title")}
        </h1>
        <p className="relative m-0 max-w-[600px] text-muted">{t("intro")}</p>
      </div>
      <DiscoverScreen
        playlists={playlists
          .filter((p) => p.trackCount > 0)
          .map((p) => ({ id: p.id, name: p.name, trackCount: p.trackCount }))}
        editablePlaylists={playlists
          .filter((p) => p.editable)
          .map((p) => ({ id: p.id, name: p.name }))}
        earlier={generations.map((g) => ({
          id: g.id,
          when: format.dateTime(g.createdAt, {
            month: "short",
            day: "numeric",
            timeZone: rules.timeZone,
          }),
          title: g.title,
          trackCount: g.trackIds.length,
          unmatchedCount: g.unmatched.length,
        }))}
        canWrite={flags.has(FeatureFlag.PlaylistWrite)}
        note={note}
      />
    </>
  );
}
