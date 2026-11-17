import { timingSafeEqual } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { enrichImportedTracks, syncRecentlyPlayed } from "@/data/spotify/sync";
import { adminDb } from "@/data/supabase/client";
import { accessTokenFor, ReauthorizationRequiredError } from "@/server/auth/session";
import { serverEnv, spotifyConfig } from "@/server/env";

export const maxDuration = 60;

const authorized = (request: NextRequest, secret: string) => {
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
};

/**
 * Syncs every signed-in user's recent plays. No schedule calls it by default (the public
 * deployment is demo-only); call it with `Authorization: Bearer <CRON_SECRET>`.
 */
export async function GET(request: NextRequest) {
  const secret = serverEnv().CRON_SECRET;
  const config = spotifyConfig();
  if (!secret || !authorized(request, secret))
    return new NextResponse("Unauthorized", { status: 401 });
  if (!config) return NextResponse.json({ synced: 0, reason: "spotify not configured" });

  const db = adminDb(config);
  const { data: users } = await db
    .from("rewind_users")
    .select("id, last_sync_cursor_ms, rewind_spotify_tokens!inner(user_id)")
    .limit(25);
  const results = { synced: 0, added: 0, enriched: 0, reauthorize: 0, failed: 0 };
  for (const user of users ?? []) {
    try {
      const token = await accessTokenFor(db, config, user.id);
      const { added } = await syncRecentlyPlayed(db, user, token);
      results.synced++;
      results.added += added;
      results.enriched += await enrichImportedTracks(db, token, 20);
    } catch (error) {
      if (error instanceof ReauthorizationRequiredError) results.reauthorize++;
      else {
        results.failed++;
        console.error("Cron sync failed for a user", error);
      }
    }
  }
  return NextResponse.json(results);
}
