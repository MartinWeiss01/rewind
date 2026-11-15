import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { match } from "ts-pattern";
import { z } from "zod";
import { alert } from "@/components/ui/styles";

const loginSchema = z
  .enum(["cancelled", "forbidden", "failed", "unavailable"])
  .optional()
  .catch(undefined);

export default async function LandingPage({ searchParams }: PageProps<"/">) {
  const t = await getTranslations();
  const login = loginSchema.parse((await searchParams).login);
  const loginMessage =
    login &&
    match(login)
      .with("cancelled", () => t("marketing.loginCancelled"))
      .with("forbidden", () => t("marketing.loginForbidden"))
      .with("failed", () => t("marketing.loginFailed"))
      .with("unavailable", () => t("marketing.loginUnavailable"))
      .exhaustive();
  return (
    <section className="flex flex-col items-start gap-6 py-[clamp(48px,10vw,120px)]">
      {loginMessage ? (
        <div role="status" className={`${alert.base} ${alert.tone.info}`}>
          {loginMessage}
        </div>
      ) : null}
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
