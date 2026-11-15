import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function LandingPage() {
  const t = await getTranslations();
  return (
    <section className="flex flex-col items-start gap-6 py-[clamp(48px,10vw,120px)]">
      <span className="eyebrow">{t("marketing.eyebrow")}</span>
      <h1 className="m-0 max-w-[14ch] font-display font-extrabold text-[clamp(48px,8vw,104px)] leading-[0.95] tracking-tighter">
        {t("marketing.title")}
      </h1>
      <p className="m-0 max-w-[56ch] text-lg text-muted leading-relaxed">{t("marketing.lead")}</p>
      <Link
        href="/app"
        className="inline-flex min-h-[52px] items-center rounded-full bg-ink px-7 font-semibold text-on-ink"
      >
        {t("common.tryDemo")}
      </Link>
      <span className="text-muted text-sm">{t("common.demoNote")}</span>
    </section>
  );
}
