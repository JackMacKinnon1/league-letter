'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Gauge, Info, Search, Trophy, Users } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useState } from 'react'
import PlayerAdvancedStatsModal from '@/components/PlayerAdvancedStatsModal'
import PlayerComparisonModal from '@/components/PlayerComparisonModal'
import WRRouteProjectionModal from '@/components/WRRouteProjectionModal'
import type { PlayerScoreRow } from '@/lib/playerScoreStats'

const WRCalculationModal = dynamic(() => import('@/components/WRCalculationModal'), {
  ssr: false,
})

type UploadOption = {
  id: string
  position: string
  file_name: string | null
  upload_label: string | null
  uploaded_at: string
  summary?: Record<string, any>
}

const POSITIONS = ['WR', 'TE', 'QB', 'RB']

export default function PlayerScoresPage() {
  const [position, setPosition] = useState('WR')
  const [uploadId, setUploadId] = useState('')
  const [uploads, setUploads] = useState<UploadOption[]>([])
  const [selectedUpload, setSelectedUpload] = useState<UploadOption | null>(null)
  const [rows, setRows] = useState<PlayerScoreRow[]>([])
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerScoreRow | null>(null)
  const [showCalculationModal, setShowCalculationModal] = useState(false)
  const [showComparisonModal, setShowComparisonModal] = useState(false)
  const [showRouteProjectionModal, setShowRouteProjectionModal] = useState(false)
  const [wrToolRows, setWrToolRows] = useState<PlayerScoreRow[]>([])
  const [wrToolUploadId, setWrToolUploadId] = useState('')
  const [wrToolLoading, setWrToolLoading] = useState(false)
  const [wrToolError, setWrToolError] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    let timedOut = false

    const timeoutId = window.setTimeout(() => {
      timedOut = true
      controller.abort()
    }, 20000)

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
        const responseText = await response.text()
        const json = responseText ? JSON.parse(responseText) : {}

        if (!response.ok) throw new Error(json.error || 'Failed to load scores.')

        setRows(json.rows || [])
        setTotalPages(json.totalPages || 1)
        setTotal(json.total || 0)
        setUploads(json.uploads || [])
        setSelectedUpload(json.selectedUpload || null)
        setUploadId(json.uploadId || uploadId)
      } catch (err: any) {
        if (err.name === 'AbortError') {
          if (timedOut) {
            setError('Loading rankings timed out. Refresh the page and try again.')
          }
        } else {
          setError(err.message || 'Failed to load scores.')
        }
      } finally {
        window.clearTimeout(timeoutId)
        setLoading(false)
      }
    }

    loadScores()
    return () => {
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [position, uploadId, page, search])

  const loadWrToolRows = useCallback(async () => {
    const activeUploadId = selectedUpload?.id || uploadId
    if (!activeUploadId || position !== 'WR') return
    if (wrToolRows.length > 0 && wrToolUploadId === activeUploadId) return

    setWrToolLoading(true)
    setWrToolError('')

    try {
      const params = new URLSearchParams({
        position: 'WR',
        uploadId: activeUploadId,
        all: 'true',
      })
      const response = await fetch(`/api/player-scores?${params.toString()}`)
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Failed to load receivers for the comparison tools.')

      setWrToolRows(json.rows || [])
      setWrToolUploadId(activeUploadId)
    } catch (err: any) {
      setWrToolError(err.message || 'Failed to load receivers for the comparison tools.')
    } finally {
      setWrToolLoading(false)
    }
  }, [position, selectedUpload?.id, uploadId, wrToolRows.length, wrToolUploadId])

  useEffect(() => {
    const activeUploadId = selectedUpload?.id || uploadId
    if (wrToolUploadId && wrToolUploadId !== activeUploadId) {
      setWrToolRows([])
      setWrToolUploadId('')
      setWrToolError('')
    }
  }, [selectedUpload?.id, uploadId, wrToolUploadId])

  function openComparisonModal() {
    setShowComparisonModal(true)
    void loadWrToolRows()
  }

  function openRouteProjectionModal() {
    setShowRouteProjectionModal(true)
    void loadWrToolRows()
  }

  const topThree = useMemo(() => rows.slice(0, 3), [rows])

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <section className="overflow-hidden rounded-[2rem] border border-zinc-800 bg-white/[0.035] p-6 shadow-2xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-300">
                Uploaded Rankings
              </p>
              <h1 className="mt-2 text-4xl font-black md:text-5xl">
                Player Scores
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">
                Rankings are calculated from the uploaded Raw Data and the saved WR Valuator weights. Click any player to view the advanced Raw Data stats saved from that import.
              </p>
              {selectedUpload && (
                <p className="mt-2 text-xs font-bold text-zinc-500">
                  Showing {selectedUpload.upload_label || selectedUpload.file_name || 'latest upload'} · uploaded {formatDate(selectedUpload.uploaded_at)}
                </p>
              )}
              {position === 'WR' && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCalculationModal(true)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-2.5 text-sm font-black text-emerald-200 transition hover:border-emerald-300 hover:bg-emerald-400/15 hover:text-white"
                  >
                    <Info size={17} />
                    How is this calculated?
                  </button>
                  <button
                    type="button"
                    onClick={openComparisonModal}
                    className="inline-flex items-center gap-2 rounded-2xl border border-sky-400/30 bg-sky-400/10 px-4 py-2.5 text-sm font-black text-sky-200 transition hover:border-sky-300 hover:bg-sky-400/15 hover:text-white"
                  >
                    <Users size={17} />
                    Compare WRs
                  </button>
                  <button
                    type="button"
                    onClick={openRouteProjectionModal}
                    className="inline-flex items-center gap-2 rounded-2xl border border-violet-400/30 bg-violet-400/10 px-4 py-2.5 text-sm font-black text-violet-200 transition hover:border-violet-300 hover:bg-violet-400/15 hover:text-white"
                  >
                    <Gauge size={17} />
                    Route Volume Projector
                  </button>
                </div>
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

          {loading && (
            <div className="h-1 w-full overflow-hidden bg-white/5">
              <div className="h-full w-1/2 animate-[loading-bar_1.15s_ease-in-out_infinite] rounded-full bg-emerald-400/80" />
            </div>
          )}

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
          <PlayerAdvancedStatsModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
        )}
        {showCalculationModal && (
          <WRCalculationModal
            onClose={() => setShowCalculationModal(false)}
            weights={(selectedUpload?.summary?.weights as any) || null}
          />
        )}
        {showComparisonModal && (
          <PlayerComparisonModal
            players={wrToolRows}
            loading={wrToolLoading}
            error={wrToolError}
            onClose={() => setShowComparisonModal(false)}
          />
        )}
        {showRouteProjectionModal && (
          <WRRouteProjectionModal
            players={wrToolRows}
            loading={wrToolLoading}
            error={wrToolError}
            onClose={() => setShowRouteProjectionModal(false)}
          />
        )}
      </AnimatePresence>
    </main>
  )
}

function formatDate(value: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
