'use client'

import { useState } from 'react'
import { Upload } from 'lucide-react'

export default function WRValuatorUploader() {
  const [season, setSeason] = useState('2025')
  const [fpdFile, setFpdFile] = useState<File | null>(null)
  const [pffFile, setPffFile] = useState<File | null>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  async function uploadFiles() {
    setMessage('')
    setResult(null)

    if (!season || !fpdFile || !pffFile) {
      setMessage('Season, Fantasy Points CSV, and PFF CSV are required.')
      return
    }

    setLoading(true)

    const formData = new FormData()
    formData.append('season', season)
    formData.append('fpdFile', fpdFile)
    formData.append('pffFile', pffFile)

    const response = await fetch('/api/site-admin/wr-valuator/upload', {
      method: 'POST',
      body: formData,
    })

    const json = await response.json()

    if (!response.ok) {
      setMessage(json.error || 'Upload failed.')
      setLoading(false)
      return
    }

    setResult(json)
    setMessage('WR values imported successfully.')
    setLoading(false)
  }

  return (
    <section className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500 text-zinc-950">
          <Upload size={22} />
        </div>

        <div>
          <h2 className="text-3xl font-black">WR CSV Uploader</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Upload one season at a time. The model uses FPDS + PFF and pulls age
            from your Supabase players table.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div>
          <label className="text-sm font-bold text-zinc-400">Season</label>
          <input
            value={season}
            onChange={(event) => setSeason(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none focus:border-emerald-500"
            placeholder="2025"
          />
        </div>

        <div>
          <label className="text-sm font-bold text-zinc-400">
            Fantasy Points Data CSV
          </label>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => setFpdFile(event.target.files?.[0] || null)}
            className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm"
          />
        </div>

        <div>
          <label className="text-sm font-bold text-zinc-400">PFF CSV</label>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => setPffFile(event.target.files?.[0] || null)}
            className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm"
          />
        </div>
      </div>

      <button
        onClick={uploadFiles}
        disabled={loading}
        className="mt-5 w-full rounded-2xl bg-emerald-500 py-3 font-black text-zinc-950 hover:bg-emerald-400 disabled:opacity-60"
      >
        {loading ? 'Importing...' : 'Import WR Values'}
      </button>

      {message && (
        <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-300">
          {message}
        </div>
      )}

      {result && (
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          <Stat label="Season" value={result.season} />
          <Stat label="WR Rows Stored" value={result.yearlyRowsStored} />
          <Stat label="Player Values Stored" value={result.playerValuesStored} />
          <Stat
            label="Unmatched PFF"
            value={result.importSummary?.unmatchedPffCount || 0}
          />
          <Stat
            label="Missing Age"
            value={result.importSummary?.missingAgeCount || 0}
          />
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
        <h3 className="text-xl font-black">Expected CSV Columns</h3>

        <p className="mt-3 text-sm leading-7 text-zinc-400">
          Fantasy Points Data: XFP, REC, YDS, TGT, TGT %, TPRR, YPRR, TM YDS %.
        </p>

        <p className="mt-2 text-sm leading-7 text-zinc-400">
          PFF: grades_pass_route.
        </p>

        <p className="mt-2 text-sm leading-7 text-zinc-500">
          Age is no longer taken from the CSV. It is matched from the Supabase
          players table using player name and the age column.
        </p>
      </div>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black">{String(value)}</p>
    </div>
  )
}
