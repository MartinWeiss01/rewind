/** Artwork: a real image URL (Spotify) or a seed for a generated gradient (demo, missing art). */
export type Cover = { kind: "image"; url: string } | { kind: "generated"; seed: number };

export type ArtistRef = { id: string; name: string };
export type Artist = ArtistRef & { image: Cover };

export type AlbumRef = {
  id: string;
  name: string;
  cover: Cover;
  /** ISO date, possibly only a year ("2019") or year-month, as Spotify reports it. */
  releaseDate: string | null;
};
export type Album = AlbumRef & { artists: readonly ArtistRef[] };

export type Track = {
  id: string;
  name: string;
  artists: readonly ArtistRef[];
  album: AlbumRef;
  durationMs: number;
  /** International Standard Recording Code; helps match the same song across releases. */
  isrc: string | null;
  explicit: boolean;
  /** Spotify URL to open the track, absent in demo mode. */
  externalUrl: string | null;
};

export type Profile = {
  id: string;
  displayName: string;
  avatar: Cover | null;
  externalUrl: string | null;
};
