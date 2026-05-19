create table if not exists public.player_score_uploads (
  id uuid primary key default gen_random_uuid(),
  position text not null check (position in ('WR', 'TE', 'QB', 'RB')),
  file_name text,
  upload_label text,
  summary jsonb not null default '{}',
  uploaded_at timestamptz not null default now()
);

create table if not exists public.player_score_rankings (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid not null references public.player_score_uploads(id) on delete cascade,
  player_key text not null,
  player_name text not null,
  team text,
  position text not null check (position in ('WR', 'TE', 'QB', 'RB')),
  rank integer not null,
  rank_label text,
  score integer not null default 0,
  latest_season text,
  seasons_played text[] not null default '{}',
  advanced_stats jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  unique(upload_id, position, player_key)
);

create index if not exists player_score_uploads_position_uploaded_at_idx
on public.player_score_uploads(position, uploaded_at desc);

create index if not exists player_score_rankings_upload_rank_idx
on public.player_score_rankings(upload_id, rank);

create index if not exists player_score_rankings_position_score_idx
on public.player_score_rankings(position, score desc);

-- Safe migration path from the earlier calculated-model version.
-- You can leave the older player_score_seasons table in place; the app no longer reads it.
