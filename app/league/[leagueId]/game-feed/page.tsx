import GameFeedClient from '@/components/GameFeedClient'
import LeagueWeekSelector from '@/components/LeagueWeekSelector'
import Link from '@/components/NoPrefetchLink'
import Navbar from '@/components/Navbar'
import { createClient } from '@/lib/supabase/server'
import {
  normalizeGameFeedSeason,
  normalizeGameFeedWeek,
  type GameFeedEvent,
  type GameFeedLeagueTeam,
  type GameFeedMatchupRow,
} from '@/lib/gameFeed'
import { Beaker, Radio } from 'lucide-react'
import { redirect } from 'next/navigation'

const PAGE_SIZE = 25

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
  const { data: { user } } = await supabase.auth.getUser()

  const { data: league } = await supabase
    .from('leagues')
    .select('*')
    .eq('id', leagueId)
    .maybeSingle()

  if (!league) redirect('/')

  const feedMode = league.game_feed_display_mode === 'test' ? 'test' : 'public'
  const [{ data: matchupSeasonRows }, { data: eventSeasonRows }] = await Promise.all([
    supabase
      .from('matchups')
      .select('season')
      .eq('league_id', leagueId)
      .not('season', 'is', null)
      .limit(500),
    supabase
      .from('game_feed_events')
      .select('season')
      .eq('league_id', leagueId)
      .eq('feed_mode', feedMode)
      .limit(500),
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

  const [eventsResult, teamsResult, matchupsResult, memberResult, profileResult] = await Promise.all([
    supabase
      .from('game_feed_events')
      .select('*', { count: 'exact' })
      .eq('league_id', leagueId)
      .eq('feed_mode', feedMode)
      .eq('season', selectedSeason)
      .eq('week', selectedWeek)
      .order('id', { ascending: false })
      .range(0, PAGE_SIZE - 1),
    supabase
      .from('teams')
      .select('sleeper_roster_id,sleeper_owner_id,team_name,players')
      .eq('league_id', leagueId)
      .order('team_name', { ascending: true })
      .limit(64),
    supabase
      .from('matchups')
      .select('sleeper_roster_id,matchup_id')
      .eq('league_id', leagueId)
      .eq('season', selectedSeason)
      .eq('week', selectedWeek)
      .limit(64),
    user
      ? supabase
          .from('league_members')
          .select('sleeper_user_id')
          .eq('league_id', leagueId)
          .eq('user_id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    user
      ? supabase
          .from('profiles')
          .select('sleeper_user_id')
          .eq('id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const teams = (teamsResult.data || []) as GameFeedLeagueTeam[]
  const linkedSleeperUserId =
    (memberResult.data as any)?.sleeper_user_id ||
    (profileResult.data as any)?.sleeper_user_id ||
    null
  const autoRoster = teams.find(
    (team) => linkedSleeperUserId && team.sleeper_owner_id === linkedSleeperUserId
  )

  return (
    <main className="min-h-screen overflow-x-hidden bg-zinc-950 text-white">
      <Navbar />

      <section className="border-b border-zinc-800 bg-white/[0.015] px-3 py-7 sm:px-4 sm:py-10">
        <div className="mx-auto min-w-0 max-w-5xl">
          <Link
            href={`/league/${leagueId}?season=${selectedSeason}&week=${selectedWeek}`}
            className="text-sm font-bold text-zinc-400 hover:text-white"
          >
            ← Back to league
          </Link>

          <div className="mt-6 flex min-w-0 items-center gap-3 sm:mt-7 sm:gap-4">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border sm:h-14 sm:w-14 sm:rounded-2xl ${
                feedMode === 'test'
                  ? 'border-amber-400/20 bg-amber-400/10 text-amber-300'
                  : 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
              }`}
            >
              {feedMode === 'test' ? <Beaker size={25} /> : <Radio size={25} />}
            </div>
            <div className="min-w-0">
              <p
                className={`text-xs font-black uppercase tracking-[0.22em] sm:text-sm sm:tracking-[0.3em] ${
                  feedMode === 'test' ? 'text-amber-300' : 'text-emerald-400'
                }`}
              >
                {feedMode === 'test' ? 'Test feed' : 'Live fantasy scoring'}
              </p>
              <h1 className="mt-1 text-4xl font-black tracking-tight sm:text-5xl md:text-7xl">
                Game Feed
              </h1>
            </div>
          </div>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-400 sm:mt-5 sm:text-lg sm:leading-8">
            Filter scoring plays by NFL team or favourite players. Choose your fantasy roster to colour plays by how they affect your current matchup.
          </p>

          {feedMode === 'test' && (
            <div className="mt-5 flex max-w-3xl gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
              <Beaker className="mt-0.5 shrink-0" size={17} />
              <p>This league is displaying test events only. Public events remain hidden.</p>
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

      <section className="mx-auto min-w-0 max-w-5xl px-3 py-5 sm:px-4 sm:py-8">
        <GameFeedClient
          key={`${feedMode}:${selectedSeason}:${selectedWeek}`}
          leagueId={leagueId}
          season={String(selectedSeason)}
          week={selectedWeek}
          feedMode={feedMode}
          initialEvents={(eventsResult.data || []) as GameFeedEvent[]}
          initialTotal={eventsResult.count || 0}
          teams={teams}
          matchupRows={(matchupsResult.data || []) as GameFeedMatchupRow[]}
          initialRosterId={autoRoster ? Number(autoRoster.sleeper_roster_id) : null}
        />
      </section>
    </main>
  )
}
