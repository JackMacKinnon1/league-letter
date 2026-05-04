import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { createClient } from '@/lib/supabase/server'
import { ChevronDown, Crown } from 'lucide-react'

export default async function PreviousWinnersPage({
  params,
}: {
  params: Promise<{ leagueId: string }>
}) {
  const { leagueId } = await params
  const supabase = await createClient()

  const { data: league } = await supabase
    .from('leagues')
    .select('*')
    .eq('id', leagueId)
    .single()

  const { data: seasonWinners } = await supabase
    .from('season_winners')
    .select('*')
    .eq('league_id', leagueId)
    .order('season', { ascending: false })

  const seasonSections: any[] = []
  const allPlayerIds = new Set<string>()

  for (const winner of seasonWinners || []) {
    const rosterIds = [
      winner.champion_roster_id,
      winner.runner_up_roster_id,
    ].filter(Boolean)

    const { data: matchupRows } = await supabase
      .from('matchups')
      .select('*')
      .eq('league_id', leagueId)
      .eq('season', winner.season)
      .eq('week', winner.championship_week)
      .in('sleeper_roster_id', rosterIds)

    const championMatchup = matchupRows?.find(
      (row: any) =>
        Number(row.sleeper_roster_id) === Number(winner.champion_roster_id)
    )

    const runnerUpMatchup = matchupRows?.find(
      (row: any) =>
        Number(row.sleeper_roster_id) === Number(winner.runner_up_roster_id)
    )

    for (const playerId of championMatchup?.players || []) {
      if (playerId) allPlayerIds.add(playerId)
    }

    for (const playerId of runnerUpMatchup?.players || []) {
      if (playerId) allPlayerIds.add(playerId)
    }

    seasonSections.push({
      winner,
      championMatchup,
      runnerUpMatchup,
    })
  }

  let localPlayers: any[] = []

  if (allPlayerIds.size > 0) {
    const { data } = await supabase
      .from('players')
      .select('*')
      .in('id', Array.from(allPlayerIds))

    localPlayers = data || []
  }

  const playersById = new Map<string, any>()

  for (const player of localPlayers || []) {
    playersById.set(player.id, player)
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <Navbar />

      <section className="border-b border-zinc-800 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.25),_transparent_35%),linear-gradient(to_bottom,_#064e3b,_#09090b)] px-4 py-12">
        <div className="mx-auto max-w-7xl">
          <Link
            href={`/league/${leagueId}`}
            className="text-sm font-bold text-zinc-300 hover:text-white"
          >
            ← Back to league
          </Link>

          <p className="mt-8 text-sm font-black uppercase tracking-[0.35em] text-emerald-300">
            League History
          </p>

          <h1 className="mt-4 text-5xl font-black tracking-tight md:text-7xl">
            Previous Winners
          </h1>

          <p className="mt-4 max-w-3xl text-lg text-zinc-300">
            Champions, championship scores, and the full title-match lineups
            from past seasons.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        {seasonSections.map((section) => (
          <SeasonWinnerCard
            key={section.winner.season}
            leagueId={leagueId}
            winner={section.winner}
            championMatchup={section.championMatchup}
            runnerUpMatchup={section.runnerUpMatchup}
            playersById={playersById}
          />
        ))}

        {!seasonSections.length && (
          <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-8 text-zinc-400">
            No historical winners found yet. Sync Sleeper data from the admin
            page first.
          </div>
        )}
      </section>
    </main>
  )
}

function SeasonWinnerCard({
  leagueId,
  winner,
  championMatchup,
  runnerUpMatchup,
  playersById,
}: {
  leagueId: string
  winner: any
  championMatchup: any
  runnerUpMatchup: any
  playersById: Map<string, any>
}) {
  const championStarters = buildStarterRows(championMatchup, playersById)
  const runnerUpStarters = buildStarterRows(runnerUpMatchup, playersById)

  const championBench = buildBenchRows(championMatchup, playersById)
  const runnerUpBench = buildBenchRows(runnerUpMatchup, playersById)

  const totalStarterRows = Math.max(
    championStarters.length,
    runnerUpStarters.length
  )

  return (
    <details className="group rounded-[2rem] border border-zinc-800 bg-zinc-900 open:border-emerald-900/70">
      <summary className="list-none cursor-pointer p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <p className="text-sm font-black uppercase tracking-[0.3em] text-emerald-400">
                Season {winner.season}
              </p>

              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-950 text-zinc-400 transition group-open:rotate-180 group-open:text-emerald-400">
                <ChevronDown size={18} />
              </div>
            </div>

            <h2 className="mt-3 flex items-center gap-3 text-3xl font-black md:text-5xl">
              <Crown className="text-emerald-400" size={30} />
              <span className="truncate">{winner.champion_team_name}</span>
            </h2>

            <p className="mt-3 text-zinc-400">
              Defeated {winner.runner_up_team_name} in the championship · Week{' '}
              {winner.championship_week}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[520px]">
            <div className="rounded-2xl bg-zinc-950 p-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">
                Champion
              </p>
              <p className="mt-2 text-xl font-black">
                {winner.champion_team_name}
              </p>
              <p className="mt-2 text-4xl font-black text-emerald-400">
                {Number(winner.champion_points || 0).toFixed(2)}
              </p>
            </div>

            <div className="rounded-2xl bg-zinc-950 p-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">
                Runner-Up
              </p>
              <p className="mt-2 text-xl font-black">
                {winner.runner_up_team_name}
              </p>
              <p className="mt-2 text-4xl font-black text-zinc-300">
                {Number(winner.runner_up_points || 0).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </summary>

      <div className="border-t border-zinc-800 px-6 pb-6">
        <div className="mt-6 rounded-[1.5rem] border border-zinc-800 bg-zinc-950 p-5">
          <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
            <ChampionshipHeader
              leagueId={leagueId}
              rosterId={winner.champion_roster_id}
              teamName={winner.champion_team_name}
              points={winner.champion_points}
              align="left"
            />

            <div className="text-center text-2xl font-black text-zinc-500">
              VS
            </div>

            <ChampionshipHeader
              leagueId={leagueId}
              rosterId={winner.runner_up_roster_id}
              teamName={winner.runner_up_team_name}
              points={winner.runner_up_points}
              align="right"
            />
          </div>

          <div className="mt-8">
            <h3 className="text-2xl font-black">Starters</h3>

            <div className="mt-5 space-y-3">
              {Array.from({ length: totalStarterRows }, (_, index) => {
                const leftPlayer = championStarters[index]
                const rightPlayer = runnerUpStarters[index]

                return (
                  <StarterHeadToHeadRow
                    key={`${winner.season}-starter-${index}`}
                    leftPlayer={leftPlayer}
                    rightPlayer={rightPlayer}
                  />
                )
              })}

              {!totalStarterRows && (
                <p className="text-zinc-400">
                  No starter data found for this championship matchup.
                </p>
              )}
            </div>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <RosterColumn
              title={`${winner.champion_team_name} Bench`}
              players={championBench}
            />

            <RosterColumn
              title={`${winner.runner_up_team_name} Bench`}
              players={runnerUpBench}
            />
          </div>
        </div>
      </div>
    </details>
  )
}

function ChampionshipHeader({
  leagueId,
  rosterId,
  teamName,
  points,
  align,
}: {
  leagueId: string
  rosterId: number
  teamName: string
  points: number
  align: 'left' | 'right'
}) {
  return (
    <div
      className={`rounded-3xl border border-zinc-800 bg-zinc-900 p-5 ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      <Link
        href={`/league/${leagueId}/teams/${rosterId}`}
        className="text-2xl font-black hover:text-emerald-400"
      >
        {teamName}
      </Link>

      <p className="mt-3 text-5xl font-black text-emerald-400">
        {Number(points || 0).toFixed(2)}
      </p>

      <p className="mt-2 text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
        Roster {rosterId}
      </p>
    </div>
  )
}

function StarterHeadToHeadRow({
  leftPlayer,
  rightPlayer,
}: {
  leftPlayer: any
  rightPlayer: any
}) {
  const middleLabel =
    leftPlayer?.position || rightPlayer?.position || 'FLEX'

  return (
    <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
      <PlayerMatchupCard player={leftPlayer} align="left" />

      <div className="mx-auto flex h-10 min-w-10 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 px-3 text-xs font-black uppercase tracking-[0.2em] text-emerald-400">
        {middleLabel}
      </div>

      <PlayerMatchupCard player={rightPlayer} align="right" />
    </div>
  )
}

function PlayerMatchupCard({
  player,
  align,
}: {
  player: any
  align: 'left' | 'right'
}) {
  return (
    <div
      className={`rounded-2xl border border-zinc-800 bg-zinc-900 p-4 ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {player ? (
        <>
          <p className="font-black">{player.name}</p>
          <p className="mt-1 text-sm text-zinc-500">
            {player.position} · {player.team}
          </p>
          <p className="mt-3 text-2xl font-black text-emerald-400">
            {Number(player.points || 0).toFixed(2)}
          </p>
        </>
      ) : (
        <p className="text-zinc-500">No player</p>
      )}
    </div>
  )
}

function RosterColumn({
  title,
  players,
}: {
  title: string
  players: any[]
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <h3 className="text-xl font-black">{title}</h3>

      <div className="mt-4 space-y-2">
        {players.map((player) => (
          <div
            key={player.id}
            className="flex items-center justify-between rounded-xl bg-zinc-950 p-3"
          >
            <div>
              <p className="font-bold">{player.name}</p>
              <p className="text-sm text-zinc-500">
                {player.position} · {player.team}
              </p>
            </div>

            <p className="font-black text-emerald-400">
              {Number(player.points || 0).toFixed(2)}
            </p>
          </div>
        ))}

        {!players.length && (
          <p className="text-zinc-400">No bench players found.</p>
        )}
      </div>
    </div>
  )
}

function buildStarterRows(matchupRow: any, playersById: Map<string, any>) {
  if (!matchupRow?.starters?.length) return []

  return matchupRow.starters.map((playerId: string) => {
    const player = playersById.get(playerId)
    const points = matchupRow?.players_points?.[playerId] ?? 0

    return {
      id: playerId,
      name: player?.full_name || playerId,
      position: player?.position || '—',
      team: player?.team || 'FA',
      points,
    }
  })
}

function buildBenchRows(matchupRow: any, playersById: Map<string, any>) {
  if (!matchupRow?.players?.length) return []

  const starterSet = new Set(matchupRow.starters || [])

  return matchupRow.players
    .filter((playerId: string) => playerId && !starterSet.has(playerId))
    .map((playerId: string) => {
      const player = playersById.get(playerId)
      const points = matchupRow?.players_points?.[playerId] ?? 0

      return {
        id: playerId,
        name: player?.full_name || playerId,
        position: player?.position || '—',
        team: player?.team || 'FA',
        points,
      }
    })
}