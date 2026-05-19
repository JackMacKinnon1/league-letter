'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Database, Search, Trophy, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

type ScoreRow = {
  id: string
  upload_id: string
  player_key: string
  player_name: string
  team: string | null
  position: string
  rank: number
  rank_label: string | null
  score: number
  latest_season: string | null
  seasons_played: string[]
  advanced_stats: {
    finalRanking?: {
      player_name: string
      score: number
      rank: number
      rank_label: string | null
    }
    latestCoreStats?: Record<string, any>
    seasonStats?: Array<{
      season: string | null
      team: string | null
      stats: Record<string, any>
      core: Record<string, any>
    }>
    rawRows?: Record<string, any>[]
  }
}

type UploadOption = {
  id: string
  position: string
  file_name: string | null
  upload_label: string | null
  uploaded_at: string
  summary?: Record<string, any>
}

const POSITIONS = ['WR', 'TE', 'QB', 'RB']

const SEASON_TABLE_STATS = [
  'Season',
  'Team',
  'G',
  'YDS',
  'RecYDS/G',
  'YPRR',
  'Receiving_Grade',
  '1READ %',
  'MTF/REC',
  'TGT %',
  'TPRR',
  'FP/G',
]

const FEATURED_STATS = [
  'YDS',
  'RecYDS/G',
  'YPRR',
  'Receiving_Grade',
  '1READ %',
  'MTF/REC',
  'TGT %',
  'TPRR',
  'REC',
  'TD',
  'Birth Date',
]

export default function PlayerScoresPage() {
  const [position, setPosition] = useState('WR')
  const [uploadId, setUploadId] = useState('')
  const [uploads, setUploads] = useState<UploadOption[]>([])
  const [selectedUpload, setSelectedUpload] = useState<UploadOption | null>(null)
  const [rows, setRows] = useState<ScoreRow[]>([])
  const [selectedPlayer, setSelectedPlayer] = useState<ScoreRow | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    async function loadScores() {
      setLoading(true)
      setError('')

      const params = new URLSearchParams({
        position,
        page: String(page),
        pageSize: '50',
      })

      if (uploadId) params.set('uploadId', uploadId)
      if (search) params.set('search', search)

      try {
        const response = await fetch(`/api/player-scores?${params.toString()}`, {
          signal: controller.signal,
        })
        const json = await response.json()

        if (!response.ok) throw new Error(json.error || 'Failed to load scores.')

        setRows(json.rows || [])
        setTotalPages(json.totalPages || 1)
        setTotal(json.total || 0)
        setUploads(json.uploads || [])
        setSelectedUpload(json.selectedUpload || null)
        setUploadId(json.uploadId || uploadId)
      } catch (err: any) {
        if (err.name !== 'AbortError') setError(err.message || 'Failed to load scores.')
      } finally {
        setLoading(false)
      }
    }

    loadScores()
    return () => controller.abort()
  }, [position, uploadId, page, search])

  const topThree = useMemo(() => rows.slice(0, 3), [rows])

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <section className="overflow-hidden rounded-[2rem] border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-950 to-emerald-950/20 p-6 shadow-2xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-300">
                Uploaded Rankings
              </p>
              <h1 className="mt-2 text-4xl font-black md:text-5xl">
                Player Scores
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">
                Rankings are displayed exactly from your uploaded Excel workbook’s Final Rankings sheet. Click any player to view the advanced Raw Data stats saved from that upload.
              </p>
              {selectedUpload && (
                <p className="mt-2 text-xs font-bold text-zinc-500">
                  Showing {selectedUpload.upload_label || selectedUpload.file_name || 'latest upload'} · uploaded {formatDate(selectedUpload.uploaded_at)}
                </p>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:w-[680px]">
              <select
                value={position}
                onChange={(event) => {
                  setPosition(event.target.value)
                  setUploadId('')
                  setPage(1)
                }}
                className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 font-black outline-none focus:border-emerald-400"
              >
                {POSITIONS.map((pos) => (
                  <option key={pos} value={pos}>
                    {pos}
                  </option>
                ))}
              </select>

              <select
                value={uploadId}
                onChange={(event) => {
                  setUploadId(event.target.value)
                  setPage(1)
                }}
                className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 font-black outline-none focus:border-emerald-400"
              >
                {uploads.length === 0 && <option value="">No uploads</option>}
                {uploads.map((upload) => (
                  <option key={upload.id} value={upload.id}>
                    {upload.upload_label || upload.file_name || formatDate(upload.uploaded_at)}
                  </option>
                ))}
              </select>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value)
                    setPage(1)
                  }}
                  placeholder="Search"
                  className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 py-3 pl-10 pr-4 font-bold outline-none focus:border-emerald-400"
                />
              </div>
            </div>
          </div>
        </section>

        {topThree.length > 0 && (
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {topThree.map((player, index) => (
              <motion.button
                key={player.player_key}
                onClick={() => setSelectedPlayer(player)}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.06 }}
                className="rounded-[2rem] border border-emerald-400/20 bg-zinc-900 p-5 text-left shadow-xl transition hover:-translate-y-1 hover:border-emerald-300/60 hover:bg-zinc-900/80"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-400 text-zinc-950">
                    <Trophy size={20} />
                  </div>
                  <p className="text-3xl font-black text-emerald-300">#{player.rank}</p>
                </div>
                <h2 className="mt-4 text-2xl font-black">{player.player_name}</h2>
                <p className="mt-1 text-sm font-bold text-zinc-500">
                  {player.team || 'FA'} · {player.latest_season || 'No season'}
                </p>
                <p className="mt-4 text-4xl font-black text-white">{player.score}</p>
              </motion.button>
            ))}
          </div>
        )}

        <section className="mt-5 overflow-hidden rounded-[2rem] border border-zinc-800 bg-zinc-900 shadow-2xl">
          <div className="flex items-center justify-between border-b border-zinc-800 p-5">
            <div>
              <h2 className="text-2xl font-black">{position} Rankings</h2>
              <p className="text-sm font-bold text-zinc-500">{total} players</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((value) => Math.max(value - 1, 1))}
                disabled={page <= 1}
                className="rounded-xl border border-zinc-800 bg-zinc-950 p-2 disabled:opacity-40"
              >
                <ChevronLeft size={18} />
              </button>
              <p className="text-sm font-black text-zinc-400">
                {page} / {totalPages}
              </p>
              <button
                onClick={() => setPage((value) => Math.min(value + 1, totalPages))}
                disabled={page >= totalPages}
                className="rounded-xl border border-zinc-800 bg-zinc-950 p-2 disabled:opacity-40"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          {error && <div className="m-5 rounded-2xl border border-red-500/30 bg-red-950/30 p-4 text-sm font-bold text-red-200">{error}</div>}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-zinc-950 text-xs uppercase tracking-[0.18em] text-zinc-500">
                <tr>
                  <th className="px-5 py-4">Rank</th>
                  <th className="px-5 py-4">Player</th>
                  <th className="px-5 py-4">Team</th>
                  <th className="px-5 py-4">Latest Season</th>
                  <th className="px-5 py-4">Seasons Saved</th>
                  <th className="px-5 py-4 text-right">Score</th>
                </tr>
              </thead>

              <tbody>
                <AnimatePresence mode="popLayout">
                  {rows.map((row) => (
                    <motion.tr
                      key={row.id || `${row.position}-${row.upload_id}-${row.player_key}`}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setSelectedPlayer(row)}
                      className="cursor-pointer border-t border-zinc-800 transition hover:bg-zinc-800/50"
                    >
                      <td className="px-5 py-4 font-black text-emerald-300">#{row.rank}</td>
                      <td className="px-5 py-4">
                        <p className="font-black text-white">{row.player_name}</p>
                        <p className="mt-1 text-xs font-bold text-zinc-500">Click for advanced stats</p>
                      </td>
                      <td className="px-5 py-4 font-bold text-zinc-400">{row.team || 'FA'}</td>
                      <td className="px-5 py-4 font-bold text-zinc-400">{row.latest_season || '—'}</td>
                      <td className="px-5 py-4 font-bold text-zinc-400">{row.seasons_played?.join(', ') || '—'}</td>
                      <td className="px-5 py-4 text-right text-xl font-black text-white">{row.score}</td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {loading && (
            <div className="p-8 text-center text-sm font-black uppercase tracking-[0.2em] text-zinc-500">
              Loading rankings...
            </div>
          )}

          {!loading && rows.length === 0 && !error && (
            <div className="p-8 text-center text-sm font-black uppercase tracking-[0.2em] text-zinc-500">
              No uploaded rankings found.
            </div>
          )}
        </section>
      </div>

      <AnimatePresence>
        {selectedPlayer && (
          <PlayerStatsModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
        )}
      </AnimatePresence>
    </main>
  )
}

function PlayerStatsModal({ player, onClose }: { player: ScoreRow; onClose: () => void }) {
  const latestCoreStats = player.advanced_stats?.latestCoreStats || {}
  const seasonStats = player.advanced_stats?.seasonStats || []
  const latestFullStats = seasonStats[0]?.stats || {}

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-8 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.98 }}
        transition={{ type: 'spring', damping: 24, stiffness: 220 }}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-[2rem] border border-zinc-800 bg-zinc-950 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-800 bg-gradient-to-br from-zinc-900 to-emerald-950/30 p-6">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-300">
              Advanced Stats
            </p>
            <h2 className="mt-2 text-3xl font-black text-white">{player.player_name}</h2>
            <p className="mt-2 text-sm font-bold text-zinc-400">
              #{player.rank} · {player.team || 'FA'} · Score {player.score}
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-2xl border border-zinc-700 bg-zinc-950 p-3 text-zinc-300 transition hover:border-emerald-300 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="max-h-[calc(90vh-130px)] overflow-y-auto p-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ModalStat label="Latest Season" value={player.latest_season || '—'} />
            <ModalStat label="Team" value={player.team || 'FA'} />
            <ModalStat label="Score" value={player.score} />
            <ModalStat label="Seasons" value={player.seasons_played?.join(', ') || '—'} />
          </div>

          <section className="mt-5 rounded-[1.5rem] border border-zinc-800 bg-zinc-900 p-5">
            <div className="flex items-center gap-2">
              <Database size={18} className="text-emerald-300" />
              <h3 className="text-xl font-black text-white">Latest Season Snapshot</h3>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURED_STATS.map((key) => (
                <ModalStat key={key} label={key} value={latestCoreStats[key] ?? latestFullStats[key] ?? '—'} />
              ))}
            </div>
          </section>

          <section className="mt-5 overflow-hidden rounded-[1.5rem] border border-zinc-800 bg-zinc-900">
            <div className="border-b border-zinc-800 p-5">
              <h3 className="text-xl font-black text-white">Season History</h3>
              <p className="mt-1 text-sm font-bold text-zinc-500">
                These rows are pulled directly from the uploaded Raw Data sheet.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-zinc-950 text-xs uppercase tracking-[0.16em] text-zinc-500">
                  <tr>
                    {SEASON_TABLE_STATS.map((key) => (
                      <th key={key} className="px-4 py-3">{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {seasonStats.map((season, index) => (
                    <tr key={`${season.season}-${index}`} className="border-t border-zinc-800">
                      {SEASON_TABLE_STATS.map((key) => {
                        const value = key === 'Team'
                          ? season.team
                          : key === 'Season'
                            ? season.season
                            : season.stats?.[key]

                        return (
                          <td key={key} className="px-4 py-3">
                            <StatValue statKey={key} value={value} />
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {seasonStats.length === 0 && (
              <div className="p-6 text-sm font-bold text-zinc-500">
                No matching Raw Data rows were found for this player in the uploaded workbook.
              </div>
            )}
          </section>
        </div>
      </motion.div>
    </motion.div>
  )
}

function ModalStat({ label, value }: { label: string; value: any }) {
  const tone = getStatTone(label, value)

  return (
    <div className={`rounded-2xl border p-4 transition ${tone.cardClass}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-zinc-500">{label}</p>
        {tone.label && (
          <span className={`rounded-full px-2 py-0.5 text-[0.6rem] font-black uppercase tracking-[0.14em] ${tone.badgeClass}`}>
            {tone.label}
          </span>
        )}
      </div>
      <p className={`mt-2 text-lg font-black ${tone.valueClass}`}>{formatValue(value)}</p>
    </div>
  )
}

function StatValue({ statKey, value }: { statKey: string; value: any }) {
  const tone = getStatTone(statKey, value)

  if (!tone.label) {
    return <span className="font-bold text-zinc-300">{formatValue(value)}</span>
  }

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${tone.tableClass}`}>
      {formatValue(value)}
    </span>
  )
}

type StatTone = {
  label: string
  cardClass: string
  valueClass: string
  badgeClass: string
  tableClass: string
}

const NEUTRAL_TONE: StatTone = {
  label: '',
  cardClass: 'border-zinc-800 bg-zinc-950',
  valueClass: 'text-white',
  badgeClass: 'bg-zinc-800 text-zinc-300',
  tableClass: 'border-zinc-800 bg-zinc-950 text-zinc-300',
}

const STAT_THRESHOLDS: Record<string, number[]> = {
  yds: [1200, 900, 700, 500],
  recydsg: [80, 65, 50, 35],
  receivingyardspergame: [80, 65, 50, 35],
  yprr: [2.5, 2, 1.5, 1.2],
  receivinggrade: [85, 75, 65, 60],
  pff: [85, 75, 65, 60],
  pffgrade: [85, 75, 65, 60],
  gradespassroute: [85, 75, 65, 60],
  firstread: [30, 25, 20, 15],
  firstreadpct: [30, 25, 20, 15],
  oneReadPct: [30, 25, 20, 15],
  mtfrec: [0.25, 0.18, 0.12, 0.08],
  targetshare: [25, 22, 18, 14],
  tgtpct: [25, 22, 18, 14],
  tprr: [0.28, 0.24, 0.19, 0.15],
  rec: [100, 80, 60, 40],
  receptions: [100, 80, 60, 40],
  td: [10, 7, 5, 3],
  tds: [10, 7, 5, 3],
  fpg: [18, 15, 12, 9],
}

function getStatTone(label: string, value: any): StatTone {
  const number = toNumber(value)
  if (number === null) return NEUTRAL_TONE

  const key = normalizeStatKey(label)
  const thresholds = STAT_THRESHOLDS[key]
  if (!thresholds) return NEUTRAL_TONE

  if (number >= thresholds[0]) {
    return {
      label: 'Elite',
      cardClass: 'border-emerald-400/60 bg-emerald-400/10 shadow-[0_0_24px_rgba(52,211,153,0.10)]',
      valueClass: 'text-emerald-300',
      badgeClass: 'bg-emerald-400 text-zinc-950',
      tableClass: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300',
    }
  }

  if (number >= thresholds[1]) {
    return {
      label: 'Good',
      cardClass: 'border-lime-400/50 bg-lime-400/10',
      valueClass: 'text-lime-300',
      badgeClass: 'bg-lime-400 text-zinc-950',
      tableClass: 'border-lime-400/40 bg-lime-400/10 text-lime-300',
    }
  }

  if (number >= thresholds[2]) {
    return {
      label: 'Avg',
      cardClass: 'border-yellow-400/45 bg-yellow-400/10',
      valueClass: 'text-yellow-300',
      badgeClass: 'bg-yellow-400 text-zinc-950',
      tableClass: 'border-yellow-400/40 bg-yellow-400/10 text-yellow-300',
    }
  }

  if (number >= thresholds[3]) {
    return {
      label: 'Low',
      cardClass: 'border-orange-400/45 bg-orange-400/10',
      valueClass: 'text-orange-300',
      badgeClass: 'bg-orange-400 text-zinc-950',
      tableClass: 'border-orange-400/40 bg-orange-400/10 text-orange-300',
    }
  }

  return {
    label: 'Bad',
    cardClass: 'border-red-400/45 bg-red-400/10',
    valueClass: 'text-red-300',
    badgeClass: 'bg-red-400 text-white',
    tableClass: 'border-red-400/40 bg-red-400/10 text-red-300',
  }
}

function normalizeStatKey(label: string) {
  const normalized = String(label)
    .toLowerCase()
    .replace(/1read/g, 'firstread')
    .replace(/receiving_grade/g, 'receivinggrade')
    .replace(/recyds\/g/g, 'recydsg')
    .replace(/fp\/g/g, 'fpg')
    .replace(/tgt\s*%/g, 'tgtpct')
    .replace(/first\s*read\s*%/g, 'firstreadpct')
    .replace(/mtf\/rec/g, 'mtfrec')
    .replace(/[^a-z0-9]/g, '')

  if (normalized === 'firstread') return 'firstreadpct'
  if (normalized === 'targetshare') return 'targetshare'
  if (normalized === 'tgtpct') return 'tgtpct'
  if (normalized === 'receivinggrade') return 'receivinggrade'
  if (normalized === 'gradespassroute') return 'gradespassroute'
  return normalized
}

function toNumber(value: any) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null

  const parsed = Number(String(value).replace(/,/g, '').replace(/%/g, '').trim())
  return Number.isFinite(parsed) ? parsed : null
}

function formatValue(value: any) {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return value.toLocaleString()
    return value.toLocaleString(undefined, { maximumFractionDigits: 3 })
  }
  return String(value)
}

function formatDate(value: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
