-- League Letter profile / Sleeper account linking
-- Run this once in the Supabase SQL Editor.

alter table public.profiles
  add column if not exists sleeper_user_id text,
  add column if not exists sleeper_username text,
  add column if not exists sleeper_display_name text,
  add column if not exists sleeper_avatar text,
  add column if not exists sleeper_connected_at timestamptz;

create unique index if not exists profiles_sleeper_user_id_unique
  on public.profiles (sleeper_user_id)
  where sleeper_user_id is not null;

create index if not exists profiles_sleeper_username_idx
  on public.profiles (lower(sleeper_username))
  where sleeper_username is not null;

comment on column public.profiles.sleeper_user_id is
  'Canonical Sleeper user ID used to identify this League Letter user across leagues.';
comment on column public.profiles.sleeper_username is
  'Canonical Sleeper username returned by the Sleeper API.';
