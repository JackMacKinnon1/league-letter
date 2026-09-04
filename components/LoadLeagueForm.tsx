'use client'

import { useState } from 'react'
import { Download, LoaderCircle } from 'lucide-react'

export default function LoadLeagueForm() {
  const [sleeperLeagueId, setSleeperLeagueId] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function loadLeague() {
    setLoading(true)
    setMessage('')

    try {
      const res = await fetch('/api/league/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    <div className="ll-card ll-form-card">
      <div className="ll-form-card-head">
        <span className="ll-feature-icon"><Download size={20} /></span>
        <div>
          <p className="ll-eyebrow">Sleeper import</p>
          <h1>Load a Sleeper league</h1>
        </div>
      </div>

      <p className="ll-form-intro">
        Paste your Sleeper League ID. If League Letter has never seen this room before,
        your account becomes the league admin automatically.
      </p>

      <label className="ll-field">
        <span>Sleeper League ID</span>
        <input
          className="ll-input"
          placeholder="Example: 1124830261361217536"
          value={sleeperLeagueId}
          onChange={(e) => setSleeperLeagueId(e.target.value)}
        />
      </label>

      <button onClick={loadLeague} disabled={loading || !sleeperLeagueId} className="ll-btn ll-btn-primary ll-btn-block">
        {loading ? <><LoaderCircle className="animate-spin" size={17} /> Loading and syncing…</> : <>Load league</>}
      </button>

      {message && <div className="ll-notice ll-notice-error">{message}</div>}
    </div>
  )
}
