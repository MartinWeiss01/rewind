import type { Cover, Track } from "./music";

export type PlaylistSummary = {
  id: string;
  name: string;
  description: string;
  ownerName: string;
  /** Owned or collaborative: items can be read and changed. */
  editable: boolean;
  isPublic: boolean;
  trackCount: number;
  covers: readonly Cover[];
  /** Spotify's version marker for the item list. */
  snapshotId: string;
  externalUrl: string | null;
};

export type PlaylistItem = {
  /** Stable key for this row; the same track can appear twice. */
  key: string;
  track: Track;
  addedAt: Date | null;
};

export type PlaylistDetail = PlaylistSummary & {
  /** Null when Spotify does not return items (playlists owned by others). */
  items: readonly PlaylistItem[] | null;
  /**
   * Items Rewind can't show (local files, removed tracks). Rewriting the playlist from
   * `items` would delete them, so writes that replace or delete it are refused.
   */
  hiddenItems: number;
};

/** A saved copy of a playlist's track order before a bulk change, for undo. */
export type PlaylistSnapshot = {
  id: string;
  playlistId: string;
  label: string;
  createdAt: Date;
  trackIds: readonly string[];
};

export type NewPlaylist = { name: string; description: string; isPublic: boolean };
