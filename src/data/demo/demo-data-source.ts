import { match } from "ts-pattern";
import { buildCatalog, type Catalog } from "@/demo/catalog";
import { generateHistory } from "@/demo/history";
import { persona as defaultPersona, type Persona } from "@/demo/persona";
import { generatePlaylists } from "@/demo/playlists";
import { hashString } from "@/demo/random";
import type { DemoSessionState } from "@/demo/session-state";
import { type Interval, type Play, PlaySource } from "@/domain/listening";
import type { Track } from "@/domain/music";
import type {
  PlaylistDetail,
  PlaylistItem,
  PlaylistSnapshot,
  PlaylistSummary,
} from "@/domain/playlists";
import { parseStreamingHistory, playKey } from "@/features/import/streaming-history";
import { dayKey } from "@/lib/time-zone";
import {
  DataMode,
  type ImportSummary,
  type ListeningData,
  type MusicDataSource,
  type Page,
  type PlayQuery,
  type PlayRow,
  PlaySort,
} from "../music-data-source";

type DemoWorld = {
  catalog: Catalog;
  plays: readonly Play[];
  playlists: readonly PlaylistDetail[];
};

/** Generated data is the same for everyone on a given day, so build it once per day. */
let cachedWorld: { key: string; world: DemoWorld } | null = null;

function worldFor(persona: Persona, now: Date): DemoWorld {
  const key = `${persona.seed}:${dayKey(now, persona.timeZone)}`;
  if (cachedWorld?.key === key) return cachedWorld.world;
  const catalog = buildCatalog(persona);
  const world = {
    catalog,
    plays: generateHistory(persona, catalog, now),
    playlists: generatePlaylists(persona, catalog, now),
  };
  cachedWorld = { key, world };
  return world;
}

/** Index of the first play at or after `time` in a list sorted by playedAt. */
function lowerBound(plays: readonly Play[], time: number): number {
  let lo = 0;
  let hi = plays.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((plays[mid]?.playedAt.getTime() ?? 0) < time) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

const normalize = (value: string) =>
  value
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

export type DemoContext = {
  /** Current session state; mutated in place by writes. */
  state: DemoSessionState;
  /** Persists the state after a write (and creates the session on first write). */
  commit(state: DemoSessionState): Promise<void>;
  now: Date;
  persona?: Persona;
};

/** Reads generated demo data merged with the visitor's sandboxed changes. */
export function createDemoDataSource({
  state,
  commit,
  now,
  persona = defaultPersona,
}: DemoContext): MusicDataSource {
  const world = worldFor(persona, now);
  const { catalog } = world;

  const allPlays = (): readonly Play[] => {
    if (state.importedPlays.length === 0) return world.plays;
    const imported = state.importedPlays.map(([trackId, playedAt, msPlayed]) => ({
      trackId,
      playedAt: new Date(playedAt),
      msPlayed,
      source: PlaySource.Imported,
    }));
    return [...world.plays, ...imported].sort(
      (a, b) => a.playedAt.getTime() - b.playedAt.getTime(),
    );
  };

  const playsIn = (interval: Interval) => {
    const plays = allPlays();
    return plays.slice(
      lowerBound(plays, interval.start.getTime()),
      lowerBound(plays, interval.end.getTime()),
    );
  };

  const trackMap = (plays: readonly { trackId: string }[]) => {
    const map = new Map<string, Track>();
    for (const play of plays) {
      const track = catalog.trackById.get(play.trackId);
      if (track && !map.has(track.id)) map.set(track.id, track);
    }
    return map;
  };

  const write = async (change: (draft: DemoSessionState) => void) => {
    change(state);
    state.revision += 1;
    await commit(state);
  };

  const playlistDetail = (id: string): PlaylistDetail | null => {
    if (state.removedPlaylists.includes(id)) return null;
    const created = state.createdPlaylists.find((p) => p.id === id);
    const base: PlaylistDetail | undefined =
      world.playlists.find((p) => p.id === id) ??
      (created && {
        id: created.id,
        name: created.name,
        description: created.description,
        ownerName: persona.displayName,
        editable: true,
        isPublic: created.isPublic,
        trackCount: 0,
        covers: [],
        snapshotId: "",
        externalUrl: null,
        items: [],
      });
    if (!base) return null;

    const override = state.playlistItems[id];
    const items: readonly PlaylistItem[] | null = override
      ? override.flatMap(({ trackId, addedAt }, position) => {
          const track = catalog.trackById.get(trackId);
          return track
            ? [{ key: `${trackId}#${position}`, track, addedAt: new Date(addedAt) }]
            : [];
        })
      : base.items;
    const details = state.playlistDetails[id] ?? {};
    const covers = items
      ? [
          ...new Map(
            items.map((i) => [JSON.stringify(i.track.album.cover), i.track.album.cover]),
          ).values(),
        ].slice(0, 4)
      : base.covers;
    return {
      ...base,
      ...details,
      items,
      covers,
      trackCount: items?.length ?? base.trackCount,
      snapshotId: `demo-${id}-${state.revision}`,
    };
  };

  const summary = ({ items: _items, ...rest }: PlaylistDetail): PlaylistSummary => rest;

  const setItems = (id: string, trackIds: readonly string[]) => {
    const current = playlistDetail(id);
    if (!current?.editable) throw new Error("Playlist is not editable");
    const addedAtByTrack = new Map((current.items ?? []).map((i) => [i.track.id, i.addedAt]));
    state.playlistItems[id] = trackIds.map((trackId) => ({
      trackId,
      addedAt: (addedAtByTrack.get(trackId) ?? now).toISOString(),
    }));
  };

  return {
    mode: DataMode.Demo,

    async getProfile() {
      return {
        id: "demo-listener",
        displayName: persona.displayName,
        avatar: { kind: "generated", seed: hashString(persona.displayName) },
        externalUrl: null,
      };
    },
    async getListeningRules() {
      return state.rules;
    },
    async saveListeningRules(rules) {
      await write((draft) => {
        draft.rules = rules;
      });
    },

    async getListening(interval): Promise<ListeningData> {
      const plays = playsIn(interval);
      return { plays, tracks: trackMap(plays) };
    },
    async getFirstPlayAt() {
      return allPlays()[0]?.playedAt ?? null;
    },
    async listPlays(query: PlayQuery): Promise<Page<PlayRow>> {
      const needle = normalize(query.search.trim());
      const rows: PlayRow[] = [];
      for (const play of playsIn(query.interval)) {
        const track = catalog.trackById.get(play.trackId);
        if (!track) continue;
        const skipped = play.msPlayed < state.rules.skipThresholdMs;
        if (skipped && !query.includeSkips) continue;
        if (query.source !== "all" && play.source !== query.source) continue;
        if (
          needle &&
          !normalize(
            `${track.name} ${track.artists.map((a) => a.name).join(" ")} ${track.album.name}`,
          ).includes(needle)
        ) {
          continue;
        }
        rows.push({ ...play, track, skipped });
      }
      match(query.sort)
        .with(PlaySort.Newest, () =>
          rows.sort((a, b) => b.playedAt.getTime() - a.playedAt.getTime()),
        )
        .with(PlaySort.Oldest, () =>
          rows.sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime()),
        )
        .with(PlaySort.Longest, () => rows.sort((a, b) => b.msPlayed - a.msPlayed))
        .exhaustive();
      const start = (query.page - 1) * query.pageSize;
      return {
        rows: rows.slice(start, start + query.pageSize),
        total: rows.length,
        page: query.page,
        pageSize: query.pageSize,
      };
    },
    async getLastSyncAt() {
      return null;
    },
    async importHistory(files): Promise<ImportSummary> {
      const known = new Set(allPlays().map(playKey));
      let added = 0;
      let duplicates = 0;
      let skipped = 0;
      let first: Date | null = null;
      let last: Date | null = null;
      const newPlays: DemoSessionState["importedPlays"] = [];
      const records: DemoSessionState["imports"] = [];
      for (const file of files) {
        const parsed = parseStreamingHistory(file.entries);
        skipped += parsed.skipped;
        let addedInFile = 0;
        for (const entry of parsed.entries) {
          if (!catalog.trackById.has(entry.trackId)) {
            skipped++;
            continue;
          }
          const key = playKey(entry);
          if (known.has(key)) {
            duplicates++;
            continue;
          }
          known.add(key);
          newPlays.push([entry.trackId, entry.playedAt.toISOString(), entry.msPlayed]);
          addedInFile++;
          if (!first || entry.playedAt < first) first = entry.playedAt;
          if (!last || entry.playedAt > last) last = entry.playedAt;
        }
        added += addedInFile;
        records.push({
          id: `demo-import-${state.imports.length + records.length + 1}`,
          fileName: file.name,
          importedAt: now.toISOString(),
          added: addedInFile,
        });
      }
      await write((draft) => {
        draft.importedPlays.push(...newPlays);
        draft.imports.push(...records);
      });
      return {
        files: files.length,
        added,
        duplicates,
        skipped,
        firstPlayedAt: first,
        lastPlayedAt: last,
      };
    },
    async listImports() {
      return state.imports.map((record) => ({
        ...record,
        importedAt: new Date(record.importedAt),
      }));
    },
    async deleteImport(id) {
      await write((draft) => {
        draft.imports = draft.imports.filter((record) => record.id !== id);
        if (draft.imports.length === 0) draft.importedPlays = [];
      });
    },

    async listPlaylists() {
      const ids = [...world.playlists.map((p) => p.id), ...state.createdPlaylists.map((p) => p.id)];
      return ids.flatMap((id) => {
        const detail = playlistDetail(id);
        return detail ? [summary(detail)] : [];
      });
    },
    async getPlaylist(id) {
      return playlistDetail(id);
    },
    async searchTracks(query) {
      const needle = normalize(query.trim());
      if (!needle) return [];
      return catalog.tracks
        .filter((t) =>
          normalize(`${t.name} ${t.artists.map((a) => a.name).join(" ")}`).includes(needle),
        )
        .slice(0, 10);
    },
    async getTracks(ids) {
      return ids.flatMap((id) => {
        const track = catalog.trackById.get(id);
        return track ? [track] : [];
      });
    },

    async createPlaylist(input, trackIds) {
      const id = `demo-session-playlist-${state.createdPlaylists.length + 1}-${state.revision}`;
      await write((draft) => {
        draft.createdPlaylists.push({ id, ...input, createdAt: now.toISOString() });
        draft.playlistItems[id] = trackIds.map((trackId) => ({
          trackId,
          addedAt: now.toISOString(),
        }));
      });
      const created = playlistDetail(id);
      if (!created) throw new Error("Created playlist is missing");
      return summary(created);
    },
    async updatePlaylistDetails(id, input) {
      await write((draft) => {
        draft.playlistDetails[id] = { ...draft.playlistDetails[id], ...input };
      });
    },
    async replacePlaylistItems(id, trackIds) {
      await write(() => setItems(id, trackIds));
    },
    async addPlaylistItems(id, trackIds) {
      const current = playlistDetail(id);
      const existing = current?.items?.map((i) => i.track.id) ?? [];
      await write(() => setItems(id, [...existing, ...trackIds]));
    },
    async removePlaylist(id) {
      await write((draft) => {
        draft.removedPlaylists.push(id);
      });
    },

    async listGenerations(limit) {
      return state.generations
        .map((g) => ({ ...g, createdAt: new Date(g.createdAt) }))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, limit);
    },
    async saveGeneration(input) {
      const generation = {
        ...input,
        id: `demo-generation-${state.generations.length + 1}-${state.revision}`,
        createdAt: now.toISOString(),
        trackIds: [...input.trackIds],
        unmatched: [...input.unmatched],
      };
      await write((draft) => {
        draft.generations.push(generation);
      });
      return { ...generation, createdAt: new Date(generation.createdAt) };
    },

    async getDataSummary() {
      // The generated listener is not "stored"; only the visitor's own additions count.
      return {
        plays: state.importedPlays.length,
        imports: state.imports.length,
        snapshots: state.snapshots.length,
        generations: state.generations.length,
      };
    },
    async exportData() {
      return {
        mode: DataMode.Demo,
        rules: state.rules,
        imports: state.imports,
        importedPlays: state.importedPlays,
        snapshots: state.snapshots,
        generations: state.generations,
        playlistChanges: {
          items: state.playlistItems,
          details: state.playlistDetails,
          created: state.createdPlaylists,
        },
      };
    },
    async deleteAllData() {
      await write((draft) => {
        draft.importedPlays = [];
        draft.imports = [];
        draft.snapshots = [];
        draft.generations = [];
      });
    },

    async listSnapshots(playlistId): Promise<readonly PlaylistSnapshot[]> {
      return state.snapshots
        .filter((s) => s.playlistId === playlistId)
        .map((s) => ({ ...s, createdAt: new Date(s.createdAt) }))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
    async saveSnapshot(playlistId, label, trackIds) {
      const snapshot = {
        id: `demo-snapshot-${state.snapshots.length + 1}-${state.revision}`,
        playlistId,
        label,
        createdAt: now.toISOString(),
        trackIds: [...trackIds],
      };
      await write((draft) => {
        draft.snapshots.push(snapshot);
      });
      return { ...snapshot, createdAt: new Date(snapshot.createdAt) };
    },
  };
}

/** A sample export built from demo tracks, for trying the import in demo mode. */
export function demoSampleExport(now: Date, persona: Persona = defaultPersona): unknown[] {
  const world = worldFor(persona, now);
  const firstPlay = world.plays[0]?.playedAt ?? now;
  const tracks = world.catalog.tracks.slice(0, 120);
  return tracks.map((track, i) => {
    const endedAt = new Date(firstPlay.getTime() - (i + 1) * 3 * 86_400_000 + i * 600_000);
    return {
      ts: endedAt.toISOString().replace(/\.\d{3}Z$/, "Z"),
      ms_played: track.durationMs,
      master_metadata_track_name: track.name,
      master_metadata_album_artist_name: track.artists[0]?.name ?? null,
      master_metadata_album_album_name: track.album.name,
      spotify_track_uri: `spotify:track:${track.id}`,
    };
  });
}
