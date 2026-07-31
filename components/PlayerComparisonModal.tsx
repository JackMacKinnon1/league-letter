'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Check, Search, Users, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  formatStatValue,
  getPlayerId,
  getPlayerSeasonRow,
  getPlayerSeasonRows,
  getRouteVolume,
  getStatValue,
  toStatNumber,
  type PlayerScoreRow,
} from '@/lib/playerScoreStats'

type Props = {
  players: PlayerScoreRow[]
  loading: boolean
  error: string
  onClose: () => void
}

type ComparisonMetric = {
  label: string
  aliases?: string[]
  value?: (player: PlayerScoreRow, season: string | null) => any
  lowerIsBetter?: boolean
  decimals?: number
}

const MAX_PLAYERS = 4

const METRICS: ComparisonMetric[] = [
  { label: 'Dynasty Score', value: (player) => player.score, decimals: 0 },
  { label: 'Rank', value: (player) => player.rank, lowerIsBetter: true, decimals: 0 },
  { label: 'Games', aliases: ['G', 'Games'], decimals: 0 },
  { label: 'Routes', value: (player, season) => getRouteVolume(getPlayerSeasonRow(player, season)).routes, decimals: 0 },
  { label: 'Targets', aliases: ['TGT', 'Targets'], decimals: 0 },
  { label: 'Receptions', aliases: ['REC', 'Receptions'], decimals: 0 },
  { label: 'Receiving Yards', aliases: ['YDS', 'Receiving Yards', 'Rec Yards'], decimals: 0 },
  { label: 'Touchdowns', aliases: ['TD', 'TDs', 'Receiving TD'], decimals: 1 },
  { label: 'Yards / Game', aliases: ['RecYDS/G', 'Receiving Yards/G', 'Yards/G'], decimals: 2 },
  { label: 'YPRR', aliases: ['YPRR', 'Yards Per Route Run'], decimals: 3 },
  { label: 'TPRR', aliases: ['TPRR', 'Targets Per Route Run'], decimals: 3 },
  { label: 'Target Share', aliases: ['TGT %', 'TGT%', 'Target Share'], decimals: 2 },
  { label: 'First Read %', aliases: ['1READ %', '1Read %', 'First Read %'], decimals: 2 },
  { label: 'PFF Receiving Grade', aliases: ['Receiving_Grade', 'Receiving Grade', 'grades_pass_route', 'PFF Grade', 'PFF'], decimals: 2 },
  { label: 'MTF / Rec', aliases: ['MTF/REC', 'MTF / REC', 'Missed Tackles Forced / Rec'], decimals: 3 },
  { label: 'Fantasy Points / Game', aliases: ['FP/G', 'Fantasy Points/G'], decimals: 2 },
]

export default function PlayerComparisonModal({ players, loading, error, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [selectedSeasons, setSelectedSeasons] = useState<Record<string, string>>({})

  const filteredPlayers = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return players
      .filter((player) => {
        if (!normalized) return true
        return `${player.player_name} ${player.team || ''}`.toLowerCase().includes(normalized)
      })
      .slice(0, 40)
  }, [players, query])

  const selectedPlayers = useMemo(
    () => selectedIds.map((id) => players.find((player) => getPlayerId(player) === id)).filter(Boolean) as PlayerScoreRow[],
    [players, selectedIds],
  )

  function togglePlayer(player: PlayerScoreRow) {
    const id = getPlayerId(player)
    setSelectedIds((current) => {
      if (current.includes(id)) return current.filter((value) => value !== id)
      if (current.length >= MAX_PLAYERS) return current
      return [...current, id]
    })
  }

  function selectedSeason(player: PlayerScoreRow) {
    const id = getPlayerId(player)
    return selectedSeasons[id] || getPlayerSeasonRows(player)[0]?.season || player.latest_season || ''
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-3 py-5 backdrop-blur-sm sm:px-5"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.98 }}
        transition={{ type: 'spring', damping: 24, stiffness: 220 }}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[94vh] w-full max-w-7xl overflow-hidden rounded-[2rem] border border-zinc-800 bg-zinc-950 shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-zinc-800 bg-white/[0.035] p-5 sm:p-6">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-300">WR Comparison</p>
            <h2 className="mt-2 text-2xl font-black text-white sm:text-3xl">Compare advanced stats</h2>
            <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-zinc-400">
              Select two to four receivers. You can choose a different saved season for each player.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-2xl border border-zinc-700 bg-zinc-950 p-3 text-zinc-300 transition hover:border-emerald-300 hover:text-white" aria-label="Close comparison">
            <X size={20} />
          </button>
        </header>

        <div className="max-h-[calc(94vh-130px)] overflow-y-auto p-5 sm:p-6">
          <section className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
            <div className="rounded-[1.5rem] border border-zinc-800 bg-zinc-900 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Users size={18} className="text-emerald-300" />
                  <h3 className="font-black text-white">Choose receivers</h3>
                </div>
                <span className="rounded-full bg-zinc-950 px-3 py-1 text-xs font-black text-zinc-400">{selectedIds.length}/{MAX_PLAYERS}</span>
              </div>

              <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={17} />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search receivers" className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 py-3 pl-10 pr-4 text-sm font-bold outline-none focus:border-emerald-400" />
              </div>

              <div className="mt-3 max-h-[390px] space-y-2 overflow-y-auto pr-1">
                {loading && <p className="p-4 text-sm font-bold text-zinc-500">Loading all receivers...</p>}
                {error && <p className="rounded-2xl border border-red-500/30 bg-red-950/30 p-4 text-sm font-bold text-red-200">{error}</p>}
                {!loading && !error && filteredPlayers.map((player) => {
                  const id = getPlayerId(player)
                  const selected = selectedIds.includes(id)
                  const disabled = !selected && selectedIds.length >= MAX_PLAYERS
                  return (
                    <button
                      key={id}
                      type="button"
                      disabled={disabled}
                      onClick={() => togglePlayer(player)}
                      className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-3 text-left transition ${selected ? 'border-emerald-400/60 bg-emerald-400/10' : 'border-zinc-800 bg-zinc-950 hover:border-zinc-600'} disabled:cursor-not-allowed disabled:opacity-40`}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-white">{player.player_name}</p>
                        <p className="mt-1 text-xs font-bold text-zinc-500">WR{player.rank} · {player.team || 'FA'} · {player.score}</p>
                      </div>
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${selected ? 'border-emerald-300 bg-emerald-400 text-zinc-950' : 'border-zinc-700 text-transparent'}`}>
                        <Check size={15} />
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="min-w-0">
              {selectedPlayers.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <AnimatePresence mode="popLayout">
                    {selectedPlayers.map((player) => {
                      const id = getPlayerId(player)
                      const seasons = getPlayerSeasonRows(player)
                      return (
                        <motion.div key={id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} className="rounded-[1.4rem] border border-emerald-400/25 bg-emerald-400/[0.06] p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate font-black text-white">{player.player_name}</p>
                              <p className="mt-1 text-xs font-bold text-zinc-500">WR{player.rank} · {player.team || 'FA'}</p>
                            </div>
                            <button type="button" onClick={() => togglePlayer(player)} className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-800 hover:text-white" aria-label={`Remove ${player.player_name}`}>
                              <X size={16} />
                            </button>
                          </div>
                          <select
                            value={selectedSeason(player)}
                            onChange={(event) => setSelectedSeasons((current) => ({ ...current, [id]: event.target.value }))}
                            className="mt-3 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm font-black outline-none focus:border-emerald-400"
                          >
                            {seasons.map((row) => <option key={row.season || 'unknown'} value={row.season || ''}>{row.season || 'Unknown season'}</option>)}
                          </select>
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>
                </div>
              )}

              {selectedPlayers.length < 2 ? (
                <div className="mt-4 flex min-h-[360px] items-center justify-center rounded-[1.5rem] border border-dashed border-zinc-700 bg-zinc-900/60 p-8 text-center">
                  <div>
                    <Users className="mx-auto text-zinc-600" size={38} />
                    <p className="mt-4 text-lg font-black text-white">Select at least two receivers</p>
                    <p className="mt-2 text-sm font-bold text-zinc-500">Their selected seasons will appear side by side here.</p>
                  </div>
                </div>
              ) : (
                <ComparisonTable players={selectedPlayers} selectedSeason={selectedSeason} />
              )}
            </div>
          </section>
        </div>
      </motion.div>
    </motion.div>
  )
}

function ComparisonTable({ players, selectedSeason }: { players: PlayerScoreRow[]; selectedSeason: (player: PlayerScoreRow) => string }) {
  return (
    <div className="mt-4 overflow-hidden rounded-[1.5rem] border border-zinc-800 bg-zinc-900">
      <div className="border-b border-zinc-800 p-5">
        <h3 className="text-xl font-black text-white">Side-by-side results</h3>
        <p className="mt-1 text-sm font-bold text-zinc-500">The best numeric value in each category is highlighted. Lower rank is better.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-zinc-950 text-xs uppercase tracking-[0.14em] text-zinc-500">
            <tr>
              <th className="sticky left-0 z-10 bg-zinc-950 px-4 py-3">Stat</th>
              {players.map((player) => (
                <th key={getPlayerId(player)} className="min-w-[170px] px-4 py-3">
                  <span className="block text-zinc-200">{player.player_name}</span>
                  <span className="mt-1 block text-[0.65rem] text-zinc-600">{selectedSeason(player)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-zinc-800">
              <td className="sticky left-0 z-10 bg-zinc-900 px-4 py-3 font-black text-zinc-400">Team</td>
              {players.map((player) => {
                const row = getPlayerSeasonRow(player, selectedSeason(player))
                return <td key={getPlayerId(player)} className="px-4 py-3 font-black text-white">{row?.team || player.team || 'FA'}</td>
              })}
            </tr>
            {METRICS.map((metric) => {
              const values = players.map((player) => getMetricValue(metric, player, selectedSeason(player)))
              const numericValues = values.map(toStatNumber).filter((value): value is number => value !== null)
              const best = numericValues.length ? (metric.lowerIsBetter ? Math.min(...numericValues) : Math.max(...numericValues)) : null

              return (
                <tr key={metric.label} className="border-t border-zinc-800">
                  <td className="sticky left-0 z-10 bg-zinc-900 px-4 py-3 font-black text-zinc-400">{metric.label}</td>
                  {players.map((player, index) => {
                    const numeric = toStatNumber(values[index])
                    const isBest = best !== null && numeric !== null && Math.abs(numeric - best) < 0.000001
                    return (
                      <td key={getPlayerId(player)} className="px-4 py-3">
                        <span className={`inline-flex rounded-xl border px-3 py-1.5 font-black ${isBest ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300' : 'border-zinc-800 bg-zinc-950 text-zinc-200'}`}>
                          {formatStatValue(values[index], metric.decimals ?? 2)}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function getMetricValue(metric: ComparisonMetric, player: PlayerScoreRow, season: string | null) {
  if (metric.value) return metric.value(player, season)
  return getStatValue(getPlayerSeasonRow(player, season), metric.aliases || [])
}
