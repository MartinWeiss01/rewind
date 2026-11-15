import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { authorizeUrl } from "@/data/spotify/oauth";
import { listeningRulesSchema } from "@/domain/listening";
import { oauthStateCookie, oauthTimeZoneCookie } from "@/server/auth/session";
import { randomToken } from "@/server/crypto";
import { serverEnv, spotifyConfig } from "@/server/env";

/** Starts the Authorization Code flow; the state cookie protects the callback. */
export async function GET(request: NextRequest) {
  const config = spotifyConfig();
  if (!config) {
    return NextResponse.redirect(new URL("/?login=unavailable", serverEnv().APP_URL));
  }
  const state = randomToken(16);
  const cookieStore = await cookies();
  const options = {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/spotify",
    maxAge: 10 * 60,
  } as const;
  cookieStore.set(oauthStateCookie, state, options);
  const timeZone = listeningRulesSchema.shape.timeZone.safeParse(
    request.nextUrl.searchParams.get("tz"),
  );
  if (timeZone.success) cookieStore.set(oauthTimeZoneCookie, timeZone.data, options);
  return NextResponse.redirect(authorizeUrl(config, state));
}
