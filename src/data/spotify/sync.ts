import type { Db } from "@/data/supabase/client";
import { PlaySource } from "@/domain/listening";
import type { Track } from "@/domain/music";
import { spotifyRequest } from "./api";
import { GetRecentlyPlayedResponse, GetTrackResponse } from "./generated/spotify.zod";
import { mapTrack } from "./mapping";
import { saveTracks } from "./track-store";

/**
 * Saves the user's recently played tracks. Spotify only exposes the last 50 plays, so
 * this runs on a schedule and whenever the user opens the app. `played_at` is stored as
 * Spotify reports it, truncated to the second.
 */
export async function syncRecentlyPlayed(
  db: Db,
  user: { id: string; last_sync_cursor_ms: number | null },
  accessToken: string,
): Promise<{ added: number }> {
  const response = await spotifyRequest(
    accessToken,
    "/me/player/recently-played",
    GetRecentlyPlayedResponse,
    {
      query: { limit: 50, after: user.last_sync_cursor_ms ?? undefined },
    },
  );
  const tracks: Track[] = [];
  const plays: {
    user_id: string;
    track_id: string;
    played_at: string;
    ms_played: number;
    source: string;
  }[] = [];
  for (const item of response.items ?? []) {
    const track = item.track ? mapTrack(item.track) : null;
    if (!track || !item.played_at) continue;
    tracks.push(track);
    plays.push({
      user_id: user.id,
      track_id: track.id,
      played_at: new Date(
        Math.floor(new Date(item.played_at).getTime() / 1000) * 1000,
      ).toISOString(),
      ms_played: track.durationMs,
      source: PlaySource.Synced,
    });
  }
  await saveTracks(db, tracks);
  let added = 0;
  if (plays.length > 0) {
    const { data, error } = await db
      .from("rewind_plays")
      .upsert(plays, { onConflict: "user_id,track_id,played_at", ignoreDuplicates: true })
      .select("played_at");
    if (error) throw new Error(`Could not save synced plays: ${error.message}`);
    added = data?.length ?? 0;
  }
  const cursor = Number(response.cursors?.after);
  const now = new Date().toISOString();
  await db
    .from("rewind_users")
    .update({
      last_sync_at: now,
      sync_error: null,
      updated_at: now,
      ...(Number.isFinite(cursor) && cursor > 0 ? { last_sync_cursor_ms: cursor } : {}),
    })
    .eq("id", user.id);
  return { added };
}

/**
 * Replaces names-only tracks from imports with full data (covers, real artist IDs).
 * Spotify removed batch track lookups, so this fetches one track per request and only
 * a small batch per run to stay well within the rate limit.
 */
export async function enrichImportedTracks(
  db: Db,
  accessToken: string,
  limit = 40,
): Promise<number> {
  const { data } = await db
    .from("rewind_tracks")
    .select("id")
    .is("enriched_at", null)
    .order("updated_at", { ascending: true })
    .limit(limit);
  const tracks: Track[] = [];
  for (const row of data ?? []) {
    const track = mapTrack(
      await spotifyRequest(accessToken, `/tracks/${encodeURIComponent(row.id)}`, GetTrackResponse),
    );
    if (track) tracks.push(track);
  }
  await saveTracks(db, tracks);
  return tracks.length;
}
