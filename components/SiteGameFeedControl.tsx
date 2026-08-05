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

type LeagueSetting = {
  id: string
  name: string
  game_feed_enabled?: boolean | null
  game_feed_display_mode?: FeedMode | null
}

type NormalizedLeagueSetting = {
  id: string
  name: string
  game_feed_enabled: boolean
  game_feed_display_mode: FeedMode
}

type WorkerState = {
  feed_mode: FeedMode
  source_sleeper_league_id: string
  poll_seconds: number
  season?: string | null
  week?: number | null
  league_status?: string | null
  last_polled_at?: string | null
  last_success_at?: string | null
  last_error?: string | null
  worker_heartbeat_at?: string | null
  worker_started_at?: string | null
  worker_stopped_at?: string | null
  worker_name?: string | null
  worker_version?: string | null
}

export default function SiteGameFeedControl({
  initialLeagues,
  initialWorkerStates,
}: {
  initialLeagues: LeagueSetting[]
  initialWorkerStates: WorkerState[]
}) {
  const [leagues, setLeagues] = useState<NormalizedLeagueSetting[]>(() =>
    normalizeLeagues(initialLeagues)
  )
  const [workerStates, setWorkerStates] = useState(initialWorkerStates)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [copied, setCopied] = useState(false)

  const activeWorker = useMemo(
    () => workerStates.find((state) => isRecentHeartbeat(state.worker_heartbeat_at)) || null,
    [workerStates]
  )

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/site-admin/game-feed', { cache: 'no-store' })
      if (!response.ok) return
      const json = await response.json()
      setWorkerStates(json.workerStates || [])
    } catch {
      // Preserve the last known state and retry on the next interval.
    }
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => void refresh(), 10_000)
    return () => window.clearInterval(interval)
  }, [refresh])

  function updateLeague(
    leagueId: string,
    patch: Partial<
      Pick<NormalizedLeagueSetting, 'game_feed_enabled' | 'game_feed_display_mode'>
    >
  ) {
    setLeagues((current) =>
      current.map((league) => (league.id === leagueId ? { ...league, ...patch } : league))
    )
  }

  function updateAll(
    patch: Partial<
      Pick<NormalizedLeagueSetting, 'game_feed_enabled' | 'game_feed_display_mode'>
    >
  ) {
    setLeagues((current) => current.map((league) => ({ ...league, ...patch })))
  }

  async function save() {
    setSaving(true)
    setMessage('')

    try {
      const response = await fetch('/api/site-admin/game-feed', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leagues: leagues.map((league) => ({
            id: league.id,
            enabled: league.game_feed_enabled !== false,
            displayMode:
              league.game_feed_display_mode === 'test' ? 'test' : 'public',
          })),
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Could not save Game Feed settings.')

      setLeagues(normalizeLeagues(json.leagues || leagues))
      setWorkerStates(json.workerStates || workerStates)
      setMessage('Game Feed settings saved for every League Letter room.')
    } catch (error: any) {
      setMessage(error?.message || 'Could not save Game Feed settings.')
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

  const workerOnline = Boolean(activeWorker)
  const statusTone = !workerOnline
    ? 'border-zinc-700 bg-zinc-950 text-zinc-400'
    : activeWorker?.feed_mode === 'test'
      ? 'border-amber-400/20 bg-amber-400/10 text-amber-300'
      : 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${statusTone}`}>
              <Radio size={22} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-400">
                Site-wide live scoring
              </p>
              <h2 className="mt-1 text-3xl font-black">Collector status</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
                Only the site owner can change which rooms receive the global feed or switch a room between Public and Test data.
              </p>
            </div>
          </div>

          <div className={`inline-flex w-fit items-center gap-2 rounded-full border px-4 py-2 text-sm font-black ${statusTone}`}>
            <Power size={15} />
            Collector {workerOnline ? 'Online' : 'Offline'}
            {activeWorker && ` · ${activeWorker.feed_mode.toUpperCase()}`}
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <div className="flex items-start gap-3">
            <Terminal className="mt-0.5 shrink-0 text-emerald-300" size={20} />
            <div className="min-w-0 flex-1">
              <p className="font-black">Start the collector from your main PC</p>
              <p className="mt-1 text-sm leading-6 text-zinc-500">
                Public and Test workers remain separate. The active mode is shown above.
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

        <div className="mt-4 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
          <StatusValue
            label="Worker mode"
            value={activeWorker?.feed_mode?.toUpperCase() || 'OFFLINE'}
            icon={activeWorker?.feed_mode === 'test' ? <Beaker size={15} /> : <Globe2 size={15} />}
            accent={workerOnline}
          />
          <StatusValue
            label="Source Sleeper league"
            value={activeWorker?.source_sleeper_league_id || 'Not running'}
            icon={<Database size={15} />}
          />
          <StatusValue
            label="Poll interval"
            value={activeWorker ? `${activeWorker.poll_seconds} seconds` : '—'}
          />
          <StatusValue
            label="Collector PC"
            value={activeWorker?.worker_name || 'Not running'}
          />
          <StatusValue
            label="Heartbeat"
            value={formatTime(activeWorker?.worker_heartbeat_at)}
            accent={workerOnline}
          />
          <StatusValue
            label="Last poll"
            value={formatTime(activeWorker?.last_polled_at)}
          />
          <StatusValue
            label="Last success"
            value={formatTime(activeWorker?.last_success_at)}
          />
          <StatusValue
            label="NFL week"
            value={activeWorker?.season && activeWorker?.week ? `${activeWorker.season} · Week ${activeWorker.week}` : '—'}
          />
        </div>

        {activeWorker?.last_error && (
          <div className="mt-4 flex gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            <AlertTriangle className="mt-0.5 shrink-0" size={17} />
            <p>{activeWorker.last_error}</p>
          </div>
        )}
      </section>

      <section className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-400">
              Room distribution
            </p>
            <h2 className="mt-2 text-3xl font-black">Website feed behaviour</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
              These settings control the homepage preview, full Game Feed, player pages, biggest plays and Realtime updates for each room.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => updateAll({ game_feed_enabled: true })}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-black text-zinc-200 transition hover:bg-white/[0.08]"
            >
              Enable all
            </button>
            <button
              type="button"
              onClick={() => updateAll({ game_feed_enabled: false })}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-black text-zinc-400 transition hover:bg-white/[0.08] hover:text-white"
            >
              Disable all
            </button>
            <button
              type="button"
              onClick={() => updateAll({ game_feed_display_mode: 'public' })}
              className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-sm font-black text-emerald-300 transition hover:bg-emerald-400/15"
            >
              All public
            </button>
            <button
              type="button"
              onClick={() => updateAll({ game_feed_display_mode: 'test' })}
              className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-sm font-black text-amber-300 transition hover:bg-amber-400/15"
            >
              All test
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {leagues.map((league) => {
            const enabled = league.game_feed_enabled !== false
            const mode = league.game_feed_display_mode === 'test' ? 'test' : 'public'

            return (
              <article
                key={league.id}
                className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-black">{league.name}</h3>
                    <p className="mt-1 truncate text-xs text-zinc-600">{league.id}</p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-black uppercase tracking-[0.12em] ${
                    enabled
                      ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
                      : 'border-zinc-700 bg-zinc-900 text-zinc-500'
                  }`}>
                    {enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>

                <label className="mt-5 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] px-3 py-3">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(event) =>
                      updateLeague(league.id, { game_feed_enabled: event.target.checked })
                    }
                    className="h-5 w-5 accent-emerald-500"
                  />
                  <span>
                    <span className="block text-sm font-black">Receive the global feed</span>
                    <span className="mt-0.5 block text-xs text-zinc-500">
                      Copy source events into this room
                    </span>
                  </span>
                </label>

                <label className="mt-3 block">
                  <span className="text-sm font-black">Displayed data</span>
                  <select
                    value={mode}
                    onChange={(event) =>
                      updateLeague(league.id, {
                        game_feed_display_mode:
                          event.target.value === 'test' ? 'test' : 'public',
                      })
                    }
                    className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 font-bold outline-none focus:border-emerald-400"
                  >
                    <option value="public">Public — hide test cells</option>
                    <option value="test">Test — hide public cells</option>
                  </select>
                </label>
              </article>
            )
          })}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 font-black text-zinc-950 transition hover:bg-emerald-400 disabled:opacity-50"
          >
            <Save size={17} />
            {saving ? 'Saving…' : 'Save all settings'}
          </button>
          {message && <p className="text-sm font-bold text-zinc-300">{message}</p>}
        </div>
      </section>
    </div>
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
      <p className={`mt-2 break-words font-bold ${accent ? 'text-emerald-300' : 'text-zinc-300'}`}>
        {value}
      </p>
    </div>
  )
}

function normalizeLeagues(leagues: LeagueSetting[]): NormalizedLeagueSetting[] {
  return leagues.map((league) => ({
    ...league,
    game_feed_enabled: league.game_feed_enabled !== false,
    game_feed_display_mode:
      league.game_feed_display_mode === 'test' ? 'test' : 'public',
  }))
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
