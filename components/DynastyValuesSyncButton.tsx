'use client'

import { useState } from 'react'

export default function DynastyValuesSyncButton() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function syncValues() {
    setLoading(true)
    setMessage('')

    const response = await fetch('/api/site-admin/dynasty-values/sync', {
      method: 'POST',
    })

    const json = await response.json()

    if (!response.ok) {
      setMessage(json.error || 'Failed to sync dynasty values.')
      setLoading(false)
      return
    }

    setMessage(
      `Synced ${json.valuesStored} dynasty values. Last refreshed: ${json.lastRefreshedAt}`
    )

    setLoading(false)
  }

  return (
    <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="text-3xl font-black">Dynasty Values</h2>

      <p className="mt-2 text-sm text-zinc-400">
        Pull LeagueLogs market values and store them by Sleeper player ID.
      </p>

      <button
        onClick={syncValues}
        disabled={loading}
        className="mt-5 w-full rounded-2xl bg-emerald-500 py-3 font-black text-zinc-950 hover:bg-emerald-400 disabled:opacity-60"
      >
        {loading ? 'Syncing...' : 'Sync Dynasty Values'}
      </button>

      {message && (
        <p className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-300">
          {message}
        </p>
      )}
    </div>
  )
}