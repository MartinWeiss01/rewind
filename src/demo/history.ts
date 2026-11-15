import { type Play, PlaySource } from "@/domain/listening";
import { dayKey, epochDay, keyFromEpochDay, zonedTimeToUtc } from "@/lib/time-zone";
import type { Catalog, CatalogTrack } from "./catalog";
import type { Persona } from "./persona";
import { createRandom } from "./random";

/** Days ago that always have plays, forming the longest streak of the history. */
const longestStreak = { fromDaysAgo: 221, toDaysAgo: 181 };

/**
 * Generates the persona's plays up to `now`, oldest first. Discoveries and streaks
 * are relative to today, so the demo always looks current; the same `now` always
 * yields the same history.
 */
export function generateHistory(persona: Persona, catalog: Catalog, now: Date): Play[] {
  const today = epochDay(dayKey(now, persona.timeZone));
  const plays: Play[] = [];
  const hours = persona.hourWeights.map((weight, hour) => ({ hour, weight }));

  for (let daysAgo = persona.historyDays - 1; daysAgo >= 0; daysAgo--) {
    const day = today - daysAgo;
    const random = createRandom(persona.seed ^ Math.imul(day, 2654435761));
    const inCurrentStreak = daysAgo < persona.currentStreakDays;
    const inLongestStreak =
      daysAgo <= longestStreak.fromDaysAgo && daysAgo >= longestStreak.toDaysAgo;
    const forcedSilent =
      daysAgo === persona.currentStreakDays ||
      daysAgo === longestStreak.fromDaysAgo + 1 ||
      daysAgo === longestStreak.toDaysAgo - 1;
    const silent =
      forcedSilent ||
      (!inCurrentStreak && !inLongestStreak && random.chance(persona.silentDayShare));
    if (silent) continue;

    const [year, month, date] = keyFromEpochDay(day).split("-").map(Number);
    const weekday = (((day + 3) % 7) + 7) % 7; // 1970-01-01 was a Thursday; Monday = 0.
    const count = Math.max(
      3,
      Math.round(
        persona.playsPerDay * (persona.weekdayWeights[weekday] ?? 1) * (0.5 + random.next()),
      ),
    );

    const known = catalog.artists.filter(
      (artist) => artist.discoveredDaysAgo === null || artist.discoveredDaysAgo >= daysAgo,
    );
    const onRepeat = daysAgo < 14 ? catalog.tracks.filter((_, i) => i % 53 === 7).slice(0, 3) : [];

    for (let i = 0; i < count; i++) {
      const track: CatalogTrack =
        onRepeat.length > 0 && random.chance(0.12)
          ? random.pick(onRepeat)
          : pickTrack(catalog, known, daysAgo, random);
      const { hour } = random.weighted(hours, (h) => h.weight);
      const playedAt = zonedTimeToUtc(
        { year: year ?? 1970, month: month ?? 1, day: date ?? 1, hour, minute: random.int(0, 59) },
        persona.timeZone,
      );
      if (playedAt > now) continue;
      const skipped = random.chance(0.11);
      plays.push({
        trackId: track.id,
        playedAt: new Date(playedAt.getTime() + random.int(0, 59) * 1000),
        msPlayed: skipped
          ? random.int(2, 28) * 1000
          : random.chance(0.85)
            ? track.durationMs
            : Math.round(track.durationMs * (0.4 + random.next() * 0.5)),
        source: daysAgo > 60 ? PlaySource.Imported : PlaySource.Synced,
      });
    }
  }
  return plays.sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime());
}

function pickTrack(
  catalog: Catalog,
  known: Catalog["artists"],
  daysAgo: number,
  random: ReturnType<typeof createRandom>,
): CatalogTrack {
  const artist = random.weighted(known, (a) => {
    const fresh = a.discoveredDaysAgo !== null && a.discoveredDaysAgo - daysAgo < 30 ? 2.2 : 1;
    return a.affinity * fresh;
  });
  const tracks = catalog.tracksByArtist.get(artist.id) ?? catalog.tracks;
  return random.weighted(tracks, (t) => t.pull);
}
