import Link from "next/link";
import { getTranslations } from "next-intl/server";

export async function Logo({ href }: { href: "/" | "/app" }) {
  const t = await getTranslations("common");
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 font-display font-extrabold text-[22px] tracking-tight"
    >
      <span
        aria-hidden="true"
        className="grid size-[34px] place-items-center rounded-full bg-ink text-bg"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M11 6v12L3 12zM21 6v12l-8-6z" />
        </svg>
      </span>
      {t("appName")}
    </Link>
  );
}
