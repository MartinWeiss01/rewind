import { match } from "ts-pattern";
import { z } from "zod";
import type { PlaylistSummary } from "@/domain/playlists";

export const OwnerFilter = { All: "all", Mine: "mine", Followed: "followed" } as const;
export type OwnerFilter = (typeof OwnerFilter)[keyof typeof OwnerFilter];

export const LibrarySort = { Recent: "recent", Name: "name", Size: "size" } as const;
export type LibrarySort = (typeof LibrarySort)[keyof typeof LibrarySort];

export const LibraryView = { Grid: "grid", List: "list" } as const;
export type LibraryView = (typeof LibraryView)[keyof typeof LibraryView];

/** `/app/playlists` search params. Unknown or malformed values fall back to defaults. */
export const libraryParamsSchema = z.object({
  q: z
    .string()
    .max(100)
    .catch("")
    .default("")
    .transform((value) => value.trim()),
  owner: z.enum(OwnerFilter).catch(OwnerFilter.All).default(OwnerFilter.All),
  sort: z.enum(LibrarySort).catch(LibrarySort.Recent).default(LibrarySort.Recent),
  view: z.enum(LibraryView).catch(LibraryView.Grid).default(LibraryView.Grid),
});
export type LibraryParams = z.infer<typeof libraryParamsSchema>;

/** Takes the first value of repeated params, as Next.js passes arrays for them. */
export function parseLibraryParams(raw: Record<string, string | string[] | undefined>) {
  const first = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  );
  return libraryParamsSchema.parse(first);
}

const fold = (value: string) =>
  value
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

/**
 * Filters and sorts the library. "Mine" means editable (owned or collaborative);
 * "Recent" keeps the order the source returns, which is most recent first on Spotify.
 */
export function filterLibrary<T extends PlaylistSummary>(
  playlists: readonly T[],
  { q, owner, sort }: Pick<LibraryParams, "q" | "owner" | "sort">,
): T[] {
  const needle = fold(q);
  const filtered = playlists.filter((p) => {
    const ownerOk = match(owner)
      .with(OwnerFilter.All, () => true)
      .with(OwnerFilter.Mine, () => p.editable)
      .with(OwnerFilter.Followed, () => !p.editable)
      .exhaustive();
    return ownerOk && (!needle || fold(`${p.name} ${p.ownerName}`).includes(needle));
  });
  return match(sort)
    .with(LibrarySort.Recent, () => filtered)
    .with(LibrarySort.Name, () =>
      [...filtered].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      ),
    )
    .with(LibrarySort.Size, () => [...filtered].sort((a, b) => b.trackCount - a.trackCount))
    .exhaustive();
}
