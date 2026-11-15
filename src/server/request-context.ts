import { cookies } from "next/headers";
import { after } from "next/server";
import { cache } from "react";
import { createDemoDataSource } from "@/data/demo/demo-data-source";
import type { MusicDataSource } from "@/data/music-data-source";
import { createSpotifyDataSource } from "@/data/spotify/spotify-data-source";
import { syncRecentlyPlayed } from "@/data/spotify/sync";
import { adminDb } from "@/data/supabase/client";
import { createDbDemoSessionStore } from "@/demo/db-session-store";
import { persona } from "@/demo/persona";
import {
  createMemoryDemoSessionStore,
  type DemoSessionStore,
  emptyDemoSessionState,
} from "@/demo/session-state";
import { accessTokenFor, sessionCookie, userForSession } from "./auth/session";
import { serverEnv, spotifyConfig } from "./env";
import { enabledFlags, type FeatureFlag, parseFlagRules, type Viewer } from "./feature-flags";

export const demoSessionCookie = "rewind_demo";

export type RequestContext = {
  viewer: Viewer;
  source: MusicDataSource;
  flags: ReadonlySet<FeatureFlag>;
  now: Date;
  /** True when Spotify sign-in is configured on this deployment. */
  spotifyAvailable: boolean;
  /** Account actions for a signed-in Spotify user; null in demo mode. */
  account: SpotifyAccount | null;
};

export type SpotifyAccount = {
  /** When Spotify asks the user to sign in again (six months after authorizing). */
  loginValidUntil: Date | null;
  syncError: string | null;
  syncNow(): Promise<{ added: number }>;
  /** Deletes the user and everything stored about them, then ends the session. */
  disconnect(): Promise<void>;
};

const syncEveryMs = 10 * 60 * 1000;
const sixMonthsMs = 182 * 24 * 60 * 60 * 1000;

// Process-local fallback when no database is configured (development without Supabase).
const globalStore = globalThis as typeof globalThis & { rewindDemoStore?: DemoSessionStore };
globalStore.rewindDemoStore ??= createMemoryDemoSessionStore();
const memoryStore: DemoSessionStore = globalStore.rewindDemoStore;

function demoStore(): DemoSessionStore {
  const env = serverEnv();
  return env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SECRET_KEY
    ? createDbDemoSessionStore(
        adminDb({
          supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
          supabaseSecretKey: env.SUPABASE_SECRET_KEY,
        }),
      )
    : memoryStore;
}

/**
 * Who is asking and which data they see, resolved once per request.
 * A valid Spotify session gets Spotify mode; everyone else gets the demo.
 */
export const getRequestContext = cache(async (): Promise<RequestContext> => {
  const now = new Date();
  const cookieStore = await cookies();
  const config = spotifyConfig();
  const flagRules = parseFlagRules(process.env);

  if (config) {
    const db = adminDb(config);
    const user = await userForSession(db, cookieStore.get(sessionCookie)?.value);
    if (user) {
      const viewer: Viewer = { mode: "spotify", spotifyUserId: user.spotify_user_id };
      const accessToken = () => accessTokenFor(db, config, user.id);
      const lastSync = user.last_sync_at ? new Date(user.last_sync_at).getTime() : 0;
      if (now.getTime() - lastSync > syncEveryMs) {
        // Keep history fresh without delaying the page.
        after(async () => {
          try {
            await syncRecentlyPlayed(db, user, await accessToken());
          } catch (error) {
            console.error("Background sync failed", error);
          }
        });
      }
      const { data: tokenRow } = await db
        .from("rewind_spotify_tokens")
        .select("authorized_at")
        .eq("user_id", user.id)
        .maybeSingle();
      const account: SpotifyAccount = {
        loginValidUntil: tokenRow
          ? new Date(new Date(tokenRow.authorized_at).getTime() + sixMonthsMs)
          : null,
        syncError: user.sync_error,
        syncNow: async () => syncRecentlyPlayed(db, user, await accessToken()),
        disconnect: async () => {
          // Tokens, sessions, plays, imports, snapshots and generations cascade.
          const { error } = await db.from("rewind_users").delete().eq("id", user.id);
          if (error) throw new Error(`Could not delete account: ${error.message}`);
          cookieStore.delete(sessionCookie);
        },
      };
      return {
        viewer,
        source: createSpotifyDataSource({ db, user, accessToken }),
        flags: enabledFlags(viewer, flagRules),
        now,
        spotifyAvailable: true,
        account,
      };
    }
  }

  const store = demoStore();
  const viewer: Viewer = { mode: "demo" };
  const existingId = cookieStore.get(demoSessionCookie)?.value;
  const state =
    (existingId && (await store.load(existingId))) || emptyDemoSessionState(persona.timeZone);
  const source = createDemoDataSource({
    state,
    now,
    // Writes only happen in server actions and route handlers, where cookies can be set.
    commit: async (next) => {
      const id = existingId ?? crypto.randomUUID();
      if (!existingId) {
        cookieStore.set(demoSessionCookie, id, {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/",
          maxAge: 24 * 60 * 60,
        });
      }
      await store.save(id, next);
    },
  });
  return {
    viewer,
    source,
    flags: enabledFlags(viewer, flagRules),
    now,
    spotifyAvailable: config !== null,
    account: null,
  };
});

/** Ends the visitor's demo sandbox (Settings → Reset demo). */
export async function resetDemoSession(): Promise<void> {
  const cookieStore = await cookies();
  const id = cookieStore.get(demoSessionCookie)?.value;
  if (id) await demoStore().remove(id);
  cookieStore.delete(demoSessionCookie);
}
