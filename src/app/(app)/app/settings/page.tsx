import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ScreenHeader } from "@/components/feedback/screen-header";
import { ThemeSwitch } from "@/components/preferences/theme-switch";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("screens.settings");
  return { title: t("title") };
}

export default async function Page() {
  const t = await getTranslations();
  return (
    <>
      <ScreenHeader eyebrow={t("screens.settings.eyebrow")} title={t("screens.settings.title")} />
      <section
        aria-labelledby="appearance-heading"
        className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-line bg-surface p-[22px]"
      >
        <div className="flex flex-col gap-1">
          <h2
            id="appearance-heading"
            className="m-0 font-bold font-display text-2xl tracking-tight"
          >
            {t("settings.appearance")}
          </h2>
          <span className="text-muted text-sm">{t("settings.theme")}</span>
        </div>
        <ThemeSwitch />
      </section>
    </>
  );
}
