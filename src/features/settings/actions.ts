"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { DataMode } from "@/data/music-data-source";
import { getRequestContext, resetDemoSession } from "@/server/request-context";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

const rulesSchema = z.object({
  skipSeconds: z.coerce.number().int().min(0).max(60),
  timeZone: z.string().min(1).max(64),
});

export async function saveListeningRules(input: unknown): Promise<ActionResult> {
  const parsed = rulesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { source } = await getRequestContext();
  try {
    await source.saveListeningRules({
      skipThresholdMs: parsed.data.skipSeconds * 1000,
      timeZone: parsed.data.timeZone,
    });
  } catch {
    return { ok: false, error: "failed" };
  }
  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function syncNow(): Promise<ActionResult> {
  const { account } = await getRequestContext();
  if (!account) return { ok: false, error: "demo" };
  try {
    const { added } = await account.syncNow();
    revalidatePath("/app", "layout");
    return { ok: true, message: String(added) };
  } catch {
    return { ok: false, error: "failed" };
  }
}

export async function deleteImport(input: unknown): Promise<ActionResult> {
  const id = z.string().min(1).max(100).safeParse(input);
  if (!id.success) return { ok: false, error: "invalid" };
  const { source } = await getRequestContext();
  await source.deleteImport(id.data);
  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function deleteAllData(): Promise<ActionResult> {
  const { source } = await getRequestContext();
  await source.deleteAllData();
  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function disconnectSpotify(): Promise<void> {
  const { account } = await getRequestContext();
  if (account) await account.disconnect();
  redirect("/");
}

export async function resetDemo(): Promise<void> {
  const { source } = await getRequestContext();
  if (source.mode !== DataMode.Demo) return;
  await resetDemoSession();
  revalidatePath("/app", "layout");
  redirect("/app/settings");
}

export async function endDemo(): Promise<void> {
  await resetDemoSession();
  redirect("/");
}
