"use server";

import { cookies } from "next/headers";
import { localeCookie, localeSchema } from "./locale";

const oneYear = 60 * 60 * 24 * 365;

export async function setLocale(input: unknown): Promise<void> {
  const locale = localeSchema.parse(input);
  const cookieStore = await cookies();
  cookieStore.set(localeCookie, locale, { path: "/", maxAge: oneYear, sameSite: "lax" });
}
