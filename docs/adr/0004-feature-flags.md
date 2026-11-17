# ADR 0004: Feature flags per account

- Status: accepted
- Date: 2026-11-15, revised 2026-11-17 (access and admins moved from environment variables to the database)

## Context

Spotify mode is invite-only. Some features should stay limited to specific accounts while the app is in development, even among invited users: personal tools, features that cost money to run (AI) and features that write to a real Spotify account. Demo mode uses fictional data and is open to everyone.

The first version kept one environment variable per flag with a list of Spotify user IDs. Every change meant editing the environment and redeploying, so the owner could not simply turn a feature on for someone.

## Decision

- Gated features are named feature flags defined in one const object (`FeatureFlag` in `src/server/feature-flags.ts`), for example `stats`, `ai` and `playlistWrite`.
- Admins are members whose `role` is `admin` in `rewind_access_members`. The role is set by hand in the database (SQL or the Supabase table editor); the app never grants, changes or removes it, so nobody can promote themselves through the app or lock the last admin out. Admins have every flag and are the only ones who reach `/app/admin`.
- Everyone else gets the flags an admin granted them on `/app/admin`. Grants live in `rewind_access_members`, keyed by Spotify user ID so access can be granted before the person first signs in; every change is logged in `rewind_access_events`. Nobody has a flag by default.
- Stored flag names are checked against `FeatureFlag` when read, so adding or retiring a flag needs no migration.
- Demo mode enables every flag.
- Enabled flags are resolved server-side once per request, next to the data source, and passed down as a typed set. Pages and server actions check it; hidden navigation alone is never the check. If the grants can't be read, the viewer gets no gated features.
- Public pages (landing, README) describe what the demo shows and do not advertise flagged features.

## Consequences

- A user without a flag gets a not-found response for its routes and does not see its navigation items. Non-admins, demo visitors included, get a not-found response for `/app/admin`.
- A change on `/app/admin` applies on the person's next request, without a redeploy.
- A fresh database has no admin: the first one is added by hand, for example `insert into rewind_access_members (spotify_user_id, role) values ('<id>', 'admin') on conflict (spotify_user_id) do update set role = 'admin';`.
- Adding a flag means one entry in `FeatureFlag` and its name and description in the `admin` messages; the type checker points at every place that has to handle it.
- Spotify's Development Mode still limits sign-in to people on the app's user list in the Spotify Developer Dashboard; the admin page cannot change that list.
