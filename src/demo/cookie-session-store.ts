import { deflateRawSync, inflateRawSync } from "node:zlib";
import { z } from "zod";
import { buildCatalog } from "./catalog";
import { persona as defaultPersona, type Persona } from "./persona";
import {
  type DemoSessionState,
  type DemoSessionStore,
  demoSessionStateSchema,
} from "./session-state";

/**
 * Demo sandboxes kept in the visitor's own cookies, for deployments without a
 * database. Pages render on the server, so the state has to travel with every
 * request: it is shrunk (catalog indexes instead of track IDs, seconds instead of
 * ISO dates), compressed and split over a few cookies. When it would not fit, the
 * oldest snapshots, AI runs and imports are dropped first.
 */

/** The cookies the store reads and writes; Next's `cookies()` fits it. */
export type CookieJar = {
  get(name: string): { value: string } | undefined;
  set(
    name: string,
    value: string,
    options: { httpOnly: boolean; sameSite: "lax"; secure: boolean; path: string; maxAge: number },
  ): void;
  delete(name: string): void;
};

const cookiePrefix = "rewind_demo_s";
/** Characters per cookie, under the ~4 KB browsers allow for name, value and attributes. */
export const chunkSize = 3800;
/** At most this many cookies, so request headers stay well under server limits. */
export const maxChunks = 3;
const maxAgeSeconds = 24 * 60 * 60;
const formatVersion = 1;

/** Thrown when even a trimmed state is too large for the cookies. */
export class DemoStateTooLargeError extends Error {
  constructor() {
    super("The demo sandbox is too large to keep in cookies");
    this.name = "DemoStateTooLargeError";
  }
}

/** Track IDs as catalog indexes; IDs outside the catalog stay as strings. */
function trackCodec(persona: Persona) {
  const tracks = buildCatalog(persona).tracks;
  const indexById = new Map(tracks.map((track, index) => [track.id, index]));
  return {
    /** Changes when the catalog does, so cookies from an older catalog are ignored. */
    fingerprint: `${persona.seed}:${tracks.length}`,
    encode: (id: string): number | string => indexById.get(id) ?? id,
    decode: (value: number | string): string =>
      typeof value === "number" ? (tracks[value]?.id ?? "") : value,
  };
}

const toSeconds = (iso: string) => Math.round(new Date(iso).getTime() / 1000);
const fromSeconds = (seconds: number) => new Date(seconds * 1000).toISOString();

const ref = z.union([z.number().int(), z.string()]);
const compactSchema = z.object({
  v: z.literal(formatVersion),
  c: z.string(),
  rules: z.unknown(),
  items: z.record(z.string(), z.array(z.tuple([ref, z.number()]))),
  details: z.unknown(),
  created: z.array(z.unknown()),
  removed: z.array(z.string()),
  snapshots: z.array(z.tuple([z.string(), z.string(), z.string(), z.number(), z.array(ref)])),
  plays: z.array(z.tuple([ref, z.number(), z.number()])),
  imports: z.array(z.unknown()),
  generations: z.array(
    z.tuple([z.string(), z.number(), z.string(), z.string(), z.array(ref), z.array(z.string())]),
  ),
  revision: z.number(),
});

/** Encodes a state as the cookie payload, or null when it doesn't fit even trimmed. */
export function encodeDemoState(
  state: DemoSessionState,
  persona: Persona = defaultPersona,
): string | null {
  const codec = trackCodec(persona);
  const encode = (draft: DemoSessionState) =>
    deflateRawSync(
      JSON.stringify({
        v: formatVersion,
        c: codec.fingerprint,
        rules: draft.rules,
        items: Object.fromEntries(
          Object.entries(draft.playlistItems).map(([id, items]) => [
            id,
            items.map((item) => [codec.encode(item.trackId), toSeconds(item.addedAt)]),
          ]),
        ),
        details: draft.playlistDetails,
        created: draft.createdPlaylists,
        removed: draft.removedPlaylists,
        snapshots: draft.snapshots.map((s) => [
          s.id,
          s.playlistId,
          s.label,
          toSeconds(s.createdAt),
          s.trackIds.map(codec.encode),
        ]),
        plays: draft.importedPlays.map(([trackId, playedAt, msPlayed]) => [
          codec.encode(trackId),
          toSeconds(playedAt),
          msPlayed,
        ]),
        imports: draft.imports,
        generations: draft.generations.map((g) => [
          g.id,
          toSeconds(g.createdAt),
          g.title,
          g.request,
          g.trackIds.map(codec.encode),
          g.unmatched,
        ]),
        revision: draft.revision,
      }),
      { level: 9 },
    ).toString("base64url");

  // Oldest history goes first; the playlists themselves are never dropped.
  let draft = state;
  for (;;) {
    const payload = encode(draft);
    if (payload.length <= chunkSize * maxChunks) return payload;
    const trimmed = trimOldest(draft);
    if (!trimmed) return null;
    draft = trimmed;
  }
}

function trimOldest(state: DemoSessionState): DemoSessionState | null {
  if (state.snapshots.length > 0) return { ...state, snapshots: state.snapshots.slice(1) };
  if (state.generations.length > 0) return { ...state, generations: state.generations.slice(1) };
  if (state.imports.length > 0) return { ...state, imports: [], importedPlays: [] };
  return null;
}

/** Decodes a cookie payload; null for anything unreadable, stale or from another catalog. */
export function decodeDemoState(
  payload: string,
  persona: Persona = defaultPersona,
): DemoSessionState | null {
  const codec = trackCodec(persona);
  let raw: unknown;
  try {
    raw = JSON.parse(inflateRawSync(Buffer.from(payload, "base64url")).toString("utf8"));
  } catch {
    return null;
  }
  const compact = compactSchema.safeParse(raw);
  if (!compact.success || compact.data.c !== codec.fingerprint) return null;
  const c = compact.data;
  const state = demoSessionStateSchema.safeParse({
    rules: c.rules,
    playlistItems: Object.fromEntries(
      Object.entries(c.items).map(([id, items]) => [
        id,
        items.map(([track, addedAt]) => ({
          trackId: codec.decode(track),
          addedAt: fromSeconds(addedAt),
        })),
      ]),
    ),
    playlistDetails: c.details,
    createdPlaylists: c.created,
    removedPlaylists: c.removed,
    snapshots: c.snapshots.map(([id, playlistId, label, createdAt, trackIds]) => ({
      id,
      playlistId,
      label,
      createdAt: fromSeconds(createdAt),
      trackIds: trackIds.map(codec.decode),
    })),
    importedPlays: c.plays.map(([track, playedAt, msPlayed]) => [
      codec.decode(track),
      fromSeconds(playedAt),
      msPlayed,
    ]),
    imports: c.imports,
    generations: c.generations.map(([id, createdAt, title, request, trackIds, unmatched]) => ({
      id,
      createdAt: fromSeconds(createdAt),
      title,
      request,
      trackIds: trackIds.map(codec.decode),
      unmatched,
    })),
    revision: c.revision,
  });
  return state.success ? state.data : null;
}

const chunkName = (index: number) => `${cookiePrefix}${index}`;

/** The demo sandbox in the visitor's cookies. The session ID is not needed here. */
export function createCookieDemoSessionStore(
  jar: CookieJar,
  options: { secure: boolean; persona?: Persona },
): DemoSessionStore {
  const clear = () => {
    for (let i = 0; i < maxChunks; i++) if (jar.get(chunkName(i))) jar.delete(chunkName(i));
  };
  return {
    async load() {
      const chunks: string[] = [];
      for (let i = 0; i < maxChunks; i++) {
        const chunk = jar.get(chunkName(i))?.value;
        if (!chunk) break;
        chunks.push(chunk);
      }
      return chunks.length ? decodeDemoState(chunks.join(""), options.persona) : null;
    },
    async save(_sessionId, state) {
      const payload = encodeDemoState(state, options.persona);
      if (payload === null) throw new DemoStateTooLargeError();
      const count = Math.ceil(payload.length / chunkSize);
      for (let i = 0; i < maxChunks; i++) {
        if (i < count) {
          jar.set(chunkName(i), payload.slice(i * chunkSize, (i + 1) * chunkSize), {
            httpOnly: true,
            sameSite: "lax",
            secure: options.secure,
            path: "/",
            maxAge: maxAgeSeconds,
          });
        } else if (jar.get(chunkName(i))) {
          jar.delete(chunkName(i));
        }
      }
    },
    async remove() {
      clear();
    },
  };
}
