# ADR 0005: Spotify sign-in and database

- Status: accepted
- Date: 2026-11-15

## Context

Spotify recommends the Authorization Code flow with a client secret for apps with a server. Supabase Auth's Spotify provider signs users in but neither stores nor refreshes the Spotify tokens, which the app needs for every API call, so token handling would be ours either way. The repository is public and must work with any Supabase project.

## Decision

- **Sign-in:** our own Authorization Code flow in route handlers. The client secret, access token and refresh token never reach the browser. Refresh tokens are encrypted at rest (AES-256-GCM, key from `TOKEN_ENCRYPTION_KEY`) and refreshed on demand; `invalid_grant` signs the user out.
- **Session:** an HTTP-only, signed session cookie (`AUTH_SECRET`) that holds only our session ID.
- **Database:** Supabase Postgres accessed from the server with the secret key. Supabase Auth is not used. Row-level security stays enabled on every table with no public policies, so the publishable key cannot read anything.
- **Tooling:** the Supabase CLI is a pinned dev dependency for creating migrations, applying them and generating database types. It is never linked to a project: commands take the connection string from `DATABASE_URL` (`--db-url`), so nothing project-specific is written to the repository. `supabase/.temp/` stays ignored in case someone links locally.
- **Project independence:** the repository holds SQL migrations (`supabase/migrations/`) and generated database types only. No project ref, URL or key is committed; the project is chosen entirely by environment variables, so the app can point at another Supabase project by applying the migrations there and changing `.env.local`.

## Consequences

- Session and token code is ours to test, including refresh races and revoked access.
- Moving to another Supabase account is: create a project, apply the migrations in order, set the env variables.
