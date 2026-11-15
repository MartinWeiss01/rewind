import { cookies } from "next/headers";
import { cache } from "react";
import { createDemoDataSource } from "@/data/demo/demo-data-source";
import type { MusicDataSource } from "@/data/music-data-source";
import { persona } from "@/demo/persona";
import {
  createMemoryDemoSessionStore,
  type DemoSessionStore,
  emptyDemoSessionState,
} from "@/demo/session-state";
import { enabledFlags, type FeatureFlag, parseFlagRules, type Viewer } from "./feature-flags";

export const demoSessionCookie = "rewind_demo";

export type RequestContext = {
  viewer: Viewer;
  source: MusicDataSource;
  flags: ReadonlySet<FeatureFlag>;
  now: Date;
};

// Survives hot reloads in development; one instance per server process.
const globalStore = globalThis as typeof globalThis & { rewindDemoStore?: DemoSessionStore };
globalStore.rewindDemoStore ??= createMemoryDemoSessionStore();
export const demoSessionStore: DemoSessionStore = globalStore.rewindDemoStore;

/**
 * Who is asking and which data they see, resolved once per request.
 * Without a Spotify session every visitor gets the demo.
 */
export const getRequestContext = cache(async (): Promise<RequestContext> => {
  const now = new Date();
  const cookieStore = await cookies();
  const viewer: Viewer = { mode: "demo" };

  const existingId = cookieStore.get(demoSessionCookie)?.value;
  const state =
    (existingId && (await demoSessionStore.load(existingId))) ||
    emptyDemoSessionState(persona.timeZone);
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
      await demoSessionStore.save(id, next);
    },
  });

  return { viewer, source, flags: enabledFlags(viewer, parseFlagRules(process.env)), now };
});
