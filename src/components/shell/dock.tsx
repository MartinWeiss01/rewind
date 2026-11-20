"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { FeatureFlag } from "@/server/feature-flags";
import { navItems } from "./nav-items";

/** Floating navigation at the bottom of every app screen. */
export function Dock({ flags, isDemo }: { flags: readonly FeatureFlag[]; isDemo: boolean }) {
  const t = useTranslations();
  const pathname = usePathname();

  return (
    <nav
      aria-label={t("shell.mainNavigation")}
      className="fixed bottom-[22px] left-1/2 z-10 flex max-w-[calc(100%-24px)] -translate-x-1/2 items-center gap-1 overflow-x-auto rounded-full bg-ink p-2 shadow-[0_24px_50px_-20px_rgba(0,0,0,.55)]"
    >
      {navItems
        .filter((item) => !item.flag || flags.includes(item.flag))
        .map((item) => {
          const current =
            item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={current ? "page" : undefined}
              aria-label={t(`nav.${item.key}`)}
              className="group flex min-h-12 items-center gap-2 whitespace-nowrap rounded-full px-3.5 font-semibold text-on-ink text-sm aria-[current=page]:bg-bg aria-[current=page]:px-[18px] aria-[current=page]:text-ink"
            >
              <item.icon size={20} aria-hidden="true" />
              <span className="hidden group-aria-[current=page]:inline">
                {t(`nav.${item.key}`)}
              </span>
            </Link>
          );
        })}
      {isDemo ? (
        <span className="ml-1 inline-flex h-7 items-center rounded-full bg-butter px-3 font-semibold text-[#17140f] text-xs">
          {t("shell.demo")}
        </span>
      ) : null}
    </nav>
  );
}
