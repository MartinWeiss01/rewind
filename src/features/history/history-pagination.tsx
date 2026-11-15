"use client";

import {
  Pagination,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationList,
  PaginationNext,
  PaginationPrevious,
} from "@ui-sdk/react/pagination";
import type { Route } from "next";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import { button } from "@/components/ui/styles";
import { HISTORY_PAGE_SIZE, type HistoryFilters, historyHref } from "./query";

/** Lets ui-sdk's pagination parts render as client-side links; they pass `href` from getHref. */
function RouterLink({ href, ...props }: ComponentProps<"a">) {
  if (!href) return <a {...props} />;
  return <Link {...props} href={href as Route} scroll={false} />;
}

const step = `${button.base} ${button.size.sm} ${button.variant.secondary} data-disabled:cursor-not-allowed data-disabled:opacity-50`;
const pageLink = `${button.base} ${button.size.sm} ${button.variant.ghost} min-w-9 px-2 data-current:bg-ink data-current:text-on-ink`;

/** "1–50 of 1,412 plays" plus page links that keep every other filter. */
export function HistoryPagination({ filters, total }: { filters: HistoryFilters; total: number }) {
  const t = useTranslations("history");
  const format = useFormatter();
  const first = (filters.page - 1) * HISTORY_PAGE_SIZE + 1;
  const last = Math.min(filters.page * HISTORY_PAGE_SIZE, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-muted text-sm">
        {t("showing", {
          first: format.number(first),
          last: format.number(last),
          total,
        })}
      </span>
      {total > HISTORY_PAGE_SIZE ? (
        <Pagination
          aria-label={t("pagination")}
          total={total}
          pageSize={HISTORY_PAGE_SIZE}
          page={filters.page}
          getHref={(page) => historyHref(filters, { page })}
        >
          <PaginationList className="m-0 flex list-none flex-wrap items-center gap-1 p-0">
            {({ items }) => (
              <>
                <PaginationItem>
                  <PaginationPrevious render={<RouterLink />} className={step}>
                    {t("previous")}
                  </PaginationPrevious>
                </PaginationItem>
                {items.map((item) => (
                  <PaginationItem key={item}>
                    {typeof item === "number" ? (
                      <PaginationLink page={item} render={<RouterLink />} className={pageLink} />
                    ) : (
                      <PaginationEllipsis className="px-1 text-muted" />
                    )}
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext render={<RouterLink />} className={step}>
                    {t("next")}
                  </PaginationNext>
                </PaginationItem>
              </>
            )}
          </PaginationList>
        </Pagination>
      ) : null}
    </div>
  );
}
