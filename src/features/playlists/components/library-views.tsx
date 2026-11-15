import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { chipClass } from "@/components/ui/styles";
import { splitHours } from "@/lib/format";
import type { LibraryEntry } from "../load";
import { CoverMosaic } from "./cover-mosaic";
import { table, tableBox, td, th } from "./ui";

/** Formats a total duration as "4 h 12 min". */
export async function durationFormatter() {
  const t = await getTranslations("playlists");
  return (ms: number | null) => {
    if (ms === null) return null;
    const { hours, minutes } = splitHours(ms);
    return hours > 0 ? t("durationHours", { hours, minutes }) : t("durationMinutes", { minutes });
  };
}

/** Library as cards with a cover mosaic. */
export async function LibraryGrid({ playlists }: { playlists: readonly LibraryEntry[] }) {
  const t = await getTranslations("playlists");
  const duration = await durationFormatter();
  return (
    <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,220px),1fr))] gap-4 p-0">
      {playlists.map((p) => (
        <li key={p.id}>
          <Link
            href={`/app/playlists/${encodeURIComponent(p.id)}`}
            className="flex h-full flex-col gap-3 rounded-3xl border border-line bg-surface p-4 text-ink no-underline shadow-[0_1px_0_rgba(23,20,15,.04),0_24px_48px_-24px_rgba(60,40,10,.22)] transition-transform hover:-translate-y-0.5 motion-reduce:transition-none"
          >
            <CoverMosaic covers={p.covers} />
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate font-semibold text-[15px]">{p.name}</div>
                <div className="truncate text-muted text-sm">{p.ownerName}</div>
              </div>
              {p.editable ? null : (
                <span className={chipClass("neutral", "h-6 shrink-0")}>{t("readOnly")}</span>
              )}
            </div>
            <div className="mt-auto flex flex-wrap items-center gap-2.5 font-mono text-muted text-sm">
              <span>{t("tracks", { count: p.trackCount })}</span>
              {p.durationMs === null ? null : (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{duration(p.durationMs)}</span>
                </>
              )}
              {p.duplicates ? (
                <span className={chipClass("coral", "h-[22px] font-sans")}>
                  {t("duplicates", { count: p.duplicates })}
                </span>
              ) : null}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Library as a table. */
export async function LibraryList({ playlists }: { playlists: readonly LibraryEntry[] }) {
  const t = await getTranslations("playlists");
  const duration = await durationFormatter();
  return (
    <div className={tableBox}>
      <table className={table}>
        <thead>
          <tr>
            <th scope="col" className={th}>
              {t("library.columnPlaylist")}
            </th>
            <th scope="col" className={th}>
              {t("library.columnOwner")}
            </th>
            <th scope="col" className={th}>
              {t("library.columnTracks")}
            </th>
            <th scope="col" className={th}>
              {t("library.columnDuration")}
            </th>
            <th scope="col" className={th}>
              {t("library.columnHealth")}
            </th>
          </tr>
        </thead>
        <tbody>
          {playlists.map((p) => (
            <tr key={p.id} className="[&:last-child>td]:border-b-0">
              <td className={td}>
                <Link
                  href={`/app/playlists/${encodeURIComponent(p.id)}`}
                  className="flex items-center gap-3 text-ink no-underline"
                >
                  <CoverMosaic covers={p.covers} size={40} />
                  <b className="truncate">{p.name}</b>
                  {p.editable ? null : (
                    <span className={chipClass("neutral", "h-6 shrink-0")}>{t("readOnly")}</span>
                  )}
                </Link>
              </td>
              <td className={`${td} text-muted`}>{p.ownerName}</td>
              <td className={`${td} font-mono`}>{p.trackCount}</td>
              <td className={`${td} font-mono`}>{duration(p.durationMs) ?? "—"}</td>
              <td className={td}>
                {p.duplicates ? (
                  <span className={chipClass("coral", "h-6")}>
                    {t("duplicates", { count: p.duplicates })}
                  </span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
