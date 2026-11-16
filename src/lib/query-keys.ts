import type { DefaultOptions } from "@tanstack/react-query";

/**
 * Defaults for client-side queries and mutations. Reads stay fresh for 30 seconds
 * and retry once; writes never retry on their own, so a failed write is only
 * repeated when the listener asks for it.
 */
export const queryClientDefaults = {
  queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  mutations: { retry: 0 },
} as const satisfies DefaultOptions;

/**
 * Query keys per feature. Each feature's `all` key is the prefix of its other keys,
 * so invalidating it refreshes everything the feature caches on the client.
 */
export const queryKeys = {
  playlists: {
    all: ["playlists"] as const,
    trackSearch: (query: string) => ["playlists", "trackSearch", query] as const,
    /** Prefix of every playlist loaded for comparing; playlist writes invalidate it. */
    compares: ["playlists", "compare"] as const,
    compare: (playlistId: string) => ["playlists", "compare", playlistId] as const,
    /** Prefix of every merge preview; playlist writes invalidate it. */
    mergePreviews: ["playlists", "mergePreview"] as const,
    mergePreview: (input: {
      targetId: string | null;
      sourceIds: readonly string[];
      skipExisting: boolean;
    }) => ["playlists", "mergePreview", input] as const,
  },
  discover: {
    all: ["discover"] as const,
    playlistSeed: (playlistId: string) => ["discover", "playlistSeed", playlistId] as const,
    generation: (id: string) => ["discover", "generation", id] as const,
  },
} as const;
