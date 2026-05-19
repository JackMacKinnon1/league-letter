'use client'

import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowRight,
  ChevronDown,
  GitBranch,
  Handshake,
  Search,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'

type Team = {
  id?: string
  sleeper_roster_id: number
  team_name: string
  owner_name?: string | null
}

type Player = {
  id: string
  first_name?: string | null
  last_name?: string | null
  full_name?: string | null
  position?: string | null
  team?: string | null
}

type Trade = {
  id: string
  league_id: string
  sleeper_transaction_id: string
  season: string | number | null
  week: number | null
  roster_ids: number[] | null
  adds: Record<string, number> | null
  drops: Record<string, number> | null
  draft_picks: any[] | null
  created_sleeper_at: number | null
  status?: string | null
}

type AssetMove = {
  key: string
  label: string
  type: 'player' | 'pick'
  fromRosterId: number | null
  toRosterId: number | null
  season: string | number | null
  week: number | null
  tradeId: string
  timestamp: number
}

export default function TradeCenter({
  leagueId,
  leagueName,
  trades,
  teams,
  players,
}: {
  leagueId: string
  leagueName?: string | null
  trades: Trade[]
  teams: Team[]
  players: Record<string, Player>
}) {
  const [selectedSeason, setSelectedSeason] = useState('all')
  const [selectedTeam, setSelectedTeam] = useState('all')
  const [search, setSearch] = useState('')
  const [openTradeId, setOpenTradeId] = useState<string | null>(trades[0]?.id || null)

  const teamByRosterId = useMemo(() => {
    const map = new Map<number, Team>()
    for (const team of teams || []) {
      map.set(Number(team.sleeper_roster_id), team)
    }
    return map
  }, [teams])

  const seasons = useMemo(() => {
    return Array.from(new Set(trades.map((trade) => String(trade.season || 'Unknown'))))
      .filter(Boolean)
      .sort((a, b) => Number(b) - Number(a))
  }, [trades])

  const allAssetMoves = useMemo(
    () => trades.flatMap((trade) => getAssetMoves(trade, players)),
    [trades, players]
  )

  const assetOptions = useMemo(() => {
    const map = new Map<string, AssetMove>()
    for (const move of allAssetMoves) {
      if (!map.has(move.key)) map.set(move.key, move)
    }

    return Array.from(map.values())
      .sort((a, b) => a.label.localeCompare(b.label))
      .slice(0, 250)
  }, [allAssetMoves])

  const [selectedAssetKey, setSelectedAssetKey] = useState<string>(assetOptions[0]?.key || '')

  const filteredTrades = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return trades.filter((trade) => {
      const rosterIds = trade.roster_ids || []
      const tradeAssets = getTradeAssetLabels(trade, players).join(' ').toLowerCase()
      const teamNames = rosterIds
        .map((rosterId) => getTeamName(Number(rosterId), teamByRosterId))
        .join(' ')
        .toLowerCase()

      const matchesSeason =
        selectedSeason === 'all' || String(trade.season || 'Unknown') === selectedSeason
      const matchesTeam =
        selectedTeam === 'all' || rosterIds.map(Number).includes(Number(selectedTeam))
      const matchesSearch =
        !normalizedSearch ||
        tradeAssets.includes(normalizedSearch) ||
        teamNames.includes(normalizedSearch)

      return matchesSeason && matchesTeam && matchesSearch
    })
  }, [trades, players, selectedSeason, selectedTeam, search, teamByRosterId])

  const teamTradeCounts = useMemo(() => {
    const counts = new Map<number, number>()

    for (const trade of trades) {
      for (const rosterId of trade.roster_ids || []) {
        counts.set(Number(rosterId), (counts.get(Number(rosterId)) || 0) + 1)
      }
    }

    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
  }, [trades])

  const mostActiveTeam = teamTradeCounts[0]
  const totalAssets = allAssetMoves.length
  const biggestTrade = [...trades].sort(
    (a, b) => getAssetMoves(b, players).length - getAssetMoves(a, players).length
  )[0]

  const selectedAssetTimeline = allAssetMoves
    .filter((move) => move.key === selectedAssetKey)
    .sort((a, b) => a.timestamp - b.timestamp)

  return (
    <main className="min-h-screen overflow-hidden bg-zinc-950 text-white">
      <div className="pointer-events-none fixed inset-0 opacity-70">
        <div className="absolute left-[-12%] top-[-15%] h-[34rem] w-[34rem] rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute right-[-15%] top-[20%] h-[32rem] w-[32rem] rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute bottom-[-20%] left-[30%] h-[30rem] w-[30rem] rounded-full bg-amber-500/10 blur-3xl" />
      </div>

      <section className="relative border-b border-zinc-800 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.28),_transparent_35%),linear-gradient(to_bottom,_#064e3b,_#09090b)] px-4 py-12 md:py-16">
        <div className="mx-auto max-w-7xl">
          <Link
            href={`/league/${leagueId}`}
            className="text-sm font-bold text-zinc-300 transition hover:text-white"
          >
            ← Back to league
          </Link>

          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_420px] lg:items-end">
            <div>
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm font-black uppercase tracking-[0.35em] text-emerald-300"
              >
                Deal Desk
              </motion.p>

              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="mt-4 text-5xl font-black tracking-tight md:text-7xl"
              >
                Trade Center
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mt-4 max-w-3xl text-lg text-zinc-300"
              >
                Every league trade, every asset moved, and a trade tree that follows
                players and draft picks through {leagueName || 'your league'} history.
              </motion.p>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="rounded-[2rem] border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-400 text-zinc-950 shadow-lg shadow-emerald-500/20">
                  <Handshake size={34} />
                </div>
                <div>
                  <p className="text-4xl font-black">{trades.length}</p>
                  <p className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-300">
                    Trades Logged
                  </p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <HeroStat label="Assets Moved" value={totalAssets} />
                <HeroStat
                  label="Most Active"
                  value={mostActiveTeam ? getTeamName(mostActiveTeam[0], teamByRosterId) : '—'}
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="relative border-b border-zinc-800 bg-zinc-950/90 py-3">
        <div className="flex overflow-hidden whitespace-nowrap">
          <motion.div
            animate={{ x: ['0%', '-50%'] }}
            transition={{ repeat: Infinity, ease: 'linear', duration: 36 }}
            className="flex min-w-max gap-4 pr-4 text-sm font-black uppercase tracking-[0.18em] text-zinc-300"
          >
            {[...filteredTrades, ...filteredTrades].slice(0, 24).map((trade, index) => (
              <span
                key={`${trade.id}-ticker-${index}`}
                className="rounded-full border border-zinc-800 bg-zinc-900 px-4 py-2"
              >
                <span className="text-emerald-400">TRADE ALERT</span>{' '}
                {formatTradeHeadline(trade, teamByRosterId)}
              </span>
            ))}
            {!filteredTrades.length && (
              <span className="rounded-full border border-zinc-800 bg-zinc-900 px-4 py-2">
                No trades found yet
              </span>
            )}
          </motion.div>
        </div>
      </section>

      <section className="relative mx-auto grid max-w-7xl gap-6 px-4 py-8 lg:grid-cols-[420px_1fr]">
        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[2rem] border border-zinc-800 bg-zinc-900/80 p-5 shadow-2xl backdrop-blur"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
                <GitBranch size={22} />
              </div>
              <div>
                <h2 className="text-2xl font-black">Trade Tree</h2>
                <p className="text-sm text-zinc-500">Follow an asset across every deal</p>
              </div>
            </div>

            <select
              value={selectedAssetKey}
              onChange={(event) => setSelectedAssetKey(event.target.value)}
              className="mt-5 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-bold outline-none transition focus:border-emerald-500"
            >
              {assetOptions.map((asset) => (
                <option key={asset.key} value={asset.key}>
                  {asset.label}
                </option>
              ))}
            </select>

            <div className="mt-5 space-y-4">
              <AnimatePresence mode="popLayout">
                {selectedAssetTimeline.map((move, index) => (
                  <motion.div
                    key={`${move.tradeId}-${move.key}-${index}`}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 16 }}
                    transition={{ delay: index * 0.05 }}
                    className="relative pl-8"
                  >
                    <div className="absolute bottom-[-1rem] left-[0.65rem] top-7 w-px bg-zinc-800" />
                    <div className="absolute left-0 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-zinc-950 ring-4 ring-zinc-900">
                      <ArrowRight size={13} />
                    </div>

                    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">
                        {move.season || 'Unknown'} · Week {move.week || '?'}
                      </p>
                      <h3 className="mt-2 font-black">{move.label}</h3>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm font-bold">
                        <TeamPill name={getTeamName(move.fromRosterId, teamByRosterId)} muted />
                        <ArrowRight size={16} className="text-zinc-500" />
                        <TeamPill name={getTeamName(move.toRosterId, teamByRosterId)} />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {!selectedAssetTimeline.length && (
                <div className="rounded-2xl border border-dashed border-zinc-800 p-5 text-sm text-zinc-400">
                  Pick an asset to see its trade path.
                </div>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="rounded-[2rem] border border-zinc-800 bg-zinc-900/80 p-5"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-300">
                <Trophy size={21} />
              </div>
              <div>
                <h3 className="text-xl font-black">Trade Superlatives</h3>
                <p className="text-sm text-zinc-500">Quick league trade notes</p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <Superlative
                label="Most Active Team"
                value={mostActiveTeam ? `${getTeamName(mostActiveTeam[0], teamByRosterId)} · ${mostActiveTeam[1]} trades` : 'No trades yet'}
              />
              <Superlative
                label="Biggest Trade"
                value={biggestTrade ? `${getAssetMoves(biggestTrade, players).length} assets · ${formatTradeHeadline(biggestTrade, teamByRosterId)}` : 'No trades yet'}
              />
              <Superlative label="Seasons With Trades" value={seasons.length || 0} />
            </div>
          </motion.div>
        </div>

        <div className="space-y-5">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[2rem] border border-zinc-800 bg-zinc-900/80 p-5 shadow-2xl backdrop-blur"
          >
            <div className="grid gap-3 md:grid-cols-[1fr_180px_180px]">
              <label className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3">
                <Search size={18} className="text-zinc-500" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search players, picks, or teams..."
                  className="w-full bg-transparent text-sm font-bold outline-none placeholder:text-zinc-600"
                />
              </label>

              <select
                value={selectedSeason}
                onChange={(event) => setSelectedSeason(event.target.value)}
                className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm font-bold outline-none"
              >
                <option value="all">All seasons</option>
                {seasons.map((season) => (
                  <option key={season} value={season}>
                    {season}
                  </option>
                ))}
              </select>

              <select
                value={selectedTeam}
                onChange={(event) => setSelectedTeam(event.target.value)}
                className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm font-bold outline-none"
              >
                <option value="all">All teams</option>
                {teams.map((team) => (
                  <option key={team.sleeper_roster_id} value={team.sleeper_roster_id}>
                    {team.team_name}
                  </option>
                ))}
              </select>
            </div>
          </motion.div>

          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard icon={<Handshake size={23} />} label="Showing" value={filteredTrades.length} />
            <MetricCard icon={<Sparkles size={23} />} label="Assets" value={filteredTrades.flatMap((trade) => getAssetMoves(trade, players)).length} />
            <MetricCard icon={<Users size={23} />} label="Teams" value={teams.length} />
          </div>

          <div className="space-y-4">
            {filteredTrades.map((trade, index) => (
              <TradeCard
                key={trade.id}
                trade={trade}
                index={index}
                players={players}
                teamByRosterId={teamByRosterId}
                isOpen={openTradeId === trade.id}
                onToggle={() => setOpenTradeId(openTradeId === trade.id ? null : trade.id)}
                leagueId={leagueId}
              />
            ))}

            {!filteredTrades.length && (
              <div className="rounded-[2rem] border border-dashed border-zinc-800 bg-zinc-900/70 p-8 text-center text-zinc-400">
                No trades match those filters.
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}

function TradeCard({
  trade,
  index,
  players,
  teamByRosterId,
  isOpen,
  onToggle,
  leagueId,
}: {
  trade: Trade
  index: number
  players: Record<string, Player>
  teamByRosterId: Map<number, Team>
  isOpen: boolean
  onToggle: () => void
  leagueId: string
}) {
  const rosterIds = trade.roster_ids || []
  const columns = rosterIds.map((rosterId) => getTradeColumn(trade, Number(rosterId), players))
  const assetCount = getAssetMoves(trade, players).length

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.2) }}
      className="overflow-hidden rounded-[2rem] border border-zinc-800 bg-zinc-900/80 shadow-xl backdrop-blur transition hover:border-zinc-700"
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full flex-col gap-4 p-5 text-left md:flex-row md:items-center md:justify-between"
      >
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-400">
            Trade · {trade.season || 'Unknown'} · Week {trade.week || '?'}
          </p>
          <h3 className="mt-2 text-2xl font-black">
            {formatTradeHeadline(trade, teamByRosterId)}
          </h3>
          <p className="mt-2 text-sm text-zinc-500">
            {assetCount} asset{assetCount === 1 ? '' : 's'} moved
          </p>
        </div>

        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-zinc-300 ring-1 ring-zinc-800"
        >
          <ChevronDown size={20} />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: 'easeInOut' }}
          >
            <div className="border-t border-zinc-800 p-5">
              <div className={`grid gap-4 ${columns.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-2 xl:grid-cols-3'}`}>
                {columns.map((column) => {
                  const team = teamByRosterId.get(Number(column.rosterId))

                  return (
                    <div
                      key={column.rosterId}
                      className="rounded-[1.5rem] border border-zinc-800 bg-zinc-950 p-4"
                    >
                      {team ? (
                        <Link
                          href={`/league/${leagueId}/teams/${team.sleeper_roster_id}`}
                          className="block text-lg font-black transition hover:text-emerald-400"
                        >
                          {team.team_name}
                        </Link>
                      ) : (
                        <h4 className="text-lg font-black">Roster {column.rosterId}</h4>
                      )}

                      <div className="mt-4 grid gap-3">
                        <AssetList title="Received" items={column.received} good />
                        <AssetList title="Sent Away" items={column.sent} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function AssetList({ title, items, good }: { title: string; items: string[]; good?: boolean }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">{title}</p>
      <div className="mt-2 space-y-2">
        {items.map((item) => (
          <div
            key={`${title}-${item}`}
            className={`rounded-2xl px-3 py-2 text-sm font-bold ${
              good ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'
            }`}
          >
            {good ? '+' : '-'} {item}
          </div>
        ))}
        {!items.length && <p className="text-sm text-zinc-600">No assets</p>}
      </div>
    </div>
  )
}

function HeroStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-zinc-950/60 p-4 ring-1 ring-white/10">
      <p className="truncate text-2xl font-black">{value}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">{label}</p>
    </div>
  )
}

function MetricCard({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[1.5rem] border border-zinc-800 bg-zinc-900/80 p-5"
    >
      <div className="flex items-center gap-3 text-emerald-400">{icon}</div>
      <p className="mt-4 text-3xl font-black">{value}</p>
      <p className="mt-1 text-sm font-bold uppercase tracking-[0.18em] text-zinc-500">{label}</p>
    </motion.div>
  )
}

function Superlative({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p className="mt-2 font-black text-zinc-200">{value}</p>
    </div>
  )
}

function TeamPill({ name, muted }: { name: string; muted?: boolean }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs ${
        muted ? 'bg-zinc-900 text-zinc-400' : 'bg-emerald-500 text-zinc-950'
      }`}
    >
      {name}
    </span>
  )
}

function getTradeColumn(trade: Trade, rosterId: number, players: Record<string, Player>) {
  const receivedPlayers = trade.adds
    ? Object.entries(trade.adds)
        .filter(([, receivingRosterId]) => Number(receivingRosterId) === rosterId)
        .map(([playerId]) => getPlayerName(playerId, players))
    : []

  const sentPlayers = trade.adds
    ? Object.entries(trade.adds)
        .filter(([, receivingRosterId]) => Number(receivingRosterId) !== rosterId)
        .filter(() => (trade.roster_ids || []).map(Number).includes(rosterId))
        .map(([playerId]) => getPlayerName(playerId, players))
    : []

  const receivedPicks = getReceivedPicksForRoster(trade.draft_picks, rosterId)
  const sentPicks = getLostPicksForRoster(trade.draft_picks, rosterId)

  return {
    rosterId,
    received: [...receivedPlayers, ...receivedPicks],
    sent: [...sentPlayers, ...sentPicks],
  }
}

function getAssetMoves(trade: Trade, players: Record<string, Player>): AssetMove[] {
  const moves: AssetMove[] = []
  const rosterIds = (trade.roster_ids || []).map(Number)
  const timestamp = Number(trade.created_sleeper_at || 0)

  if (trade.adds) {
    for (const [playerId, toRosterId] of Object.entries(trade.adds)) {
      const to = Number(toRosterId)
      const from = rosterIds.find((rosterId) => rosterId !== to) || null
      moves.push({
        key: `player:${playerId}`,
        label: getPlayerName(playerId, players),
        type: 'player',
        fromRosterId: from,
        toRosterId: to,
        season: trade.season,
        week: trade.week,
        tradeId: trade.id,
        timestamp,
      })
    }
  }

  for (const pick of trade.draft_picks || []) {
    moves.push({
      key: getPickKey(pick),
      label: formatDraftPick(pick),
      type: 'pick',
      fromRosterId: pick.previous_owner_id ? Number(pick.previous_owner_id) : null,
      toRosterId: pick.owner_id ? Number(pick.owner_id) : null,
      season: trade.season,
      week: trade.week,
      tradeId: trade.id,
      timestamp,
    })
  }

  return moves
}

function getTradeAssetLabels(trade: Trade, players: Record<string, Player>) {
  return getAssetMoves(trade, players).map((move) => move.label)
}

function getPlayerName(playerId: string, players: Record<string, Player>) {
  const player = players[playerId]
  if (!player) return playerId

  const fullName = `${player.first_name || ''} ${player.last_name || ''}`.trim()
  return fullName || player.full_name || playerId
}

function getPickKey(pick: any) {
  return `pick:${pick.season || ''}:${pick.round || ''}:${pick.roster_id || ''}`
}

function formatDraftPick(pick: any) {
  const season = pick.season || ''
  const round = pick.round ? `Round ${pick.round}` : 'Pick'
  const originalOwner = pick.roster_id ? `from Roster ${pick.roster_id}` : ''
  return `${season} ${round}${originalOwner ? ` ${originalOwner}` : ''}`.trim()
}

function getReceivedPicksForRoster(draftPicks: any[] | null, rosterId: number) {
  if (!draftPicks?.length) return []
  return draftPicks
    .filter((pick) => Number(pick.owner_id) === rosterId)
    .map(formatDraftPick)
}

function getLostPicksForRoster(draftPicks: any[] | null, rosterId: number) {
  if (!draftPicks?.length) return []
  return draftPicks
    .filter((pick) => Number(pick.previous_owner_id) === rosterId)
    .map(formatDraftPick)
}

function getTeamName(rosterId: number | null | undefined, teamByRosterId: Map<number, Team>) {
  if (!rosterId) return 'Unknown roster'
  return teamByRosterId.get(Number(rosterId))?.team_name || `Roster ${rosterId}`
}

function formatTradeHeadline(trade: Trade, teamByRosterId: Map<number, Team>) {
  const names = (trade.roster_ids || [])
    .map((rosterId) => getTeamName(Number(rosterId), teamByRosterId))
    .filter(Boolean)

  if (!names.length) return 'League trade completed'
  if (names.length === 1) return `${names[0]} made a deal`
  if (names.length === 2) return `${names[0]} ↔ ${names[1]}`

  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`
}
