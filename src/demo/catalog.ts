import type { Album, Artist, Track } from "@/domain/music";
import type { GenreKey, Persona } from "./persona";
import { titleWords } from "./persona";
import { createRandom, hashString } from "./random";

export type CatalogTrack = Track & {
  genre: GenreKey /** 0..1, how often it comes up */;
  pull: number;
};

export type Catalog = {
  artists: readonly (Artist & {
    genre: GenreKey;
    affinity: number;
    discoveredDaysAgo: number | null;
  })[];
  albums: readonly Album[];
  tracks: readonly CatalogTrack[];
  trackById: ReadonlyMap<string, CatalogTrack>;
  tracksByArtist: ReadonlyMap<string, readonly CatalogTrack[]>;
};

const pad = (n: number) => String(n).padStart(3, "0");

/** Builds the fictional catalog for a persona. Pure and deterministic. */
export function buildCatalog(persona: Persona): Catalog {
  const random = createRandom(persona.seed);
  const artists: Catalog["artists"][number][] = [];
  const albums: Album[] = [];
  const tracks: CatalogTrack[] = [];
  let isrcCounter = 1;

  persona.artists.forEach((source, artistIndex) => {
    const artistId = `demo-artist-${pad(artistIndex + 1)}`;
    const artist = {
      id: artistId,
      name: source.name,
      image: { kind: "generated", seed: hashString(source.name) } as const,
      genre: source.genre,
      affinity: source.affinity,
      discoveredDaysAgo: source.discoveredDaysAgo,
    };
    artists.push(artist);
    const ref = { id: artistId, name: source.name };
    const usedTitles = new Set<string>();
    const title = () => {
      for (;;) {
        const candidate = random.chance(0.45)
          ? random.pick(titleWords.single)
          : `${random.pick(titleWords.first)} ${random.pick(titleWords.second)}`;
        if (!usedTitles.has(candidate)) {
          usedTitles.add(candidate);
          return candidate;
        }
      }
    };

    const albumCount = source.affinity >= 4 ? 3 : source.affinity >= 2 ? 2 : 1;
    for (let a = 0; a < albumCount; a++) {
      const albumId = `${artistId}-album-${a + 1}`;
      const album: Album = {
        id: albumId,
        name: title(),
        cover: { kind: "generated", seed: hashString(albumId) },
        artists: [ref],
        releaseDate: `${2026 - albumCount + a - random.int(0, 3)}-${String(random.int(1, 12)).padStart(2, "0")}-${String(random.int(1, 28)).padStart(2, "0")}`,
      };
      albums.push(album);
      const trackCount = random.int(6, 11);
      for (let t = 0; t < trackCount; t++) {
        const featured =
          random.chance(0.08) && persona.artists.length > 1
            ? persona.artists[
                (artistIndex + random.int(1, persona.artists.length - 1)) % persona.artists.length
              ]
            : undefined;
        const featuredIndex = featured ? persona.artists.indexOf(featured) : -1;
        tracks.push({
          id: `${albumId}-track-${t + 1}`,
          name: title(),
          artists: featured
            ? [ref, { id: `demo-artist-${pad(featuredIndex + 1)}`, name: featured.name }]
            : [ref],
          album: {
            id: album.id,
            name: album.name,
            cover: album.cover,
            releaseDate: album.releaseDate,
          },
          durationMs: random.int(150, 330) * 1000,
          isrc: `XXDEM${String(isrcCounter++).padStart(7, "0")}`,
          explicit: source.genre === "hiphop" && random.chance(0.5),
          externalUrl: null,
          genre: source.genre,
          // Earlier album tracks and the latest album pull harder.
          pull: (1 / (t + 1.5)) * (a === albumCount - 1 ? 1.4 : 1),
        });
      }
    }
  });

  // Re-releases: a remastered copy of a few songs with the same ISRC, for duplicate detection.
  const remasterSources = tracks.filter((_, i) => i % 41 === 3).slice(0, 4);
  for (const original of remasterSources) {
    tracks.push({
      ...original,
      id: `${original.id}-remaster`,
      name: `${original.name} (Remastered)`,
      durationMs: original.durationMs + random.int(-2, 2) * 1000,
      pull: original.pull * 0.2,
    });
  }

  const trackById = new Map(tracks.map((track) => [track.id, track]));
  const tracksByArtist = new Map<string, CatalogTrack[]>();
  for (const track of tracks) {
    const main = track.artists[0];
    if (!main) continue;
    const list = tracksByArtist.get(main.id) ?? [];
    list.push(track);
    tracksByArtist.set(main.id, list);
  }
  return { artists, albums, tracks, trackById, tracksByArtist };
}
