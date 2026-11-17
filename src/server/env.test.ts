import { afterEach, describe, expect, it, vi } from "vitest";

describe("serverEnv in a demo-only deployment", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("ignores every key that is set", async () => {
    vi.stubEnv("DEMO_ONLY", "true");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.test");
    vi.stubEnv("SUPABASE_SECRET_KEY", "test-secret");
    vi.stubEnv("SPOTIFY_CLIENT_ID", "test-client");
    vi.stubEnv("SPOTIFY_CLIENT_SECRET", "test-client-secret");
    vi.stubEnv("SPOTIFY_REDIRECT_URI", "https://example.test/callback");
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", "test-key");
    const { serverEnv, spotifyConfig } = await import("./env");
    expect(serverEnv().DEMO_ONLY).toBe(true);
    expect(serverEnv().SUPABASE_SECRET_KEY).toBeUndefined();
    expect(spotifyConfig()).toBeNull();
  });
});
