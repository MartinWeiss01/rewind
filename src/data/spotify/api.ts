import type { z } from "zod";

const apiBase = "https://api.spotify.com/v1";

export class SpotifyAuthError extends Error {
  constructor(message = "Spotify rejected the access token") {
    super(message);
    this.name = "SpotifyAuthError";
  }
}

/** 429 from Spotify. `quotaExceeded` means the app's daily quota, not a short burst. */
export class SpotifyRateLimitError extends Error {
  constructor(
    readonly retryAfterSeconds: number,
    readonly quotaExceeded: boolean,
  ) {
    super(
      quotaExceeded
        ? "Spotify quota exceeded"
        : `Spotify rate limit, retry after ${retryAfterSeconds}s`,
    );
    this.name = "SpotifyRateLimitError";
  }
}

export class SpotifyRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "SpotifyRequestError";
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  query?: Record<string, string | number | undefined>;
  body?: unknown;
};

/** Short bursts are retried once if Spotify asks to wait at most this long. */
const maxInlineRetrySeconds = 3;

/**
 * Calls the Web API and validates the JSON response with a schema generated from
 * Spotify's OpenAPI document. Never runs in the browser: the token stays on the server.
 */
export async function spotifyRequest<T extends z.ZodType>(
  accessToken: string,
  path: string,
  schema: T,
  options: RequestOptions = {},
  attempt = 0,
): Promise<z.infer<T>> {
  const url = new URL(`${apiBase}${path}`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  });

  if (response.status === 401) throw new SpotifyAuthError();
  if (response.status === 429) {
    const retryAfter = Number(response.headers.get("Retry-After") ?? "1") || 1;
    const text = await response.text().catch(() => "");
    const quotaExceeded = text.includes("QUOTA_EXCEEDED");
    if (!quotaExceeded && attempt === 0 && retryAfter <= maxInlineRetrySeconds) {
      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
      return spotifyRequest(accessToken, path, schema, options, attempt + 1);
    }
    throw new SpotifyRateLimitError(retryAfter, quotaExceeded);
  }
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new SpotifyRequestError(
      response.status,
      `Spotify ${options.method ?? "GET"} ${path} failed: ${response.status} ${text.slice(0, 200)}`,
    );
  }

  const json: unknown = response.status === 204 ? {} : await response.json().catch(() => ({}));
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new SpotifyRequestError(
      response.status,
      `Unexpected response from ${path}: ${issue?.path.join(".") ?? "?"} ${issue?.message ?? ""}`,
    );
  }
  return parsed.data;
}
