import type { Interval, ListeningRules, Play, PlaySource } from "@/domain/listening";
import type { Profile, Track } from "@/domain/music";
import type {
  NewPlaylist,
  PlaylistDetail,
  PlaylistSnapshot,
  PlaylistSummary,
} from "@/domain/playlists";

export const DataMode = {
  Demo: "demo",
  Spotify: "spotify",
} as const;
export type DataMode = (typeof DataMode)[keyof typeof DataMode];

/** Plays in an interval plus every track they reference. Input for the stats engine. */
export type ListeningData = {
  plays: readonly Play[];
  tracks: ReadonlyMap<string, Track>;
};

export const PlaySort = {
  Newest: "newest",
  Oldest: "oldest",
  Longest: "longest",
} as const;
export type PlaySort = (typeof PlaySort)[keyof typeof PlaySort];

export type PlayQuery = {
  interval: Interval;
  source: PlaySource | "all";
  search: string;
  includeSkips: boolean;
  sort: PlaySort;
  page: number;
  pageSize: number;
};

export type PlayRow = Play & { track: Track; skipped: boolean };
export type Page<T> = { rows: readonly T[]; total: number; page: number; pageSize: number };

/** Result of importing streaming history files. */
export type ImportSummary = {
  files: number;
  added: number;
  duplicates: number;
  skipped: number;
  firstPlayedAt: Date | null;
  lastPlayedAt: Date | null;
};

export type ImportRecord = {
  id: string;
  fileName: string;
  importedAt: Date;
  added: number;
};

/** A saved AI suggestion run, shown under "Earlier suggestions". */
export type Generation = {
  id: string;
  createdAt: Date;
  title: string;
  /** What was asked, in the user's words or as "Based on <playlist>". */
  request: string;
  trackIds: readonly string[];
  /** "Title — Artist" lines the model suggested that matched no track. */
  unmatched: readonly string[];
};

/** Counts shown under "Your data" in settings. */
export type DataSummary = {
  plays: number;
  imports: number;
  snapshots: number;
  generations: number;
};

/**
 * Everything the UI reads or changes, independent of where it comes from.
 * Resolved server-side per request: DemoDataSource or SpotifyDataSource.
 * Statistics are computed from `getListening` by the stats engine, never here.
 */
export type MusicDataSource = {
  readonly mode: DataMode;

  getProfile(): Promise<Profile>;
  getListeningRules(): Promise<ListeningRules>;
  saveListeningRules(rules: ListeningRules): Promise<void>;

  getListening(interval: Interval): Promise<ListeningData>;
  /** Earliest play, or null without any history. */
  getFirstPlayAt(): Promise<Date | null>;
  listPlays(query: PlayQuery): Promise<Page<PlayRow>>;
  /** Last successful sync, null in demo mode or before the first sync. */
  getLastSyncAt(): Promise<Date | null>;
  importHistory(files: readonly { name: string; entries: unknown }[]): Promise<ImportSummary>;
  listImports(): Promise<readonly ImportRecord[]>;
  deleteImport(id: string): Promise<void>;

  listPlaylists(): Promise<readonly PlaylistSummary[]>;
  getPlaylist(id: string): Promise<PlaylistDetail | null>;
  searchTracks(query: string): Promise<readonly Track[]>;
  getTracks(ids: readonly string[]): Promise<readonly Track[]>;

  createPlaylist(input: NewPlaylist, trackIds: readonly string[]): Promise<PlaylistSummary>;
  updatePlaylistDetails(id: string, input: Partial<NewPlaylist>): Promise<void>;
  /** Replaces the whole item list; callers snapshot first. */
  replacePlaylistItems(id: string, trackIds: readonly string[]): Promise<void>;
  addPlaylistItems(id: string, trackIds: readonly string[]): Promise<void>;
  /** Unfollows (Spotify's equivalent of deleting your own playlist). */
  removePlaylist(id: string): Promise<void>;

  listGenerations(limit: number): Promise<readonly Generation[]>;
  saveGeneration(input: Omit<Generation, "id" | "createdAt">): Promise<Generation>;

  getDataSummary(): Promise<DataSummary>;
  /** Everything Rewind stores about the user, as plain JSON-serialisable data. */
  exportData(): Promise<unknown>;
  /** Deletes plays, imports, snapshots and generations; keeps the login. */
  deleteAllData(): Promise<void>;

  listSnapshots(playlistId: string): Promise<readonly PlaylistSnapshot[]>;
  saveSnapshot(
    playlistId: string,
    label: string,
    trackIds: readonly string[],
  ): Promise<PlaylistSnapshot>;
};
