'use client'

import Link from '@/components/NoPrefetchLink'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Activity } from 'lucide-react'

type LiveMatchupsPanelProps = {
  leagueId: string
  selectedSeason: string
  selectedWeek: number
  initialMatchups: any[]
  initialTeams: any[]
  compact?: boolean
  limit?: number
  showHeader?: boolean
  pollLiveScores?: boolean
}


export default function LiveMatchupsPanel({
  leagueId,
  selectedSeason,
  selectedWeek,
  initialMatchups,
  initialTeams,
  compact = false,
  limit,
  showHeader = true,
  pollLiveScores = false,
}: LiveMatchupsPanelProps) {
  const [matchups, setMatchups] = useState<any[]>(initialMatchups || [])
  const [teams, setTeams] = useState<any[]>(initialTeams || [])
  const [isChecking, setIsChecking] = useState(false)
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null)
  const [changedRosterIds, setChangedRosterIds] = useState<Set<number>>(new Set())
  const [statusMessage, setStatusMessage] = useState(
    pollLiveScores
      ? 'These matchup cards use the latest normal league sync. The global Game Feed worker only collects player scoring events.'
      : 'Live score updates are paused outside the Sleeper season.'
  )
  const [glowVersion, setGlowVersion] = useState(0)
  const previousPointsRef = useRef<Map<number, number>>(buildPointsMap(initialMatchups || []))

  const groupedMatchups = useMemo(() => groupMatchups(matchups), [matchups])
  const visibleEntries = useMemo(() => {
    const entries = Object.entries(groupedMatchups)
    return typeof limit === 'number' ? entries.slice(0, limit) : entries
  }, [groupedMatchups, limit])

  const teamByRosterId = useMemo(() => {
    const map = new Map<number, any>()
    for (const team of teams || []) {
      map.set(Number(team.sleeper_roster_id), team)
    }
    return map
  }, [teams])

  const refreshMatchups = useCallback(async (mode: 'auto' | 'manual' = 'auto') => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return

    setIsChecking(true)

    try {
      const params = new URLSearchParams({
        season: selectedSeason,
        week: String(selectedWeek),
      })

      const response = await fetch(
        `/api/league/${leagueId}/live-matchups?${params.toString()}`,
        { cache: 'no-store' }
      )

      if (!response.ok) {
        setStatusMessage('Could not check for score changes. The page stayed as-is.')
        return
      }

      const json = await response.json()
      const nextMatchups = json.matchups || []
      const nextPoints = buildPointsMap(nextMatchups)
      const changed = new Set<number>()

      for (const [rosterId, nextPointTotal] of nextPoints.entries()) {
        const previousPointTotal = previousPointsRef.current.get(rosterId)
        if (
          previousPointTotal !== undefined &&
          Math.abs(Number(nextPointTotal) - Number(previousPointTotal)) >= 0.01
        ) {
          changed.add(rosterId)
        }
      }


      previousPointsRef.current = nextPoints
      setMatchups(nextMatchups)
      setTeams(json.teams || teams)
      setLastCheckedAt(new Date())
      setChangedRosterIds(changed)
      setStatusMessage(
        json.globalFeedOnly
          ? 'These matchup cards use the latest normal league sync. The single-source Game Feed worker does not poll each league.'
          : !json.feedEnabled
            ? 'Game Feed collection is disabled for this league.'
            : json.synced
              ? 'Live scores refreshed from Supabase.'
              : 'Stored matchup scores are still available.'
      )

      if (changed.size) {
        setGlowVersion((version) => version + 1)
      }
    } catch {
      setStatusMessage('Could not check for score changes. The page stayed as-is.')
    } finally {
      setIsChecking(false)
    }
  }, [leagueId, selectedSeason, selectedWeek, teams])

  useEffect(() => {
    if (!pollLiveScores) return

    const intervalId = window.setInterval(() => {
      void refreshMatchups('auto')
    }, 15_000)

    return () => window.clearInterval(intervalId)
  }, [pollLiveScores, refreshMatchups])

  return (
    <section className={compact ? '' : 'rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6'}>
      {showHeader && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-zinc-500">
              Season {selectedSeason} · Week {selectedWeek}
            </p>
            <h2 className="text-3xl font-black">Matchups</h2>
            <p className="mt-2 text-sm text-zinc-500">{statusMessage}</p>
            {lastCheckedAt && (
              <p className="mt-1 text-xs text-zinc-600">
                Last checked {lastCheckedAt.toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>
      )}

      {isChecking && (
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-zinc-800">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-emerald-400" />
        </div>
      )}

      <div className={`mt-5 grid gap-4 ${compact ? 'md:grid-cols-2' : 'lg:grid-cols-2'}`}>
        {visibleEntries.map(([matchupId, matchupTeams]) => (
          <LiveMatchupCard
            key={matchupId}
            matchupId={matchupId}
            teams={matchupTeams}
            leagueId={leagueId}
            selectedSeason={selectedSeason}
            teamByRosterId={teamByRosterId}
            changedRosterIds={changedRosterIds}
            glowVersion={glowVersion}
          />
        ))}

        {!matchups?.length && (
          <div className="rounded-[2rem] border border-zinc-800 bg-zinc-950 p-8 text-zinc-400">
            No matchup data found for this season/week.
          </div>
        )}
      </div>
    </section>
  )
}

function LiveMatchupCard({
  matchupId,
  teams,
  leagueId,
  selectedSeason,
  teamByRosterId,
  changedRosterIds,
  glowVersion,
}: {
  matchupId: string
  teams: any[]
  leagueId: string
  selectedSeason: string
  teamByRosterId: Map<number, any>
  changedRosterIds: Set<number>
  glowVersion: number
}) {
  const first = teams[0]
  const second = teams[1]
  const firstProfile = first ? teamByRosterId.get(Number(first.sleeper_roster_id)) : null
  const secondProfile = second ? teamByRosterId.get(Number(second.sleeper_roster_id)) : null
  const prediction = firstProfile && secondProfile ? calculateWinChances(firstProfile, secondProfile) : null

  return (
    <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
      {prediction && (
        <WinChanceBar
          firstLabel={first?.team_name || 'Team A'}
          secondLabel={second?.team_name || 'Team B'}
          firstChance={prediction.firstChance}
          secondChance={prediction.secondChance}
          className="mb-4"
        />
      )}

      <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
        Matchup {String(matchupId).replace('solo-', '')}
      </p>

      <LiveTeamRow
        key={`first-${Number(first?.sleeper_roster_id)}-${changedRosterIds.has(Number(first?.sleeper_roster_id)) ? glowVersion : 0}`}
        team={first}
        leagueId={leagueId}
        selectedSeason={selectedSeason}
        changed={changedRosterIds.has(Number(first?.sleeper_roster_id))}
      />

      <div className="my-3 border-t border-zinc-800" />

      {second ? (
        <LiveTeamRow
          key={`second-${Number(second?.sleeper_roster_id)}-${changedRosterIds.has(Number(second?.sleeper_roster_id)) ? glowVersion : 0}`}
          team={second}
          leagueId={leagueId}
          selectedSeason={selectedSeason}
          changed={changedRosterIds.has(Number(second?.sleeper_roster_id))}
        />
      ) : (
        <p className="text-sm text-zinc-500">No opponent found</p>
      )}

      {prediction && (
        <p className="mt-4 flex items-center gap-2 text-xs leading-5 text-zinc-500">
          <Activity size={13} />
          Projected using last season average points/week and weekly volatility.
        </p>
      )}
    </div>
  )
}

function LiveTeamRow({
  team,
  leagueId,
  selectedSeason,
  changed,
}: {
  team: any
  leagueId: string
  selectedSeason: string
  changed: boolean
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl p-2 transition-all duration-500 ${
        changed ? 'score-update-glow' : ''
      }`}
    >
      <div className="min-w-0">
        <Link
          href={`/league/${leagueId}/teams/${team?.sleeper_roster_id}?season=${selectedSeason}`}
          className="block truncate font-black hover:text-emerald-400"
        >
          {team?.team_name || 'Unknown Team'}
        </Link>
        <p className="text-xs text-zinc-500">Roster {team?.sleeper_roster_id}</p>
      </div>

      <p className="shrink-0 text-2xl font-black text-emerald-400">
        {Number(team?.points || 0).toFixed(2)}
      </p>
    </div>
  )
}

function WinChanceBar({
  firstLabel,
  secondLabel,
  firstChance,
  secondChance,
  className = '',
}: {
  firstLabel: string
  secondLabel: string
  firstChance: number
  secondChance: number
  className?: string
}) {
  const firstWidth = clampChance(firstChance)
  const secondWidth = clampChance(secondChance)

  return (
    <div className={`overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 ${className}`}>
      <div className="flex h-24 w-full overflow-hidden">
        <div
          className="relative flex min-w-0 flex-col justify-center overflow-hidden bg-emerald-500/15 px-3 text-emerald-300"
          style={{ width: `${firstWidth}%`, flexBasis: `${firstWidth}%` }}
          title={`${firstLabel}: ${firstChance.toFixed(1)}%`}
        >
          <div className="absolute inset-0 bg-emerald-500/10" />
          <div className="relative min-w-[4rem]">
            <p className="truncate text-xs font-bold uppercase tracking-[0.2em]">{firstLabel}</p>
            <p className="mt-1 text-2xl font-black">{firstChance.toFixed(1)}%</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-70">Win chance</p>
          </div>
        </div>

        <div
          className="relative flex min-w-0 flex-col justify-center overflow-hidden bg-red-500/10 px-3 text-red-300"
          style={{ width: `${secondWidth}%`, flexBasis: `${secondWidth}%` }}
          title={`${secondLabel}: ${secondChance.toFixed(1)}%`}
        >
          <div className="absolute inset-0 bg-red-500/10" />
          <div className="relative min-w-[4rem]">
            <p className="truncate text-xs font-bold uppercase tracking-[0.2em]">{secondLabel}</p>
            <p className="mt-1 text-2xl font-black">{secondChance.toFixed(1)}%</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-70">Win chance</p>
          </div>
        </div>
      </div>

      <div className="h-1.5 w-full bg-red-500/20">
        <div className="h-full bg-emerald-400 transition-all duration-500" style={{ width: `${firstWidth}%` }} />
      </div>
    </div>
  )
}

function groupMatchups(matchups: any[]) {
  return matchups.reduce((acc: Record<string, any[]>, matchup: any) => {
    const key =
      matchup.matchup_id !== null && matchup.matchup_id !== undefined
        ? String(matchup.matchup_id)
        : `solo-${matchup.sleeper_roster_id}`

    if (!acc[key]) acc[key] = []
    acc[key].push(matchup)
    return acc
  }, {})
}

function buildPointsMap(matchups: any[]) {
  const map = new Map<number, number>()
  for (const matchup of matchups || []) {
    map.set(Number(matchup.sleeper_roster_id), Number(matchup.points || 0))
  }
  return map
}

function calculateWinChances(firstTeam: any, secondTeam: any) {
  const firstAvg = Number(firstTeam.avg_points_per_week)
  const secondAvg = Number(secondTeam.avg_points_per_week)
  const firstSd = Math.max(Number(firstTeam.points_std_dev || 0), 1)
  const secondSd = Math.max(Number(secondTeam.points_std_dev || 0), 1)

  if (!Number.isFinite(firstAvg) || !Number.isFinite(secondAvg)) return null

  const combinedSd = Math.sqrt(firstSd ** 2 + secondSd ** 2)
  if (!combinedSd || !Number.isFinite(combinedSd)) return null

  const z = (firstAvg - secondAvg) / combinedSd
  const firstChance = normalCdf(z) * 100

  return {
    firstChance,
    secondChance: 100 - firstChance,
  }
}

function normalCdf(z: number) {
  return 0.5 * (1 + erf(z / Math.sqrt(2)))
}

function erf(x: number) {
  const sign = x >= 0 ? 1 : -1
  const absX = Math.abs(x)
  const a1 = 0.254829592
  const a2 = -0.284496736
  const a3 = 1.421413741
  const a4 = -1.453152027
  const a5 = 1.061405429
  const p = 0.3275911
  const t = 1 / (1 + p * absX)
  const y =
    1 -
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) *
      t *
      Math.exp(-absX * absX))
  return sign * y
}

function clampChance(chance: number) {
  if (!Number.isFinite(chance)) return 50
  return Math.min(100, Math.max(0, chance))
}
