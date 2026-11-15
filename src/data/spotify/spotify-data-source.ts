import { match } from "ts-pattern";
import { z } from "zod";
import type { Db } from "@/data/supabase/client";
import { type Interval, listeningRulesSchema, type Play, PlaySource } from "@/domain/listening";
import type { Cover, Track } from "@/domain/music";
import type { PlaylistDetail, PlaylistItem, PlaylistSummary } from "@/domain/playlists";
import { parseStreamingHistory, playKey } from "@/features/import/streaming-history";
import type { UserRow } from "@/server/auth/session";
import {
  DataMode,
  type Generation,
  type ImportSummary,
  type ListeningData,
  type MusicDataSource,
  type PlayRow,
  PlaySort,
} from "../music-data-source";
import { SpotifyRequestError, spotifyRequest } from "./api";
import {
  AddItemsToPlaylistResponse,
  ChangePlaylistDetailsResponse,
  CreatePlaylistResponse,
  GetAListOfCurrentUsersPlaylistsResponse,
  GetPlaylistResponse,
  GetTrackResponse,
  ReorderOrReplacePlaylistsItemsResponse,
  SearchResponse,
  UnfollowPlaylistResponse,
} from "./generated/spotify.zod";
import { mapTrack, pickImage, trackUri } from "./mapping";
import { chunk, loadTracks, saveImportedTrackNames, saveTracks } from "./track-store";

/**
 * Playlist items are checked one by one in `playlistItems`: local files come back with
 * null ids and names Spotify's schema says are always set, and one of them would
 * otherwise fail the whole page.
 */
const playlistItemsPage = z.object({
  next: z.string().nullable(),
  items: z.array(z.object({ added_at: z.string().nullish(), item: z.unknown() })),
});

/** A playlist without its embedded first page of items, which `playlistItems` reads. */
const playlistResponse = GetPlaylistResponse.omit({ items: true }).extend({
  items: z.object({ total: z.int() }).optional(),
});

/**
 * Playlist details by user and playlist, reused while the playlist's snapshot id is
 * unchanged (Spotify issues a new one on every change). Saves the item requests that
 * otherwise run into Spotify's rate limit on the library screen.
 */
const detailCache = new Map<string, PlaylistDetail>();
const detailCacheSize = 300;

function rememberDetail(key: string, detail: PlaylistDetail) {
  detailCache.delete(key);
  detailCache.set(key, detail);
  if (detailCache.size > detailCacheSize) {
    const oldest = detailCache.keys().next().value;
    if (oldest !== undefined) detailCache.delete(oldest);
  }
}

const pageSize = 1000;
const playRowSchema = z.object({
  track_id: z.string(),
  played_at: z.string(),
  ms_played: z.number(),
  source: z.enum(PlaySource),
});

type Context = {
  db: Db;
  user: UserRow;
  /** Returns a valid Spotify access token, refreshing when needed. */
  accessToken: () => Promise<string>;
};

const toPlay = (row: z.infer<typeof playRowSchema>): Play => ({
  trackId: row.track_id,
  playedAt: new Date(row.played_at),
  msPlayed: row.ms_played,
  source: row.source,
});

/** Data for a signed-in Spotify user: plays from our database, playlists live from Spotify. */
export function createSpotifyDataSource({ db, user, accessToken }: Context): MusicDataSource {
  const userId = user.id;
  const call = async <T extends z.ZodType>(
    path: string,
    schema: T,
    options?: Parameters<typeof spotifyRequest>[3],
  ) => spotifyRequest(await accessToken(), path, schema, options);

  const playsBetween = async (interval: Interval): Promise<Play[]> => {
    const plays: Play[] = [];
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await db
        .from("rewind_plays")
        .select("track_id, played_at, ms_played, source")
        .eq("user_id", userId)
        .gte("played_at", interval.start.toISOString())
        .lt("played_at", interval.end.toISOString())
        .order("played_at", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw new Error(`Could not load plays: ${error.message}`);
      for (const row of data ?? []) plays.push(toPlay(playRowSchema.parse(row)));
      if (!data || data.length < pageSize) return plays;
    }
  };

  const summaryFrom = (playlist: {
    id?: string;
    name?: string;
    description?: string | null;
    collaborative?: boolean;
    public?: boolean | null;
    snapshot_id?: string;
    images?: { url: string; width: number | null }[] | null;
    owner?: { id?: string; display_name?: string | null };
    items?: { total?: number };
    external_urls?: { spotify?: string };
  }): PlaylistSummary | null => {
    if (!playlist.id || !playlist.name) return null;
    const cover: Cover | null = pickImage(playlist.images ?? undefined, 300);
    return {
      id: playlist.id,
      name: playlist.name,
      description: playlist.description ?? "",
      ownerName: playlist.owner?.display_name ?? playlist.owner?.id ?? "",
      editable: playlist.owner?.id === user.spotify_user_id || playlist.collaborative === true,
      isPublic: playlist.public ?? false,
      trackCount: playlist.items?.total ?? 0,
      covers: cover ? [cover] : [],
      snapshotId: playlist.snapshot_id ?? "",
      externalUrl: playlist.external_urls?.spotify ?? null,
    };
  };

  const playlistItems = async (
    id: string,
  ): Promise<{ items: PlaylistItem[]; hidden: number } | null> => {
    const items: PlaylistItem[] = [];
    let hidden = 0;
    const tracks: Track[] = [];
    for (let offset = 0; ; offset += 50) {
      let page: z.infer<typeof playlistItemsPage>;
      try {
        page = await call(`/playlists/${id}/items`, playlistItemsPage, {
          query: { limit: 50, offset },
        });
      } catch (error) {
        // Items of playlists the user neither owns nor collaborates on are not readable.
        if (error instanceof SpotifyRequestError && (error.status === 403 || error.status === 404))
          return null;
        throw error;
      }
      page.items.forEach((entry, index) => {
        const parsed = GetTrackResponse.safeParse(entry.item);
        const track = parsed.success ? mapTrack(parsed.data) : null;
        if (!track) {
          hidden += 1;
          return;
        }
        tracks.push(track);
        items.push({
          key: `${track.id}#${offset + index}`,
          track,
          addedAt: entry.added_at ? new Date(entry.added_at) : null,
        });
      });
      if (!page.next) break;
    }
    await saveTracks(db, tracks);
    return { items, hidden };
  };

  const writeItems = async (id: string, trackIds: readonly string[], replace: boolean) => {
    const uris = trackIds.map(trackUri);
    const [first = [], ...rest] = chunk(uris, 100);
    if (replace) {
      await call(`/playlists/${id}/items`, ReorderOrReplacePlaylistsItemsResponse, {
        method: "PUT",
        body: { uris: first },
      });
    } else if (first.length > 0) {
      await call(`/playlists/${id}/items`, AddItemsToPlaylistResponse, {
        method: "POST",
        body: { uris: first },
      });
    }
    for (const part of rest) {
      await call(`/playlists/${id}/items`, AddItemsToPlaylistResponse, {
        method: "POST",
        body: { uris: part },
      });
    }
  };

  /** Snapshot ids from this request's `listPlaylists`, to reuse cached details without a request. */
  const listedSnapshots = new Map<string, string>();

  const count = async (
    table: "rewind_plays" | "rewind_imports" | "rewind_playlist_snapshots" | "rewind_generations",
  ) => {
    const { count: total, error } = await db
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);
    if (error) throw new Error(`Could not count ${table}: ${error.message}`);
    return total ?? 0;
  };

  return {
    mode: DataMode.Spotify,

    async getProfile() {
      return {
        id: user.spotify_user_id,
        displayName: user.display_name || user.spotify_user_id,
        avatar: user.avatar_url ? { kind: "image", url: user.avatar_url } : null,
        externalUrl: user.profile_url,
      };
    },
    async getListeningRules() {
      return { skipThresholdMs: user.skip_threshold_ms, timeZone: user.time_zone };
    },
    async saveListeningRules(rules) {
      const valid = listeningRulesSchema.parse(rules);
      const { error } = await db
        .from("rewind_users")
        .update({
          skip_threshold_ms: valid.skipThresholdMs,
          time_zone: valid.timeZone,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);
      if (error) throw new Error(`Could not save rules: ${error.message}`);
    },

    async getListening(interval): Promise<ListeningData> {
      const plays = await playsBetween(interval);
      return {
        plays,
        tracks: await loadTracks(
          db,
          plays.map((p) => p.trackId),
        ),
      };
    },
    async getFirstPlayAt() {
      const { data } = await db
        .from("rewind_plays")
        .select("played_at")
        .eq("user_id", userId)
        .order("played_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      return data ? new Date(data.played_at) : null;
    },
    async listPlays(query) {
      let trackFilter: string[] | null = null;
      const needle = query.search.trim();
      if (needle) {
        const { data } = await db
          .from("rewind_tracks")
          .select("id")
          .ilike("search_text", `%${needle.toLocaleLowerCase().replace(/[%_]/g, "")}%`)
          .limit(1000);
        trackFilter = (data ?? []).map((row) => row.id);
        if (trackFilter.length === 0)
          return { rows: [], total: 0, page: query.page, pageSize: query.pageSize };
      }
      let request = db
        .from("rewind_plays")
        .select("track_id, played_at, ms_played, source", { count: "exact" })
        .eq("user_id", userId)
        .gte("played_at", query.interval.start.toISOString())
        .lt("played_at", query.interval.end.toISOString());
      if (!query.includeSkips) request = request.gte("ms_played", user.skip_threshold_ms);
      if (query.source !== "all") request = request.eq("source", query.source);
      if (trackFilter) request = request.in("track_id", trackFilter);
      request = match(query.sort)
        .with(PlaySort.Newest, () => request.order("played_at", { ascending: false }))
        .with(PlaySort.Oldest, () => request.order("played_at", { ascending: true }))
        .with(PlaySort.Longest, () => request.order("ms_played", { ascending: false }))
        .exhaustive();
      const from = (query.page - 1) * query.pageSize;
      const { data, error, count: total } = await request.range(from, from + query.pageSize - 1);
      if (error) throw new Error(`Could not list plays: ${error.message}`);
      const plays = (data ?? []).map((row) => toPlay(playRowSchema.parse(row)));
      const tracks = await loadTracks(
        db,
        plays.map((p) => p.trackId),
      );
      const rows: PlayRow[] = plays.flatMap((play) => {
        const track = tracks.get(play.trackId);
        return track ? [{ ...play, track, skipped: play.msPlayed < user.skip_threshold_ms }] : [];
      });
      return { rows, total: total ?? rows.length, page: query.page, pageSize: query.pageSize };
    },
    async getLastSyncAt() {
      return user.last_sync_at ? new Date(user.last_sync_at) : null;
    },
    async importHistory(files): Promise<ImportSummary> {
      // Synced plays are authoritative; imports only fill in history before the first one.
      const { data: firstSynced } = await db
        .from("rewind_plays")
        .select("played_at")
        .eq("user_id", userId)
        .eq("source", PlaySource.Synced)
        .order("played_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      const cutoff = firstSynced
        ? new Date(firstSynced.played_at).getTime()
        : Number.POSITIVE_INFINITY;

      const summary: ImportSummary = {
        files: files.length,
        added: 0,
        duplicates: 0,
        skipped: 0,
        firstPlayedAt: null,
        lastPlayedAt: null,
      };
      for (const file of files) {
        const parsed = parseStreamingHistory(file.entries);
        summary.skipped += parsed.skipped;
        const seen = new Set<string>();
        const entries = parsed.entries.filter((entry) => {
          const key = playKey(entry);
          if (entry.playedAt.getTime() >= cutoff || seen.has(key)) {
            summary.duplicates++;
            return false;
          }
          seen.add(key);
          return true;
        });
        const { data: record, error: importError } = await db
          .from("rewind_imports")
          .insert({ user_id: userId, file_name: file.name.slice(0, 200) })
          .select("id")
          .single();
        if (importError || !record)
          throw new Error(`Could not record import: ${importError?.message}`);
        await saveImportedTrackNames(db, entries);
        let added = 0;
        for (const part of chunk(entries, 1000)) {
          const { data, error } = await db
            .from("rewind_plays")
            .upsert(
              part.map((entry) => ({
                user_id: userId,
                track_id: entry.trackId,
                played_at: new Date(
                  Math.floor(entry.playedAt.getTime() / 1000) * 1000,
                ).toISOString(),
                ms_played: entry.msPlayed,
                source: PlaySource.Imported,
                import_id: record.id,
              })),
              { onConflict: "user_id,track_id,played_at", ignoreDuplicates: true },
            )
            .select("played_at");
          if (error) throw new Error(`Could not import plays: ${error.message}`);
          added += data?.length ?? 0;
          summary.duplicates += part.length - (data?.length ?? 0);
        }
        await db.from("rewind_imports").update({ added }).eq("id", record.id).eq("user_id", userId);
        summary.added += added;
        for (const entry of entries) {
          if (!summary.firstPlayedAt || entry.playedAt < summary.firstPlayedAt)
            summary.firstPlayedAt = entry.playedAt;
          if (!summary.lastPlayedAt || entry.playedAt > summary.lastPlayedAt)
            summary.lastPlayedAt = entry.playedAt;
        }
      }
      return summary;
    },
    async listImports() {
      const { data, error } = await db
        .from("rewind_imports")
        .select("id, file_name, imported_at, added")
        .eq("user_id", userId)
        .order("imported_at", { ascending: false });
      if (error) throw new Error(`Could not list imports: ${error.message}`);
      return (data ?? []).map((row) => ({
        id: row.id,
        fileName: row.file_name,
        importedAt: new Date(row.imported_at),
        added: row.added,
      }));
    },
    async deleteImport(id) {
      // Plays reference the import with ON DELETE CASCADE.
      const { error } = await db.from("rewind_imports").delete().eq("id", id).eq("user_id", userId);
      if (error) throw new Error(`Could not delete import: ${error.message}`);
    },

    async listPlaylists() {
      const playlists: PlaylistSummary[] = [];
      listedSnapshots.clear();
      for (let offset = 0; ; offset += 50) {
        const page = await call("/me/playlists", GetAListOfCurrentUsersPlaylistsResponse, {
          query: { limit: 50, offset },
        });
        for (const item of page.items) {
          const summary = summaryFrom(item);
          if (!summary) continue;
          playlists.push(summary);
          listedSnapshots.set(summary.id, summary.snapshotId);
        }
        if (!page.next) return playlists;
      }
    },
    async getPlaylist(id, options): Promise<PlaylistDetail | null> {
      const cacheKey = `${userId}:${id}`;
      const cached = detailCache.get(cacheKey);
      // Listed in this request with the same snapshot: nothing changed, no request needed.
      if (cached?.snapshotId && listedSnapshots.get(id) === cached.snapshotId) return cached;
      if (options?.cachedOnly) return null;
      let playlist: z.infer<typeof playlistResponse>;
      try {
        playlist = await call(`/playlists/${encodeURIComponent(id)}`, playlistResponse);
      } catch (error) {
        if (error instanceof SpotifyRequestError && (error.status === 404 || error.status === 403))
          return null;
        throw error;
      }
      const summary = summaryFrom(playlist);
      if (!summary) return null;
      if (cached?.snapshotId && cached.snapshotId === summary.snapshotId) {
        const detail = {
          ...cached,
          ...summary,
          items: cached.items,
          trackCount: cached.trackCount,
        };
        rememberDetail(cacheKey, detail);
        return detail;
      }
      const read = await playlistItems(summary.id);
      const detail: PlaylistDetail = {
        ...summary,
        items: read?.items ?? null,
        hiddenItems: read?.hidden ?? 0,
        trackCount: read ? read.items.length + read.hidden : summary.trackCount,
      };
      if (summary.snapshotId) rememberDetail(cacheKey, detail);
      return detail;
    },
    async searchTracks(query) {
      const q = query.trim();
      if (!q) return [];
      const result = await call("/search", SearchResponse, {
        query: { q, type: "track", limit: 10 },
      });
      const tracks = (result.tracks?.items ?? []).flatMap((item) => {
        const track = mapTrack(item);
        return track ? [track] : [];
      });
      await saveTracks(db, tracks);
      return tracks;
    },
    async getTracks(ids) {
      const known = await loadTracks(db, ids);
      const missing = ids.filter((id) => !known.has(id)).slice(0, 20);
      const fetched: Track[] = [];
      for (const id of missing) {
        const track = mapTrack(await call(`/tracks/${encodeURIComponent(id)}`, GetTrackResponse));
        if (track) fetched.push(track);
      }
      await saveTracks(db, fetched);
      for (const track of fetched) known.set(track.id, track);
      return ids.flatMap((id) => {
        const track = known.get(id);
        return track ? [track] : [];
      });
    },

    async createPlaylist(input, trackIds) {
      const created = await call("/me/playlists", CreatePlaylistResponse, {
        method: "POST",
        body: { name: input.name, description: input.description, public: input.isPublic },
      });
      const summary = summaryFrom(created);
      if (!summary) throw new Error("Spotify did not return the new playlist");
      if (trackIds.length > 0) await writeItems(summary.id, trackIds, false);
      return { ...summary, trackCount: trackIds.length };
    },
    async updatePlaylistDetails(id, input) {
      await call(`/playlists/${encodeURIComponent(id)}`, ChangePlaylistDetailsResponse, {
        method: "PUT",
        body: { name: input.name, description: input.description, public: input.isPublic },
      });
    },
    async replacePlaylistItems(id, trackIds) {
      await writeItems(encodeURIComponent(id), trackIds, true);
    },
    async addPlaylistItems(id, trackIds) {
      await writeItems(encodeURIComponent(id), trackIds, false);
    },
    async removePlaylist(id) {
      await call(`/playlists/${encodeURIComponent(id)}/followers`, UnfollowPlaylistResponse, {
        method: "DELETE",
      });
    },

    async listGenerations(limit) {
      const { data, error } = await db
        .from("rewind_generations")
        .select("id, created_at, title, request, track_ids, unmatched")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error(`Could not list generations: ${error.message}`);
      return (data ?? []).map(
        (row): Generation => ({
          id: row.id,
          createdAt: new Date(row.created_at),
          title: row.title,
          request: row.request,
          trackIds: row.track_ids,
          unmatched: row.unmatched,
        }),
      );
    },
    async saveGeneration(input) {
      const { data, error } = await db
        .from("rewind_generations")
        .insert({
          user_id: userId,
          title: input.title,
          request: input.request,
          track_ids: [...input.trackIds],
          unmatched: [...input.unmatched],
        })
        .select("id, created_at")
        .single();
      if (error || !data) throw new Error(`Could not save generation: ${error?.message}`);
      return { ...input, id: data.id, createdAt: new Date(data.created_at) };
    },

    async getDataSummary() {
      const [plays, imports, snapshots, generations] = await Promise.all([
        count("rewind_plays"),
        count("rewind_imports"),
        count("rewind_playlist_snapshots"),
        count("rewind_generations"),
      ]);
      return { plays, imports, snapshots, generations };
    },
    async exportData() {
      const [imports, snapshots, generations, plays] = await Promise.all([
        db.from("rewind_imports").select("file_name, imported_at, added").eq("user_id", userId),
        db
          .from("rewind_playlist_snapshots")
          .select("playlist_id, label, track_ids, created_at")
          .eq("user_id", userId),
        db
          .from("rewind_generations")
          .select("title, request, track_ids, unmatched, created_at")
          .eq("user_id", userId),
        playsBetween({ start: new Date(0), end: new Date(Date.now() + 86_400_000) }),
      ]);
      return {
        exportedAt: new Date().toISOString(),
        profile: { spotifyUserId: user.spotify_user_id, displayName: user.display_name },
        rules: { skipThresholdMs: user.skip_threshold_ms, timeZone: user.time_zone },
        plays: plays.map((p) => ({
          trackId: p.trackId,
          playedAt: p.playedAt.toISOString(),
          msPlayed: p.msPlayed,
          source: p.source,
        })),
        imports: imports.data ?? [],
        snapshots: snapshots.data ?? [],
        generations: generations.data ?? [],
      };
    },
    async deleteAllData() {
      for (const table of [
        "rewind_plays",
        "rewind_imports",
        "rewind_playlist_snapshots",
        "rewind_generations",
      ] as const) {
        const { error } = await db.from(table).delete().eq("user_id", userId);
        if (error) throw new Error(`Could not delete ${table}: ${error.message}`);
      }
      await db
        .from("rewind_users")
        .update({ last_sync_cursor_ms: null, updated_at: new Date().toISOString() })
        .eq("id", userId);
    },

    async listSnapshots(playlistId) {
      const { data, error } = await db
        .from("rewind_playlist_snapshots")
        .select("id, playlist_id, label, created_at, track_ids")
        .eq("user_id", userId)
        .eq("playlist_id", playlistId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw new Error(`Could not list snapshots: ${error.message}`);
      return (data ?? []).map((row) => ({
        id: row.id,
        playlistId: row.playlist_id,
        label: row.label,
        createdAt: new Date(row.created_at),
        trackIds: row.track_ids,
      }));
    },
    async saveSnapshot(playlistId, label, trackIds) {
      const { data, error } = await db
        .from("rewind_playlist_snapshots")
        .insert({ user_id: userId, playlist_id: playlistId, label, track_ids: [...trackIds] })
        .select("id, created_at")
        .single();
      if (error || !data) throw new Error(`Could not save snapshot: ${error?.message}`);
      return { id: data.id, playlistId, label, createdAt: new Date(data.created_at), trackIds };
    },
  };
}
