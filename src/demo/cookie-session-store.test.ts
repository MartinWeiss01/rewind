import { describe, expect, it } from "vitest";
import { buildCatalog } from "./catalog";
import {
  type CookieJar,
  chunkSize,
  createCookieDemoSessionStore,
  DemoStateTooLargeError,
  decodeDemoState,
  encodeDemoState,
  maxChunks,
} from "./cookie-session-store";
import { persona } from "./persona";
import { type DemoSessionState, emptyDemoSessionState } from "./session-state";

const tracks = buildCatalog(persona).tracks;
const at = (seconds: number) => new Date(Date.UTC(2026, 10, 1) + seconds * 1000).toISOString();
const ids = (from: number, count: number) =>
  Array.from({ length: count }, (_, i) => tracks[(from + i) % tracks.length]?.id ?? "");

/** A visitor who used every tool a lot: twelve edited playlists, history, AI runs, an import. */
function busyState(): DemoSessionState {
  const state = emptyDemoSessionState("Europe/Prague");
  for (let p = 0; p < 12; p++) {
    state.playlistItems[`demo-playlist-${p}`] = ids(p * 37, 90).map((trackId, i) => ({
      trackId,
      addedAt: at(p * 1000 + i),
    }));
  }
  state.snapshots = Array.from({ length: 20 }, (_, i) => ({
    id: `demo-snapshot-${i}`,
    playlistId: `demo-playlist-${i % 12}`,
    label: "removeDuplicates:3",
    createdAt: at(50_000 + i),
    trackIds: ids(i * 11, 90),
  }));
  state.generations = Array.from({ length: 10 }, (_, i) => ({
    id: `demo-generation-${i}`,
    createdAt: at(60_000 + i),
    title: "Rainy evening, mellow indie",
    request: JSON.stringify({ mode: "vibe", prompt: "Rainy evening, mellow indie", count: 20 }),
    trackIds: ids(i * 7, 20),
    unmatched: ["Unknown – Nowhere"],
  }));
  state.importedPlays = ids(0, 120).map((trackId, i) => [trackId, at(i * 3600), 180_000]);
  state.imports = [
    { id: "demo-import-1", fileName: "sample.json", importedAt: at(70_000), added: 120 },
  ];
  state.revision = 42;
  return state;
}

/** Text compression can't shrink: a small xorshift generator, so tests stay deterministic. */
function noise(seed: number, length: number): string {
  let x = seed + 1;
  return Array.from({ length }, () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return String.fromCharCode(97 + (Math.abs(x) % 26));
  }).join("");
}

function fakeJar(): CookieJar & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    get: (name) => (values.has(name) ? { value: values.get(name) ?? "" } : undefined),
    set: (name, value) => values.set(name, value),
    delete: (name) => values.delete(name),
  };
}

describe("demo state codec", () => {
  it("round-trips a state exactly", () => {
    const state = busyState();
    state.snapshots = state.snapshots.slice(0, 2);
    state.generations = state.generations.slice(0, 2);
    const payload = encodeDemoState(state);
    expect(payload).not.toBeNull();
    expect(decodeDemoState(payload ?? "")).toEqual(
      // Dates come back in the same instant, normalized to toISOString.
      JSON.parse(
        JSON.stringify(state, (_, v) =>
          typeof v === "string" && /^\d{4}-\d\d-\d\dT/.test(v) ? new Date(v).toISOString() : v,
        ),
      ),
    );
  });

  it("keeps the playlists of a busy visitor and trims the oldest history to fit", () => {
    const payload = encodeDemoState(busyState());
    expect(payload).not.toBeNull();
    expect(payload?.length ?? 0).toBeLessThanOrEqual(chunkSize * maxChunks);
    const decoded = decodeDemoState(payload ?? "");
    expect(Object.keys(decoded?.playlistItems ?? {})).toHaveLength(12);
    expect(decoded?.snapshots.at(-1)?.id).toBe("demo-snapshot-19");
  });

  it("rejects garbage and payloads from another catalog", () => {
    expect(decodeDemoState("not-a-payload")).toBeNull();
    const payload = encodeDemoState(emptyDemoSessionState("UTC")) ?? "";
    expect(decodeDemoState(payload, { ...persona, seed: persona.seed + 1 })).toBeNull();
  });
});

describe("cookie demo session store", () => {
  it("saves over several cookies, loads them back and clears them", async () => {
    const jar = fakeJar();
    const store = createCookieDemoSessionStore(jar, { secure: false });
    const state = busyState();
    await store.save("", state);
    expect(jar.values.size).toBeGreaterThan(0);
    expect(jar.values.size).toBeLessThanOrEqual(maxChunks);
    expect((await store.load(""))?.revision).toBe(42);

    await store.save("", emptyDemoSessionState("UTC"));
    expect(jar.values.size).toBe(1);

    await store.remove("");
    expect(jar.values.size).toBe(0);
    expect(await store.load("")).toBeNull();
  });

  it("refuses a state whose playlists alone don't fit", async () => {
    const state = emptyDemoSessionState("UTC");
    for (let p = 0; p < 400; p++) {
      state.createdPlaylists.push({
        id: `demo-created-${p}`,
        // Pseudo-random text, so compression can't hide the size.
        name: `Playlist ${noise(p, 60)}`,
        description: noise(p + 1000, 200),
        isPublic: false,
        createdAt: at(p),
      });
    }
    await expect(
      createCookieDemoSessionStore(fakeJar(), { secure: false }).save("", state),
    ).rejects.toThrow(DemoStateTooLargeError);
  });
});
