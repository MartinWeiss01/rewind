-- Synced plays were stored with Spotify's played_at, which is when playback ended;
-- imported plays are stored by their start. Move synced plays to their start so both
-- sources agree. Rows are re-inserted rather than updated in place, because shifting one
-- play onto the old time of a back-to-back repeat of the same track would break the
-- unique key mid-update.
create temporary table rewind_synced_shift as
  select user_id, track_id,
    date_trunc('second', played_at - ms_played * interval '1 millisecond') as played_at,
    ms_played, source, import_id
  from public.rewind_plays
  where source = 'synced';

delete from public.rewind_plays where source = 'synced';

-- An imported play at the same start is the same listen; the synced one is kept.
delete from public.rewind_plays p
  using rewind_synced_shift s
  where p.user_id = s.user_id and p.track_id = s.track_id and p.played_at = s.played_at;

insert into public.rewind_plays (user_id, track_id, played_at, ms_played, source, import_id)
  select user_id, track_id, played_at, ms_played, source, import_id from rewind_synced_shift
  on conflict do nothing;

drop table rewind_synced_shift;
