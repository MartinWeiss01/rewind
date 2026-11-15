import { defineConfig } from "orval";

type SchemaNode = {
  properties?: Record<string, SchemaNode & { deprecated?: boolean }>;
  required?: string[];
  [key: string]: unknown;
};

/**
 * Spotify keeps removed fields in the document with `deprecated: true` (popularity,
 * available_markets, followers…). Treat them as absent: drop them from schemas so
 * validation never depends on them.
 */
function dropDeprecatedFields(node: unknown): void {
  if (Array.isArray(node)) {
    for (const item of node) dropDeprecatedFields(item);
    return;
  }
  if (!node || typeof node !== "object") return;
  const schema = node as SchemaNode;
  if (schema.properties) {
    for (const [name, property] of Object.entries(schema.properties)) {
      if (property?.deprecated === true) {
        delete schema.properties[name];
        schema.required = schema.required?.filter((field) => field !== name);
      }
    }
    // An empty `required` list is invalid OpenAPI.
    if (schema.required?.length === 0) delete schema.required;
  }
  for (const value of Object.values(schema)) dropDeprecatedFields(value);
}

/**
 * Zod schemas for the Spotify Web API endpoints Rewind uses, generated from Spotify's
 * official OpenAPI document. Run `pnpm spotify:generate` after changing the list.
 * Only listed, current operations are generated; deprecated ones are never included.
 */
export default defineConfig({
  spotify: {
    input: {
      // Prepared by scripts/fetch-spotify-openapi.mjs from Spotify's published schema.
      target: "./node_modules/.cache/spotify-openapi.yaml",
      override: {
        transformer: (spec) => {
          dropDeprecatedFields(spec);
          return spec;
        },
      },
      filters: {
        mode: "include",
        operationIds: [
          "get-current-users-profile",
          "get-recently-played",
          "get-track",
          "search",
          "get-a-list-of-current-users-playlists",
          "get-playlist",
          "get-playlists-items",
          "create-playlist",
          "change-playlist-details",
          "add-items-to-playlist",
          "reorder-or-replace-playlists-items",
          "unfollow-playlist",
        ],
      },
    },
    output: {
      client: "zod",
      mode: "single",
      target: "./src/data/spotify/generated/spotify.zod.ts",
      override: { zod: { version: 4 } },
    },
  },
});
