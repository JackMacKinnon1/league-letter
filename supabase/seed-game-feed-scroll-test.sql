-- League Letter Game Feed scroll-test seed
--
-- Creates 750 TEST-mode Game Feed events for every League Letter room.
-- The rows use real player IDs/names/teams from public.players, so player
-- pictures, team filters, favourites, and roster highlighting can all be tested.
--
-- Safe to run more than once: existing rows from this seed are removed first.
-- After running it, set the room's Website feed mode to TEST in Site Admin.

begin;

-- Remove an older run of this same seed so reruns stay predictable.
delete from public.game_feed_events
where metadata ->> 'seed_source' = 'scroll_test_seed';

-- Fail early with a useful message instead of silently inserting nothing.
do $$
begin
  if not exists (select 1 from public.leagues) then
    raise exception 'No League Letter leagues exist yet.';
  end if;

  if not exists (
    select 1
    from public.players
    where team is not null
      and upper(coalesce(position, '')) in ('WR', 'RB', 'TE', 'QB')
  ) then
    raise exception 'No offensive players exist in public.players. Sync Sleeper players first.';
  end if;

  if not exists (
    select 1
    from public.players
    where team is not null
      and upper(coalesce(position, '')) = 'QB'
  ) then
    raise exception 'No quarterbacks exist in public.players. Sync Sleeper players first.';
  end if;

  if not exists (
    select 1
    from public.players
    where team is not null
      and upper(coalesce(position, '')) = 'K'
  ) then
    raise exception 'No kickers exist in public.players. Sync Sleeper players first.';
  end if;
end
$$;

with
config as (
  select 750::integer as plays_per_league
),
target_leagues as (
  select
    l.id,
    coalesce(nullif(l.sleeper_league_id::text, ''), 'mock-sleeper-league') as sleeper_league_id,
    coalesce(nullif(l.season::text, ''), extract(year from now())::integer::text) as season,
    greatest(1, least(25, coalesce(l.current_week, 1)::integer)) as week
  from public.leagues l
),
player_pools as (
  select
    'skill'::text as pool_key,
    p.id::text as player_id,
    coalesce(nullif(p.full_name, ''), nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), p.id::text) as player_name,
    upper(p.position) as player_position,
    upper(p.team) as player_team
  from public.players p
  where p.team is not null
    and upper(coalesce(p.position, '')) in ('WR', 'RB', 'TE', 'QB')

  union all

  select
    'qb'::text,
    p.id::text,
    coalesce(nullif(p.full_name, ''), nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), p.id::text),
    'QB'::text,
    upper(p.team)
  from public.players p
  where p.team is not null
    and upper(coalesce(p.position, '')) = 'QB'

  union all

  select
    'k'::text,
    p.id::text,
    coalesce(nullif(p.full_name, ''), nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), p.id::text),
    'K'::text,
    upper(p.team)
  from public.players p
  where p.team is not null
    and upper(coalesce(p.position, '')) = 'K'
),
ranked_players as (
  select
    pp.*,
    row_number() over (partition by pp.pool_key order by pp.player_team, pp.player_name, pp.player_id) as pool_row,
    count(*) over (partition by pp.pool_key) as pool_count
  from player_pools pp
),
team_qbs as (
  select
    p.id::text as player_id,
    coalesce(nullif(p.full_name, ''), nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), p.id::text) as player_name,
    upper(p.team) as player_team,
    row_number() over (
      partition by upper(p.team)
      order by coalesce(p.active, false) desc, coalesce(p.search_rank, 999999), p.id
    ) as team_qb_row
  from public.players p
  where p.team is not null
    and upper(coalesce(p.position, '')) = 'QB'
),
numbered_plays as (
  select
    l.*,
    c.plays_per_league,
    gs.play_number,
    mod(gs.play_number - 1, 10) as play_code,
    case
      when mod(gs.play_number - 1, 10) = 3 then 'qb'
      when mod(gs.play_number - 1, 10) = 4 then 'k'
      else 'skill'
    end as primary_pool
  from target_leagues l
  cross join config c
  cross join lateral generate_series(1, c.plays_per_league) as gs(play_number)
),
selected_plays as (
  select
    np.*,
    primary_player.player_id as primary_player_id,
    primary_player.player_name as primary_player_name,
    primary_player.player_position as primary_player_position,
    primary_player.player_team as primary_player_team,
    team_qb.player_id as team_qb_id,
    team_qb.player_name as team_qb_name,
    fallback_qb.player_id as fallback_qb_id,
    fallback_qb.player_name as fallback_qb_name
  from numbered_plays np
  join ranked_players primary_player
    on primary_player.pool_key = np.primary_pool
   and primary_player.pool_row = 1 + (((np.play_number - 1)::bigint) % primary_player.pool_count)
  left join team_qbs team_qb
    on team_qb.player_team = primary_player.player_team
   and team_qb.team_qb_row = 1
  left join ranked_players fallback_qb
    on fallback_qb.pool_key = 'qb'
   and fallback_qb.pool_row = 1 + (((np.play_number - 1)::bigint) % fallback_qb.pool_count)
)
insert into public.game_feed_events (
  league_id,
  sleeper_league_id,
  source_sleeper_league_id,
  feed_mode,
  season,
  week,
  event_type,
  description,
  primary_player_id,
  primary_player_name,
  primary_player_position,
  primary_player_team,
  secondary_player_id,
  secondary_player_name,
  secondary_player_position,
  primary_fantasy_delta,
  secondary_fantasy_delta,
  inferred_yards,
  inferred_receptions,
  inferred_touchdowns,
  confidence,
  is_aggregate,
  is_correction,
  metadata,
  fingerprint,
  occurred_at,
  detected_at
)
select
  sp.id,
  sp.sleeper_league_id,
  sp.sleeper_league_id,
  'test',
  sp.season,
  sp.week,
  case sp.play_code
    when 0 then 'reception'
    when 1 then 'rush'
    when 2 then 'touchdown'
    when 3 then 'turnover'
    when 4 then 'field_goal'
    when 5 then 'reception'
    when 6 then 'touchdown'
    when 7 then 'scoring_update'
    when 8 then 'turnover'
    else 'reception'
  end,
  case sp.play_code
    when 0 then '18-yard reception'
    when 1 then '7-yard rush'
    when 2 then '42-yard touchdown reception'
    when 3 then 'Interception thrown'
    when 4 then '39-yard field goal'
    when 5 then '12-yard reception'
    when 6 then '4-yard rushing touchdown'
    when 7 then '2 receptions, 24 yards'
    when 8 then 'Fumble lost'
    else '31-yard reception'
  end,
  sp.primary_player_id,
  sp.primary_player_name,
  sp.primary_player_position,
  sp.primary_player_team,
  case
    when sp.play_code in (0, 2, 5, 7, 9)
      then coalesce(sp.team_qb_id, sp.fallback_qb_id)
    else null
  end,
  case
    when sp.play_code in (0, 2, 5, 7, 9)
      then coalesce(sp.team_qb_name, sp.fallback_qb_name)
    else null
  end,
  case when sp.play_code in (0, 2, 5, 7, 9) then 'QB' else null end,
  case sp.play_code
    when 0 then 2.80
    when 1 then 0.70
    when 2 then 11.20
    when 3 then -1.00
    when 4 then 3.00
    when 5 then 2.20
    when 6 then 6.40
    when 7 then 4.40
    when 8 then -2.00
    else 4.10
  end,
  case sp.play_code
    when 0 then 0.72
    when 2 then 5.68
    when 5 then 0.48
    when 7 then 0.96
    when 9 then 1.24
    else null
  end,
  case sp.play_code
    when 0 then 18
    when 1 then 7
    when 2 then 42
    when 4 then 39
    when 5 then 12
    when 6 then 4
    when 7 then 24
    when 9 then 31
    else null
  end,
  case sp.play_code
    when 0 then 1
    when 2 then 1
    when 5 then 1
    when 7 then 2
    when 9 then 1
    else null
  end,
  case when sp.play_code in (2, 6) then 1 else 0 end,
  case when sp.play_code = 7 then 'medium' else 'high' end,
  sp.play_code = 7,
  false,
  jsonb_build_object(
    'synthetic', true,
    'seed_source', 'scroll_test_seed',
    'seed_version', 1,
    'mock_index', sp.play_number
  ),
  concat(
    'scroll-test-seed-v1:',
    sp.id::text, ':', sp.season, ':', sp.week::text, ':', sp.play_number::text
  ),
  now() - ((sp.plays_per_league - sp.play_number) * interval '12 seconds'),
  now() - ((sp.plays_per_league - sp.play_number) * interval '12 seconds')
from selected_plays sp
on conflict (fingerprint) do nothing;

commit;

-- Verification: this should show 750 rows per league.
select
  league_id,
  count(*) as mock_play_count,
  min(detected_at) as oldest_mock_play,
  max(detected_at) as newest_mock_play
from public.game_feed_events
where metadata ->> 'seed_source' = 'scroll_test_seed'
group by league_id
order by league_id;
