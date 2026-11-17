# ADR 0006: Data sources, stats engine and the demo sandbox

- Status: accepted
- Date: 2026-11-15

## Context

Every screen works in two modes. Spotify mode reads the Spotify Web API and our database; demo mode shows a fictional listener and must never reach Spotify or store anything about the visitor. Statistics must be identical in both modes.

## Decision

- **One contract.** `MusicDataSource` (`src/data/music-data-source.ts`) is the only way screens read or change data. `getRequestContext()` (`src/server/request-context.ts`) resolves it once per request together with the viewer and feature flags.
- **Stats are computed, not fetched.** Data sources return plays plus the tracks they reference (`getListening`). A pure engine (`src/features/stats/engine.ts`) turns them into every statistic, so both modes share one tested implementation. Skip threshold and time zone come from the user's listening rules.
- **Demo data is generated.** `src/demo/` builds a catalog, about a year of plays and a dozen playlists from a fixed seed and a persona file. Nothing is committed as fixture data; changing `persona.ts` changes the demo's taste. Discoveries and streaks are relative to today, so the demo always looks current.
- **Demo writes are sandboxed.** A visitor's changes (playlist edits, snapshots, sample import, rules) live in a demo session keyed by an anonymous, HTTP-only cookie, expire after a day and are applied on top of the generated data. The store is an interface: a database table when one is configured, otherwise the visitor's own cookies (compact, compressed and split over at most three cookies; the oldest snapshots, AI runs and imports are dropped first when it would not fit).
- **Demo-only deployments.** `DEMO_ONLY=true` runs the app as a public demo: it ignores every key that is set, so no database, Spotify or AI call can happen, keeps demo changes in cookies, and leaves out Spotify sign-in and Spotify mentions.
- **Translations per feature.** Messages live in `messages/<locale>/<namespace>.json`; `messages/en/index.ts` defines the type every other locale must satisfy.

## Consequences

- Spotify mode keeps its own play history in the database (sync plus imports) because the API exposes only the last 50 plays.
- Large histories are loaded per request for the selected range; if that becomes slow, the engine's functions can move into SQL behind the same signatures.
