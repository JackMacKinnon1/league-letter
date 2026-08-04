'use client'

import {
  AlertTriangle,
  Beaker,
  Check,
  Clipboard,
  Database,
  Globe2,
  Power,
  Radio,
  Save,
  Terminal,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

type FeedMode = 'public' | 'test'

type GameFeedSettings = {
  game_feed_enabled?: boolean | null
  game_feed_display_mode?: FeedMode | null
  game_feed_poll_seconds?: number | null
  game_feed_last_polled_at?: string | null
  game_feed_last_success_at?: string | null
  game_feed_last_error?: string | null
  game_feed_worker_heartbeat_at?: string | null
  game_feed_worker_started_at?: string | null
  game_feed_worker_stopped_at?: string | null
  game_feed_worker_name?: string | null
  game_feed_worker_version?: string | null
  game_feed_worker_mode?: FeedMode | null
  game_feed_source_sleeper_league_id?: string | null
}

type WorkerState = {
  feed_mode: FeedMode
  source_sleeper_league_id: string
  poll_seconds: number
  last_polled_at?: string | null
  last_success_at?: string | null
  last_error?: string | null
  worker_heartbeat_at?: string | null
  worker_started_at?: string | null
  worker_stopped_at?: string | null
  worker_name?: string | null
  worker_version?: string | null
}

export default function GameFeedManager({
  leagueId,
  initialSettings,
}: {
  leagueId: string
  initialSettings: GameFeedSettings
}) {
  const [settings, setSettings] = useState(initialSettings)
  const [enabled, setEnabled] = useState(initialSettings.game_feed_enabled !== false)
  const [displayMode, setDisplayMode] = useState<FeedMode>(
    initialSettings.game_feed_display_mode === 'test' ? 'test' : 'public'
  )
  const [activeWorker, setActiveWorker] = useState<WorkerState | null>(() =>
    isRecentHeartbeat(initialSettings.game_feed_worker_heartbeat_at)
      ? {
          feed_mode:
            initialSettings.game_feed_worker_mode === 'test' ? 'test' : 'public',
          source_sleeper_league_id:
            initialSettings.game_feed_source_sleeper_league_id || 'Unknown',
          poll_seconds: Number(initialSettings.game_feed_poll_seconds || 10),
          last_polled_at: initialSettings.game_feed_last_polled_at,
          last_success_at: initialSettings.game_feed_last_success_at,
          last_error: initialSettings.game_feed_last_error,
          worker_heartbeat_at: initialSettings.game_feed_worker_heartbeat_at,
          worker_started_at: initialSettings.game_feed_worker_started_at,
          worker_stopped_at: initialSettings.game_feed_worker_stopped_at,
          worker_name: initialSettings.game_feed_worker_name,
          worker_version: initialSettings.game_feed_worker_version,
        }
      : null
  )
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  const refreshStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/league/${leagueId}/game-feed/settings`, {
        cache: 'no-store',
      })
      if (!response.ok) return
      const json = await response.json()
      if (!json.settings) return
      setSettings(json.settings)
      setActiveWorker(json.activeWorker || null)
    } catch {
      // Keep the last known status. The next interval will retry.
    }
  }, [leagueId])

  useEffect(() => {
    void refreshStatus()
    const interval = window.setInterval(() => void refreshStatus(), 10_000)
    return () => window.clearInterval(interval)
  }, [refreshStatus])

  const workerOnline = Boolean(activeWorker)
  const collectorStatus = workerOnline ? 'Online' : 'Offline'
  const modeMismatch = Boolean(
    activeWorker && activeWorker.feed_mode !== displayMode
  )

  const statusTone = useMemo(() => {
    if (!workerOnline) return 'border-zinc-700 bg-zinc-950 text-zinc-400'
    return activeWorker?.feed_mode === 'test'
      ? 'border-amber-400/20 bg-amber-400/10 text-amber-300'
      : 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
  }, [activeWorker?.feed_mode, workerOnline])

  async function save() {
    setSaving(true)
    setMessage('')
    try {
      const response = await fetch(`/api/league/${leagueId}/game-feed/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, displayMode }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Could not save settings.')
      setSettings((current) => ({ ...current, ...json.settings }))
      setActiveWorker(json.activeWorker || null)
      setMessage(
        displayMode === 'test'
          ? 'Saved. This league now displays test events only.'
          : 'Saved. This league now displays public events only.'
      )
    } catch (error: any) {
      setMessage(error?.message || 'Could not save settings.')
    } finally {
      setSaving(false)
    }
  }

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText('npm run game-feed')
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setMessage('Copy failed. Run: npm run game-feed')
    }
  }

  return (
    <section className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${statusTone}`}
          >
            <Radio size={22} />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-400">
              Single-source live scoring
            </p>
            <h2 className="mt-1 text-3xl font-black">Game Feed</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
              Your PC polls one dedicated deep Sleeper league. Each inferred play is then copied into every enabled League Letter feed without another Sleeper request.
            </p>
          </div>
        </div>

        <div className={`inline-flex w-fit items-center gap-2 rounded-full border px-4 py-2 text-sm font-black ${statusTone}`}>
          <Power size={15} />
          Collector {collectorStatus}
          {activeWorker && ` · ${activeWorker.feed_mode.toUpperCase()}`}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
        <div className="flex items-start gap-3">
          <Terminal className="mt-0.5 shrink-0 text-emerald-300" size={20} />
          <div className="min-w-0 flex-1">
            <p className="font-black">Start the collector from your project folder</p>
            <p className="mt-1 text-sm leading-6 text-zinc-500">
              It asks whether you are starting in Public or Test mode. Test mode can create four sample cells immediately.
            </p>
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-zinc-800 bg-black px-4 py-3 font-mono text-sm text-emerald-300">
              <code className="min-w-0 flex-1 overflow-x-auto">npm run game-feed</code>
              <button
                type="button"
                onClick={copyCommand}
                className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
                aria-label="Copy collector command"
              >
                {copied ? <Check size={16} /> : <Clipboard size={16} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
          <span className="text-sm font-black">Receive the global feed</span>
          <span className="mt-3 flex items-center gap-3">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
              className="h-5 w-5 accent-emerald-500"
            />
            <span className="text-sm text-zinc-300">
              {enabled ? 'Copy source events into this league' : 'Do not copy events into this league'}
            </span>
          </span>
        </label>

        <label className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
          <span className="text-sm font-black">Website feed mode</span>
          <select
            value={displayMode}
            onChange={(event) => setDisplayMode(event.target.value as FeedMode)}
            className="mt-3 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 font-bold outline-none focus:border-emerald-400"
          >
            <option value="public">Public — hide all test cells</option>
            <option value="test">Test — show test cells only</option>
          </select>
          <p className="mt-2 text-xs leading-5 text-zinc-500">
            This controls the league homepage, full Game Feed, player pages, and realtime updates.
          </p>
        </label>
      </div>

      {modeMismatch && (
        <div className="mt-4 flex gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
          <AlertTriangle className="mt-0.5 shrink-0" size={17} />
          <p>
            The worker is running in <strong>{activeWorker?.feed_mode}</strong> mode, but this league is displaying <strong>{displayMode}</strong> mode. New worker events will remain hidden until the modes match.
          </p>
        </div>
      )}

      {displayMode === 'test' && (
        <div className="mt-4 flex gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          <Beaker className="mt-0.5 shrink-0" size={17} />
          <p>
            Test mode is active for this league. Public events are hidden, and synthetic test cells are clearly labelled.
          </p>
        </div>
      )}

      <div className="mt-4 grid gap-3 text-sm text-zinc-400 md:grid-cols-2 xl:grid-cols-4">
        <StatusValue
          label="Worker mode"
          value={activeWorker?.feed_mode?.toUpperCase() || 'Offline'}
          icon={activeWorker?.feed_mode === 'test' ? <Beaker size={15} /> : <Globe2 size={15} />}
          accent={workerOnline}
        />
        <StatusValue
          label="Source Sleeper league"
          value={activeWorker?.source_sleeper_league_id || settings.game_feed_source_sleeper_league_id || 'Not configured'}
          icon={<Database size={15} />}
        />
        <StatusValue
          label="Poll interval"
          value={activeWorker ? `${activeWorker.poll_seconds} seconds` : '—'}
        />
        <StatusValue
          label="Collector"
          value={activeWorker?.worker_name || settings.game_feed_worker_name || 'Not running'}
        />
        <StatusValue
          label="PC heartbeat"
          value={formatTime(activeWorker?.worker_heartbeat_at)}
          accent={workerOnline}
        />
        <StatusValue
          label="Last source poll"
          value={formatTime(activeWorker?.last_polled_at || settings.game_feed_last_polled_at)}
        />
        <StatusValue
          label="Last successful poll"
          value={formatTime(activeWorker?.last_success_at || settings.game_feed_last_success_at)}
        />
        <StatusValue
          label="Website mode"
          value={displayMode.toUpperCase()}
          accent={displayMode === 'test'}
        />
      </div>

      {(activeWorker?.last_error || settings.game_feed_last_error) && (
        <p className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          Last collector error: {activeWorker?.last_error || settings.game_feed_last_error}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 font-black text-zinc-950 transition hover:bg-emerald-400 disabled:opacity-50"
        >
          <Save size={17} />
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </div>

      {message && (
        <p className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-300">
          {message}
        </p>
      )}
    </section>
  )
}

function StatusValue({
  label,
  value,
  accent = false,
  icon,
}: {
  label: string
  value: string
  accent?: boolean
  icon?: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-zinc-600">
        {icon}
        {label}
      </p>
      <p className={`mt-2 break-words font-bold ${accent ? 'text-amber-300' : 'text-zinc-300'}`}>
        {value}
      </p>
    </div>
  )
}

function formatTime(value?: string | null) {
  if (!value) return 'Never'
  return new Date(value).toLocaleString()
}

function isRecentHeartbeat(value?: string | null) {
  if (!value) return false
  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) && Date.now() - timestamp < 35_000
}
