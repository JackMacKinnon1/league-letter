-- League Letter Game Feed — single deep Sleeper source + local PC collector
-- Run this entire file in the Supabase SQL Editor.
-- It is safe to run again when upgrading from the earlier local-worker version.

create extension if not exists pgcrypto;

alter table public.leagues
  add column if not exists scoring_settings jsonb not null default '{}'::jsonb,
  add column if not exists game_feed_enabled boolean not null default true,
  add column if not exists game_feed_display_mode text not null default 'public',
  add column if not exists game_feed_poll_seconds integer not null default 10,
  add column if not exists game_feed_last_polled_at timestamptz,
  add column if not exists game_feed_last_success_at timestamptz,
  add column if not exists game_feed_last_error text,
  add column if not exists game_feed_metadata_synced_at timestamptz,
  add column if not exists game_feed_poll_lock_until timestamptz,
  add column if not exists game_feed_worker_heartbeat_at timestamptz,
  add column if not exists game_feed_worker_started_at timestamptz,
  add column if not exists game_feed_worker_stopped_at timestamptz,
  add column if not exists game_feed_worker_name text,
  add column if not exists game_feed_worker_version text,
  add column if not exists game_feed_worker_mode text,
  add column if not exists game_feed_source_sleeper_league_id text;

alter table public.leagues
  drop constraint if exists leagues_game_feed_poll_seconds_check;

alter table public.leagues
  drop constraint if exists leagues_game_feed_display_mode_check;

update public.leagues
set game_feed_poll_seconds = 10
where game_feed_poll_seconds < 5 or game_feed_poll_seconds > 300;

update public.leagues
set game_feed_display_mode = 'public'
where game_feed_display_mode not in ('public', 'test')
   or game_feed_display_mode is null;

alter table public.leagues
  add constraint leagues_game_feed_poll_seconds_check
  check (game_feed_poll_seconds between 5 and 300);

alter table public.leagues
  add constraint leagues_game_feed_display_mode_check
  check (game_feed_display_mode in ('public', 'test'));

-- Legacy per-league snapshots remain in place so this migration upgrades cleanly.
-- The v2 worker uses the global source snapshot table below instead.
create table if not exists public.game_feed_player_snapshots (
  league_id uuid not null references public.leagues(id) on delete cascade,
  sleeper_league_id text not null,
  season text not null,
  week integer not null check (week between 1 and 25),
  sleeper_player_id text not null,
  sleeper_roster_id integer,
  is_starter boolean not null default false,
  fantasy_points numeric not null default 0,
  previous_fantasy_points numeric,
  last_delta numeric not null default 0,
  last_polled_at timestamptz not null default now(),
  primary key (league_id, season, week, sleeper_player_id)
);

create index if not exists game_feed_snapshots_lookup_idx
  on public.game_feed_player_snapshots (league_id, season, week);

-- One baseline per worker mode keeps test runs completely separate from public runs.
create table if not exists public.game_feed_source_snapshots (
  feed_mode text not null check (feed_mode in ('public', 'test')),
  source_sleeper_league_id text not null,
  season text not null,
  week integer not null check (week between 1 and 25),
  sleeper_player_id text not null,
  sleeper_roster_id integer,
  is_starter boolean not null default false,
  fantasy_points numeric not null default 0,
  previous_fantasy_points numeric,
  last_delta numeric not null default 0,
  last_polled_at timestamptz not null default now(),
  primary key (
    feed_mode,
    source_sleeper_league_id,
    season,
    week,
    sleeper_player_id
  )
);

create index if not exists game_feed_source_snapshots_lookup_idx
  on public.game_feed_source_snapshots (
    feed_mode,
    source_sleeper_league_id,
    season,
    week
  );

-- Global worker status and lock. There can be one public worker and one test worker,
-- though normally only one is run at a time.
create table if not exists public.game_feed_source_state (
  feed_mode text primary key check (feed_mode in ('public', 'test')),
  source_sleeper_league_id text not null,
  poll_seconds integer not null default 10 check (poll_seconds between 5 and 300),
  season text,
  week integer check (week between 1 and 25),
  league_status text,
  scoring_settings jsonb not null default '{}'::jsonb,
  metadata_source_sleeper_league_id text,
  metadata_synced_at timestamptz,
  last_polled_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  poll_lock_until timestamptz,
  worker_heartbeat_at timestamptz,
  worker_started_at timestamptz,
  worker_stopped_at timestamptz,
  worker_name text,
  worker_version text,
  updated_at timestamptz not null default now()
);


alter table public.game_feed_source_state
  add column if not exists metadata_source_sleeper_league_id text;

create table if not exists public.game_feed_poll_batches (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  sleeper_league_id text not null,
  source_sleeper_league_id text,
  feed_mode text not null default 'public',
  season text not null,
  week integer not null,
  status text not null default 'started'
    check (status in ('started', 'seeded', 'completed', 'skipped', 'failed')),
  player_change_count integer not null default 0,
  event_count integer not null default 0,
  scoring_settings jsonb not null default '{}'::jsonb,
  raw_matchups jsonb,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.game_feed_poll_batches
  add column if not exists scoring_settings jsonb not null default '{}'::jsonb,
  add column if not exists source_sleeper_league_id text,
  add column if not exists feed_mode text not null default 'public';

alter table public.game_feed_poll_batches
  drop constraint if exists game_feed_poll_batches_feed_mode_check;

update public.game_feed_poll_batches
set feed_mode = 'public'
where feed_mode not in ('public', 'test') or feed_mode is null;

update public.game_feed_poll_batches
set source_sleeper_league_id = sleeper_league_id
where source_sleeper_league_id is null;

alter table public.game_feed_poll_batches
  add constraint game_feed_poll_batches_feed_mode_check
  check (feed_mode in ('public', 'test'));

create index if not exists game_feed_batches_league_idx
  on public.game_feed_poll_batches (league_id, started_at desc);

create index if not exists game_feed_batches_mode_idx
  on public.game_feed_poll_batches (feed_mode, started_at desc);

create table if not exists public.game_feed_events (
  id bigint generated always as identity primary key,
  league_id uuid not null references public.leagues(id) on delete cascade,
  sleeper_league_id text not null,
  source_sleeper_league_id text,
  feed_mode text not null default 'public',
  season text not null,
  week integer not null check (week between 1 and 25),
  batch_id uuid references public.game_feed_poll_batches(id) on delete set null,
  event_type text not null check (
    event_type in (
      'reception',
      'rush',
      'passing',
      'touchdown',
      'field_goal',
      'extra_point',
      'defense',
      'turnover',
      'scoring_update',
      'stat_correction'
    )
  ),
  description text not null,
  primary_player_id text not null,
  primary_player_name text not null,
  primary_player_position text,
  primary_player_team text,
  secondary_player_id text,
  secondary_player_name text,
  secondary_player_position text,
  primary_fantasy_delta numeric not null,
  secondary_fantasy_delta numeric,
  inferred_yards integer,
  inferred_receptions integer,
  inferred_touchdowns integer,
  confidence text not null default 'low'
    check (confidence in ('high', 'medium', 'low')),
  is_aggregate boolean not null default false,
  is_correction boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  fingerprint text not null unique,
  occurred_at timestamptz not null default now(),
  detected_at timestamptz not null default now()
);

alter table public.game_feed_events
  add column if not exists source_sleeper_league_id text,
  add column if not exists feed_mode text not null default 'public';

alter table public.game_feed_events
  drop constraint if exists game_feed_events_feed_mode_check;

update public.game_feed_events
set feed_mode = 'public'
where feed_mode not in ('public', 'test') or feed_mode is null;

update public.game_feed_events
set source_sleeper_league_id = sleeper_league_id
where source_sleeper_league_id is null;

alter table public.game_feed_events
  add constraint game_feed_events_feed_mode_check
  check (feed_mode in ('public', 'test'));

create index if not exists game_feed_events_feed_idx
  on public.game_feed_events (league_id, season, week, id desc);

create index if not exists game_feed_events_mode_feed_idx
  on public.game_feed_events (league_id, feed_mode, season, week, id desc);

create index if not exists game_feed_events_primary_player_idx
  on public.game_feed_events (league_id, primary_player_id, id desc);

create index if not exists game_feed_events_secondary_player_idx
  on public.game_feed_events (league_id, secondary_player_id, id desc)
  where secondary_player_id is not null;

alter table public.game_feed_events enable row level security;
alter table public.game_feed_player_snapshots enable row level security;
alter table public.game_feed_source_snapshots enable row level security;
alter table public.game_feed_source_state enable row level security;
alter table public.game_feed_poll_batches enable row level security;

drop policy if exists "Public can read game feed events" on public.game_feed_events;
create policy "Public can read game feed events"
  on public.game_feed_events
  for select
  to anon, authenticated
  using (true);

-- The frontend only receives the selected mode through its server queries/API.
-- Source snapshots, locks, heartbeats, and diagnostic batches stay service-role only.
grant select on public.game_feed_events to anon, authenticated;
grant usage, select on sequence public.game_feed_events_id_seq to anon, authenticated;

grant all on public.game_feed_events to service_role;
grant all on public.game_feed_player_snapshots to service_role;
grant all on public.game_feed_source_snapshots to service_role;
grant all on public.game_feed_source_state to service_role;
grant all on public.game_feed_poll_batches to service_role;
grant all on sequence public.game_feed_events_id_seq to service_role;

create or replace function public.claim_game_feed_source_poll(
  p_feed_mode text,
  p_source_sleeper_league_id text,
  p_poll_seconds integer default 10,
  p_force boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_rows integer := 0;
  safe_seconds integer := greatest(5, least(coalesce(p_poll_seconds, 10), 300));
begin
  if p_feed_mode not in ('public', 'test') then
    raise exception 'Invalid Game Feed mode';
  end if;

  insert into public.game_feed_source_state (
    feed_mode,
    source_sleeper_league_id,
    poll_seconds
  )
  values (
    p_feed_mode,
    p_source_sleeper_league_id,
    safe_seconds
  )
  on conflict (feed_mode) do update
  set
    source_sleeper_league_id = excluded.source_sleeper_league_id,
    poll_seconds = excluded.poll_seconds,
    updated_at = now();

  update public.game_feed_source_state
  set
    source_sleeper_league_id = p_source_sleeper_league_id,
    poll_seconds = safe_seconds,
    poll_lock_until = now() + interval '45 seconds',
    last_polled_at = now(),
    updated_at = now()
  where feed_mode = p_feed_mode
    and (
      poll_lock_until is null
      or poll_lock_until < now()
    )
    and (
      p_force
      or last_polled_at is null
      or last_polled_at <= now() - make_interval(secs => safe_seconds)
    );

  get diagnostics affected_rows = row_count;
  return affected_rows > 0;
end;
$$;

create or replace function public.finish_game_feed_source_poll(
  p_feed_mode text,
  p_succeeded boolean,
  p_error text default null
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.game_feed_source_state
  set
    last_success_at = case when p_succeeded then now() else last_success_at end,
    last_error = case when p_succeeded then null else left(p_error, 1000) end,
    poll_lock_until = null,
    updated_at = now()
  where feed_mode = p_feed_mode;
$$;

revoke all on function public.claim_game_feed_source_poll(text, text, integer, boolean)
  from public, anon, authenticated;
revoke all on function public.finish_game_feed_source_poll(text, boolean, text)
  from public, anon, authenticated;
grant execute on function public.claim_game_feed_source_poll(text, text, integer, boolean)
  to service_role;
grant execute on function public.finish_game_feed_source_poll(text, boolean, text)
  to service_role;

-- Legacy functions are kept for backwards compatibility but the v2 worker does not call them.
create or replace function public.claim_game_feed_poll(
  p_league_id uuid,
  p_force boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_rows integer := 0;
begin
  update public.leagues
  set
    game_feed_poll_lock_until = now() + interval '45 seconds',
    game_feed_last_polled_at = now()
  where id = p_league_id
    and game_feed_enabled = true
    and (
      game_feed_poll_lock_until is null
      or game_feed_poll_lock_until < now()
    )
    and (
      p_force
      or game_feed_last_polled_at is null
      or game_feed_last_polled_at <= now() - make_interval(secs => game_feed_poll_seconds)
    );

  get diagnostics affected_rows = row_count;
  return affected_rows > 0;
end;
$$;

create or replace function public.finish_game_feed_poll(
  p_league_id uuid,
  p_succeeded boolean,
  p_error text default null
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.leagues
  set
    game_feed_last_success_at = case when p_succeeded then now() else game_feed_last_success_at end,
    game_feed_last_error = case when p_succeeded then null else left(p_error, 1000) end,
    game_feed_poll_lock_until = null
  where id = p_league_id;
$$;

revoke all on function public.claim_game_feed_poll(uuid, boolean)
  from public, anon, authenticated;
revoke all on function public.finish_game_feed_poll(uuid, boolean, text)
  from public, anon, authenticated;
grant execute on function public.claim_game_feed_poll(uuid, boolean) to service_role;
grant execute on function public.finish_game_feed_poll(uuid, boolean, text) to service_role;

-- New rows are pushed to open Game Feed pages through Supabase Realtime.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'game_feed_events'
  ) then
    alter publication supabase_realtime add table public.game_feed_events;
  end if;
end $$;
