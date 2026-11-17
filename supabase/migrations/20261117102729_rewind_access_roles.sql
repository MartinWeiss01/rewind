-- Admins are members with role 'admin', set by hand in the database; the app never
-- changes roles. Admins have every feature and manage everyone else's on /app/admin.
alter table public.rewind_access_members
  add column role text check (role in ('admin'));
