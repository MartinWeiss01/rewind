import { z } from "zod";
import type { Db } from "@/data/supabase/client";
import type { Json } from "@/data/supabase/database.types";
import type { Track } from "@/domain/music";

const coverSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("image"), url: z.string() }),
  z.object({ kind: z.literal("generated"), seed: z.number() }),
]);
const artistsSchema = z.array(z.object({ id: z.string(), name: z.string() }));
const albumSchema = z.object({ id: z.string(), name: z.string(), cover: coverSchema });

type TrackRow = {
  id: string;
  name: string;
  artists: unknown;
  album: unknown;
  duration_ms: number;
  isrc: string | null;
  explicit: boolean;
};

export function trackFromRow(row: TrackRow): Track | null {
  const artists = artistsSchema.safeParse(row.artists);
  const album = albumSchema.safeParse(row.album);
  if (!artists.success || !album.success) return null;
  return {
    id: row.id,
    name: row.name,
    artists: artists.data,
    album: album.data,
    durationMs: row.duration_ms,
    isrc: row.isrc,
    explicit: row.explicit,
    externalUrl: `https://open.spotify.com/track/${row.id}`,
  };
}

const chunk = <T>(items: readonly T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
};

export { chunk };

/** Loads cached tracks by ID. Missing IDs are simply absent from the map. */
export async function loadTracks(db: Db, ids: readonly string[]): Promise<Map<string, Track>> {
  const map = new Map<string, Track>();
  for (const part of chunk([...new Set(ids)], 300)) {
    const { data, error } = await db
      .from("rewind_tracks")
      .select("id, name, artists, album, duration_ms, isrc, explicit")
      .in("id", part);
    if (error) throw new Error(`Could not load tracks: ${error.message}`);
    for (const row of data ?? []) {
      const track = trackFromRow(row);
      if (track) map.set(track.id, track);
    }
  }
  return map;
}

/** Stores full track data from the API (overwrites names-only rows from imports). */
export async function saveTracks(db: Db, tracks: readonly Track[]): Promise<void> {
  const unique = [...new Map(tracks.map((t) => [t.id, t])).values()];
  const now = new Date().toISOString();
  for (const part of chunk(unique, 500)) {
    const { error } = await db.from("rewind_tracks").upsert(
      part.map((t) => ({
        id: t.id,
        name: t.name,
        artists: t.artists.map((a) => ({ id: a.id, name: a.name })),
        album: { id: t.album.id, name: t.album.name, cover: { ...t.album.cover } },
        duration_ms: t.durationMs,
        isrc: t.isrc,
        explicit: t.explicit,
        enriched_at: now,
        updated_at: now,
      })),
    );
    if (error) throw new Error(`Could not save tracks: ${error.message}`);
  }
}

const nameKey = (value: string) =>
  value
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * Creates names-only rows for tracks seen in an import, without overwriting tracks
 * already known. Artist and album IDs are derived from names until the track is
 * enriched from the API.
 */
export async function saveImportedTrackNames(
  db: Db,
  entries: readonly {
    trackId: string;
    trackName: string | null;
    artistName: string | null;
    albumName: string | null;
  }[],
): Promise<void> {
  const rows = new Map<string, { id: string; name: string; artists: Json; album: Json }>();
  for (const entry of entries) {
    if (rows.has(entry.trackId)) continue;
    const artist = entry.artistName ?? "Unknown artist";
    const album = entry.albumName ?? "";
    rows.set(entry.trackId, {
      id: entry.trackId,
      name: entry.trackName ?? "Unknown track",
      artists: [{ id: `name:${nameKey(artist)}`, name: artist }],
      album: {
        id: `name:${nameKey(`${artist} ${album}`)}`,
        name: album,
        cover: {
          kind: "generated",
          seed: [...album].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7),
        },
      },
    });
  }
  for (const part of chunk([...rows.values()], 500)) {
    const { error } = await db
      .from("rewind_tracks")
      .upsert(part, { onConflict: "id", ignoreDuplicates: true });
    if (error) throw new Error(`Could not save imported tracks: ${error.message}`);
  }
}
