import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { adminDb } from "@/data/supabase/client";
import { deleteSession, sessionCookie } from "@/server/auth/session";
import { serverEnv, spotifyConfig } from "@/server/env";

/** POST only, so a link or image elsewhere cannot sign the user out. */
export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookie)?.value;
  const config = spotifyConfig();
  if (token && config) await deleteSession(adminDb(config), token);
  cookieStore.delete(sessionCookie);
  return NextResponse.redirect(new URL("/", serverEnv().APP_URL), { status: 303 });
}
