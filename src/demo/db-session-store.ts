import type { Db } from "@/data/supabase/client";
import {
  type DemoSessionState,
  type DemoSessionStore,
  demoSessionStateSchema,
} from "./session-state";

const ttlMs = 24 * 60 * 60 * 1000;

/** Demo sandboxes in `rewind_demo_sessions`, shared by every server instance. */
export function createDbDemoSessionStore(db: Db): DemoSessionStore {
  return {
    async load(sessionId) {
      const { data } = await db
        .from("rewind_demo_sessions")
        .select("state, expires_at")
        .eq("id", sessionId)
        .maybeSingle();
      if (!data || new Date(data.expires_at) < new Date()) return null;
      const parsed = demoSessionStateSchema.safeParse(data.state);
      return parsed.success ? parsed.data : null;
    },
    async save(sessionId, state: DemoSessionState) {
      const now = Date.now();
      const { error } = await db.from("rewind_demo_sessions").upsert({
        id: sessionId,
        state,
        expires_at: new Date(now + ttlMs).toISOString(),
        updated_at: new Date(now).toISOString(),
      });
      if (error) throw new Error(`Could not save demo session: ${error.message}`);
      // Opportunistic cleanup keeps the table small without a separate job.
      if (Math.random() < 0.05) {
        await db
          .from("rewind_demo_sessions")
          .delete()
          .lt("expires_at", new Date(now).toISOString());
      }
    },
    async remove(sessionId) {
      await db.from("rewind_demo_sessions").delete().eq("id", sessionId);
    },
  };
}
