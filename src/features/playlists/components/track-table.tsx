"use client";

import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { Button } from "@ui-sdk/react/button";
import { useFormatter, useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";
import { match } from "ts-pattern";
import { Cover } from "@/components/ui/cover";
import { buttonClass, chipClass } from "@/components/ui/styles";
import type { PlaylistItem } from "@/domain/playlists";
import { formatClock } from "@/lib/format";
import { applyEditAction } from "../actions";
import { ChangeKind, thrownWriteFailure } from "../changes";
import { useNotice } from "./notice";
import {
  TrackOrderCheck,
  TrackOrderCheckAll,
  TrackOrderHandle,
  TrackOrderRoot,
  TrackOrderRow,
} from "./track-order";
import { checkbox, table, tableBox, td, th } from "./ui";
import { usePlaylistWrite } from "./use-playlist-write";

type Row = PlaylistItem & { position: number; duplicate: boolean; plays: number | null };

const features = tableFeatures({});
const column = createColumnHelper<typeof features, Row>();

const CheckIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3.5"
    aria-hidden="true"
    className="hidden [[aria-checked=true]>&]:block"
  >
    <path d="M5 12l5 5L20 7" />
  </svg>
);
const MixedIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3.5"
    aria-hidden="true"
    className="hidden [[aria-checked=mixed]>&]:block"
  >
    <path d="M6 12h12" />
  </svg>
);

/**
 * The playlist's items. Owners select rows, remove them, move them to the top or
 * drag them (or use the keyboard) into a new order; nothing is written until Save.
 */
export function TrackTable({
  playlistId,
  basedOn,
  items,
  plays,
  duplicateKeys,
  canEdit,
}: {
  playlistId: string;
  /** The playlist version the rows came from; saving refuses a newer one. */
  basedOn: string;
  items: readonly PlaylistItem[];
  /** Your plays per track ID, or null to hide the column. */
  plays: Readonly<Record<string, number>> | null;
  /** Rows the default duplicate removal would drop. */
  duplicateKeys: readonly string[];
  canEdit: boolean;
}) {
  const t = useTranslations("playlists.detail");
  const format = useFormatter();
  const notify = useNotice();
  const instructions = useId();
  const initialOrder = useMemo(() => items.map((i) => i.key), [items]);
  const [order, setOrder] = useState<string[]>(initialOrder);
  const [selected, setSelected] = useState<string[]>([]);
  const write = usePlaylistWrite(applyEditAction);
  const saving = write.isPending;

  const byKey = useMemo(() => new Map(items.map((i) => [i.key, i])), [items]);
  const duplicates = useMemo(() => new Set(duplicateKeys), [duplicateKeys]);
  const rows = useMemo<Row[]>(
    () =>
      order.flatMap((key, position) => {
        const item = byKey.get(key);
        return item
          ? [
              {
                ...item,
                position: position + 1,
                duplicate: duplicates.has(key),
                plays: plays ? (plays[item.track.id] ?? 0) : null,
              },
            ]
          : [];
      }),
    [order, byKey, duplicates, plays],
  );
  const dirty = order.length !== initialOrder.length || order.some((k, i) => k !== initialOrder[i]);
  const removedCount = initialOrder.length - order.length;

  const columns = useMemo(
    () =>
      column.columns([
        ...(canEdit
          ? [
              column.display({
                id: "select",
                header: () => (
                  <TrackOrderCheckAll aria-label={t("selectAll")} className={checkbox}>
                    <CheckIcon />
                    <MixedIcon />
                  </TrackOrderCheckAll>
                ),
                cell: ({ row }) => (
                  <TrackOrderCheck
                    value={row.id}
                    aria-label={t("selectRow", { title: row.original.track.name })}
                    className={checkbox}
                  >
                    <CheckIcon />
                  </TrackOrderCheck>
                ),
              }),
            ]
          : []),
        column.accessor("position", {
          header: "#",
          cell: (info) => <span className="font-mono text-muted text-xs">{info.getValue()}</span>,
        }),
        column.accessor("track", {
          id: "title",
          header: () => t("columnTitle"),
          cell: ({ row }) => {
            const { track, duplicate } = row.original;
            return (
              <div className="flex min-w-0 items-center gap-3">
                <Cover cover={track.album.cover} size={40} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-semibold">
                    <span className="truncate">{track.name}</span>
                    {duplicate ? (
                      <span className={chipClass("coral", "h-5 shrink-0 px-2 text-[11px]")}>
                        {t("duplicateChip")}
                      </span>
                    ) : null}
                  </div>
                  <div className="truncate text-muted text-sm">
                    {track.artists.map((a) => a.name).join(", ")}
                  </div>
                </div>
              </div>
            );
          },
        }),
        column.accessor((row) => row.track.album.name, {
          id: "album",
          header: () => t("columnAlbum"),
          cell: (info) => <span className="text-muted">{info.getValue()}</span>,
        }),
        column.accessor("addedAt", {
          header: () => t("columnAdded"),
          cell: (info) => {
            const value = info.getValue();
            return (
              <span className="whitespace-nowrap text-muted">
                {value ? format.dateTime(value, { dateStyle: "medium" }) : "—"}
              </span>
            );
          },
        }),
        ...(plays
          ? [
              column.accessor("plays", {
                header: () => t("columnPlays"),
                cell: (info) => (
                  <span className="font-mono">{format.number(info.getValue() ?? 0)}</span>
                ),
              }),
            ]
          : []),
        column.accessor((row) => row.track.durationMs, {
          id: "time",
          header: () => t("columnTime"),
          cell: (info) => <span className="font-mono">{formatClock(info.getValue())}</span>,
        }),
        ...(canEdit
          ? [
              column.display({
                id: "reorder",
                header: () => <span className="sr-only">{t("columnReorder")}</span>,
                cell: ({ row }) => (
                  <TrackOrderHandle
                    value={row.id}
                    aria-label={t("reorderRow", { title: row.original.track.name })}
                    aria-describedby={instructions}
                    className={buttonClass(
                      "ghost",
                      "sm",
                      "size-9 cursor-grab touch-none px-0 aria-pressed:bg-violet-soft",
                    )}
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <path d="M8 6h.01M8 12h.01M8 18h.01M16 6h.01M16 12h.01M16 18h.01" />
                    </svg>
                  </TrackOrderHandle>
                ),
              }),
            ]
          : []),
      ]),
    [canEdit, plays, t, format, instructions],
  );

  const tableInstance = useTable({
    features,
    columns,
    data: rows,
    getRowId: (row) => row.key,
  });

  const save = () => {
    const trackIds = order.flatMap((key) => {
      const item = byKey.get(key);
      return item ? [item.track.id] : [];
    });
    write.mutate(
      { playlistId, basedOn, trackIds, kind: ChangeKind.Edit },
      {
        onSuccess: (result) =>
          match(result)
            .with({ status: "ok" }, ({ snapshotId }) =>
              notify({
                kind: "done",
                message:
                  removedCount > 0 ? t("savedRemoved", { count: removedCount }) : t("savedOrder"),
                playlistId,
                snapshotId,
              }),
            )
            .otherwise((failure) => notify({ kind: "failed", result: failure })),
        onError: () => notify({ kind: "failed", result: thrownWriteFailure }),
      },
    );
  };

  const moveToTop = () => {
    const chosen = order.filter((k) => selected.includes(k));
    setOrder([...chosen, ...order.filter((k) => !selected.includes(k))]);
  };
  const removeSelected = () => {
    setOrder(order.filter((k) => !selected.includes(k)));
    setSelected([]);
  };

  return (
    <div className="flex flex-col gap-3">
      {canEdit && selected.length > 0 ? (
        <div
          role="toolbar"
          aria-label={t("selectionActions")}
          className="flex flex-wrap items-center justify-between gap-2 rounded-full bg-ink py-2.5 pr-3 pl-5 text-on-ink"
        >
          <b className="text-sm">{t("selected", { count: selected.length })}</b>
          <div className="flex flex-wrap gap-1.5">
            <Button
              className={buttonClass("ghost", "sm", "text-on-ink! hover:bg-white/10")}
              onClick={moveToTop}
            >
              {t("moveToTop")}
            </Button>
            <Button className={buttonClass("danger", "sm")} onClick={removeSelected}>
              {t("removeSelected")}
            </Button>
            <Button
              aria-label={t("clearSelection")}
              className={buttonClass("ghost", "sm", "text-on-ink! hover:bg-white/10")}
              onClick={() => setSelected([])}
            >
              ✕
            </Button>
          </div>
        </div>
      ) : null}

      {canEdit && dirty ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line-strong bg-butter-soft px-4 py-3 text-sm">
          <span>
            {removedCount > 0 ? t("unsavedRemoved", { count: removedCount }) : t("unsavedOrder")}
          </span>
          <div className="flex gap-2">
            <Button
              className={buttonClass("ghost", "sm")}
              disabled={saving}
              onClick={() => {
                setOrder(initialOrder);
                setSelected([]);
              }}
            >
              {t("discard")}
            </Button>
            <Button className={buttonClass("primary", "sm")} disabled={saving} onClick={save}>
              {saving ? t("saving") : t("save")}
            </Button>
          </div>
        </div>
      ) : null}

      <TrackOrderRoot
        value={order}
        onValueChange={(next) => setOrder(next)}
        selected={selected}
        onSelectedChange={(next) => setSelected(next)}
        reorderable={canEdit}
        rowLabel={(key) => byKey.get(key)?.track.name}
        announce={(message) =>
          t(`announce.${message.type}`, {
            label: message.label,
            position: message.position,
            total: message.total,
            count: message.count,
          })
        }
      >
        <div className={tableBox}>
          <table className={table}>
            <thead>
              {tableInstance.getHeaderGroups().map((group) => (
                <tr key={group.id}>
                  {group.headers.map((header) => (
                    <th
                      key={header.id}
                      scope="col"
                      className={`${th} ${header.column.id === "select" || header.column.id === "reorder" ? "w-11" : ""}`}
                    >
                      {header.isPlaceholder ? null : <tableInstance.FlexRender header={header} />}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {tableInstance.getRowModel().rows.map((row) => (
                <TrackOrderRow
                  key={row.id}
                  value={row.id}
                  className="data-grabbed:relative data-grabbed:z-10 data-grabbed:translate-x-(--drag-x,0) data-grabbed:translate-y-(--drag-y,0) data-grabbed:shadow-lg data-moving:*:bg-violet-soft data-selected:*:bg-violet-soft [&:last-child>td]:border-b-0"
                >
                  {row.getAllCells().map((cell) => (
                    <td key={cell.id} className={`${td} bg-surface`}>
                      <tableInstance.FlexRender cell={cell} />
                    </td>
                  ))}
                </TrackOrderRow>
              ))}
            </tbody>
          </table>
        </div>
      </TrackOrderRoot>
      {canEdit ? (
        <span id={instructions} className="text-muted text-xs">
          {t("reorderHint")}
        </span>
      ) : null}
    </div>
  );
}
