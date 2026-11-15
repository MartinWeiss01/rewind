"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { navItems } from "./nav-items";

/** Floating navigation at the bottom of every app screen. */
export function Dock() {
  const t = useTranslations();
  const pathname = usePathname();

  return (
    <nav
      aria-label={t("shell.mainNavigation")}
      className="fixed bottom-[22px] left-1/2 z-10 flex max-w-[calc(100%-24px)] -translate-x-1/2 items-center gap-1 overflow-x-auto rounded-full bg-ink p-2 shadow-[0_24px_50px_-20px_rgba(0,0,0,.55)]"
    >
      {navItems.map((item) => {
        const current = item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={current ? "page" : undefined}
            aria-label={t(`nav.${item.key}`)}
            className="group flex min-h-12 items-center gap-2 whitespace-nowrap rounded-full px-3.5 font-semibold text-on-ink text-sm aria-[current=page]:bg-bg aria-[current=page]:px-[18px] aria-[current=page]:text-ink"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d={item.icon} />
            </svg>
            <span className="hidden group-aria-[current=page]:inline">{t(`nav.${item.key}`)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
