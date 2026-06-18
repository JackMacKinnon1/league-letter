'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, Database, FileSpreadsheet, Loader2, Plus, RotateCcw, Save, Upload, X } from 'lucide-react'
import { ReactNode, Dispatch, SetStateAction, useEffect, useMemo, useRef, useState } from 'react'

const POSITIONS = ['WR', 'TE', 'QB', 'RB'] as const

const DEFAULT_WEIGHTS = {
  metricWeights: {
    yprr: 0.25,
    pff: 0.15,
    yards: 0.45,
    firstRead: 0.1,
    mtfPerRec: 0.05,
  },
  seasonWeights: {
    current: 0.6,
    previous: 0.25,
    twoAgo: 0.15,
  },
  ageMultipliers: [
    { age: 19, multiplier: 1.5 },
    { age: 21, multiplier: 1.075 },
    { age: 23, multiplier: 1.05 },
    { age: 25, multiplier: 1 },
    { age: 28, multiplier: 0.95 },
    { age: 29, multiplier: 0.9 },
    { age: 31, multiplier: 0.85 },
    { age: 33, multiplier: 0.75 },
  ],
  missingSeasonScore: 3500,
  eliteThreshold: 9000,
  eliteBoost: 0.08,
  eliteDecay: {
    current: 1,
    previous: 0.7,
    twoAgo: 0.4,
  },
  ageBoostCap: 500,
  maxScore: 9999,
}

type Weights = typeof DEFAULT_WEIGHTS
type RawRow = Record<string, any>

type PreviewRanking = {
  rank: number
  player_key: string
  player_name: string
  team: string | null
  score: number
  latest_season: string | null
  seasons_played: string[]
  season_scores: Record<string, number>
  raw_rows: RawRow[]
}

type UploadResult = {
  success: boolean
  uploadId: string
  uploadedAt: string
  position: string
  fileName: string
  rowsStored: number
  rawRows?: RawRow[]
  weights?: Weights
  summary: {
    workbookSheets: string[]
    rawRowsRead: number
    finalRankingRowsRead: number
    rowsStored: number
    rawDataSheet: string | null
    finalRankingsSheet: string | null
    calculatedFromRawData?: boolean
    seasons?: string[]
  }
  topFive: Array<{
    rank: number
    player_name: string
    team: string | null
    score: number
  }>
}

const IMPORTANT_COLUMNS = [
  'Name',
  'Team',
  'POS',
  'G',
  'Year',
  'Season',
  'RecYDS/G',
  'YPRR',
  'MTF/REC',
  '1READ %',
  'Receiving_Grade',
  'Birth Date',
]

export default function PlayerScoresUploader() {
  const [uploadLabel, setUploadLabel] = useState('')
  const [position, setPosition] = useState<(typeof POSITIONS)[number]>('WR')
  const [file, setFile] = useState<File | null>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [preloadLoading, setPreloadLoading] = useState(false)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [rawRows, setRawRows] = useState<RawRow[]>([])
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS)
  const [showUpload, setShowUpload] = useState(false)
  const [search, setSearch] = useState('')
  const [previewRows, setPreviewRows] = useState<PreviewRanking[]>([])
  const [previewDirty, setPreviewDirty] = useState(false)
  const [draftRow, setDraftRow] = useState<RawRow | null>(null)
  const previewRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function loadExistingData() {
      setPreloadLoading(true)
      setMessage('')

      try {
        const response = await fetch(`/api/site-admin/player-scores/upload?position=${position}`, {
          signal: controller.signal,
        })
        const json = await response.json()

        if (!response.ok) throw new Error(json.error || 'Failed to load existing data.')

        const loadedRows = json.rawRows || []
        const loadedWeights = mergeWeights(json.weights || DEFAULT_WEIGHTS)
        setRawRows(loadedRows)
        setWeights(loadedWeights)
        setPreviewRows(calculatePreviewRankings(loadedRows, position, loadedWeights))
        setPreviewDirty(false)
        setUploadLabel(json.upload?.upload_label ? `${json.upload.upload_label} updated` : '')
        setResult(null)
      } catch (error: any) {
        if (error.name !== 'AbortError') setMessage(error.message || 'Failed to load existing data.')
      } finally {
        setPreloadLoading(false)
      }
    }

    loadExistingData()
    return () => controller.abort()
  }, [position])

  const editableColumns = useMemo(() => {
    const existingColumns = Array.from(new Set(rawRows.flatMap((row) => Object.keys(row))))
    const important = IMPORTANT_COLUMNS.filter((column) => existingColumns.includes(column))
    return Array.from(new Set([...important, ...existingColumns.filter((column) => important.length < 6 || column === 'Raw Score').slice(0, 3)]))
      .filter((column) => column !== 'Rank')
      .slice(0, 14)
  }, [rawRows])

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rawRows
    const needle = search.trim().toLowerCase()
    return rawRows.filter((row) =>
      String(row.Name || row.Player || row['Player Name'] || '').toLowerCase().includes(needle)
    )
  }, [rawRows, search])

  async function uploadFile() {
    setMessage('')
    setResult(null)

    if (!position || !file) {
      setMessage('Position and Raw Data workbook are required.')
      return
    }

    setLoading(true)

    try {
      const formData = new FormData()
      formData.append('uploadLabel', uploadLabel)
      formData.append('position', position)
      formData.append('file', file)
      formData.append('weights', JSON.stringify(weights))
      formData.append('previewOnly', 'true')

      const response = await fetch('/api/site-admin/player-scores/upload', {
        method: 'POST',
        body: formData,
      })

      const json = await response.json()

      if (!response.ok) {
        setMessage(json.error || 'Upload failed.')
        return
      }

      const nextRows = json.rawRows || []
      const nextWeights = mergeWeights(json.weights || weights)
      setResult(json)
      setRawRows(nextRows)
      setWeights(nextWeights)
      setPreviewRows(calculatePreviewRankings(nextRows, position, nextWeights))
      setPreviewDirty(false)
      setShowUpload(false)
      setMessage(`${position} rankings preview updated from the uploaded raw data. Review it, tune weights, then submit to save.`)
    } finally {
      setLoading(false)
    }
  }

  async function submitEditedRows() {
    setMessage('')
    setResult(null)

    if (!rawRows.length) {
      setMessage('There is no raw data to submit yet. Upload a Raw Data workbook first.')
      return
    }

    setLoading(true)

    try {
      const formData = new FormData()
      formData.append('uploadLabel', uploadLabel || `Manual ${position} update`)
      formData.append('position', position)
      formData.append('rawRows', JSON.stringify(rawRows))
      formData.append('weights', JSON.stringify(weights))

      const response = await fetch('/api/site-admin/player-scores/upload', {
        method: 'POST',
        body: formData,
      })

      const json = await response.json()

      if (!response.ok) {
        setMessage(json.error || 'Save failed.')
        return
      }

      const nextRows = json.rawRows || rawRows
      const nextWeights = mergeWeights(json.weights || weights)
      setResult(json)
      setRawRows(nextRows)
      setWeights(nextWeights)
      setPreviewRows(calculatePreviewRankings(nextRows, position, nextWeights))
      setPreviewDirty(false)
      setMessage(`${position} rankings recalculated and saved from edited raw data.`)
    } finally {
      setLoading(false)
    }
  }

  function markPreviewDirty() {
    setPreviewDirty(true)
  }

  function updateRawRow(rowIndex: number, column: string, value: string) {
    setRawRows((current) =>
      current.map((row, index) =>
        index === rowIndex ? { ...row, [column]: value } : row
      )
    )
    markPreviewDirty()
  }

  function makeBlankRow(): RawRow {
    return {
      Name: '',
      Team: '',
      POS: position,
      G: '',
      Year: new Date().getFullYear(),
      Season: new Date().getFullYear(),
      'RecYDS/G': '',
      YPRR: '',
      'MTF/REC': '',
      '1READ %': '',
      Receiving_Grade: '',
      'Birth Date': '',
    }
  }

  function addBlankRow() {
    setDraftRow(makeBlankRow())
  }

  function updateDraftRow(column: string, value: string) {
    setDraftRow((current) => ({ ...(current || makeBlankRow()), [column]: value }))
  }

  function submitDraftRow() {
    if (!draftRow) return
    const name = String(draftRow.Name || draftRow.Player || draftRow['Player Name'] || '').trim()
    if (!name) {
      setMessage('Player name is required before adding the row.')
      return
    }
    setRawRows((current) => [draftRow, ...current])
    setDraftRow(null)
    markPreviewDirty()
    setMessage('Temporary row added. Click Preview Rankings to update the preview, then submit when ready.')
  }

  function removeRow(rowIndex: number) {
    setRawRows((current) => current.filter((_, index) => index !== rowIndex))
    markPreviewDirty()
  }

  function previewRankingsAndScroll() {
    setPreviewRows(calculatePreviewRankings(rawRows, position, weights))
    setPreviewDirty(false)
    requestAnimationFrame(() => {
      previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  function handleWeightsChange(next: SetStateAction<Weights>) {
    setWeights(next)
    markPreviewDirty()
  }

  return (
    <section className="overflow-hidden rounded-[2rem] border border-zinc-800 bg-zinc-950 shadow-2xl">
      <div className="relative border-b border-zinc-800 bg-white/[0.035] p-6">
        <div className="absolute right-6 top-6 hidden h-24 w-24 rounded-full bg-emerald-400/10 blur-3xl md:block" />

        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400 text-zinc-950 shadow-lg shadow-emerald-500/20">
              <FileSpreadsheet size={22} />
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-300">
                Admin Data Import
              </p>
              <h2 className="mt-1 text-3xl font-black text-white">
                WR Valuator Raw Data Calculator
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowUpload((value) => !value)}
              className="flex items-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-black text-white transition hover:border-emerald-300"
            >
              <Upload size={16} />
              Upload New Data
            </button>
            <button
              onClick={() => setWeights(DEFAULT_WEIGHTS)}
              className="flex items-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-black text-white transition hover:border-emerald-300"
            >
              <RotateCcw size={16} />
              Reset Weights
            </button>
          </div>
        </div>

        <p className="relative mt-4 max-w-4xl text-sm leading-7 text-zinc-400">
          Upload the workbook’s <span className="font-black text-white">Raw Data</span> tab, tune the model weights, and the app calculates the raw season scores plus final rankings at upload time. Existing saved data is preloaded here so you can edit rows directly and submit updated rankings without rebuilding the Excel file.
        </p>
      </div>

      <div className="p-6">
        <div className="grid gap-4 lg:grid-cols-[160px_1fr]">
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
              Save label
            </label>
            <input
              value={uploadLabel}
              onChange={(event) => setUploadLabel(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 font-bold text-white outline-none transition focus:border-emerald-400"
              placeholder="Example: 2026 WR model - tuned weights"
            />
          </div>
        </div>

        {showUpload && (
          <div className="mt-5 rounded-[1.5rem] border border-dashed border-zinc-700 bg-zinc-900 p-4">
            <label className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
              Raw Data workbook
            </label>
            <input
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
              className="mt-2 w-full rounded-2xl border border-dashed border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-300 file:mr-4 file:rounded-xl file:border-0 file:bg-emerald-400 file:px-3 file:py-2 file:font-black file:text-zinc-950"
            />
            <button
              onClick={uploadFile}
              disabled={loading}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 py-3 font-black text-zinc-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
              {loading ? 'Calculating rankings...' : `Calculate ${position} Rankings From Upload`}
            </button>
          </div>
        )}

        <WeightsEditor weights={weights} setWeights={handleWeightsChange} />

        <div className="mt-4 flex flex-col gap-3 rounded-[1.5rem] border border-emerald-400/20 bg-emerald-400/[0.035] p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="font-black text-white">Preview updated rankings</h3>
            <p className="mt-1 text-sm font-bold text-zinc-500">
              Edits and weight changes are staged first so the page stays fast. Click preview when you want to recalculate and jump to the rankings.
            </p>
          </div>
          <button
            onClick={previewRankingsAndScroll}
            disabled={!rawRows.length}
            className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-black text-zinc-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <CheckCircle2 size={17} />
            {previewDirty ? 'Preview Rankings' : 'Refresh Preview'}
          </button>
        </div>

        <div className="mt-6 rounded-[1.5rem] border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <Database size={18} className="text-emerald-300" />
              <div>
                <h3 className="text-lg font-black text-white">Editable Raw Data</h3>
                <p className="text-xs font-bold text-zinc-500">
                  {preloadLoading ? 'Loading saved data...' : `${rawRows.length} raw rows loaded`}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search player"
                className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm font-bold text-white outline-none focus:border-emerald-400"
              />
              <button
                onClick={addBlankRow}
                className="flex items-center justify-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-black text-white transition hover:border-emerald-300"
              >
                <Plus size={16} />
                Add Row
              </button>
            </div>
          </div>

          {draftRow && (
            <DraftRowEditor
              row={draftRow}
              columns={IMPORTANT_COLUMNS}
              onChange={updateDraftRow}
              onSubmit={submitDraftRow}
              onCancel={() => setDraftRow(null)}
            />
          )}

          <div className="mt-4 max-h-[520px] overflow-auto rounded-2xl border border-zinc-800 bg-zinc-950">
            <table className="w-full min-w-[1320px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-zinc-900 text-[0.68rem] uppercase tracking-[0.18em] text-zinc-500">
                <tr>
                  <th className="px-3 py-3">Remove</th>
                  {editableColumns.map((column) => (
                    <th
                      key={column}
                      className={`px-3 py-3 ${isNameColumn(column) ? 'min-w-[220px]' : ''}`}
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {filteredRows.slice(0, 250).map((row) => {
                  const rowIndex = rawRows.indexOf(row)
                  return (
                    <tr key={`${rowIndex}-${row.Name || row.Player || 'row'}`} className="hover:bg-white/[0.03]">
                      <td className="px-3 py-2">
                        <button
                          onClick={() => removeRow(rowIndex)}
                          className="rounded-xl border border-zinc-800 p-2 text-zinc-500 transition hover:border-red-400 hover:text-red-300"
                        >
                          <X size={14} />
                        </button>
                      </td>
                      {editableColumns.map((column) => (
                        <td key={column} className={`px-3 py-2 ${isNameColumn(column) ? 'min-w-[220px]' : ''}`}>
                          <input
                            value={row[column] ?? ''}
                            onChange={(event) => updateRawRow(rowIndex, column, event.target.value)}
                            className={`w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 font-bold text-zinc-100 outline-none focus:border-emerald-400 ${isNameColumn(column) ? 'min-w-[190px]' : ''}`}
                          />
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {filteredRows.length > 250 && (
            <p className="mt-3 text-xs font-bold text-zinc-500">
              Showing first 250 matching rows. Search a player name to narrow the editable table.
            </p>
          )}

          <div ref={previewRef}>
            <RankingsPreview rankings={previewRows} isDirty={previewDirty} />
          </div>

          <button
            onClick={submitEditedRows}
            disabled={loading || !rawRows.length}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 py-3 font-black text-zinc-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            {loading ? 'Saving calculated rankings...' : 'Submit Current Preview as Updated Rankings'}
          </button>
        </div>

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
              <Stat label="Seasons" value={result.summary?.seasons?.join(', ') || '—'} />
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
      </div>
    </section>
  )
}


function RankingsPreview({ rankings, isDirty }: { rankings: PreviewRanking[]; isDirty: boolean }) {
  const topRows = rankings.slice(0, 25)

  return (
    <div className="mt-5 rounded-[1.5rem] border border-emerald-400/20 bg-emerald-400/[0.035] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="text-emerald-300" size={18} />
          <div>
            <h3 className="font-black text-white">Live Rankings Preview</h3>
            <p className="text-xs font-bold text-zinc-500">
              Click Preview Rankings after editing raw data or multipliers. Nothing is saved until you submit.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isDirty && (
            <p className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-black text-amber-200">
              Preview needs refresh
            </p>
          )}
          <p className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs font-black text-emerald-300">
            {rankings.length} players
          </p>
        </div>
      </div>

      {topRows.length ? (
        <div className="mt-4 max-h-[460px] overflow-auto rounded-2xl border border-zinc-800 bg-zinc-950">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-zinc-900 text-[0.68rem] uppercase tracking-[0.18em] text-zinc-500">
              <tr>
                <th className="px-4 py-3">Rank</th>
                <th className="px-4 py-3">Player</th>
                <th className="px-4 py-3">Team</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Seasons</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {topRows.map((player) => (
                <tr key={player.player_key} className="hover:bg-white/[0.03]">
                  <td className="px-4 py-3 font-black text-emerald-300">#{player.rank}</td>
                  <td className="px-4 py-3 font-black text-white">{player.player_name}</td>
                  <td className="px-4 py-3 font-bold text-zinc-400">{player.team || 'FA'}</td>
                  <td className="px-4 py-3 text-lg font-black text-white">{player.score}</td>
                  <td className="px-4 py-3 text-xs font-bold text-zinc-500">{player.seasons_played.join(', ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm font-bold text-zinc-500">
          Add or upload raw rows to generate a live preview.
        </p>
      )}
    </div>
  )
}


function DraftRowEditor({
  row,
  columns,
  onChange,
  onSubmit,
  onCancel,
}: {
  row: RawRow
  columns: string[]
  onChange: (column: string, value: string) => void
  onSubmit: () => void
  onCancel: () => void
}) {
  return (
    <div className="mt-4 rounded-[1.5rem] border border-emerald-400/25 bg-emerald-400/[0.035] p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h4 className="font-black text-white">New temporary row</h4>
          <p className="text-xs font-bold text-zinc-500">
            Fill this out, then add it to the raw data. Rankings will not recalculate until you click Preview Rankings.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm font-black text-white transition hover:border-red-400 hover:text-red-300"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            className="rounded-2xl bg-emerald-400 px-4 py-2 text-sm font-black text-zinc-950 transition hover:bg-emerald-300"
          >
            Add Row To Raw Data
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {columns.map((column) => (
          <label key={column} className={`${isNameColumn(column) ? 'sm:col-span-2' : ''}`}>
            <span className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-zinc-500">{column}</span>
            <input
              value={row[column] ?? ''}
              onChange={(event) => onChange(column, event.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 font-bold text-white outline-none focus:border-emerald-400"
            />
          </label>
        ))}
      </div>
    </div>
  )
}

function WeightsEditor({
  weights,
  setWeights,
}: {
  weights: Weights
  setWeights: Dispatch<SetStateAction<Weights>>
}) {
  function update(path: string[], value: string) {
    const numeric = Number(value)
    setWeights((current) => {
      const next: any = structuredClone(current)
      let cursor = next
      for (const key of path.slice(0, -1)) cursor = cursor[key]
      cursor[path[path.length - 1]] = Number.isFinite(numeric) ? numeric : 0
      return next
    })
  }

  function updateAgeMultiplier(index: number, key: 'age' | 'multiplier', value: string) {
    const numeric = Number(value)
    setWeights((current) => {
      const next = structuredClone(current)
      next.ageMultipliers[index] = {
        ...next.ageMultipliers[index],
        [key]: Number.isFinite(numeric) ? numeric : 0,
      }
      return next
    })
  }

  return (
    <div className="mt-6 rounded-[1.5rem] border border-zinc-800 bg-zinc-900 p-4">
      <h3 className="text-lg font-black text-white">Calculation Weights</h3>
      <p className="mt-1 text-sm text-zinc-500">
        These replace the workbook’s Weights tab. The upload route uses these values when calculating raw season scores, recency weighting, elite-season boost, and age multipliers.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <WeightCard title="Raw Score Metrics">
          <NumberInput label="YPRR" value={weights.metricWeights.yprr} onChange={(value) => update(['metricWeights', 'yprr'], value)} />
          <NumberInput label="PFF" value={weights.metricWeights.pff} onChange={(value) => update(['metricWeights', 'pff'], value)} />
          <NumberInput label="Yards / Game" value={weights.metricWeights.yards} onChange={(value) => update(['metricWeights', 'yards'], value)} />
          <NumberInput label="First Read %" value={weights.metricWeights.firstRead} onChange={(value) => update(['metricWeights', 'firstRead'], value)} />
          <NumberInput label="MTF / Rec" value={weights.metricWeights.mtfPerRec} onChange={(value) => update(['metricWeights', 'mtfPerRec'], value)} />
        </WeightCard>

        <WeightCard title="Final Ranking Blend">
          <NumberInput label="Current Year" value={weights.seasonWeights.current} onChange={(value) => update(['seasonWeights', 'current'], value)} />
          <NumberInput label="Previous Year" value={weights.seasonWeights.previous} onChange={(value) => update(['seasonWeights', 'previous'], value)} />
          <NumberInput label="Two Years Ago" value={weights.seasonWeights.twoAgo} onChange={(value) => update(['seasonWeights', 'twoAgo'], value)} />
          <NumberInput label="Non-Rookie One-Season Missing Score" value={weights.missingSeasonScore} onChange={(value) => update(['missingSeasonScore'], value)} />
          <NumberInput label="Max Score" value={weights.maxScore} onChange={(value) => update(['maxScore'], value)} />
        </WeightCard>

        <WeightCard title="Elite + Age Rules">
          <NumberInput label="Elite Threshold" value={weights.eliteThreshold} onChange={(value) => update(['eliteThreshold'], value)} />
          <NumberInput label="Elite Boost" value={weights.eliteBoost} onChange={(value) => update(['eliteBoost'], value)} />
          <NumberInput label="Current Elite Decay" value={weights.eliteDecay.current} onChange={(value) => update(['eliteDecay', 'current'], value)} />
          <NumberInput label="Previous Elite Decay" value={weights.eliteDecay.previous} onChange={(value) => update(['eliteDecay', 'previous'], value)} />
          <NumberInput label="Two Ago Elite Decay" value={weights.eliteDecay.twoAgo} onChange={(value) => update(['eliteDecay', 'twoAgo'], value)} />
          <NumberInput label="Age Boost Cap" value={weights.ageBoostCap} onChange={(value) => update(['ageBoostCap'], value)} />
        </WeightCard>
      </div>

      <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
        <h4 className="font-black text-white">Age Multipliers</h4>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {weights.ageMultipliers.map((item, index) => (
            <div key={`${item.age}-${index}`} className="grid grid-cols-2 gap-2 rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
              <NumberInput label="Age" value={item.age} onChange={(value) => updateAgeMultiplier(index, 'age', value)} />
              <NumberInput label="Multiplier" value={item.multiplier} onChange={(value) => updateAgeMultiplier(index, 'multiplier', value)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function WeightCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
      <h4 className="font-black text-white">{title}</h4>
      <div className="mt-3 grid gap-3">{children}</div>
    </div>
  )
}

function NumberInput({ label, value, onChange }: { label: string; value: number; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-zinc-500">{label}</span>
      <input
        type="number"
        step="0.001"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 font-bold text-white outline-none focus:border-emerald-400"
      />
    </label>
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

function mergeWeights(value: Partial<Weights>): Weights {
  return {
    metricWeights: { ...DEFAULT_WEIGHTS.metricWeights, ...(value.metricWeights || {}) },
    seasonWeights: { ...DEFAULT_WEIGHTS.seasonWeights, ...(value.seasonWeights || {}) },
    ageMultipliers: value.ageMultipliers?.length ? value.ageMultipliers as Weights['ageMultipliers'] : DEFAULT_WEIGHTS.ageMultipliers,
    missingSeasonScore: Number(value.missingSeasonScore ?? DEFAULT_WEIGHTS.missingSeasonScore),
    eliteThreshold: Number(value.eliteThreshold ?? DEFAULT_WEIGHTS.eliteThreshold),
    eliteBoost: Number(value.eliteBoost ?? DEFAULT_WEIGHTS.eliteBoost),
    eliteDecay: { ...DEFAULT_WEIGHTS.eliteDecay, ...(value.eliteDecay || {}) },
    ageBoostCap: Number(value.ageBoostCap ?? DEFAULT_WEIGHTS.ageBoostCap),
    maxScore: Number(value.maxScore ?? DEFAULT_WEIGHTS.maxScore),
  }
}


function calculatePreviewRankings(rawRows: RawRow[], position: string, weights: Weights): PreviewRanking[] {
  const cleanedRows = (rawRows || [])
    .map((row) => ({ ...row }))
    .filter((row) => getRowString(row, ['Name', 'Player', 'Player Name']))
    .filter((row) => {
      const rowPosition = getRowString(row, ['POS', 'Position']).toUpperCase()
      return !rowPosition || rowPosition === position
    })

  if (!cleanedRows.length) return []

  const scoredRows = calculateSeasonRawScoresForPreview(cleanedRows, weights)
  const seasons = Array.from(new Set(scoredRows.map((row) => getRowSeason(row)).filter(Boolean)))
    .sort((a, b) => Number(b) - Number(a))
    .slice(0, 3)

  const byPlayer = new Map<string, RawRow[]>()
  for (const row of scoredRows) {
    const name = getRowString(row, ['Name', 'Player', 'Player Name'])
    const key = normalizePreviewKey(name)
    if (!byPlayer.has(key)) byPlayer.set(key, [])
    byPlayer.get(key)?.push(row)
  }

  const rankings: PreviewRanking[] = []
  for (const [playerKey, rows] of byPlayer.entries()) {
    const sortedRows = [...rows].sort((a, b) => Number(getRowSeason(b) || 0) - Number(getRowSeason(a) || 0))
    const latest = sortedRows[0]
    const seasonScores: Record<string, number> = {}
    for (const row of sortedRows) {
      const season = getRowSeason(row)
      if (season) seasonScores[season] = getRowNumber(row, ['Raw Score']) ?? 0
    }

    rankings.push({
      rank: 0,
      player_key: playerKey,
      player_name: getRowString(latest, ['Name', 'Player', 'Player Name']),
      team: getRowString(latest, ['Team', 'Tm']) || null,
      score: calculatePreviewFinalScore({
        //@ts-ignore
        targetSeasons: seasons,
        seasonScores,
        birthDate: getRowDate(latest, ['Birth Date', 'DOB', 'Date of Birth']),
        weights,
      }),
      latest_season: getRowSeason(latest),
      seasons_played: Array.from(new Set(sortedRows.map((row) => getRowSeason(row)).filter(Boolean))) as string[],
      season_scores: seasonScores,
      raw_rows: sortedRows,
    })
  }

  return rankings
    .sort((a, b) => b.score - a.score || a.player_name.localeCompare(b.player_name))
    .map((row, index) => ({ ...row, rank: index + 1 }))
}

function calculateSeasonRawScoresForPreview(rows: RawRow[], weights: Weights) {
  const aliases = {
    yards: ['RecYDS/G', 'Receiving Yards/G', 'Yards/G', 'YDS'],
    yprr: ['YPRR'],
    mtfPerRec: ['MTF/REC', 'MTF Per Rec'],
    firstRead: ['1READ %', '1Read %', 'First Read %', 'First Rd %'],
    pff: ['Receiving_Grade', 'Receiving Grade', 'grades_pass_route', 'PFF Grade', 'PFF'],
  }

  const bySeason = new Map<string, RawRow[]>()
  for (const row of rows) {
    const season = getRowSeason(row) || 'unknown'
    bySeason.set(season, [...(bySeason.get(season) || []), row])
  }

  const output: RawRow[] = []
  for (const seasonRows of bySeason.values()) {
    const metricPercentiles = new Map<string, Map<RawRow, number>>()

    for (const [metricKey, metricAliases] of Object.entries(aliases)) {
      const values = seasonRows
        .map((row) => getRowNumber(row, metricAliases))
        .filter((value): value is number => Number.isFinite(value))
      const map = new Map<RawRow, number>()
      for (const row of seasonRows) {
        const value = getRowNumber(row, metricAliases)
        map.set(row, Number.isFinite(value) && values.length > 1 ? percentRankIncPreview(values, Number(value)) : 0.5)
      }
      metricPercentiles.set(metricKey, map)
    }

    for (const row of seasonRows) {
      const yprrPct = metricPercentiles.get('yprr')?.get(row) ?? 0.5
      const pffPct = metricPercentiles.get('pff')?.get(row) ?? 0.5
      const yardsPct = metricPercentiles.get('yards')?.get(row) ?? 0.5
      const firstReadPct = metricPercentiles.get('firstRead')?.get(row) ?? 0.5
      const mtfPct = metricPercentiles.get('mtfPerRec')?.get(row) ?? 0.5
      const metricWeights = weights.metricWeights
      const totalWeight = metricWeights.yprr + metricWeights.pff + metricWeights.yards + metricWeights.firstRead + metricWeights.mtfPerRec
      const weightedPercentile = totalWeight > 0
        ? (yprrPct * metricWeights.yprr + pffPct * metricWeights.pff + yardsPct * metricWeights.yards + firstReadPct * metricWeights.firstRead + mtfPct * metricWeights.mtfPerRec) / totalWeight
        : 0.5

      output.push({
        ...row,
        'Yards %': roundPreview(yardsPct, 4),
        'YPRR %': roundPreview(yprrPct, 4),
        'MTF %': roundPreview(mtfPct, 4),
        'First Rd %': roundPreview(firstReadPct, 4),
        'PFF %': roundPreview(pffPct, 4),
        'Raw Score': roundPreview(weightedPercentile * 9999, 2),
      })
    }
  }

  return output
}

function calculatePreviewFinalScore({
  targetSeasons,
  seasonScores,
  birthDate,
  weights,
}: {
  targetSeasons: string[]
  seasonScores: Record<string, number>
  birthDate: Date | null
  weights: Weights
}) {
  const [currentSeason, previousSeason, twoAgoSeason] = targetSeasons
  const hasCurrent = Boolean(currentSeason && seasonScores[currentSeason] !== undefined)
  const hasPrevious = Boolean(previousSeason && seasonScores[previousSeason] !== undefined)
  const hasTwoAgo = Boolean(twoAgoSeason && seasonScores[twoAgoSeason] !== undefined)

  const isCurrentSeasonRookie = hasCurrent && !hasPrevious && !hasTwoAgo
  const isPreviousSeasonRookie = hasPrevious && !hasTwoAgo

  const includedSeasonSlots = isCurrentSeasonRookie
    ? ([
        { hasSeason: hasCurrent, score: Number(seasonScores[currentSeason]), weight: weights.seasonWeights.current },
      ])
    : isPreviousSeasonRookie
      ? ([
          { hasSeason: hasCurrent, score: Number(seasonScores[currentSeason]), weight: weights.seasonWeights.current },
          { hasSeason: hasPrevious, score: Number(seasonScores[previousSeason]), weight: weights.seasonWeights.previous },
        ])
      : ([
          { hasSeason: hasCurrent, score: Number(seasonScores[currentSeason]), weight: weights.seasonWeights.current },
          { hasSeason: hasPrevious, score: Number(seasonScores[previousSeason]), weight: weights.seasonWeights.previous },
          { hasSeason: hasTwoAgo, score: Number(seasonScores[twoAgoSeason]), weight: weights.seasonWeights.twoAgo },
        ])

  const realSeasonScores = includedSeasonSlots
    .filter((slot) => slot.hasSeason && Number.isFinite(slot.score))
    .map((slot) => slot.score)

  const missingScore = realSeasonScores.length >= 2
    ? realSeasonScores.reduce((total, score) => total + score, 0) / realSeasonScores.length
    : weights.missingSeasonScore

  const denominator = includedSeasonSlots.reduce((total, slot) => total + slot.weight, 0)
  const weightedScoreTotal = includedSeasonSlots.reduce((total, slot) => (
    total + (slot.hasSeason ? slot.score : missingScore) * slot.weight
  ), 0)

  const baseScore = realSeasonScores.length > 0 && denominator > 0
    ? weightedScoreTotal / denominator
    : 0

  const currentRealScore = hasCurrent ? Number(seasonScores[currentSeason]) : null
  const previousRealScore = hasPrevious ? Number(seasonScores[previousSeason]) : null
  const twoAgoRealScore = hasTwoAgo ? Number(seasonScores[twoAgoSeason]) : null

  const eliteMultiplier = 1 + Math.max(
    currentRealScore !== null && currentRealScore > weights.eliteThreshold ? weights.eliteBoost * weights.eliteDecay.current : 0,
    previousRealScore !== null && previousRealScore > weights.eliteThreshold ? weights.eliteBoost * weights.eliteDecay.previous : 0,
    twoAgoRealScore !== null && twoAgoRealScore > weights.eliteThreshold ? weights.eliteBoost * weights.eliteDecay.twoAgo : 0
  )

  const preAgeScore = baseScore * eliteMultiplier
  const ageMultiplier = getPreviewAgeMultiplier(birthDate, weights.ageMultipliers)
  const ageAdjustedScore = ageMultiplier > 1
    ? Math.min(preAgeScore * ageMultiplier, preAgeScore + weights.ageBoostCap)
    : preAgeScore * ageMultiplier

  return Math.min(weights.maxScore, Math.round(ageAdjustedScore))
}

function getPreviewAgeMultiplier(birthDate: Date | null, multipliers: Array<{ age: number; multiplier: number }>) {
  if (!birthDate) return 1
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const beforeBirthday = today.getMonth() < birthDate.getMonth() || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())
  if (beforeBirthday) age -= 1
  const sorted = [...multipliers].sort((a, b) => a.age - b.age)
  let match = sorted[0]
  for (const item of sorted) if (age >= item.age) match = item
  return Number(match?.multiplier || 1)
}

function getRowSeason(row: RawRow) {
  return getRowString(row, ['Year', 'Season']) || null
}

function getRowString(row: RawRow, aliases: string[]) {
  const value = getRowValue(row, aliases)
  if (value === undefined || value === null) return ''
  return String(value).trim()
}

function getRowNumber(row: RawRow, aliases: string[]) {
  const value = getRowValue(row, aliases)
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (value === undefined || value === null || value === '') return null
  const parsed = Number(String(value).replace(/[$,%]/g, '').replace(/,/g, '').trim())
  return Number.isFinite(parsed) ? parsed : null
}

function getRowDate(row: RawRow, aliases: string[]) {
  const value = getRowValue(row, aliases)
  if (!value) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  const parsed = new Date(String(value))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function getRowValue(row: RawRow, aliases: string[]) {
  for (const alias of aliases) {
    if (row[alias] !== undefined && row[alias] !== null && String(row[alias]).trim() !== '') return row[alias]
    const matchedKey = Object.keys(row).find((key) => normalizePreviewHeader(key) === normalizePreviewHeader(alias))
    if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null && String(row[matchedKey]).trim() !== '') return row[matchedKey]
  }
  return undefined
}

function percentRankIncPreview(values: number[], target: number) {
  const sorted = [...values].filter(Number.isFinite).sort((a, b) => a - b)
  const n = sorted.length
  if (n <= 1) return 0.5
  if (target <= sorted[0]) return 0
  if (target >= sorted[n - 1]) return 1
  for (let i = 0; i < n - 1; i += 1) {
    const low = sorted[i]
    const high = sorted[i + 1]
    if (target === low) return i / (n - 1)
    if (target > low && target < high) return (i + (high === low ? 0 : (target - low) / (high - low))) / (n - 1)
  }
  return 0.5
}

function isNameColumn(column: string) {
  return ['name', 'player', 'playername'].includes(normalizePreviewHeader(column))
}

function normalizePreviewKey(value: string) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
}

function normalizePreviewHeader(value: string) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function roundPreview(value: number, places: number) {
  const factor = Math.pow(10, places)
  return Math.round(value * factor) / factor
}
