import type { z } from "zod";
import type { Cover, Profile, Track } from "@/domain/music";
import type { GetCurrentUsersProfileResponse, GetTrackResponse } from "./generated/spotify.zod";

export type SpotifyTrack = z.infer<typeof GetTrackResponse>;
type SpotifyImage = { url: string; width: number | null };

/** The smallest image that is still at least `minWidth` wide, else the largest. */
export function pickImage(
  images: readonly SpotifyImage[] | undefined,
  minWidth = 160,
): Cover | null {
  if (!images || images.length === 0) return null;
  const sorted = [...images].sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
  const fit = sorted.find((image) => (image.width ?? 0) >= minWidth) ?? sorted.at(-1);
  return fit ? { kind: "image", url: fit.url } : null;
}

const fallbackCover = (id: string): Cover => ({
  kind: "generated",
  seed: [...id].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 7),
});

/** Maps a Spotify track to ours, or null for local files and malformed items. */
export function mapTrack(track: SpotifyTrack): Track | null {
  if (!track.id || !track.name || track.is_local) return null;
  const album = track.album;
  return {
    id: track.id,
    name: track.name,
    artists: (track.artists ?? []).flatMap((artist) =>
      artist.id && artist.name ? [{ id: artist.id, name: artist.name }] : [],
    ),
    album: album
      ? {
          id: album.id,
          name: album.name,
          cover: pickImage(album.images) ?? fallbackCover(album.id),
        }
      : { id: `unknown-${track.id}`, name: "", cover: fallbackCover(track.id) },
    durationMs: track.duration_ms ?? 0,
    isrc: track.external_ids?.isrc ?? null,
    explicit: track.explicit ?? false,
    externalUrl: track.external_urls?.spotify ?? null,
  };
}

export function mapProfile(
  profile: z.infer<typeof GetCurrentUsersProfileResponse>,
): Profile & { spotifyId: string } {
  if (!profile.id) throw new Error("Spotify profile has no ID");
  return {
    id: profile.id,
    spotifyId: profile.id,
    displayName: profile.display_name ?? profile.id,
    avatar: pickImage(profile.images, 64),
    externalUrl: profile.external_urls?.spotify ?? null,
  };
}

/** Spotify track ID from a URI like spotify:track:abc. */
export const trackUri = (id: string) => `spotify:track:${id}`;
