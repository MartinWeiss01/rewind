"use client";

import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { ExternalLinkIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { match } from "ts-pattern";
import { Cover } from "@/components/ui/cover";
import { buttonClass, chipClass } from "@/components/ui/styles";
import { PlaySort } from "@/data/music-data-source";
import { PlaySource } from "@/domain/listening";
import type { TrackItem } from "@/features/stats/view";
import { type HistoryFilters, historyHref } from "./query";

/** One row of the plays table, formatted on the server. */
export type HistoryRow = {
  key: string;
  played: string;
  listened: string;
  skipped: boolean;
  source: PlaySource;
  album: string;
  track: TrackItem;
};

const features = tableFeatures({});
const helper = createColumnHelper<typeof features, HistoryRow>();

function SortLink({
  label,
  href,
  direction,
}: {
  label: string;
  href: string;
  direction: "descending" | "ascending" | null;
}) {
  return (
    <Link
      href={href as Route}
      scroll={false}
      className="inline-flex items-center gap-1 text-inherit no-underline hover:text-ink"
    >
      {label}
      <span aria-hidden="true">
        {direction === "descending" ? "↓" : direction === "ascending" ? "↑" : ""}
      </span>
    </Link>
  );
}

const th =
  "whitespace-nowrap border-line border-b px-3.5 py-3 text-left font-mono font-semibold text-[11px] text-muted uppercase tracking-[0.1em]";
const td = "border-line border-b px-3.5 py-2.5 align-middle";

/** Plays with server-side sorting, filtering and pagination (all driven by the URL). */
export function PlaysTable({ rows, filters }: { rows: HistoryRow[]; filters: HistoryFilters }) {
  const t = useTranslations("history");

  const columns = useMemo(() => {
    const playedDirection = match(filters.sort)
      .with(PlaySort.Newest, () => "descending" as const)
      .with(PlaySort.Oldest, () => "ascending" as const)
      .with(PlaySort.Longest, () => null)
      .exhaustive();
    return helper.columns([
      helper.accessor("played", {
        header: () => (
          <SortLink
            label={t("columns.played")}
            direction={playedDirection}
            href={historyHref(filters, {
              sort: filters.sort === PlaySort.Newest ? PlaySort.Oldest : PlaySort.Newest,
              page: 1,
            })}
          />
        ),
        cell: ({ row }) => (
          <span className="whitespace-nowrap font-mono text-sm">{row.original.played}</span>
        ),
      }),
      helper.accessor("track", {
        header: () => t("columns.track"),
        cell: ({ row }) => (
          <div className="flex flex-nowrap items-center gap-3">
            <Cover cover={row.original.track.cover} size={36} />
            <div className="min-w-0">
              <div className="max-w-[320px] truncate font-semibold text-[15px]">
                {row.original.track.name}
              </div>
              <div className="max-w-[320px] truncate text-muted text-sm">
                {row.original.track.artists}
              </div>
            </div>
          </div>
        ),
      }),
      helper.accessor("album", {
        header: () => t("columns.album"),
        cell: ({ row }) => <span className="text-muted text-sm">{row.original.album}</span>,
      }),
      helper.accessor("listened", {
        header: () => (
          <SortLink
            label={t("columns.listened")}
            direction={filters.sort === PlaySort.Longest ? "descending" : null}
            href={historyHref(filters, { sort: PlaySort.Longest, page: 1 })}
          />
        ),
        cell: ({ row }) => (
          <span className="whitespace-nowrap font-mono text-sm">
            {row.original.listened}
            {row.original.skipped ? (
              <span className={chipClass("coral", "ml-1.5 h-[22px]")}>{t("skip")}</span>
            ) : null}
          </span>
        ),
      }),
      helper.accessor("source", {
        header: () => t("columns.source"),
        cell: ({ row }) => (
          <span
            className={chipClass(
              row.original.source === PlaySource.Imported ? "violet" : "mint",
              "h-6",
            )}
          >
            {t(`source.${row.original.source}`)}
          </span>
        ),
      }),
      helper.display({
        id: "open",
        header: () => <span className="sr-only">{t("columns.actions")}</span>,
        cell: ({ row }) =>
          row.original.track.externalUrl ? (
            <a
              href={row.original.track.externalUrl}
              target="_blank"
              rel="noreferrer"
              className={buttonClass("ghost", "sm", "size-9 px-0")}
            >
              <ExternalLinkIcon size={16} aria-hidden="true" />
              <span className="sr-only">
                {t("openInSpotify", { track: row.original.track.name })}
              </span>
            </a>
          ) : null,
      }),
    ]);
  }, [filters, t]);

  const table = useTable({ features, columns, data: rows, getRowId: (row) => row.key });

  const ariaSort = (id: string) =>
    match(id)
      .with("played", () =>
        filters.sort === PlaySort.Newest
          ? ("descending" as const)
          : filters.sort === PlaySort.Oldest
            ? ("ascending" as const)
            : undefined,
      )
      .with("listened", () =>
        filters.sort === PlaySort.Longest ? ("descending" as const) : undefined,
      )
      .otherwise(() => undefined);

  return (
    <div className="overflow-x-auto rounded-[18px] border border-line bg-surface">
      <table className="w-full border-collapse">
        <caption className="sr-only">{t("tableCaption")}</caption>
        <thead>
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => (
                <th
                  key={header.id}
                  scope="col"
                  aria-sort={ariaSort(header.column.id)}
                  className={th}
                >
                  {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="[&:last-child>td]:border-b-0">
              {row.getAllCells().map((cell) => (
                <td key={cell.id} className={td}>
                  <table.FlexRender cell={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
