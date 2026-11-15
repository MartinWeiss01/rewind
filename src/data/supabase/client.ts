import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { SpotifyConfig } from "@/server/env";
import type { Database } from "./database.types";

export type Db = SupabaseClient<Database>;

let cached: { key: string; client: Db } | null = null;

/**
 * Server-only client with the secret key. Row-level security has no policies, so this
 * is the only way in; every query must filter by the signed-in user's ID.
 */
export function adminDb(config: Pick<SpotifyConfig, "supabaseUrl" | "supabaseSecretKey">): Db {
  const key = `${config.supabaseUrl}|${config.supabaseSecretKey.slice(0, 8)}`;
  if (cached?.key === key) return cached.client;
  const client = createClient<Database>(config.supabaseUrl, config.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  cached = { key, client };
  return client;
}
