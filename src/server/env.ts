import { z } from "zod";

/** `true` turns a flag on; anything else, or nothing, leaves it off. */
export const envFlag = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
  z
    .enum(["true", "false", ""])
    .optional()
    .transform((value) => value === "true"),
);

const optional = z
  .string()
  .optional()
  .transform((value) => (value?.trim() ? value.trim() : undefined));

/** Server-side environment, validated on first use. Never import from client components. */
const serverEnvSchema = z.object({
  /**
   * A public portfolio deployment: demo mode only, with no database, Spotify or AI
   * keys used even if some are set. Visitors' demo changes live in their cookies.
   */
  DEMO_ONLY: envFlag,
  APP_URL: z.url().default("http://127.0.0.1:3000"),
  NEXT_PUBLIC_SUPABASE_URL: optional.pipe(z.url().optional()),
  SUPABASE_SECRET_KEY: optional,
  SPOTIFY_CLIENT_ID: optional,
  SPOTIFY_CLIENT_SECRET: optional,
  SPOTIFY_REDIRECT_URI: optional.pipe(z.url().optional()),
  AUTH_SECRET: optional,
  TOKEN_ENCRYPTION_KEY: optional,
  CRON_SECRET: optional,
});
export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  cached ??= withoutKeysWhenDemoOnly(serverEnvSchema.parse(process.env));
  return cached;
}

/** In a demo-only deployment no key is used, so nothing real can be reached by mistake. */
function withoutKeysWhenDemoOnly(env: ServerEnv): ServerEnv {
  if (!env.DEMO_ONLY) return env;
  return {
    DEMO_ONLY: true,
    APP_URL: env.APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: undefined,
    SUPABASE_SECRET_KEY: undefined,
    SPOTIFY_CLIENT_ID: undefined,
    SPOTIFY_CLIENT_SECRET: undefined,
    SPOTIFY_REDIRECT_URI: undefined,
    AUTH_SECRET: undefined,
    TOKEN_ENCRYPTION_KEY: undefined,
    CRON_SECRET: undefined,
  };
}

export type SpotifyConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  supabaseUrl: string;
  supabaseSecretKey: string;
  encryptionKey: string;
};

/**
 * Everything Spotify mode needs. Null when anything is missing, in which case the app
 * runs demo-only and the sign-in button explains that Spotify is not configured.
 */
export function spotifyConfig(): SpotifyConfig | null {
  const env = serverEnv();
  if (
    !env.SPOTIFY_CLIENT_ID ||
    !env.SPOTIFY_CLIENT_SECRET ||
    !env.SPOTIFY_REDIRECT_URI ||
    !env.NEXT_PUBLIC_SUPABASE_URL ||
    !env.SUPABASE_SECRET_KEY ||
    !env.TOKEN_ENCRYPTION_KEY
  ) {
    return null;
  }
  return {
    clientId: env.SPOTIFY_CLIENT_ID,
    clientSecret: env.SPOTIFY_CLIENT_SECRET,
    redirectUri: env.SPOTIFY_REDIRECT_URI,
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseSecretKey: env.SUPABASE_SECRET_KEY,
    encryptionKey: env.TOKEN_ENCRYPTION_KEY,
  };
}
