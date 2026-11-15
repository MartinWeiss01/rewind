import { z } from "zod";
import { defaultListeningRules, listeningRulesSchema } from "@/domain/listening";

/**
 * A visitor's changes on top of the generated demo data. Kept per demo session,
 * never tied to a person, and dropped when the session expires.
 */
export const demoSessionStateSchema = z.object({
  rules: listeningRulesSchema,
  /** Item lists replaced by tool runs, keyed by playlist ID. */
  playlistItems: z.record(
    z.string(),
    z.array(z.object({ trackId: z.string(), addedAt: z.iso.datetime() })),
  ),
  playlistDetails: z.record(
    z.string(),
    z.object({ name: z.string(), description: z.string(), isPublic: z.boolean() }).partial(),
  ),
  createdPlaylists: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      isPublic: z.boolean(),
      createdAt: z.iso.datetime(),
    }),
  ),
  removedPlaylists: z.array(z.string()),
  snapshots: z.array(
    z.object({
      id: z.string(),
      playlistId: z.string(),
      label: z.string(),
      createdAt: z.iso.datetime(),
      trackIds: z.array(z.string()),
    }),
  ),
  /** Plays added through the sample import, as compact tuples [trackId, playedAt ISO, msPlayed]. */
  importedPlays: z.array(z.tuple([z.string(), z.iso.datetime(), z.number().int()])),
  imports: z.array(
    z.object({
      id: z.string(),
      fileName: z.string(),
      importedAt: z.iso.datetime(),
      added: z.number().int(),
    }),
  ),
  generations: z.array(
    z.object({
      id: z.string(),
      createdAt: z.iso.datetime(),
      title: z.string(),
      request: z.string(),
      trackIds: z.array(z.string()),
      unmatched: z.array(z.string()),
    }),
  ),
  /** Bumped on every write, used as the demo playlists' snapshot marker. */
  revision: z.number().int(),
});
export type DemoSessionState = z.infer<typeof demoSessionStateSchema>;

export const emptyDemoSessionState = (timeZone: string): DemoSessionState => ({
  rules: { ...defaultListeningRules, timeZone },
  playlistItems: {},
  playlistDetails: {},
  createdPlaylists: [],
  removedPlaylists: [],
  snapshots: [],
  importedPlays: [],
  imports: [],
  generations: [],
  revision: 0,
});

/** Where demo sessions live between requests. */
export type DemoSessionStore = {
  load(sessionId: string): Promise<DemoSessionState | null>;
  save(sessionId: string, state: DemoSessionState): Promise<void>;
  remove(sessionId: string): Promise<void>;
};

const ttlMs = 24 * 60 * 60 * 1000;

/** Process-local store. Fine for development and a single server; replaced by the database store in production. */
export function createMemoryDemoSessionStore(): DemoSessionStore {
  const sessions = new Map<string, { state: DemoSessionState; expiresAt: number }>();
  return {
    async load(sessionId) {
      const entry = sessions.get(sessionId);
      if (!entry || entry.expiresAt < Date.now()) {
        sessions.delete(sessionId);
        return null;
      }
      return structuredClone(entry.state);
    },
    async save(sessionId, state) {
      sessions.set(sessionId, { state: structuredClone(state), expiresAt: Date.now() + ttlMs });
    },
    async remove(sessionId) {
      sessions.delete(sessionId);
    },
  };
}
