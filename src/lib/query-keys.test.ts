import { describe, expect, it } from "vitest";
import { queryClientDefaults, queryKeys } from "./query-keys";

const startsWith = (key: readonly unknown[], prefix: readonly unknown[]) =>
  prefix.every((part, i) => key[i] === part);

describe("queryKeys", () => {
  it("nests every key under its feature's prefix", () => {
    expect(startsWith(queryKeys.playlists.trackSearch("x"), queryKeys.playlists.all)).toBe(true);
    expect(
      startsWith(
        queryKeys.playlists.mergePreview({ targetId: null, sourceIds: ["a"], skipExisting: true }),
        queryKeys.playlists.all,
      ),
    ).toBe(true);
    expect(startsWith(queryKeys.discover.playlistSeed("p"), queryKeys.discover.all)).toBe(true);
    expect(startsWith(queryKeys.discover.generation("g"), queryKeys.discover.all)).toBe(true);
  });

  it("keeps different inputs apart", () => {
    expect(queryKeys.playlists.trackSearch("a")).not.toEqual(queryKeys.playlists.trackSearch("b"));
    expect(queryKeys.discover.generation("a")).not.toEqual(queryKeys.discover.playlistSeed("a"));
  });
});

describe("queryClientDefaults", () => {
  it("never retries writes and retries reads once", () => {
    expect(queryClientDefaults.mutations.retry).toBe(0);
    expect(queryClientDefaults.queries.retry).toBe(1);
  });
});
