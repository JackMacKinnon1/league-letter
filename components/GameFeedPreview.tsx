'use client'

import GameFeedPlayerImage from '@/components/GameFeedPlayerImage'
import Link from '@/components/NoPrefetchLink'
import {
  formatFantasyDelta,
  type GameFeedEvent,
  type GameFeedLeagueTeam,
  type GameFeedMatchupRow,
} from '@/lib/gameFeed'
import { Beaker, Radio } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

export default function GameFeedPreview({
  leagueId,
  season,
  week,
  feedMode,
  events,
  teams,
  matchupRows,
  initialRosterId,
}: {
  leagueId: string
  season: string
  week: number
  feedMode: 'public' | 'test'
  events: GameFeedEvent[]
  teams: GameFeedLeagueTeam[]
  matchupRows: GameFeedMatchupRow[]
  initialRosterId: number | null
}) {
  const isTest = feedMode === 'test'
  const rosterStorageKey = `game-feed:${leagueId}:my-roster`
  const [selectedRosterId, setSelectedRosterId] = useState(
    initialRosterId ? String(initialRosterId) : ''
  )

  useEffect(() => {
    const savedRoster = window.localStorage.getItem(rosterStorageKey)
    if (savedRoster && teams.some((team) => String(team.sleeper_roster_id) === savedRoster)) {
      setSelectedRosterId(savedRoster)
    }
  }, [rosterStorageKey, teams])

  const selectedTeam = useMemo(
    () => teams.find((team) => String(team.sleeper_roster_id) === selectedRosterId) || null,
    [selectedRosterId, teams]
  )
  const opponentTeam = useMemo(() => {
    if (!selectedTeam) return null
    const selectedMatchup = matchupRows.find(
      (row) => Number(row.sleeper_roster_id) === Number(selectedTeam.sleeper_roster_id)
    )
    if (selectedMatchup?.matchup_id === null || selectedMatchup?.matchup_id === undefined) return null
    const opponent = matchupRows.find(
      (row) =>
        Number(row.matchup_id) === Number(selectedMatchup.matchup_id) &&
        Number(row.sleeper_roster_id) !== Number(selectedTeam.sleeper_roster_id)
    )
    return teams.find(
      (team) => Number(team.sleeper_roster_id) === Number(opponent?.sleeper_roster_id)
    ) || null
  }, [matchupRows, selectedTeam, teams])
  const myPlayerIds = useMemo(() => new Set(selectedTeam?.players || []), [selectedTeam])
  const opponentPlayerIds = useMemo(() => new Set(opponentTeam?.players || []), [opponentTeam])

  return (
    <section className="min-w-0 overflow-hidden rounded-[1.5rem] border border-zinc-800 bg-zinc-900 p-4 sm:rounded-[2rem] sm:p-6">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border sm:h-11 sm:w-11 sm:rounded-2xl ${
              isTest
                ? 'border-amber-400/20 bg-amber-400/10 text-amber-300'
                : 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
            }`}
          >
            {isTest ? <Beaker size={20} /> : <Radio size={20} />}
          </div>
          <div className="min-w-0">
            <p
              className={`text-xs font-black uppercase tracking-[0.24em] ${
                isTest ? 'text-amber-300' : 'text-emerald-400'
              }`}
            >
              {isTest ? 'Test scoring' : 'Live scoring'}
            </p>
            <h2 className="text-2xl font-black sm:text-3xl">Game Feed</h2>
          </div>
        </div>

        <Link
          href={`/league/${leagueId}/game-feed?season=${season}&week=${week}`}
          className={`shrink-0 whitespace-nowrap text-xs font-black sm:text-sm ${
            isTest
              ? 'text-amber-300 hover:text-amber-200'
              : 'text-emerald-400 hover:text-emerald-300'
          }`}
        >
          Open feed →
        </Link>
      </div>

      {isTest && (
        <p className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs font-bold text-amber-100">
          This league is showing test cells only. Public events are hidden.
        </p>
      )}

      {selectedTeam && (
        <p className="mt-4 text-xs font-bold text-zinc-500">
          Matchup colours are based on {selectedTeam.team_name}
          {opponentTeam ? ` versus ${opponentTeam.team_name}.` : '.'}
        </p>
      )}

      <div className="mt-4 space-y-2.5 sm:mt-5 sm:space-y-3">
        {events.map((event) => {
          const impact = matchupImpact(event, myPlayerIds, opponentPlayerIds)
          const tone = impact > 0
            ? 'border-emerald-400/45 bg-emerald-950/25 shadow-[inset_4px_0_0_rgba(52,211,153,0.85)]'
            : impact < 0
              ? 'border-red-400/45 bg-red-950/25 shadow-[inset_4px_0_0_rgba(248,113,113,0.85)]'
              : 'border-zinc-800 bg-zinc-950 hover:border-zinc-600'

          return (
            <Link
              key={event.id}
              href={`/league/${leagueId}/players/${event.primary_player_id}?season=${event.season}&week=${event.week}`}
              className={`flex min-w-0 items-center gap-2.5 rounded-xl border p-2.5 transition sm:gap-3 sm:rounded-2xl sm:p-3 ${tone}`}
            >
              <GameFeedPlayerImage
                event={event}
                leagueId={leagueId}
                size="preview"
                interactive={false}
              />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black sm:text-base">{event.description}</p>
                <p className="truncate text-xs text-zinc-500">
                  {event.primary_player_name}
                  {event.secondary_player_name
                    ? ` · from ${event.secondary_player_name}`
                    : ''}
                </p>
              </div>

              {event.feed_mode === 'test' && (
                <span className="hidden rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-[10px] font-black text-amber-300 sm:inline-flex">
                  TEST
                </span>
              )}

              <p
                className={`shrink-0 text-sm font-black sm:text-base ${
                  Number(event.primary_fantasy_delta) >= 0
                    ? 'text-emerald-400'
                    : 'text-red-400'
                }`}
              >
                {formatFantasyDelta(event.primary_fantasy_delta)}
              </p>
            </Link>
          )
        })}

        {!events.length && (
          <div className="rounded-2xl border border-dashed border-zinc-700 px-5 py-8 text-center text-sm text-zinc-500">
            {isTest
              ? 'Start the worker in Test mode and choose to add sample feed cells.'
              : 'The first public worker poll seeds player totals. New fantasy-point changes will appear here.'}
          </div>
        )}
      </div>
    </section>
  )
}

function matchupImpact(
  event: GameFeedEvent,
  myPlayerIds: Set<string>,
  opponentPlayerIds: Set<string>
) {
  let impact = 0
  const primaryDelta = Number(event.primary_fantasy_delta || 0)
  const secondaryDelta = Number(event.secondary_fantasy_delta || 0)
  if (myPlayerIds.has(event.primary_player_id)) impact += primaryDelta
  if (opponentPlayerIds.has(event.primary_player_id)) impact -= primaryDelta
  if (event.secondary_player_id && myPlayerIds.has(event.secondary_player_id)) impact += secondaryDelta
  if (event.secondary_player_id && opponentPlayerIds.has(event.secondary_player_id)) impact -= secondaryDelta
  return impact
}
