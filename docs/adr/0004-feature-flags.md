# ADR 0004: Feature flags per account

- Status: accepted
- Date: 2026-11-15

## Context

Spotify mode is invite-only. Some features should stay limited to specific accounts while the app is in development, even among invited users: personal tools, features that cost money to run (AI) and features that write to a real Spotify account. Demo mode uses fictional data and is open to everyone.

## Decision

- Gated features are named feature flags defined in one const object (`FeatureFlag` in `src/server/feature-flags.ts`), for example `stats`, `ai` and `playlistWrite`.
- In Spotify mode each flag has a rule in its own environment variable (`FEATURE_STATS`, `FEATURE_AI`, `FEATURE_PLAYLIST_WRITE`): `all`, `none`, or a comma-separated list of Spotify user IDs. An unset or empty variable means `none`.
- Demo mode enables every flag.
- Enabled flags are resolved server-side once per request, next to the data source, and passed down as a typed set. Pages and server actions check it; hidden navigation alone is never the check.
- Public pages (landing, README) describe what the demo shows and do not advertise flagged features.

## Consequences

- A user without a flag gets a not-found response for its routes and does not see its navigation items.
- Adding a flag means one entry in `FeatureFlag`, its variable name and a line in `.env.example`; the type checker points at every place that has to handle it.
- Flags are configuration, not a runtime service: changing a rule needs a redeploy, which is fine for a handful of accounts.
