import { RewindIcon } from "lucide-react";
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
        <RewindIcon size={16} fill="currentColor" aria-hidden="true" />
      </span>
      {t("appName")}
    </Link>
  );
}
