import Link from 'next/link'
import Navbar from '@/components/Navbar'
import LeagueWeekSelector from '@/components/LeagueWeekSelector'
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

  const { data: matchups } = await supabase
    .from('matchups')
    .select('*')
    .eq('league_id', leagueId)
    .eq('season', selectedSeason)
    .eq('week', selectedWeek)
    .order('matchup_id', { ascending: true })

  const groupedMatchups =
    matchups?.reduce((acc: Record<string, any[]>, matchup: any) => {
      const key =
        matchup.matchup_id !== null && matchup.matchup_id !== undefined
          ? String(matchup.matchup_id)
          : `solo-${matchup.sleeper_roster_id}`

      if (!acc[key]) acc[key] = []
      acc[key].push(matchup)

      return acc
    }, {}) || {}

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <Navbar />

      <section className="border-b border-zinc-800 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.25),_transparent_35%),linear-gradient(to_bottom,_#064e3b,_#09090b)] px-4 py-12">
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

          <LeagueWeekSelector
            leagueId={leagueId}
            seasons={availableSeasons.length ? availableSeasons : [selectedSeason]}
            selectedSeason={selectedSeason}
            selectedWeek={selectedWeek}
          />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-5 lg:grid-cols-2">
          {Object.entries(groupedMatchups).map(([matchupId, teams]) => (
            <MatchupCard
              key={matchupId}
              leagueId={leagueId}
              selectedSeason={selectedSeason}
              matchupId={matchupId}
              teams={teams}
            />
          ))}

          {!matchups?.length && (
            <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-8 text-zinc-400">
              No matchups found for this season/week.
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

function MatchupCard({
  leagueId,
  selectedSeason,
  matchupId,
  teams,
}: {
  leagueId: string
  selectedSeason: string
  matchupId: string
  teams: any[]
}) {
  const first = teams[0]
  const second = teams[1]

  return (
    <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
      <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-400">
        Matchup {matchupId.replace('solo-', '')}
      </p>

      <div className="mt-5 space-y-4">
        <TeamRow
          leagueId={leagueId}
          selectedSeason={selectedSeason}
          team={first}
        />

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-zinc-800" />
          <p className="text-sm font-black text-zinc-500">VS</p>
          <div className="h-px flex-1 bg-zinc-800" />
        </div>

        {second ? (
          <TeamRow
            leagueId={leagueId}
            selectedSeason={selectedSeason}
            team={second}
          />
        ) : (
          <p className="rounded-2xl bg-zinc-950 p-4 text-sm text-zinc-500">
            No opponent found.
          </p>
        )}
      </div>
    </div>
  )
}

function TeamRow({
  leagueId,
  selectedSeason,
  team,
}: {
  leagueId: string
  selectedSeason: string
  team: any
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-zinc-950 p-5">
      <div>
        <Link
          href={`/league/${leagueId}/teams/${team?.sleeper_roster_id}?season=${selectedSeason}`}
          className="text-xl font-black hover:text-emerald-400"
        >
          {team?.team_name || 'Unknown Team'}
        </Link>

        <p className="mt-1 text-sm text-zinc-500">
          Roster {team?.sleeper_roster_id}
        </p>
      </div>

      <p className="text-4xl font-black text-emerald-400">
        {Number(team?.points || 0).toFixed(2)}
      </p>
    </div>
  )
}