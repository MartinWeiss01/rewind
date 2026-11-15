import type { Cover, Track } from "@/domain/music";
import type { TopAlbum, TopArtist, TopTrack } from "./engine";

/**
 * Plain, serialisable shapes the statistics screens hand to client components.
 * Server pages map engine results into these; Dates travel as ISO strings.
 */
export type TrackItem = {
  id: string;
  name: string;
  artists: string;
  cover: Cover;
  externalUrl: string | null;
};
export type RankedTrack = TrackItem & { plays: number; minutes: number };
export type RankedArtist = {
  id: string;
  name: string;
  cover: Cover;
  plays: number;
  minutes: number;
};
export type RankedAlbum = {
  id: string;
  name: string;
  artists: string;
  cover: Cover;
  plays: number;
  minutes: number;
};

const MS_PER_MINUTE = 60_000;

export const artistNames = (artists: readonly { name: string }[]) =>
  artists.map((artist) => artist.name).join(", ");

export function toTrackItem(track: Track): TrackItem {
  return {
    id: track.id,
    name: track.name,
    artists: artistNames(track.artists),
    cover: track.album.cover,
    externalUrl: track.externalUrl,
  };
}

export function toRankedTrack({ track, plays, ms }: TopTrack): RankedTrack {
  return { ...toTrackItem(track), plays, minutes: ms / MS_PER_MINUTE };
}

export function toRankedArtist({ artist, plays, ms, cover }: TopArtist): RankedArtist {
  return { id: artist.id, name: artist.name, cover, plays, minutes: ms / MS_PER_MINUTE };
}

export function toRankedAlbum({ album, artists, plays, ms }: TopAlbum): RankedAlbum {
  return {
    id: album.id,
    name: album.name,
    artists: artistNames(artists),
    cover: album.cover,
    plays,
    minutes: ms / MS_PER_MINUTE,
  };
}
