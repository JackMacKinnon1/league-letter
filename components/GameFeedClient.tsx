'use client'

import GameFeedPlayerImage from '@/components/GameFeedPlayerImage'
import Link from '@/components/NoPrefetchLink'
import { createClient } from '@/lib/supabase/client'
import {
  formatFantasyDelta,
  type GameFeedEvent,
} from '@/lib/gameFeed'
import {
  Activity,
  Beaker,
  AlertTriangle,
  ArrowDown,
  CircleDot,
  Radio,
  RefreshCw,
  Shield,
  Target,
  Trophy,
  Zap,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const eventFilters = [
  ['all', 'All plays'],
  ['reception', 'Receptions'],
  ['rush', 'Rushes'],
  ['touchdown', 'Touchdowns'],
  ['turnover', 'Turnovers'],
  ['field_goal', 'Kicking'],
  ['defense', 'Defense'],
  ['scoring_update', 'Other'],
] as const

export default function GameFeedClient({
  leagueId,
  season,
  week,
  feedMode,
  initialEvents,
}: {
  leagueId: string
  season: string
  week: number
  feedMode: 'public' | 'test'
  initialEvents: GameFeedEvent[]
}) {
  const [events, setEvents] = useState<GameFeedEvent[]>(initialEvents)
  const [eventType, setEventType] = useState('all')
  const [confidence, setConfidence] = useState('all')
  const [hasMore, setHasMore] = useState(initialEvents.length >= 50)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [connectionState, setConnectionState] = useState<
    'connecting' | 'live' | 'fallback'
  >('connecting')
  const [newPlayCount, setNewPlayCount] = useState(0)
  const feedTopRef = useRef<HTMLDivElement>(null)
  const latestCursorRef = useRef(
    initialEvents.reduce((max, event) => Math.max(max, Number(event.id)), 0)
  )
  const knownEventIdsRef = useRef(
    new Set(initialEvents.map((event) => Number(event.id)))
  )
  const newEventIdsRef = useRef(new Set<number>())
  const storageKey = `game-feed:${leagueId}:${feedMode}:${season}:${week}:last-seen`

  const mergeEvents = useCallback(
    (incoming: GameFeedEvent[], { countAsNew = false } = {}) => {
      const matchingMode = incoming.filter((event) => event.feed_mode === feedMode)
      if (!matchingMode.length) return

      const unseen = matchingMode.filter((event) => {
        const id = Number(event.id)
        if (knownEventIdsRef.current.has(id)) return false
        knownEventIdsRef.current.add(id)
        return true
      })

      setEvents((current) => {
        const byId = new Map<number, GameFeedEvent>()
        for (const event of [...current, ...matchingMode]) {
          byId.set(Number(event.id), event)
        }
        return Array.from(byId.values()).sort((a, b) => Number(b.id) - Number(a.id))
      })

      latestCursorRef.current = Math.max(
        latestCursorRef.current,
        ...matchingMode.map((event) => Number(event.id))
      )

      if (countAsNew && unseen.length) {
        for (const event of unseen) newEventIdsRef.current.add(Number(event.id))
        setNewPlayCount(newEventIdsRef.current.size)
      }
    },
    [feedMode]
  )

  const fetchAfter = useCallback(
    async (after: number) => {
      const params = new URLSearchParams({
        season,
        week: String(week),
        after: String(after),
        limit: '200',
      })
      const response = await fetch(
        `/api/league/${leagueId}/game-feed?${params.toString()}`,
        { cache: 'no-store' }
      )
      if (!response.ok) {
        return { events: [] as GameFeedEvent[], hasMore: false, nextCursor: after }
      }
      const json = await response.json()
      return {
        events: (json.events || []) as GameFeedEvent[],
        hasMore: Boolean(json.hasMore),
        nextCursor: Number(json.nextCursor || after),
      }
    },
    [leagueId, season, week]
  )

  useEffect(() => {
    let cancelled = false
    const lastSeen = Number(window.localStorage.getItem(storageKey) || 0)

    async function recoverMissedEvents() {
      if (lastSeen > 0) {
        let cursor = lastSeen
        let hasMore = true
        let pages = 0
        const missed: GameFeedEvent[] = []

        while (hasMore && pages < 10 && !cancelled) {
          const page = await fetchAfter(cursor)
          missed.push(...page.events)
          hasMore = page.hasMore
          if (page.nextCursor <= cursor || page.events.length === 0) break
          cursor = page.nextCursor
          pages += 1
        }

        if (!cancelled) {
          mergeEvents(missed)
          const recoveredIds = new Set(
            [...initialEvents, ...missed]
              .filter((event) => Number(event.id) > lastSeen)
              .map((event) => Number(event.id))
          )
          for (const id of recoveredIds) newEventIdsRef.current.add(id)
          setNewPlayCount(newEventIdsRef.current.size)
        }
      }
    }

    void recoverMissedEvents()

    return () => {
      cancelled = true
      window.localStorage.setItem(storageKey, String(latestCursorRef.current))
    }
  }, [fetchAfter, initialEvents, mergeEvents, storageKey])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`game-feed:${leagueId}:${feedMode}:${season}:${week}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'game_feed_events',
          filter: `league_id=eq.${leagueId}`,
        },
        (payload) => {
          const event = payload.new as GameFeedEvent
          if (
            event.feed_mode !== feedMode ||
            String(event.season) !== String(season) ||
            Number(event.week) !== week
          ) {
            return
          }
          mergeEvents([event], { countAsNew: true })
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setConnectionState('live')
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnectionState('fallback')
        }
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [feedMode, leagueId, mergeEvents, season, week])

  // Realtime is the primary path. This low-frequency Supabase API catch-up makes
  // reconnects reliable and never contacts Sleeper.
  useEffect(() => {
    const interval = window.setInterval(async () => {
      const incoming = await fetchAfter(latestCursorRef.current)
      if (incoming.events.length) {
        mergeEvents(incoming.events, { countAsNew: true })
      }
    }, 15_000)

    return () => window.clearInterval(interval)
  }, [fetchAfter, mergeEvents])

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const typeMatches =
        eventType === 'all' ||
        event.event_type === eventType ||
        (eventType === 'touchdown' && Number(event.inferred_touchdowns || 0) > 0) ||
        (eventType === 'field_goal' && event.event_type === 'extra_point')
      const confidenceMatches =
        confidence === 'all' || event.confidence === confidence
      return typeMatches && confidenceMatches
    })
  }, [confidence, eventType, events])

  async function loadOlder() {
    const oldest = events.reduce(
      (min, event) => Math.min(min, Number(event.id)),
      Number.POSITIVE_INFINITY
    )
    if (!Number.isFinite(oldest)) return

    setLoadingOlder(true)
    try {
      const params = new URLSearchParams({
        season,
        week: String(week),
        before: String(oldest),
        limit: '50',
      })
      const response = await fetch(
        `/api/league/${leagueId}/game-feed?${params.toString()}`,
        { cache: 'no-store' }
      )
      if (!response.ok) return
      const json = await response.json()
      const older = (json.events || []) as GameFeedEvent[]
      mergeEvents(older)
      setHasMore(Boolean(json.hasMore) || older.length === 50)
    } finally {
      setLoadingOlder(false)
    }
  }

  function acknowledgeNewPlays() {
    newEventIdsRef.current.clear()
    setNewPlayCount(0)
    window.localStorage.setItem(storageKey, String(latestCursorRef.current))
    feedTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div ref={feedTopRef} className="space-y-5">
      {newPlayCount > 0 && (
        <button
          type="button"
          onClick={acknowledgeNewPlays}
          className="sticky top-20 z-30 flex w-full items-center justify-between gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-400 px-4 py-3 text-left font-black text-emerald-950 shadow-xl shadow-black/20 transition hover:bg-emerald-300"
        >
          <span>
            {newPlayCount} new play{newPlayCount === 1 ? '' : 's'} entered
          </span>
          <span className="text-xs uppercase tracking-[0.18em]">View newest ↑</span>
        </button>
      )}
      <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${
                feedMode === 'test'
                  ? 'border-amber-400/30 bg-amber-400/10 text-amber-300'
                  : connectionState === 'live'
                    ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                    : 'border-amber-400/30 bg-amber-400/10 text-amber-300'
              }`}
            >
              {feedMode === 'test' ? <Beaker size={20} /> : <Radio size={20} />}
            </div>
            <div>
              <p className="font-black">
                {feedMode === 'test'
                  ? 'Test feed connection'
                  : connectionState === 'live'
                  ? 'Live connection'
                  : connectionState === 'fallback'
                    ? 'Catch-up polling active'
                    : 'Connecting to live feed'}
              </p>
              <p className="text-sm text-zinc-500">
                {feedMode === 'test'
                  ? 'Only test-tagged events are visible. Public events remain hidden.'
                  : 'Updates come from Supabase. Browsers never request Sleeper directly.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={eventType}
              onChange={(event) => setEventType(event.target.value)}
              className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-bold outline-none focus:border-emerald-400"
            >
              {eventFilters.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            <select
              value={confidence}
              onChange={(event) => setConfidence(event.target.value)}
              className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-bold outline-none focus:border-emerald-400"
            >
              <option value="all">All confidence</option>
              <option value="high">High confidence</option>
              <option value="medium">Medium confidence</option>
              <option value="low">Low confidence</option>
            </select>
          </div>
        </div>

      </div>

      <div className="space-y-3">
        {filteredEvents.map((event) => (
          <GameFeedCard key={event.id} event={event} leagueId={leagueId} />
        ))}

        {!filteredEvents.length && (
          <div className="rounded-[2rem] border border-dashed border-zinc-700 bg-zinc-900/50 px-6 py-16 text-center">
            <Activity className="mx-auto text-zinc-600" size={34} />
            <h2 className="mt-4 text-2xl font-black">No scoring events yet</h2>
            <p className="mx-auto mt-2 max-w-xl text-zinc-500">
              {feedMode === 'test'
                ? 'Start the worker in Test mode and choose to create sample cells, or wait for test-tagged score changes.'
                : 'The first public worker run seeds player totals. Events appear after Sleeper reports a new fantasy-point change.'}
            </p>
          </div>
        )}
      </div>

      {hasMore && events.length > 0 && (
        <button
          type="button"
          onClick={loadOlder}
          disabled={loadingOlder}
          className="mx-auto flex items-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-900 px-5 py-3 font-black transition hover:border-zinc-500 disabled:opacity-50"
        >
          {loadingOlder ? <RefreshCw className="animate-spin" size={17} /> : <ArrowDown size={17} />}
          Load older plays
        </button>
      )}
    </div>
  )
}

function GameFeedCard({ event, leagueId }: { event: GameFeedEvent; leagueId: string }) {
  const icon = eventIcon(event)
  const confidenceClass =
    event.confidence === 'high'
      ? 'text-emerald-300 bg-emerald-400/10 border-emerald-400/20'
      : event.confidence === 'medium'
        ? 'text-amber-300 bg-amber-400/10 border-amber-400/20'
        : 'text-zinc-400 bg-zinc-800 border-zinc-700'

  return (
    <article className="overflow-hidden rounded-[2rem] border border-zinc-800 bg-zinc-900 transition hover:border-zinc-700">
      <div className="flex gap-4 p-5 sm:gap-5 sm:p-6">
        <GameFeedPlayerImage
          event={event}
          leagueId={leagueId}
          icon={icon}
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-zinc-500">
                {event.primary_player_team || 'NFL'} · {event.primary_player_position || 'Player'}
              </p>
              <h2 className="mt-1 text-xl font-black sm:text-2xl">
                {event.description}
              </h2>
              <Link
                href={`/league/${leagueId}/players/${event.primary_player_id}`}
                className="mt-1 inline-block font-bold text-zinc-200 hover:text-emerald-300"
              >
                {event.primary_player_name}
              </Link>
            </div>

            <div className="shrink-0 text-left sm:text-right">
              <p
                className={`text-2xl font-black ${
                  Number(event.primary_fantasy_delta) >= 0
                    ? 'text-emerald-400'
                    : 'text-red-400'
                }`}
              >
                {formatFantasyDelta(event.primary_fantasy_delta)}
              </p>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-600">
                fantasy points
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            {event.secondary_player_id && event.secondary_player_name && (
              <Link
                href={`/league/${leagueId}/players/${event.secondary_player_id}`}
                className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1.5 font-bold text-zinc-300 hover:border-emerald-400/40 hover:text-emerald-300"
              >
                From {event.secondary_player_name}
              </Link>
            )}

            {event.feed_mode === 'test' && (
              <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 font-black text-amber-300">
                TEST{event.metadata?.synthetic ? ' · synthetic' : ''}
              </span>
            )}

            <span className={`rounded-full border px-3 py-1.5 font-black ${confidenceClass}`}>
              {event.confidence} confidence
            </span>

            {event.is_aggregate && (
              <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1.5 font-black text-violet-300">
                grouped update
              </span>
            )}

            <span className="ml-auto text-zinc-600">
              {new Date(event.detected_at).toLocaleString([], {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
          </div>
        </div>
      </div>
    </article>
  )
}

function eventIcon(event: GameFeedEvent) {
  if (Number(event.inferred_touchdowns || 0) > 0) return <Trophy size={15} />
  if (event.event_type === 'reception') return <Target size={15} />
  if (event.event_type === 'rush') return <Zap size={15} />
  if (event.event_type === 'defense') return <Shield size={15} />
  if (event.event_type === 'turnover' || event.event_type === 'stat_correction') {
    return <AlertTriangle size={15} />
  }
  return <CircleDot size={15} />
}
