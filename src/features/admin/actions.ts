"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminDb, type Db } from "@/data/supabase/client";
import {
  accessFor,
  addMember,
  parseSpotifyUserId,
  removeMember,
  setFeature,
} from "@/server/access";
import { spotifyConfig } from "@/server/env";
import { featureFlagSchema } from "@/server/feature-flags";
import { getRequestContext } from "@/server/request-context";
import { AccessError, type AccessResult } from "./types";

const fail = (error: AccessError): AccessResult => ({ status: "error", error });

/** The database and the acting admin's Spotify ID, or null when the viewer isn't an admin. */
async function asAdmin(): Promise<{ db: Db; actor: string } | null> {
  const context = await getRequestContext();
  const config = spotifyConfig();
  if (!context.isAdmin || context.viewer.mode !== "spotify" || !config) return null;
  return { db: adminDb(config), actor: context.viewer.spotifyUserId };
}

const idSchema = z.string().trim().min(1).max(200);

async function run(
  subject: string,
  write: (admin: { db: Db; actor: string }) => Promise<void>,
): Promise<AccessResult> {
  const admin = await asAdmin();
  if (!admin) return fail(AccessError.Forbidden);
  try {
    if ((await accessFor(admin.db, subject)).admin) return fail(AccessError.Admin);
    await write(admin);
  } catch (error) {
    console.error(error);
    return fail(AccessError.Failed);
  }
  revalidatePath("/app/admin");
  return { status: "ok" };
}

const setFeatureSchema = z.object({
  spotifyUserId: idSchema,
  feature: featureFlagSchema,
  on: z.boolean(),
});

/** Turns one feature on or off for a person. */
export async function setFeatureAction(input: unknown): Promise<AccessResult> {
  const parsed = setFeatureSchema.safeParse(input);
  if (!parsed.success) return fail(AccessError.Invalid);
  const { spotifyUserId, feature, on } = parsed.data;
  return run(spotifyUserId, ({ db, actor }) => setFeature(db, actor, spotifyUserId, feature, on));
}

const addSchema = z.object({
  spotifyUser: z.string().max(400),
  note: z.string().trim().max(200),
  features: z.array(featureFlagSchema).max(10),
});

/** Adds a person by Spotify user ID or profile link, with their first features. */
export async function addPersonAction(input: unknown): Promise<AccessResult> {
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return fail(AccessError.Invalid);
  const spotifyUserId = parseSpotifyUserId(parsed.data.spotifyUser);
  if (!spotifyUserId) return fail(AccessError.InvalidId);
  return run(spotifyUserId, ({ db, actor }) =>
    addMember(db, actor, {
      spotifyUserId,
      note: parsed.data.note,
      features: [...new Set(parsed.data.features)],
    }),
  );
}

/** Removes a person and every feature they had. */
export async function removePersonAction(input: unknown): Promise<AccessResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return fail(AccessError.Invalid);
  return run(parsed.data, ({ db, actor }) => removeMember(db, actor, parsed.data));
}
