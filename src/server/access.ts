import { z } from "zod";
import type { Db } from "@/data/supabase/client";
import { type FeatureFlag, knownFlags } from "./feature-flags";

/**
 * Feature access per person (ADR 0004), stored in `rewind_access_members` and
 * logged in `rewind_access_events`. Admins come from `ADMIN_SPOTIFY_IDS` and are
 * never stored. Server only: callers check that the viewer is an admin.
 */

/** Flags granted to a Spotify user; empty when they have no row. */
export async function grantedFlags(db: Db, spotifyUserId: string): Promise<FeatureFlag[]> {
  const { data, error } = await db
    .from("rewind_access_members")
    .select("features")
    .eq("spotify_user_id", spotifyUserId)
    .maybeSingle();
  if (error) {
    // Failing closed: without the row the person just doesn't get gated features.
    console.error("Could not read feature access", error.message);
    return [];
  }
  return data ? knownFlags(data.features) : [];
}

/** Someone on the admin page: an admin, a member, or a person who signed in. */
export type AccessPerson = {
  spotifyUserId: string;
  /** Spotify display name once they signed in, else the admin's note. */
  name: string;
  note: string;
  avatarUrl: string | null;
  admin: boolean;
  /** Whether a member row exists, so the person can be removed. */
  member: boolean;
  /** Whether they have signed in to Rewind at least once. */
  signedIn: boolean;
  lastSeenAt: Date | null;
  features: readonly FeatureFlag[];
};

export const AccessAction = {
  Add: "add",
  Remove: "remove",
  Grant: "grant",
  Revoke: "revoke",
} as const;
export type AccessAction = (typeof AccessAction)[keyof typeof AccessAction];
const accessActionSchema = z.enum(AccessAction);

export type AccessEvent = {
  id: number;
  actor: string;
  subject: string;
  action: AccessAction;
  feature: FeatureFlag | null;
  at: Date;
};

export type AccessOverview = { people: AccessPerson[]; events: AccessEvent[] };

const recentEvents = 10;

/** Everyone the admin page lists, admins first, then by last visit, then not yet signed in. */
export async function loadAccessOverview(
  db: Db,
  adminIds: ReadonlySet<string>,
): Promise<AccessOverview> {
  const [members, users, events] = await Promise.all([
    db.from("rewind_access_members").select("spotify_user_id, note, features"),
    db.from("rewind_users").select("id, spotify_user_id, display_name, avatar_url"),
    db
      .from("rewind_access_events")
      .select("id, actor_spotify_user_id, subject_spotify_user_id, action, feature, created_at")
      .order("created_at", { ascending: false })
      .limit(recentEvents),
  ]);
  const failed = members.error ?? users.error ?? events.error;
  if (failed) throw new Error(`Could not load access: ${failed.message}`);

  const userRows = users.data ?? [];
  const sessions = userRows.length
    ? await db
        .from("rewind_sessions")
        .select("user_id, last_seen_at")
        .in(
          "user_id",
          userRows.map((u) => u.id),
        )
    : { data: [], error: null };
  if (sessions.error) throw new Error(`Could not load access: ${sessions.error.message}`);
  const lastSeen = new Map<string, number>();
  for (const s of sessions.data ?? []) {
    const at = new Date(s.last_seen_at).getTime();
    lastSeen.set(s.user_id, Math.max(lastSeen.get(s.user_id) ?? 0, at));
  }

  const memberById = new Map((members.data ?? []).map((m) => [m.spotify_user_id, m]));
  const userById = new Map(userRows.map((u) => [u.spotify_user_id, u]));
  const ids = new Set([...adminIds, ...memberById.keys(), ...userById.keys()]);

  const people = [...ids].map((id): AccessPerson => {
    const member = memberById.get(id);
    const user = userById.get(id);
    const seen = user ? lastSeen.get(user.id) : undefined;
    const note = member?.note ?? "";
    return {
      spotifyUserId: id,
      name: user?.display_name || note || id,
      note,
      avatarUrl: user?.avatar_url ?? null,
      admin: adminIds.has(id),
      member: member !== undefined,
      signedIn: user !== undefined,
      lastSeenAt: seen ? new Date(seen) : null,
      features: member ? knownFlags(member.features) : [],
    };
  });
  people.sort(
    (a, b) =>
      Number(b.admin) - Number(a.admin) ||
      Number(b.signedIn) - Number(a.signedIn) ||
      (b.lastSeenAt?.getTime() ?? 0) - (a.lastSeenAt?.getTime() ?? 0) ||
      a.name.localeCompare(b.name),
  );

  return {
    people,
    events: (events.data ?? []).flatMap((e): AccessEvent[] => {
      const action = accessActionSchema.safeParse(e.action);
      if (!action.success) return [];
      const [feature] = e.feature ? knownFlags([e.feature]) : [];
      return [
        {
          id: e.id,
          actor: e.actor_spotify_user_id,
          subject: e.subject_spotify_user_id,
          action: action.data,
          feature: feature ?? null,
          at: new Date(e.created_at),
        },
      ];
    }),
  };
}

async function log(
  db: Db,
  actor: string,
  subject: string,
  action: AccessAction,
  feature: FeatureFlag | null = null,
) {
  const { error } = await db.from("rewind_access_events").insert({
    actor_spotify_user_id: actor,
    subject_spotify_user_id: subject,
    action,
    feature,
  });
  // The change itself went through; a missing log line is not worth failing it.
  if (error) console.error("Could not log an access change", error.message);
}

/** Adds a person, or replaces their note and features when they are already a member. */
export async function addMember(
  db: Db,
  actor: string,
  person: { spotifyUserId: string; note: string; features: readonly FeatureFlag[] },
): Promise<void> {
  const { error } = await db.from("rewind_access_members").upsert({
    spotify_user_id: person.spotifyUserId,
    note: person.note,
    features: [...person.features],
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Could not add a person: ${error.message}`);
  await log(db, actor, person.spotifyUserId, AccessAction.Add);
}

/** Turns one feature on or off for a person, creating their member row if needed. */
export async function setFeature(
  db: Db,
  actor: string,
  subject: string,
  feature: FeatureFlag,
  on: boolean,
): Promise<void> {
  const current = await grantedFlags(db, subject);
  const next = on ? knownFlags([...current, feature]) : current.filter((flag) => flag !== feature);
  const { error } = await db.from("rewind_access_members").upsert({
    spotify_user_id: subject,
    features: next,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Could not change access: ${error.message}`);
  await log(db, actor, subject, on ? AccessAction.Grant : AccessAction.Revoke, feature);
}

/** Removes a person's member row and with it every feature they had. */
export async function removeMember(db: Db, actor: string, subject: string): Promise<void> {
  const { error } = await db.from("rewind_access_members").delete().eq("spotify_user_id", subject);
  if (error) throw new Error(`Could not remove a person: ${error.message}`);
  await log(db, actor, subject, AccessAction.Remove);
}

/**
 * Reads a Spotify user ID from what an admin pastes: the ID itself, a profile link
 * (`open.spotify.com/user/<id>?si=…`) or a `spotify:user:<id>` URI. Null when it is
 * none of those.
 */
export function parseSpotifyUserId(input: string): string | null {
  const text = input.trim();
  const fromLink = text.match(
    /^(?:https?:\/\/)?open\.spotify\.com\/(?:intl-[a-z-]+\/)?user\/([^/?#]+)/i,
  );
  const fromUri = text.match(/^spotify:user:([^:]+)$/i);
  const raw = fromLink?.[1] ?? fromUri?.[1] ?? text;
  const id = (() => {
    try {
      return decodeURIComponent(raw);
    } catch {
      return null;
    }
  })();
  if (!id || id.length > 200 || /[\s/:?#]/.test(id)) return null;
  return id;
}
