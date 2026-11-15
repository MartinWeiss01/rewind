-- Rewind initial schema.
-- Conventions: every table is prefixed `rewind_`; row-level security is enabled on every
-- table with no policies, and `anon` / `authenticated` get no privileges, so the
-- publishable key can read or write nothing. The app talks to the database only from
-- the server with the secret key, and every user-owned row carries `user_id`.

create table public.rewind_users (
  id uuid primary key default gen_random_uuid(),
  spotify_user_id text not null unique,
  display_name text not null default '',
  avatar_url text,
  profile_url text,
  skip_threshold_ms integer not null default 30000 check (skip_threshold_ms between 0 and 300000),
  time_zone text not null default 'UTC',
  last_sync_at timestamptz,
  last_sync_cursor_ms bigint,
  sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rewind_spotify_tokens (
  user_id uuid primary key references public.rewind_users (id) on delete cascade,
  -- AES-256-GCM ciphertexts (iv.tag.data, base64url); the key never reaches the database.
  refresh_token_encrypted text not null,
  access_token_encrypted text,
  access_token_expires_at timestamptz,
  scopes text not null default '',
  -- Spotify refresh tokens last six months from the original authorization.
  authorized_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rewind_sessions (
  -- SHA-256 of the random session token; the token itself lives only in the cookie.
  token_hash text primary key,
  user_id uuid not null references public.rewind_users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now()
);
create index rewind_sessions_user_id_idx on public.rewind_sessions (user_id);

-- Track metadata cache. Public catalog data only (names, artists, album, length);
-- nothing about who listened. Shared by all users to avoid refetching.
create table public.rewind_tracks (
  id text primary key,
  name text not null,
  artists jsonb not null,
  album jsonb not null,
  duration_ms integer not null default 0,
  isrc text,
  explicit boolean not null default false,
  -- Null until the full track was fetched from Spotify (imports only carry names).
  enriched_at timestamptz,
  updated_at timestamptz not null default now()
);
create index rewind_tracks_unenriched_idx on public.rewind_tracks (updated_at) where enriched_at is null;

create table public.rewind_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.rewind_users (id) on delete cascade,
  file_name text not null,
  added integer not null default 0,
  imported_at timestamptz not null default now()
);
create index rewind_imports_user_id_idx on public.rewind_imports (user_id, imported_at desc);

create table public.rewind_plays (
  user_id uuid not null references public.rewind_users (id) on delete cascade,
  track_id text not null references public.rewind_tracks (id),
  -- Start of playback, truncated to the second: the same play imported twice collides here.
  played_at timestamptz not null,
  ms_played integer not null check (ms_played >= 0),
  source text not null check (source in ('synced', 'imported')),
  import_id uuid references public.rewind_imports (id) on delete cascade,
  primary key (user_id, track_id, played_at)
);
create index rewind_plays_user_played_at_idx on public.rewind_plays (user_id, played_at);

create table public.rewind_playlist_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.rewind_users (id) on delete cascade,
  playlist_id text not null,
  label text not null,
  track_ids text[] not null,
  created_at timestamptz not null default now()
);
create index rewind_playlist_snapshots_user_playlist_idx
  on public.rewind_playlist_snapshots (user_id, playlist_id, created_at desc);

create table public.rewind_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.rewind_users (id) on delete cascade,
  title text not null,
  request text not null,
  track_ids text[] not null,
  unmatched text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index rewind_generations_user_idx on public.rewind_generations (user_id, created_at desc);

-- Anonymous demo sandboxes. Not tied to any person; expire after a day.
create table public.rewind_demo_sessions (
  id uuid primary key,
  state jsonb not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);
create index rewind_demo_sessions_expires_idx on public.rewind_demo_sessions (expires_at);

-- Fixed-window counters for rate limits (AI generations, imports). Key = scope + subject.
create table public.rewind_rate_limits (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key, window_start)
);

-- Lock everything down: RLS on, no policies, no grants for client roles.
do $$
declare
  t text;
begin
  foreach t in array array[
    'rewind_users', 'rewind_spotify_tokens', 'rewind_sessions', 'rewind_tracks', 'rewind_imports',
    'rewind_plays', 'rewind_playlist_snapshots', 'rewind_generations', 'rewind_demo_sessions',
    'rewind_rate_limits'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
  end loop;
end
$$;

-- Atomic increment for rate limits; returns the count after incrementing.
create function public.rewind_hit_rate_limit(p_key text, p_window_start timestamptz)
returns integer
language sql
security invoker
set search_path = ''
as $$
  insert into public.rewind_rate_limits (key, window_start, count)
  values (p_key, p_window_start, 1)
  on conflict (key, window_start) do update set count = public.rewind_rate_limits.count + 1
  returning count;
$$;
revoke all on function public.rewind_hit_rate_limit(text, timestamptz) from public, anon, authenticated;
