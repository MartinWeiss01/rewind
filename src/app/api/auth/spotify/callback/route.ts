import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { SpotifyRequestError, spotifyRequest } from "@/data/spotify/api";
import { GetCurrentUsersProfileResponse } from "@/data/spotify/generated/spotify.zod";
import { mapProfile } from "@/data/spotify/mapping";
import { exchangeCode } from "@/data/spotify/oauth";
import { syncRecentlyPlayed } from "@/data/spotify/sync";
import { adminDb } from "@/data/supabase/client";
import { listeningRulesSchema } from "@/domain/listening";
import {
  createSession,
  oauthStateCookie,
  oauthTimeZoneCookie,
  saveTokens,
  sessionCookie,
  sessionCookieOptions,
  sessionMaxAgeSeconds,
} from "@/server/auth/session";
import { serverEnv, spotifyConfig } from "@/server/env";

const callbackSchema = z.union([
  z.object({ code: z.string().min(1), state: z.string().min(1) }),
  z.object({ error: z.string().min(1), state: z.string().optional() }),
]);

export async function GET(request: NextRequest) {
  const appUrl = serverEnv().APP_URL;
  const back = (reason: string) => NextResponse.redirect(new URL(`/?login=${reason}`, appUrl));
  const config = spotifyConfig();
  if (!config) return back("unavailable");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(oauthStateCookie)?.value;
  const timeZone = listeningRulesSchema.shape.timeZone.safeParse(
    cookieStore.get(oauthTimeZoneCookie)?.value,
  );
  cookieStore.delete({ name: oauthStateCookie, path: "/api/auth/spotify" });
  cookieStore.delete({ name: oauthTimeZoneCookie, path: "/api/auth/spotify" });

  const params = callbackSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!params.success) return back("failed");
  if ("error" in params.data)
    return back(params.data.error === "access_denied" ? "cancelled" : "failed");
  if (!expectedState || params.data.state !== expectedState) return back("failed");

  const db = adminDb(config);
  try {
    const tokens = await exchangeCode(config, params.data.code);
    const profile = mapProfile(
      await spotifyRequest(tokens.access_token, "/me", GetCurrentUsersProfileResponse),
    );
    const { data: user, error } = await db
      .from("rewind_users")
      .upsert(
        {
          spotify_user_id: profile.spotifyId,
          display_name: profile.displayName,
          avatar_url: profile.avatar?.kind === "image" ? profile.avatar.url : null,
          profile_url: profile.externalUrl,
          sync_error: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "spotify_user_id" },
      )
      .select("id, last_sync_cursor_ms, time_zone")
      .single();
    if (error || !user) throw new Error(`Could not save user: ${error?.message}`);
    // Accounts start on UTC; a sign-in from a browser moves them to its time zone.
    if (user.time_zone === "UTC" && timeZone.success && timeZone.data !== "UTC") {
      const { error: zoneError } = await db
        .from("rewind_users")
        .update({ time_zone: timeZone.data })
        .eq("id", user.id);
      if (zoneError) console.error("Could not set the time zone", zoneError.message);
    }
    await saveTokens(db, config, user.id, tokens, true);
    const token = await createSession(db, user.id);
    cookieStore.set(sessionCookie, token, {
      ...sessionCookieOptions,
      maxAge: sessionMaxAgeSeconds,
    });
    try {
      await syncRecentlyPlayed(db, user, tokens.access_token);
    } catch (syncError) {
      console.error("First sync failed", syncError);
    }
    return NextResponse.redirect(new URL("/app", appUrl));
  } catch (error) {
    console.error("Spotify sign-in failed", error);
    // Development Mode answers 403 for accounts that are not on the app's allowlist.
    if (error instanceof SpotifyRequestError && error.status === 403) return back("forbidden");
    return back("failed");
  }
}
