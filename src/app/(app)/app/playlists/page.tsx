import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ScreenHeader } from "@/components/feedback/screen-header";
import { StatePanel } from "@/components/feedback/state-panel";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("screens.playlists");
  return { title: t("title") };
}

export default async function Page() {
  const t = await getTranslations();
  return (
    <>
      <ScreenHeader eyebrow={t("screens.playlists.eyebrow")} title={t("screens.playlists.title")} />
      <StatePanel title={t("placeholder.title")} body={t("placeholder.body")} />
    </>
  );
}
