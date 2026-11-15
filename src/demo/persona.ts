/**
 * The fictional demo listener. Everything here is invented. Swap this file to
 * change the demo's taste; the generator and the app do not depend on its content.
 */
export type GenreKey = "indie" | "synthwave" | "hiphop" | "jazz" | "folk";

export type PersonaArtist = {
  name: string;
  genre: GenreKey;
  /** Relative weight in the listener's rotation. */
  affinity: number;
  /** Days before "today" when the listener first heard them; null = before the history starts. */
  discoveredDaysAgo: number | null;
};

export type Persona = {
  seed: number;
  displayName: string;
  timeZone: string;
  /** Days of history to generate. */
  historyDays: number;
  /** Average plays on an active day. */
  playsPerDay: number;
  /** Share of days with no listening at all (outside the current streak). */
  silentDayShare: number;
  /** Length of the streak that runs up to today. */
  currentStreakDays: number;
  /** Hour weights 0–23 for when plays happen, in the persona's time zone. */
  hourWeights: readonly number[];
  /** Weights Monday..Sunday. */
  weekdayWeights: readonly number[];
  artists: readonly PersonaArtist[];
  playlistNames: readonly string[];
};

export const persona: Persona = {
  seed: 20_261_115,
  displayName: "Juno Park",
  timeZone: "Europe/Berlin",
  historyDays: 420,
  playsPerDay: 34,
  silentDayShare: 0.08,
  currentStreakDays: 23,
  hourWeights: [3, 2, 1, 0.5, 0.2, 0.2, 0.6, 2, 4, 4, 3, 3, 3, 3, 3, 3, 4, 5, 6, 7, 8, 9, 8, 5],
  weekdayWeights: [1, 1, 1, 1.25, 1.1, 0.9, 0.8],
  artists: [
    { name: "Velvet Static", genre: "indie", affinity: 10, discoveredDaysAgo: null },
    { name: "Marlowe June", genre: "indie", affinity: 7, discoveredDaysAgo: null },
    { name: "Neon Harbor", genre: "synthwave", affinity: 7, discoveredDaysAgo: null },
    { name: "Kito & the Tides", genre: "indie", affinity: 6, discoveredDaysAgo: null },
    { name: "Low Orbit Club", genre: "synthwave", affinity: 5, discoveredDaysAgo: null },
    { name: "Saffron Quiet", genre: "folk", affinity: 5, discoveredDaysAgo: 310 },
    { name: "Ojo Blue", genre: "jazz", affinity: 4, discoveredDaysAgo: null },
    { name: "Dusk Arcade", genre: "synthwave", affinity: 4, discoveredDaysAgo: null },
    { name: "The Late Signals", genre: "indie", affinity: 4, discoveredDaysAgo: null },
    { name: "Mira Vance", genre: "hiphop", affinity: 4, discoveredDaysAgo: null },
    { name: "Cobalt Youth", genre: "indie", affinity: 3, discoveredDaysAgo: 200 },
    { name: "Paper Satellites", genre: "indie", affinity: 3, discoveredDaysAgo: null },
    { name: "Hollis Grey", genre: "jazz", affinity: 3, discoveredDaysAgo: null },
    { name: "Quiet Engines", genre: "synthwave", affinity: 3, discoveredDaysAgo: 150 },
    { name: "Lux Monroe", genre: "hiphop", affinity: 3, discoveredDaysAgo: null },
    { name: "Fernweh", genre: "folk", affinity: 2, discoveredDaysAgo: null },
    { name: "Glass Pilots", genre: "indie", affinity: 2, discoveredDaysAgo: 90 },
    { name: "Ada Lumen", genre: "jazz", affinity: 2, discoveredDaysAgo: 60 },
    { name: "Tape Theory", genre: "hiphop", affinity: 2, discoveredDaysAgo: null },
    { name: "Northbound Kids", genre: "indie", affinity: 2, discoveredDaysAgo: 45 },
    { name: "Solar Parade", genre: "synthwave", affinity: 2, discoveredDaysAgo: 30 },
    { name: "Wren & Willow", genre: "folk", affinity: 1.5, discoveredDaysAgo: 21 },
    { name: "Basement Bloom", genre: "hiphop", affinity: 1.5, discoveredDaysAgo: 14 },
    { name: "The Soft Hours", genre: "indie", affinity: 1.5, discoveredDaysAgo: 10 },
    { name: "Midnight Cartography", genre: "jazz", affinity: 1, discoveredDaysAgo: 7 },
    { name: "Ivory Coastline", genre: "synthwave", affinity: 1, discoveredDaysAgo: 4 },
    { name: "Static Bloom", genre: "indie", affinity: 1, discoveredDaysAgo: null },
    { name: "Rue Delacroix", genre: "jazz", affinity: 1, discoveredDaysAgo: null },
    { name: "Oakline", genre: "folk", affinity: 1, discoveredDaysAgo: 120 },
    { name: "Polar Arcade", genre: "synthwave", affinity: 0.8, discoveredDaysAgo: null },
  ],
  playlistNames: [
    "Late night drives",
    "Sunday slow",
    "Gym tape",
    "Focus / no lyrics",
    "2025 favourites",
    "Synth sunsets",
    "Rainy commute",
    "Kitchen jazz",
    "Road trip north",
    "Fresh finds",
    "Throwbacks",
    "Indie Weekly",
  ],
};

/** Words the generator combines into album and track titles. */
export const titleWords = {
  first: [
    "Glass",
    "Paper",
    "Velvet",
    "Neon",
    "Quiet",
    "Golden",
    "Hollow",
    "Silver",
    "Low",
    "Small",
    "Coastal",
    "Electric",
    "Midnight",
    "Northern",
    "Soft",
    "Static",
    "Tidal",
    "Violet",
    "Lunar",
    "Copper",
  ],
  second: [
    "House",
    "Lanterns",
    "Hours",
    "Harbor",
    "Rooms",
    "Lights",
    "Radio",
    "Tide",
    "Bloom",
    "Signals",
    "Weather",
    "Engines",
    "Avenues",
    "Motel",
    "Echoes",
    "Gardens",
    "Satellites",
    "Summer",
    "Window",
    "Drive",
  ],
  single: [
    "Glasshouse",
    "Northbound",
    "Afterimage",
    "Marigold",
    "Coastline",
    "Daydream",
    "Overpass",
    "Undertow",
    "Wildfire",
    "Slow Burn",
    "Heatwave",
    "Lullaby",
    "Orbit",
    "Cassette",
    "Postcards",
    "Moonlit",
    "Rewind",
    "Paper Planes",
    "Night Shift",
    "Half Light",
  ],
} as const;
