'use client'

import { useState } from 'react'

export default function LoadLeagueForm() {
  const [sleeperLeagueId, setSleeperLeagueId] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function loadLeague() {
    setLoading(true)
    setMessage('')

    try {
      const res = await fetch('/api/leagues/load', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sleeperLeagueId }),
      })

      const json = await res.json()

      if (!res.ok) {
        setMessage(json.error || 'Could not load league.')
        setLoading(false)
        return
      }

      window.location.href = `/league/${json.leagueId}`
    } catch {
      setMessage('Something went wrong.')
      setLoading(false)
    }
  }

  return (
    <div className="mt-6 rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
      <p className="text-sm font-black uppercase tracking-[0.3em] text-emerald-400">
        Sleeper Import
      </p>

      <h1 className="mt-3 text-4xl font-black">Load a Sleeper league</h1>

      <p className="mt-3 leading-7 text-zinc-400">
        Paste your Sleeper League ID. If this league has not been loaded on
        League Letter before, you’ll become the league admin.
      </p>

      <div className="mt-6">
        <label className="text-sm font-bold text-zinc-300">
          Sleeper League ID
        </label>

        <input
          className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none focus:border-emerald-500"
          placeholder="Example: 1124830261361217536"
          value={sleeperLeagueId}
          onChange={(e) => setSleeperLeagueId(e.target.value)}
        />
      </div>

      <button
        onClick={loadLeague}
        disabled={loading || !sleeperLeagueId}
        className="mt-5 w-full rounded-2xl bg-emerald-500 py-3 font-black text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? 'Loading and syncing...' : 'Load League'}
      </button>

      {message && (
        <div className="mt-4 rounded-2xl border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
          {message}
        </div>
      )}
    </div>
  )
}