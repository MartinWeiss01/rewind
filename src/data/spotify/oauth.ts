import { z } from "zod";
import type { SpotifyConfig } from "@/server/env";

/** Only what Rewind uses: history sync, playlist reading and editing. */
export const spotifyScopes = [
  "user-read-recently-played",
  "playlist-read-private",
  "playlist-read-collaborative",
  "playlist-modify-private",
  "playlist-modify-public",
] as const;

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string(),
  expires_in: z.number().int().positive(),
  refresh_token: z.string().min(1).optional(),
  scope: z.string().optional(),
});
export type TokenResponse = z.infer<typeof tokenResponseSchema>;

/** The refresh token was revoked or is older than six months: the user must sign in again. */
export class InvalidGrantError extends Error {
  constructor() {
    super("Spotify refresh token is no longer valid");
    this.name = "InvalidGrantError";
  }
}

export function authorizeUrl(config: SpotifyConfig, state: string): string {
  const url = new URL("https://accounts.spotify.com/authorize");
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    scope: spotifyScopes.join(" "),
    redirect_uri: config.redirectUri,
    state,
  }).toString();
  return url.toString();
}

async function tokenRequest(
  config: SpotifyConfig,
  body: Record<string, string>,
): Promise<TokenResponse> {
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams(body),
    cache: "no-store",
  });
  const json: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = z.object({ error: z.string() }).safeParse(json);
    if (error.success && error.data.error === "invalid_grant") throw new InvalidGrantError();
    throw new Error(`Spotify token request failed with ${response.status}`);
  }
  return tokenResponseSchema.parse(json);
}

export const exchangeCode = (config: SpotifyConfig, code: string) =>
  tokenRequest(config, {
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
  });

export const refreshAccessToken = (config: SpotifyConfig, refreshToken: string) =>
  tokenRequest(config, { grant_type: "refresh_token", refresh_token: refreshToken });
