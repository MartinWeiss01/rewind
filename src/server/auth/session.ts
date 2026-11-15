import { InvalidGrantError, refreshAccessToken, type TokenResponse } from "@/data/spotify/oauth";
import type { Db } from "@/data/supabase/client";
import { decrypt, encrypt, encryptionKeyFrom, randomToken, sha256 } from "@/server/crypto";
import type { SpotifyConfig } from "@/server/env";

export const sessionCookie = "rewind_session";
export const oauthStateCookie = "rewind_oauth_state";
/** The browser's time zone, carried through sign-in to set up a new account. */
export const oauthTimeZoneCookie = "rewind_oauth_tz";
export const sessionMaxAgeSeconds = 30 * 24 * 60 * 60;

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
} as const;

export type UserRow = {
  id: string;
  spotify_user_id: string;
  display_name: string;
  avatar_url: string | null;
  profile_url: string | null;
  skip_threshold_ms: number;
  time_zone: string;
  last_sync_at: string | null;
  last_sync_cursor_ms: number | null;
  sync_error: string | null;
};

const userColumns =
  "id, spotify_user_id, display_name, avatar_url, profile_url, skip_threshold_ms, time_zone, last_sync_at, last_sync_cursor_ms, sync_error";

/** Creates a session and returns the raw token for the cookie; only its hash is stored. */
export async function createSession(db: Db, userId: string): Promise<string> {
  const token = randomToken();
  const { error } = await db.from("rewind_sessions").insert({
    token_hash: sha256(token),
    user_id: userId,
    expires_at: new Date(Date.now() + sessionMaxAgeSeconds * 1000).toISOString(),
  });
  if (error) throw new Error(`Could not create session: ${error.message}`);
  return token;
}

/** The signed-in user for a session token, or null when it is missing, unknown or expired. */
export async function userForSession(db: Db, token: string | undefined): Promise<UserRow | null> {
  if (!token) return null;
  const { data: session } = await db
    .from("rewind_sessions")
    .select("user_id, expires_at")
    .eq("token_hash", sha256(token))
    .maybeSingle();
  if (!session || new Date(session.expires_at) < new Date()) return null;
  const { data: user } = await db
    .from("rewind_users")
    .select(userColumns)
    .eq("id", session.user_id)
    .maybeSingle();
  return user ?? null;
}

export async function deleteSession(db: Db, token: string): Promise<void> {
  await db.from("rewind_sessions").delete().eq("token_hash", sha256(token));
}

/** Stores freshly issued tokens (sign-in or refresh), encrypted. */
export async function saveTokens(
  db: Db,
  config: SpotifyConfig,
  userId: string,
  tokens: TokenResponse,
  isNewAuthorization: boolean,
): Promise<void> {
  const key = encryptionKeyFrom(config.encryptionKey);
  const now = new Date();
  const row = {
    user_id: userId,
    access_token_encrypted: encrypt(tokens.access_token, key),
    access_token_expires_at: new Date(now.getTime() + tokens.expires_in * 1000).toISOString(),
    updated_at: now.toISOString(),
    ...(tokens.scope ? { scopes: tokens.scope } : {}),
    ...(isNewAuthorization ? { authorized_at: now.toISOString() } : {}),
  };
  if (tokens.refresh_token) {
    const { error } = await db
      .from("rewind_spotify_tokens")
      .upsert({ ...row, refresh_token_encrypted: encrypt(tokens.refresh_token, key) });
    if (error) throw new Error(`Could not store tokens: ${error.message}`);
    return;
  }
  const { error } = await db.from("rewind_spotify_tokens").update(row).eq("user_id", userId);
  if (error) throw new Error(`Could not store tokens: ${error.message}`);
}

/** Thrown when the user has to sign in with Spotify again. */
export class ReauthorizationRequiredError extends Error {
  constructor() {
    super("Spotify sign-in expired");
    this.name = "ReauthorizationRequiredError";
  }
}

/** A valid access token for the user, refreshed when it expires within a minute. */
export async function accessTokenFor(
  db: Db,
  config: SpotifyConfig,
  userId: string,
): Promise<string> {
  const key = encryptionKeyFrom(config.encryptionKey);
  const { data } = await db
    .from("rewind_spotify_tokens")
    .select("access_token_encrypted, access_token_expires_at, refresh_token_encrypted")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new ReauthorizationRequiredError();
  const expiresAt = data.access_token_expires_at
    ? new Date(data.access_token_expires_at).getTime()
    : 0;
  if (data.access_token_encrypted && expiresAt - Date.now() > 60_000) {
    return decrypt(data.access_token_encrypted, key);
  }
  try {
    const tokens = await refreshAccessToken(config, decrypt(data.refresh_token_encrypted, key));
    await saveTokens(db, config, userId, tokens, false);
    return tokens.access_token;
  } catch (error) {
    if (error instanceof InvalidGrantError) {
      // Revoked or older than six months: forget the tokens and every session.
      await db.from("rewind_spotify_tokens").delete().eq("user_id", userId);
      await db.from("rewind_sessions").delete().eq("user_id", userId);
      await db
        .from("rewind_users")
        .update({ sync_error: "reauthorize", updated_at: new Date().toISOString() })
        .eq("id", userId);
      throw new ReauthorizationRequiredError();
    }
    throw error;
  }
}
