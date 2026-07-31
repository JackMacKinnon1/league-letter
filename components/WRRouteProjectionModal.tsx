'use client'

import { motion } from 'framer-motion'
import { ArrowRight, Gauge, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  formatStatValue,
  getPlayerId,
  getPlayerSeasonRow,
  getPlayerSeasonRows,
  type PlayerScoreRow,
} from '@/lib/playerScoreStats'
import { calculateWRRouteProjection, type WRRouteProjection } from '@/lib/wrRouteProjection'

type Props = {
  players: PlayerScoreRow[]
  loading: boolean
  error: string
  onClose: () => void
}

const STAT_ROWS = [
  { key: 'targets' as const, label: 'Targets' },
  { key: 'receptions' as const, label: 'Receptions' },
  { key: 'yards' as const, label: 'Receiving Yards' },
  { key: 'touchdowns' as const, label: 'Touchdowns' },
]

export default function WRRouteProjectionModal({ players, loading, error, onClose }: Props) {
  const [sourcePlayerId, setSourcePlayerId] = useState('')
  const [benchmarkPlayerId, setBenchmarkPlayerId] = useState('')
  const [sourceSeason, setSourceSeason] = useState('')
  const [benchmarkSeason, setBenchmarkSeason] = useState('')

  useEffect(() => {
    if (!players.length) return
    setSourcePlayerId((current) => current || getPlayerId(players[0]))
    setBenchmarkPlayerId((current) => current || getPlayerId(players[1] || players[0]))
  }, [players])

  const sourcePlayer = useMemo(() => players.find((player) => getPlayerId(player) === sourcePlayerId) || null, [players, sourcePlayerId])
  const benchmarkPlayer = useMemo(() => players.find((player) => getPlayerId(player) === benchmarkPlayerId) || null, [players, benchmarkPlayerId])

  useEffect(() => {
    if (!sourcePlayer) return
    setSourceSeason(getPlayerSeasonRows(sourcePlayer)[0]?.season || sourcePlayer.latest_season || '')
  }, [sourcePlayer])

  useEffect(() => {
    if (!benchmarkPlayer) return
    setBenchmarkSeason(getPlayerSeasonRows(benchmarkPlayer)[0]?.season || benchmarkPlayer.latest_season || '')
  }, [benchmarkPlayer])

  const projection = useMemo(() => {
    if (!sourcePlayer || !benchmarkPlayer) return null
    return calculateWRRouteProjection(
      getPlayerSeasonRow(sourcePlayer, sourceSeason),
      getPlayerSeasonRow(benchmarkPlayer, benchmarkSeason),
    )
  }, [sourcePlayer, benchmarkPlayer, sourceSeason, benchmarkSeason])

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-3 py-5 backdrop-blur-sm sm:px-5" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.98 }}
        transition={{ type: 'spring', damping: 24, stiffness: 220 }}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[94vh] w-full max-w-6xl overflow-hidden rounded-[2rem] border border-zinc-800 bg-zinc-950 shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-zinc-800 bg-white/[0.035] p-5 sm:p-6">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-300">Route Volume Projector</p>
            <h2 className="mt-2 text-2xl font-black text-white sm:text-3xl">Put one receiver on another player’s routes</h2>
            <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-zinc-400">
              The source receiver keeps his per-route target, catch, yardage, and touchdown rates. Only his route total changes.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-2xl border border-zinc-700 bg-zinc-950 p-3 text-zinc-300 transition hover:border-emerald-300 hover:text-white" aria-label="Close route projector">
            <X size={20} />
          </button>
        </header>

        <div className="max-h-[calc(94vh-130px)] overflow-y-auto p-5 sm:p-6">
          {loading && <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-sm font-bold text-zinc-500">Loading all receivers...</div>}
          {error && <div className="rounded-2xl border border-red-500/30 bg-red-950/30 p-5 text-sm font-bold text-red-200">{error}</div>}

          {!loading && !error && (
            <>
              <div className="grid items-stretch gap-4 lg:grid-cols-[1fr_auto_1fr]">
                <PlayerAndSeasonSelect label="Project this receiver" playerId={sourcePlayerId} season={sourceSeason} players={players} onPlayerChange={setSourcePlayerId} onSeasonChange={setSourceSeason} />
                <div className="hidden items-center justify-center lg:flex"><ArrowRight className="text-emerald-300" size={28} /></div>
                <PlayerAndSeasonSelect label="Use this player’s routes" playerId={benchmarkPlayerId} season={benchmarkSeason} players={players} onPlayerChange={setBenchmarkPlayerId} onSeasonChange={setBenchmarkSeason} />
              </div>

              {!projection ? (
                <div className="mt-5 rounded-[1.5rem] border border-dashed border-zinc-700 bg-zinc-900/60 p-8 text-center">
                  <Gauge className="mx-auto text-zinc-600" size={38} />
                  <p className="mt-4 text-lg font-black text-white">Route volume is unavailable</p>
                  <p className="mx-auto mt-2 max-w-2xl text-sm font-bold leading-6 text-zinc-500">
                    Each selected season needs either a routes-run column or both receiving yards and YPRR so routes can be derived.
                  </p>
                </div>
              ) : (
                <ProjectionResults sourcePlayer={sourcePlayer!} benchmarkPlayer={benchmarkPlayer!} sourceSeason={sourceSeason} benchmarkSeason={benchmarkSeason} projection={projection} />
              )}
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

function PlayerAndSeasonSelect({
  label,
  playerId,
  season,
  players,
  onPlayerChange,
  onSeasonChange,
}: {
  label: string
  playerId: string
  season: string
  players: PlayerScoreRow[]
  onPlayerChange: (value: string) => void
  onSeasonChange: (value: string) => void
}) {
  const [query, setQuery] = useState('')
  const [showResults, setShowResults] = useState(false)
  const player = players.find((item) => getPlayerId(item) === playerId) || null
  const seasons = player ? getPlayerSeasonRows(player) : []
  const filtered = players.filter((item) => `${item.player_name} ${item.team || ''}`.toLowerCase().includes(query.toLowerCase())).slice(0, 25)

  function selectPlayer(nextPlayer: PlayerScoreRow) {
    onPlayerChange(getPlayerId(nextPlayer))
    setQuery('')
    setShowResults(false)
  }

  return (
    <section className="relative rounded-[1.5rem] border border-zinc-800 bg-zinc-900 p-5">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">{label}</p>
      <p className="mt-2 text-xl font-black text-white">{player?.player_name || 'Choose a receiver'}</p>
      {player && <p className="mt-1 text-xs font-bold text-zinc-500">WR{player.rank} · {player.team || 'FA'} · Score {player.score}</p>}

      <div className="relative mt-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
        <input
          value={query}
          onFocus={() => setShowResults(true)}
          onChange={(event) => { setQuery(event.target.value); setShowResults(true) }}
          placeholder="Search and replace player"
          className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-2.5 pl-9 pr-3 text-sm font-bold outline-none focus:border-emerald-400"
        />
        {showResults && (
          <div className="absolute left-0 right-0 top-[calc(100%+0.4rem)] z-30 max-h-64 overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-950 p-2 shadow-2xl">
            {filtered.map((item) => (
              <button key={getPlayerId(item)} type="button" onClick={() => selectPlayer(item)} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-zinc-800">
                <span className="font-black text-white">{item.player_name}</span>
                <span className="text-xs font-bold text-zinc-500">WR{item.rank}</span>
              </button>
            ))}
            {filtered.length === 0 && <p className="p-3 text-sm font-bold text-zinc-500">No matching receivers.</p>}
          </div>
        )}
      </div>

      <select value={season} onChange={(event) => onSeasonChange(event.target.value)} className="mt-3 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm font-black outline-none focus:border-emerald-400">
        {seasons.map((row) => <option key={row.season || 'unknown'} value={row.season || ''}>{row.season || 'Unknown season'}</option>)}
      </select>
    </section>
  )
}

function ProjectionResults({
  sourcePlayer,
  benchmarkPlayer,
  sourceSeason,
  benchmarkSeason,
  projection,
}: {
  sourcePlayer: PlayerScoreRow
  benchmarkPlayer: PlayerScoreRow
  sourceSeason: string
  benchmarkSeason: string
  projection: WRRouteProjection
}) {
  return (
    <>
      <section className="mt-5 rounded-[1.5rem] border border-emerald-400/25 bg-emerald-400/[0.06] p-5">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">Projected line</p>
        <h3 className="mt-2 text-xl font-black text-white sm:text-2xl">
          {sourcePlayer.player_name} on {benchmarkPlayer.player_name}&apos;s {formatStatValue(projection.benchmarkRoutes, 0)} routes
        </h3>
        <p className="mt-2 text-sm font-bold leading-6 text-zinc-400">
          {sourcePlayer.player_name}&apos;s {sourceSeason} season had {formatStatValue(projection.sourceRoutes, 0)} routes. {benchmarkPlayer.player_name}&apos;s {benchmarkSeason} route volume is {formatStatValue(projection.benchmarkRoutes, 0)}.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STAT_ROWS.map((stat) => (
            <div key={stat.key} className="rounded-2xl border border-emerald-400/25 bg-zinc-950 p-4">
              <p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-zinc-500">Projected {stat.label}</p>
              <p className="mt-2 text-3xl font-black text-emerald-300">{formatStatValue(projection.projected[stat.key], stat.key === 'yards' ? 0 : 1)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-5 overflow-hidden rounded-[1.5rem] border border-zinc-800 bg-zinc-900">
        <div className="border-b border-zinc-800 p-5">
          <h3 className="text-xl font-black text-white">Actual vs route-adjusted production</h3>
          <p className="mt-1 text-sm font-bold text-zinc-500">Rates are calculated per route from the source receiver’s selected season.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="bg-zinc-950 text-xs uppercase tracking-[0.15em] text-zinc-500">
              <tr><th className="px-5 py-3">Stat</th><th className="px-5 py-3">Actual</th><th className="px-5 py-3">Per Route</th><th className="px-5 py-3">Projected</th><th className="px-5 py-3">Change</th></tr>
            </thead>
            <tbody>
              {STAT_ROWS.map((stat) => {
                const actual = projection.actual[stat.key]
                const projected = projection.projected[stat.key]
                const change = actual !== null && projected !== null ? projected - actual : null
                return (
                  <tr key={stat.key} className="border-t border-zinc-800">
                    <td className="px-5 py-4 font-black text-zinc-300">{stat.label}</td>
                    <td className="px-5 py-4 font-black text-white">{formatStatValue(actual, stat.key === 'yards' ? 0 : 1)}</td>
                    <td className="px-5 py-4 font-bold text-zinc-400">{formatStatValue(projection.rates[stat.key], 4)}</td>
                    <td className="px-5 py-4 font-black text-emerald-300">{formatStatValue(projected, stat.key === 'yards' ? 0 : 1)}</td>
                    <td className={`px-5 py-4 font-black ${change !== null && change >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{change === null ? '—' : `${change >= 0 ? '+' : ''}${formatStatValue(change, stat.key === 'yards' ? 0 : 1)}`}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <p className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-xs font-bold leading-5 text-zinc-500">
        Routes were {projection.routeSource === 'derived' ? 'derived from YDS ÷ YPRR' : 'read from the uploaded routes column'} for {sourcePlayer.player_name}, and {projection.benchmarkRouteSource === 'derived' ? 'derived from YDS ÷ YPRR' : 'read from the uploaded routes column'} for {benchmarkPlayer.player_name}. This is a volume-normalized estimate, not a forecast of how team context or efficiency would change.
      </p>
    </>
  )
}
