-- Feature access per person (ADR 0004). Admins come from the environment and are not
-- stored here. A member is keyed by Spotify user ID so access can be granted before the
-- person first signs in. Feature names are validated by the app, so adding a flag
-- needs no migration.

create table public.rewind_access_members (
  spotify_user_id text primary key check (length(spotify_user_id) between 1 and 200),
  note text not null default '' check (length(note) <= 200),
  features text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rewind_access_events (
  id bigint generated always as identity primary key,
  actor_spotify_user_id text not null,
  subject_spotify_user_id text not null,
  action text not null check (action in ('add', 'remove', 'grant', 'revoke')),
  feature text,
  created_at timestamptz not null default now()
);

create index rewind_access_events_created_at_idx on public.rewind_access_events (created_at desc);

alter table public.rewind_access_members enable row level security;
alter table public.rewind_access_members force row level security;
revoke all on table public.rewind_access_members from anon, authenticated;
alter table public.rewind_access_events enable row level security;
alter table public.rewind_access_events force row level security;
revoke all on table public.rewind_access_events from anon, authenticated;
