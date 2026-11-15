import type { PlaylistDetail, PlaylistItem } from "@/domain/playlists";
import type { Catalog, CatalogTrack } from "./catalog";
import type { GenreKey, Persona } from "./persona";
import { createRandom, hashString } from "./random";

type PlaylistPlan = {
  genres: readonly GenreKey[];
  size: number;
  /** Exact repeats of a track already in the list. */
  repeats: number;
  /** Adds the remastered copy next to an original. */
  withRemaster: boolean;
  owner: "self" | "other";
};

const plans: readonly PlaylistPlan[] = [
  { genres: ["synthwave", "indie"], size: 64, repeats: 4, withRemaster: true, owner: "self" },
  { genres: ["folk", "jazz"], size: 38, repeats: 0, withRemaster: false, owner: "self" },
  { genres: ["hiphop", "synthwave"], size: 112, repeats: 8, withRemaster: true, owner: "self" },
  { genres: ["jazz", "synthwave"], size: 87, repeats: 0, withRemaster: false, owner: "self" },
  {
    genres: ["indie", "folk", "synthwave", "hiphop", "jazz"],
    size: 140,
    repeats: 2,
    withRemaster: true,
    owner: "self",
  },
  { genres: ["synthwave"], size: 46, repeats: 1, withRemaster: false, owner: "self" },
  { genres: ["indie", "folk"], size: 52, repeats: 0, withRemaster: false, owner: "self" },
  { genres: ["jazz"], size: 30, repeats: 0, withRemaster: false, owner: "self" },
  { genres: ["indie", "hiphop"], size: 75, repeats: 3, withRemaster: false, owner: "self" },
  {
    genres: ["indie", "synthwave", "folk"],
    size: 24,
    repeats: 0,
    withRemaster: false,
    owner: "self",
  },
  { genres: ["indie", "hiphop", "jazz"], size: 68, repeats: 2, withRemaster: true, owner: "self" },
  { genres: ["indie"], size: 50, repeats: 0, withRemaster: false, owner: "other" },
];

const day = 86_400_000;

/** The persona's playlists as of `now`. The last one is followed and read-only. */
export function generatePlaylists(persona: Persona, catalog: Catalog, now: Date): PlaylistDetail[] {
  return persona.playlistNames.map((name, index) => {
    const plan = plans[index % plans.length] ?? plans[0];
    if (!plan) throw new Error("No playlist plans");
    const random = createRandom(persona.seed + hashString(name));
    const pool = catalog.tracks.filter(
      (t) => plan.genres.includes(t.genre) && !t.id.endsWith("-remaster"),
    );
    const chosen: CatalogTrack[] = [];
    const used = new Set<string>();
    while (chosen.length < Math.min(plan.size, pool.length)) {
      const track = random.weighted(pool, (t) => t.pull + 0.05);
      if (used.has(track.id)) continue;
      used.add(track.id);
      chosen.push(track);
    }
    for (let r = 0; r < plan.repeats && chosen.length > 0; r++) {
      chosen.splice(random.int(0, chosen.length), 0, random.pick(chosen));
    }
    if (plan.withRemaster) {
      const remaster = catalog.tracks.find(
        (t) => t.id.endsWith("-remaster") && used.has(t.id.replace(/-remaster$/, "")),
      );
      if (remaster) chosen.push(remaster);
    }

    const ageDays = 30 + index * 47;
    const items: PlaylistItem[] = chosen.map((track, position) => ({
      key: `${track.id}#${position}`,
      track,
      addedAt: new Date(
        now.getTime() -
          Math.round(ageDays * (1 - position / chosen.length)) * day -
          random.int(0, day),
      ),
    }));
    const id = `demo-playlist-${String(index + 1).padStart(2, "0")}`;
    const readOnly = plan.owner === "other";
    return {
      id,
      name,
      description: "",
      ownerName: readOnly ? "Static FM" : persona.displayName,
      editable: !readOnly,
      isPublic: index % 3 !== 1,
      trackCount: items.length,
      covers: unique(items.map((item) => item.track.album.cover)).slice(0, 4),
      snapshotId: `demo-${id}-0`,
      externalUrl: null,
      items: readOnly ? null : items,
    };
  });
}

function unique<T extends { kind: string }>(covers: readonly T[]): T[] {
  const seen = new Set<string>();
  return covers.filter((cover) => {
    const key = JSON.stringify(cover);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
