import Link from '@/components/NoPrefetchLink'
import Navbar from '@/components/Navbar'
import LeagueWeekSelector from '@/components/LeagueWeekSelector'
import LiveMatchupsPanel from '@/components/LiveMatchupsPanel'
import { createClient } from '@/lib/supabase/server'

export default async function MatchupsPage({
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
    .single()

  const { data: matchupSeasonRows } = await supabase
    .from('matchups')
    .select('season')
    .eq('league_id', leagueId)
    .not('season', 'is', null)

  const availableSeasons = Array.from(
    new Set((matchupSeasonRows || []).map((row: any) => String(row.season)))
  ).sort((a, b) => Number(b) - Number(a))

  const selectedSeason =
    season ||
    league?.season ||
    availableSeasons[0] ||
    String(new Date().getFullYear())

  const selectedWeek = Math.max(Number(week || league?.current_week || 1), 1)
  const pollLiveScores =
    String(league?.status || '').toLowerCase() === 'in_season' &&
    String(selectedSeason) === String(league?.season || '')

  const { data: matchups } = await supabase
    .from('matchups')
    .select('*')
    .eq('league_id', leagueId)
    .eq('season', selectedSeason)
    .eq('week', selectedWeek)
    .order('matchup_id', { ascending: true })

  const { data: teams } = await supabase
    .from('teams')
    .select('*')
    .eq('league_id', leagueId)

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <Navbar />

      <section className="border-b border-zinc-800 bg-white/[0.015] px-4 py-12">
        <div className="mx-auto max-w-7xl">
          <Link
            href={`/league/${leagueId}?season=${selectedSeason}&week=${selectedWeek}`}
            className="text-sm font-bold text-zinc-300 hover:text-white"
          >
            ← Back to league
          </Link>

          <p className="mt-8 text-sm font-black uppercase tracking-[0.35em] text-emerald-300">
            Matchup Center
          </p>

          <h1 className="mt-4 text-5xl font-black tracking-tight md:text-7xl">
            {league?.name} Matchups
          </h1>

          <p className="mt-4 text-lg text-zinc-300">
            Season {selectedSeason} · Week {selectedWeek}
          </p>

          <Link
            href={`/league/${leagueId}/game-feed?season=${selectedSeason}&week=${selectedWeek}`}
            className="mt-5 inline-flex rounded-2xl bg-emerald-500 px-5 py-3 font-black text-zinc-950 hover:bg-emerald-400"
          >
            Open Game Feed
          </Link>

          <LeagueWeekSelector
            leagueId={leagueId}
            seasons={availableSeasons.length ? availableSeasons : [selectedSeason]}
            selectedSeason={selectedSeason}
            selectedWeek={selectedWeek}
          />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8">
        <LiveMatchupsPanel
          leagueId={leagueId}
          selectedSeason={selectedSeason}
          selectedWeek={selectedWeek}
          initialMatchups={matchups || []}
          initialTeams={teams || []}
          pollLiveScores={pollLiveScores}
        />
      </section>
    </main>
  )
}
