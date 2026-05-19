-- Run this in Supabase SQL Editor before syncing again.
-- It lets League Letter store Sleeper division data for the Trophy Room.

alter table public.team_season_stats
add column if not exists division_id integer,
add column if not exists division_name text;

alter table public.teams
add column if not exists division_id integer,
add column if not exists division_name text;

alter table public.leagues
add column if not exists division_count integer;
