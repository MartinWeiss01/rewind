import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { LocaleSwitch } from "@/components/preferences/locale-switch";
import { Logo } from "@/components/shell/logo";

export default async function MarketingLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("common");
  return (
    <>
      <header className="mx-auto flex w-full max-w-[1240px] flex-wrap items-center justify-between gap-3 px-[clamp(16px,3vw,40px)] pt-5">
        <Logo href="/" />
        <div className="flex items-center gap-3">
          <LocaleSwitch />
          <Link
            href="/app"
            className="inline-flex min-h-9 items-center rounded-full border border-line-strong px-4 font-semibold text-sm"
          >
            {t("tryDemo")}
          </Link>
        </div>
      </header>
      <main id="content" className="mx-auto w-full max-w-[1240px] px-[clamp(16px,3vw,40px)]">
        {children}
      </main>
    </>
  );
}
