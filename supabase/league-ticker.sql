create table if not exists public.league_ticker_settings (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  is_enabled boolean not null default true,
  label text not null default 'League Ticker',
  speed_seconds integer not null default 32,
  pause_on_hover boolean not null default true,
  background_style text not null default 'emerald',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint league_ticker_settings_league_unique unique (league_id),
  constraint league_ticker_speed_range check (speed_seconds between 8 and 90),
  constraint league_ticker_background_style_check check (
    background_style in ('emerald', 'gold', 'red', 'blue', 'purple')
  )
);

create table if not exists public.league_ticker_items (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  emoji text not null default '⚡',
  text text not null,
  link_url text,
  is_active boolean not null default true,
  sort_order integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists league_ticker_items_league_sort_idx
on public.league_ticker_items (league_id, is_active, sort_order, created_at);

alter table public.league_ticker_settings enable row level security;
alter table public.league_ticker_items enable row level security;

-- Public read access keeps the ticker visible to logged-out league readers.
drop policy if exists "League ticker settings are readable" on public.league_ticker_settings;
create policy "League ticker settings are readable"
on public.league_ticker_settings
for select
using (true);

drop policy if exists "League ticker items are readable" on public.league_ticker_items;
create policy "League ticker items are readable"
on public.league_ticker_items
for select
using (true);

-- League owner/admins can manage ticker settings.
drop policy if exists "League admins can manage ticker settings" on public.league_ticker_settings;
create policy "League admins can manage ticker settings"
on public.league_ticker_settings
for all
to authenticated
using (
  exists (
    select 1 from public.leagues l
    where l.id = league_ticker_settings.league_id
      and l.admin_id = auth.uid()
  )
  or exists (
    select 1 from public.league_members lm
    where lm.league_id = league_ticker_settings.league_id
      and lm.user_id = auth.uid()
      and lm.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.leagues l
    where l.id = league_ticker_settings.league_id
      and l.admin_id = auth.uid()
  )
  or exists (
    select 1 from public.league_members lm
    where lm.league_id = league_ticker_settings.league_id
      and lm.user_id = auth.uid()
      and lm.role = 'admin'
  )
);

-- League owner/admins can manage ticker items.
drop policy if exists "League admins can manage ticker items" on public.league_ticker_items;
create policy "League admins can manage ticker items"
on public.league_ticker_items
for all
to authenticated
using (
  exists (
    select 1 from public.leagues l
    where l.id = league_ticker_items.league_id
      and l.admin_id = auth.uid()
  )
  or exists (
    select 1 from public.league_members lm
    where lm.league_id = league_ticker_items.league_id
      and lm.user_id = auth.uid()
      and lm.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.leagues l
    where l.id = league_ticker_items.league_id
      and l.admin_id = auth.uid()
  )
  or exists (
    select 1 from public.league_members lm
    where lm.league_id = league_ticker_items.league_id
      and lm.user_id = auth.uid()
      and lm.role = 'admin'
  )
);
