import { adminDb } from "@/data/supabase/client";
import { serverEnv } from "./env";

const memory = new Map<string, number>();

/**
 * Fixed-window counter. Returns true while `key` is under `limit` in the current window.
 * Uses the database when configured (shared by all instances), otherwise process memory.
 */
export async function takeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs).toISOString();
  const env = serverEnv();
  if (env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SECRET_KEY) {
    const db = adminDb({
      supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseSecretKey: env.SUPABASE_SECRET_KEY,
    });
    const { data, error } = await db.rpc("rewind_hit_rate_limit", {
      p_key: key,
      p_window_start: windowStart,
    });
    if (error) throw new Error(`Rate limit check failed: ${error.message}`);
    return (data ?? 0) <= limit;
  }
  const memoryKey = `${key}@${windowStart}`;
  const count = (memory.get(memoryKey) ?? 0) + 1;
  memory.set(memoryKey, count);
  return count <= limit;
}
