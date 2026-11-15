import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authorizeUrl } from "@/data/spotify/oauth";
import { oauthStateCookie } from "@/server/auth/session";
import { randomToken } from "@/server/crypto";
import { serverEnv, spotifyConfig } from "@/server/env";

/** Starts the Authorization Code flow; the state cookie protects the callback. */
export async function GET() {
  const config = spotifyConfig();
  if (!config) {
    return NextResponse.redirect(new URL("/?login=unavailable", serverEnv().APP_URL));
  }
  const state = randomToken(16);
  (await cookies()).set(oauthStateCookie, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/spotify",
    maxAge: 10 * 60,
  });
  return NextResponse.redirect(authorizeUrl(config, state));
}
