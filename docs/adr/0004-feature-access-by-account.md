# ADR 0004: Feature access by account

- Status: accepted
- Date: 2026-11-15

## Context

Spotify mode is invite-only. Some features are personal tools that should stay limited to specific accounts while the app is in development, even among invited users. Demo mode uses fictional data and is open to everyone.

## Decision

- Features are grouped into named capabilities (for example `stats` for the dashboard, history and recap).
- In Spotify mode a capability is enabled only for Spotify user IDs listed in its environment variable (`FEATURE_STATS_USER_IDS`, comma-separated). An empty or missing list disables it for everyone.
- Demo mode enables every capability.
- Access is resolved server-side once per request, next to the data source, and passed down as a typed set of capabilities. Pages and server actions check it; hidden navigation alone is never the check.
- Public pages (landing, README) describe what the demo shows and do not advertise gated capabilities.

## Consequences

- A user without a capability gets a not-found response for its routes and does not see its navigation items.
- New capabilities follow the same pattern and get a line in `.env.example`.
