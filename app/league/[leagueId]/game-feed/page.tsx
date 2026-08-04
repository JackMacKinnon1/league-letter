import GameFeedClient from '@/components/GameFeedClient'
import LeagueWeekSelector from '@/components/LeagueWeekSelector'
import Link from '@/components/NoPrefetchLink'
import Navbar from '@/components/Navbar'
import { createClient } from '@/lib/supabase/server'
import {
  normalizeGameFeedSeason,
  normalizeGameFeedWeek,
  type GameFeedEvent,
} from '@/lib/gameFeed'
import { Beaker, Radio } from 'lucide-react'
import { redirect } from 'next/navigation'

export default async function GameFeedPage({
  params,
  searchParams,
}: {
  params: Promise<{ leagueId: string }>
  searchParams: Promise<{ season?: string; week?: string }>
}) {
  const { leagueId } = await params
  const { season, week } = await searchParams
  const supabase = await createClient()

  const { data: league } = await supabase
    .from('leagues')
    .select('*')
    .eq('id', leagueId)
    .maybeSingle()

  if (!league) redirect('/')

  const feedMode = league.game_feed_display_mode === 'test' ? 'test' : 'public'
  const [{ data: matchupSeasonRows }, { data: eventSeasonRows }] =
    await Promise.all([
      supabase
        .from('matchups')
        .select('season')
        .eq('league_id', leagueId)
        .not('season', 'is', null),
      supabase
        .from('game_feed_events')
        .select('season')
        .eq('league_id', leagueId)
        .eq('feed_mode', feedMode),
    ])

  const availableSeasons = Array.from(
    new Set(
      [...(matchupSeasonRows || []), ...(eventSeasonRows || [])].map((row: any) =>
        String(row.season)
      )
    )
  ).sort((a, b) => Number(b) - Number(a))

  const selectedSeason = normalizeGameFeedSeason(
    season,
    league.season || availableSeasons[0] || String(new Date().getFullYear())
  )
  const selectedWeek = normalizeGameFeedWeek(week, Number(league.current_week || 1))

  const { data: initialEvents } = await supabase
    .from('game_feed_events')
    .select('*')
    .eq('league_id', leagueId)
    .eq('feed_mode', feedMode)
    .eq('season', selectedSeason)
    .eq('week', selectedWeek)
    .order('id', { ascending: false })
    .limit(50)

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <Navbar />

      <section className="border-b border-zinc-800 bg-white/[0.015] px-4 py-10">
        <div className="mx-auto max-w-5xl">
          <Link
            href={`/league/${leagueId}?season=${selectedSeason}&week=${selectedWeek}`}
            className="text-sm font-bold text-zinc-400 hover:text-white"
          >
            ← Back to league
          </Link>

          <div className="mt-7 flex items-center gap-4">
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-2xl border ${
                feedMode === 'test'
                  ? 'border-amber-400/20 bg-amber-400/10 text-amber-300'
                  : 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
              }`}
            >
              {feedMode === 'test' ? <Beaker size={25} /> : <Radio size={25} />}
            </div>
            <div>
              <p
                className={`text-sm font-black uppercase tracking-[0.3em] ${
                  feedMode === 'test' ? 'text-amber-300' : 'text-emerald-400'
                }`}
              >
                {feedMode === 'test' ? 'Test feed' : 'Live fantasy scoring'}
              </p>
              <h1 className="mt-1 text-5xl font-black tracking-tight md:text-7xl">
                Game Feed
              </h1>
            </div>
          </div>

          <p className="mt-5 max-w-3xl text-lg leading-8 text-zinc-400">
            Fantasy-scoring-derived plays for {league.name}. Exact descriptions are shown only when the point changes produce a clear statistical match.
          </p>

          {feedMode === 'test' && (
            <div className="mt-5 flex max-w-3xl gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
              <Beaker className="mt-0.5 shrink-0" size={17} />
              <p>
                This league is displaying test events only. Public Game Feed events are hidden until an admin switches the website mode back to Public.
              </p>
            </div>
          )}

          <LeagueWeekSelector
            leagueId={leagueId}
            seasons={availableSeasons.length ? availableSeasons : [selectedSeason]}
            selectedSeason={selectedSeason}
            selectedWeek={selectedWeek}
          />
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-8">
        <GameFeedClient
          key={`${feedMode}:${selectedSeason}:${selectedWeek}`}
          leagueId={leagueId}
          season={String(selectedSeason)}
          week={selectedWeek}
          feedMode={feedMode}
          initialEvents={(initialEvents || []) as GameFeedEvent[]}
        />
      </section>
    </main>
  )
}
