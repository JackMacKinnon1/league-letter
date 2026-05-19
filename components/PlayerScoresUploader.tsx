'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { BarChart3, CheckCircle2, Database, FileSpreadsheet, Loader2, Upload } from 'lucide-react'
import { useState } from 'react'

const POSITIONS = ['WR', 'TE', 'QB', 'RB'] as const

type UploadResult = {
  success: boolean
  uploadId: string
  uploadedAt: string
  position: string
  fileName: string
  rowsStored: number
  summary: {
    workbookSheets: string[]
    rawRowsRead: number
    finalRankingRowsRead: number
    rowsStored: number
    rawDataSheet: string | null
    finalRankingsSheet: string | null
  }
  topFive: Array<{
    rank: number
    player_name: string
    team: string | null
    score: number
  }>
}

export default function PlayerScoresUploader() {
  const [uploadLabel, setUploadLabel] = useState('')
  const [position, setPosition] = useState<(typeof POSITIONS)[number]>('WR')
  const [file, setFile] = useState<File | null>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<UploadResult | null>(null)

  async function uploadFile() {
    setMessage('')
    setResult(null)

    if (!position || !file) {
      setMessage('Position and Excel workbook are required.')
      return
    }

    setLoading(true)

    try {
      const formData = new FormData()
      formData.append('uploadLabel', uploadLabel)
      formData.append('position', position)
      formData.append('file', file)

      const response = await fetch('/api/site-admin/player-scores/upload', {
        method: 'POST',
        body: formData,
      })

      const json = await response.json()

      if (!response.ok) {
        setMessage(json.error || 'Upload failed.')
        return
      }

      setResult(json)
      setMessage(`${position} rankings imported from the workbook successfully.`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="overflow-hidden rounded-[2rem] border border-zinc-800 bg-zinc-950 shadow-2xl">
      <div className="relative border-b border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-950 to-emerald-950/30 p-6">
        <div className="absolute right-6 top-6 hidden h-24 w-24 rounded-full bg-emerald-400/10 blur-3xl md:block" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400 text-zinc-950 shadow-lg shadow-emerald-500/20">
            <FileSpreadsheet size={22} />
          </div>

          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-300">
              Admin Data Import
            </p>
            <h2 className="mt-1 text-3xl font-black text-white">
              Player Scores Workbook Upload
            </h2>
          </div>
        </div>

        <p className="relative mt-4 max-w-3xl text-sm leading-7 text-zinc-400">
          Upload your completed Excel workbook. The app now stores the values already present on the
          <span className="font-black text-white"> Final Rankings </span>
          sheet instead of recalculating them. It also stores the uploaded Raw Data rows so the public rankings page can show a player-detail modal with advanced stats from the database.
        </p>
      </div>

      <div className="p-6">
        <div className="grid gap-4 lg:grid-cols-[180px_1fr_1.2fr]">
          <div>
            <label className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
              Position
            </label>
            <select
              value={position}
              onChange={(event) => setPosition(event.target.value as any)}
              className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 font-bold text-white outline-none transition focus:border-emerald-400"
            >
              {POSITIONS.map((pos) => (
                <option key={pos} value={pos}>
                  {pos}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
              Upload label
            </label>
            <input
              value={uploadLabel}
              onChange={(event) => setUploadLabel(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 font-bold text-white outline-none transition focus:border-emerald-400"
              placeholder="Example: 2025 WR model"
            />
          </div>

          <div>
            <label className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
              Excel workbook
            </label>
            <input
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
              className="mt-2 w-full rounded-2xl border border-dashed border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-300 file:mr-4 file:rounded-xl file:border-0 file:bg-emerald-400 file:px-3 file:py-2 file:font-black file:text-zinc-950"
            />
          </div>
        </div>

        <button
          onClick={uploadFile}
          disabled={loading}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 py-3 font-black text-zinc-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
          {loading ? 'Saving workbook data...' : `Import ${position} Workbook`}
        </button>

        <AnimatePresence>
          {message && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-sm font-bold text-zinc-300"
            >
              {message}
            </motion.div>
          )}
        </AnimatePresence>

        {result && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.2fr]"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Stat label="Position" value={result.position} />
              <Stat label="Rows Stored" value={result.rowsStored} />
              <Stat label="Raw Rows Read" value={result.summary?.rawRowsRead || 0} />
              <Stat label="Final Rows Read" value={result.summary?.finalRankingRowsRead || 0} />
            </div>

            <div className="rounded-[1.5rem] border border-zinc-800 bg-zinc-900 p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="text-emerald-300" size={18} />
                <h3 className="font-black text-white">Top 5 Preview</h3>
              </div>

              <div className="mt-3 space-y-2">
                {result.topFive.map((player) => (
                  <div
                    key={`${player.rank}-${player.player_name}`}
                    className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3"
                  >
                    <div>
                      <p className="font-black text-white">
                        #{player.rank} {player.player_name}
                      </p>
                      <p className="text-xs font-bold text-zinc-500">{player.team || 'FA'}</p>
                    </div>
                    <p className="text-xl font-black text-emerald-300">
                      {player.score}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        <div className="mt-6 rounded-[1.5rem] border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-center gap-2">
            <Database size={18} className="text-emerald-300" />
            <h3 className="text-lg font-black text-white">How this upload works now</h3>
          </div>
          <p className="mt-3 text-sm leading-7 text-zinc-400">
            The upload reads the <span className="font-black text-white">Final Rankings</span> sheet for the displayed player order and scores. It reads the <span className="font-black text-white">Raw Data</span> sheet for each player’s advanced stats. The public Player Scores page simply displays the saved ranking rows and opens a modal with the saved database stats when a player is clicked.
          </p>
        </div>
      </div>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-[1.5rem] border border-zinc-800 bg-zinc-900 p-4">
      <p className="text-[0.65rem] font-black uppercase tracking-[0.22em] text-zinc-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-white">{String(value)}</p>
    </div>
  )
}
