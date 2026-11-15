-- Lower-cased track, artist and album names for history search.
alter table public.rewind_tracks
  add column search_text text generated always as (
    lower(name || ' ' || coalesce(jsonb_path_query_array(artists, '$[*].name')::text, '') || ' ' || coalesce(album ->> 'name', ''))
  ) stored;
