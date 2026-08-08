'use client'

import GameFeedPlayerImage from '@/components/GameFeedPlayerImage'
import Link from '@/components/NoPrefetchLink'
import { createClient } from '@/lib/supabase/client'
import {
  formatFantasyDelta,
  type GameFeedEvent,
  type GameFeedLeagueTeam,
  type GameFeedMatchupRow,
} from '@/lib/gameFeed'
import { NFL_TEAMS, nflTeamName } from '@/lib/nflTeams'
import {
  Activity,
  AlertTriangle,
  Beaker,
  CircleDot,
  Radio,
  RefreshCw,
  Shield,
  Star,
  Target,
  Trophy,
  Zap,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const BATCH_SIZE = 25
const MAX_PLAYS_PER_FEED_PAGE = 250
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
  initialTotal,
  teams,
  matchupRows,
  initialRosterId,
}: {
  leagueId: string
  season: string
  week: number
  feedMode: 'public' | 'test'
  initialEvents: GameFeedEvent[]
  initialTotal: number
  teams: GameFeedLeagueTeam[]
  matchupRows: GameFeedMatchupRow[]
  initialRosterId: number | null
}) {
  const [events, setEvents] = useState<GameFeedEvent[]>(initialEvents)
  const [total, setTotal] = useState(initialTotal)
  const [feedPage, setFeedPage] = useState(1)
  const [hasMoreInDatabase, setHasMoreInDatabase] = useState(initialEvents.length < initialTotal)
  const [eventType, setEventType] = useState('all')
  const [confidence, setConfidence] = useState('all')
  const [nflTeam, setNflTeam] = useState('all')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [favoritePlayerIds, setFavoritePlayerIds] = useState<string[]>([])
  const [favoritesHydrated, setFavoritesHydrated] = useState(false)
  const [selectedRosterId, setSelectedRosterId] = useState(
    initialRosterId ? String(initialRosterId) : ''
  )
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [connectionState, setConnectionState] = useState<'connecting' | 'live' | 'fallback'>('connecting')
  const [newPlayCount, setNewPlayCount] = useState(0)
  const [error, setError] = useState('')

  const feedTopRef = useRef<HTMLDivElement | null>(null)
  const feedScrollRef = useRef<HTMLDivElement | null>(null)
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null)
  const requestSequenceRef = useRef(0)
  const loadingMoreRef = useRef(false)
  const filterEffectReadyRef = useRef(false)
  const pageStartCursorsRef = useRef<Record<number, number | null>>({ 1: null })
  const latestCursorRef = useRef(
    initialEvents.reduce((max, event) => Math.max(max, Number(event.id)), 0)
  )
  const knownEventIdsRef = useRef(new Set(initialEvents.map((event) => Number(event.id))))
  const newEventIdsRef = useRef(new Set<number>())
  const lastSeenStorageKey = `game-feed:${leagueId}:${feedMode}:${season}:${week}:last-seen`
  const favouritesStorageKey = `game-feed:${leagueId}:favourites`
  const rosterStorageKey = `game-feed:${leagueId}:my-roster`

  const favoriteSet = useMemo(() => new Set(favoritePlayerIds), [favoritePlayerIds])
  const selectedTeam = useMemo(
    () => teams.find((team) => String(team.sleeper_roster_id) === selectedRosterId) || null,
    [selectedRosterId, teams]
  )
  const opponentTeam = useMemo(() => {
    if (!selectedTeam) return null
    const selectedMatchup = matchupRows.find(
      (row) => Number(row.sleeper_roster_id) === Number(selectedTeam.sleeper_roster_id)
    )
    if (selectedMatchup?.matchup_id === null || selectedMatchup?.matchup_id === undefined) return null
    const opponent = matchupRows.find(
      (row) =>
        Number(row.matchup_id) === Number(selectedMatchup.matchup_id) &&
        Number(row.sleeper_roster_id) !== Number(selectedTeam.sleeper_roster_id)
    )
    return teams.find(
      (team) => Number(team.sleeper_roster_id) === Number(opponent?.sleeper_roster_id)
    ) || null
  }, [matchupRows, selectedTeam, teams])
  const myPlayerIds = useMemo(() => new Set(selectedTeam?.players || []), [selectedTeam])
  const opponentPlayerIds = useMemo(() => new Set(opponentTeam?.players || []), [opponentTeam])
  const pageOffset = (feedPage - 1) * MAX_PLAYS_PER_FEED_PAGE
  const totalFeedPages = Math.max(1, Math.ceil(total / MAX_PLAYS_PER_FEED_PAGE))
  const reachedPageLimit = events.length >= MAX_PLAYS_PER_FEED_PAGE
  const hasNextFeedPage = pageOffset + events.length < total
  const canLoadMoreWithinPage =
    !reachedPageLimit &&
    hasMoreInDatabase &&
    pageOffset + events.length < total

  useEffect(() => {
    try {
      const savedFavorites = JSON.parse(window.localStorage.getItem(favouritesStorageKey) || '[]')
      if (Array.isArray(savedFavorites)) {
        setFavoritePlayerIds(savedFavorites.filter((id) => typeof id === 'string').slice(0, 100))
      }
      const savedRoster = window.localStorage.getItem(rosterStorageKey)
      if (
        !initialRosterId &&
        savedRoster &&
        teams.some((team) => String(team.sleeper_roster_id) === savedRoster)
      ) {
        setSelectedRosterId(savedRoster)
      }
    } catch {
      // Ignore malformed browser storage and start clean.
    } finally {
      setFavoritesHydrated(true)
    }
  }, [favouritesStorageKey, initialRosterId, rosterStorageKey, teams])

  useEffect(() => {
    if (!favoritesHydrated) return
    window.localStorage.setItem(favouritesStorageKey, JSON.stringify(favoritePlayerIds))
  }, [favoritePlayerIds, favoritesHydrated, favouritesStorageKey])

  useEffect(() => {
    if (selectedRosterId) window.localStorage.setItem(rosterStorageKey, selectedRosterId)
    else window.localStorage.removeItem(rosterStorageKey)
  }, [rosterStorageKey, selectedRosterId])

  const createFilterParams = useCallback(() => {
    const params = new URLSearchParams({
      season,
      week: String(week),
      eventType,
      confidence,
      nflTeam,
    })
    if (favoritesOnly) params.set('favoritePlayerIds', favoritePlayerIds.join(','))
    return params
  }, [confidence, eventType, favoritePlayerIds, favoritesOnly, nflTeam, season, week])

  const loadFeedPage = useCallback(async (
    targetFeedPage: number,
    explicitStartCursor?: number | null
  ) => {
    if (favoritesOnly && favoritePlayerIds.length === 0) {
      setEvents([])
      setTotal(0)
      setFeedPage(1)
      setHasMoreInDatabase(false)
      feedScrollRef.current?.scrollTo({ top: 0 })
      return
    }

    const requestId = ++requestSequenceRef.current
    setLoading(true)
    setError('')

    try {
      const params = createFilterParams()
      const startCursor = explicitStartCursor ?? pageStartCursorsRef.current[targetFeedPage] ?? null

      if (targetFeedPage === 1) {
        params.set('page', '1')
        params.set('pageSize', String(BATCH_SIZE))
      } else {
        if (!startCursor) throw new Error('The starting point for this feed page is unavailable.')
        params.set('before', String(startCursor))
        params.set('limit', String(BATCH_SIZE))
      }

      const response = await fetch(`/api/league/${leagueId}/game-feed?${params.toString()}`, {
        cache: 'no-store',
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Could not load the Game Feed.')
      if (requestId !== requestSequenceRef.current) return

      const nextEvents = (json.events || []) as GameFeedEvent[]
      for (const event of nextEvents) knownEventIdsRef.current.add(Number(event.id))

      setEvents(nextEvents)
      if (targetFeedPage === 1) setTotal(Number(json.total || 0))
      setFeedPage(targetFeedPage)
      setHasMoreInDatabase(
        typeof json.hasMore === 'boolean'
          ? json.hasMore
          : nextEvents.length === BATCH_SIZE
      )
      latestCursorRef.current = Math.max(
        latestCursorRef.current,
        ...nextEvents.map((event) => Number(event.id)),
        0
      )
      feedScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (loadError: any) {
      if (requestId === requestSequenceRef.current) {
        setError(loadError?.message || 'Could not load the Game Feed.')
      }
    } finally {
      if (requestId === requestSequenceRef.current) setLoading(false)
    }
  }, [createFilterParams, favoritePlayerIds.length, favoritesOnly, leagueId])

  const loadMore = useCallback(async () => {
    if (loading || loadingMoreRef.current || !canLoadMoreWithinPage || !events.length) return

    const oldestId = Math.min(...events.map((event) => Number(event.id)).filter(Number.isFinite))
    if (!Number.isFinite(oldestId) || oldestId <= 0) {
      setHasMoreInDatabase(false)
      return
    }

    loadingMoreRef.current = true
    setLoadingMore(true)
    setError('')

    try {
      const params = createFilterParams()
      params.set('before', String(oldestId))
      params.set('limit', String(BATCH_SIZE))

      const response = await fetch(`/api/league/${leagueId}/game-feed?${params.toString()}`, {
        cache: 'no-store',
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Could not load more plays.')

      const incoming = (json.events || []) as GameFeedEvent[]
      for (const event of incoming) knownEventIdsRef.current.add(Number(event.id))

      setEvents((current) => dedupeEvents([...current, ...incoming]).slice(0, MAX_PLAYS_PER_FEED_PAGE))
      setHasMoreInDatabase(Boolean(json.hasMore))
    } catch (loadError: any) {
      setError(loadError?.message || 'Could not load more plays.')
    } finally {
      loadingMoreRef.current = false
      setLoadingMore(false)
    }
  }, [canLoadMoreWithinPage, createFilterParams, events, leagueId, loading])

  useEffect(() => {
    if (!favoritesHydrated) return
    if (!filterEffectReadyRef.current) {
      filterEffectReadyRef.current = true
      return
    }

    pageStartCursorsRef.current = { 1: null }
    void loadFeedPage(1)
  }, [confidence, eventType, favoritePlayerIds, favoritesHydrated, favoritesOnly, loadFeedPage, nflTeam])

  useEffect(() => {
    const root = feedScrollRef.current
    const target = loadMoreSentinelRef.current
    if (!root || !target || !canLoadMoreWithinPage) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore()
      },
      {
        root,
        rootMargin: '0px 0px 320px 0px',
        threshold: 0.01,
      }
    )

    observer.observe(target)
    return () => observer.disconnect()
  }, [canLoadMoreWithinPage, loadMore])

  const fetchAfter = useCallback(async (after: number) => {
    const params = new URLSearchParams({
      season,
      week: String(week),
      after: String(after),
      limit: '200',
    })
    const response = await fetch(`/api/league/${leagueId}/game-feed?${params.toString()}`, {
      cache: 'no-store',
    })
    if (!response.ok) return [] as GameFeedEvent[]
    const json = await response.json()
    return (json.events || []) as GameFeedEvent[]
  }, [leagueId, season, week])

  const receiveNewEvents = useCallback((incoming: GameFeedEvent[]) => {
    const matchingMode = incoming.filter(
      (event) =>
        event.feed_mode === feedMode &&
        String(event.season) === String(season) &&
        Number(event.week) === week
    )
    if (!matchingMode.length) return

    const unseen = matchingMode.filter((event) => {
      const id = Number(event.id)
      if (knownEventIdsRef.current.has(id)) return false
      knownEventIdsRef.current.add(id)
      return true
    })
    if (!unseen.length) return

    for (const event of unseen) newEventIdsRef.current.add(Number(event.id))
    setNewPlayCount(newEventIdsRef.current.size)
    latestCursorRef.current = Math.max(
      latestCursorRef.current,
      ...unseen.map((event) => Number(event.id))
    )

    const visible = unseen.filter((event) => eventMatchesFilters(event, {
      eventType,
      confidence,
      nflTeam,
      favoritesOnly,
      favoriteSet,
    }))

    if (visible.length) {
      setTotal((current) => current + visible.length)
      if (feedPage === 1) {
        setEvents((current) =>
          dedupeEvents([...visible, ...current]).slice(0, MAX_PLAYS_PER_FEED_PAGE)
        )
      }
    }
  }, [confidence, eventType, favoriteSet, favoritesOnly, feedMode, feedPage, nflTeam, season, week])

  useEffect(() => {
    let cancelled = false
    const lastSeen = Number(window.localStorage.getItem(lastSeenStorageKey) || 0)
    if (lastSeen > 0) {
      void fetchAfter(lastSeen).then((missed) => {
        if (!cancelled) receiveNewEvents(missed)
      })
    }
    return () => {
      cancelled = true
      window.localStorage.setItem(lastSeenStorageKey, String(latestCursorRef.current))
    }
  }, [fetchAfter, lastSeenStorageKey, receiveNewEvents])

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
        (payload) => receiveNewEvents([payload.new as GameFeedEvent])
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setConnectionState('live')
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setConnectionState('fallback')
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [feedMode, leagueId, receiveNewEvents, season, week])

  useEffect(() => {
    const interval = window.setInterval(async () => {
      const incoming = await fetchAfter(latestCursorRef.current)
      receiveNewEvents(incoming)
    }, 15_000)
    return () => window.clearInterval(interval)
  }, [fetchAfter, receiveNewEvents])

  function acknowledgeNewPlays() {
    newEventIdsRef.current.clear()
    setNewPlayCount(0)
    window.localStorage.setItem(lastSeenStorageKey, String(latestCursorRef.current))
    pageStartCursorsRef.current = { 1: null }
    void loadFeedPage(1)
    feedScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function goToNextFeedPage() {
    if (!hasNextFeedPage || !events.length) return
    const oldestId = Math.min(...events.map((event) => Number(event.id)).filter(Number.isFinite))
    if (!Number.isFinite(oldestId) || oldestId <= 0) return

    const nextPage = feedPage + 1
    pageStartCursorsRef.current[nextPage] = oldestId
    void loadFeedPage(nextPage, oldestId)
  }

  function goToPreviousFeedPage() {
    if (feedPage <= 1) return
    const previousPage = feedPage - 1
    void loadFeedPage(previousPage, pageStartCursorsRef.current[previousPage] ?? null)
  }

  function toggleFavorite(playerId?: string | null) {
    if (!playerId) return
    setFavoritePlayerIds((current) =>
      current.includes(playerId)
        ? current.filter((id) => id !== playerId)
        : [...current, playerId].slice(-100)
    )
  }

  return (
    <div ref={feedTopRef} className="min-w-0 space-y-4 sm:space-y-5">
      {newPlayCount > 0 && (
        <button
          type="button"
          onClick={acknowledgeNewPlays}
          className="sticky top-20 z-30 flex w-full items-center justify-between gap-3 rounded-xl border border-emerald-400/30 bg-emerald-400 px-3 py-2.5 text-left text-sm font-black text-emerald-950 shadow-xl shadow-black/20 transition hover:bg-emerald-300 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-base"
        >
          <span>{newPlayCount} new play{newPlayCount === 1 ? '' : 's'} entered</span>
          <span className="text-xs uppercase tracking-[0.18em]">View newest ↑</span>
        </button>
      )}

      <div className="min-w-0 rounded-[1.5rem] border border-zinc-800 bg-zinc-900 p-4 sm:rounded-[2rem] sm:p-5">
        <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
          <div className="flex min-w-0 flex-col gap-3 sm:gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border sm:h-11 sm:w-11 sm:rounded-2xl ${
                feedMode === 'test'
                  ? 'border-amber-400/30 bg-amber-400/10 text-amber-300'
                  : connectionState === 'live'
                    ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                    : 'border-amber-400/30 bg-amber-400/10 text-amber-300'
              }`}>
                {feedMode === 'test' ? <Beaker size={20} /> : <Radio size={20} />}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-black sm:text-base">
                  {feedMode === 'test'
                    ? 'Test feed connection'
                    : connectionState === 'live'
                      ? 'Live connection'
                      : connectionState === 'fallback'
                        ? 'Catch-up polling active'
                        : 'Connecting to live feed'}
                </p>
                <p className="text-xs text-zinc-500 sm:text-sm">
                  Infinite-scroll batches · {total} matching plays
                </p>
              </div>
            </div>

            <label className="w-full min-w-0 xl:w-auto xl:min-w-64">
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-zinc-500">My fantasy team</span>
              <select
                value={selectedRosterId}
                onChange={(event) => setSelectedRosterId(event.target.value)}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-bold outline-none focus:border-emerald-400"
              >
                <option value="">No matchup highlighting</option>
                {teams.map((team) => (
                  <option key={team.sleeper_roster_id} value={team.sleeper_roster_id}>
                    {team.team_name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
            <select value={eventType} onChange={(event) => setEventType(event.target.value)} className="min-w-0 rounded-xl border border-zinc-700 bg-zinc-950 px-2.5 py-2 text-xs font-bold outline-none focus:border-emerald-400 sm:px-3 sm:text-sm">
              {eventFilters.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select value={confidence} onChange={(event) => setConfidence(event.target.value)} className="min-w-0 rounded-xl border border-zinc-700 bg-zinc-950 px-2.5 py-2 text-xs font-bold outline-none focus:border-emerald-400 sm:px-3 sm:text-sm">
              <option value="all">All confidence</option>
              <option value="high">High confidence</option>
              <option value="medium">Medium confidence</option>
              <option value="low">Low confidence</option>
            </select>
            <select value={nflTeam} onChange={(event) => setNflTeam(event.target.value)} className="min-w-0 rounded-xl border border-zinc-700 bg-zinc-950 px-2.5 py-2 text-xs font-bold outline-none focus:border-emerald-400 sm:px-3 sm:text-sm">
              <option value="all">All NFL teams</option>
              {NFL_TEAMS.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
            </select>
            <button
              type="button"
              onClick={() => setFavoritesOnly((current) => !current)}
              className={`inline-flex min-w-0 items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-black transition sm:gap-2 sm:px-3 sm:text-sm ${
                favoritesOnly
                  ? 'border-amber-400/40 bg-amber-400/10 text-amber-300'
                  : 'border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-zinc-500'
              }`}
            >
              <Star size={16} fill={favoritesOnly ? 'currentColor' : 'none'} />
              <span className="sm:hidden">Favourites ({favoritePlayerIds.length})</span>
              <span className="hidden sm:inline">Favourites only ({favoritePlayerIds.length})</span>
            </button>
          </div>

          {selectedTeam && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-xs sm:gap-3 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm">
              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 font-black text-emerald-300">Green helps {selectedTeam.team_name}</span>
              {opponentTeam && <span className="rounded-full border border-red-400/30 bg-red-400/10 px-3 py-1 font-black text-red-300">Red helps {opponentTeam.team_name}</span>}
              {!opponentTeam && <span className="text-zinc-500">No opponent matchup was found for this week.</span>}
            </div>
          )}
        </div>
      </div>

      {error && <div className="rounded-2xl border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-300">{error}</div>}

      <div className="min-w-0 overflow-hidden rounded-[1.5rem] border border-zinc-800 bg-black/35 sm:rounded-[2rem]">
        <div className="flex min-w-0 items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-900/95 px-3 py-2.5 sm:px-5 sm:py-3.5">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
              Play page {feedPage} of {totalFeedPages}
            </p>
            <p className="mt-0.5 truncate text-xs text-zinc-400 sm:text-sm">
              {events.length} displayed · scroll for older plays · maximum 250 per page
            </p>
          </div>

          {feedPage > 1 && (
            <button
              type="button"
              onClick={goToPreviousFeedPage}
              disabled={loading}
              className="shrink-0 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-black text-zinc-200 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              ← Previous page
            </button>
          )}
        </div>

        <div
          ref={feedScrollRef}
          className="h-[68dvh] min-h-[28rem] max-h-[780px] overflow-y-auto overscroll-contain scroll-smooth p-2.5 [scrollbar-gutter:stable] sm:p-4"
        >
          <div className={`min-w-0 space-y-2.5 transition-opacity sm:space-y-3 ${loading ? 'opacity-45' : 'opacity-100'}`}>
            {events.map((event) => (
              <GameFeedCard
                key={event.id}
                event={event}
                leagueId={leagueId}
                favoriteSet={favoriteSet}
                onToggleFavorite={toggleFavorite}
                myPlayerIds={myPlayerIds}
                opponentPlayerIds={opponentPlayerIds}
                myTeamName={selectedTeam?.team_name || null}
                opponentTeamName={opponentTeam?.team_name || null}
              />
            ))}

            {!events.length && !loading && (
              <div className="rounded-[1.5rem] border border-dashed border-zinc-700 bg-zinc-900/50 px-5 py-14 text-center sm:rounded-[2rem] sm:px-6 sm:py-16">
                <Activity className="mx-auto text-zinc-600" size={34} />
                <h2 className="mt-4 text-xl font-black sm:text-2xl">No matching scoring events</h2>
                <p className="mx-auto mt-2 max-w-xl text-sm text-zinc-500 sm:text-base">
                  {favoritesOnly && favoritePlayerIds.length === 0
                    ? 'Star a player first, then use the Favourites filter.'
                    : 'Try a different team or play filter, or wait for the next scoring update.'}
                </p>
              </div>
            )}

            {loading && !events.length && (
              <div className="flex min-h-64 items-center justify-center text-zinc-500">
                <RefreshCw className="animate-spin" size={24} />
              </div>
            )}

            {canLoadMoreWithinPage && <div ref={loadMoreSentinelRef} className="h-2" aria-hidden="true" />}

            {loadingMore && (
              <div className="flex items-center justify-center gap-2 py-5 text-sm font-bold text-zinc-500">
                <RefreshCw className="animate-spin" size={17} />
                Loading older plays…
              </div>
            )}

            {reachedPageLimit && hasNextFeedPage && !loadingMore && (
              <div className="rounded-[1.5rem] border border-emerald-400/25 bg-emerald-400/10 px-5 py-6 text-center sm:rounded-[2rem] sm:px-7 sm:py-8">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">
                  250 plays displayed
                </p>
                <h2 className="mt-2 text-xl font-black sm:text-2xl">Ready for the next page?</h2>
                <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-zinc-300">
                  To keep the live feed smooth, the next 250 older plays are loaded on a separate page.
                </p>
                <button
                  type="button"
                  onClick={goToNextFeedPage}
                  className="mt-4 rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-black text-emerald-950 transition hover:bg-emerald-300"
                >
                  Go to play page {feedPage + 1} →
                </button>
              </div>
            )}

            {!canLoadMoreWithinPage && !hasNextFeedPage && events.length > 0 && !loadingMore && (
              <div className="py-5 text-center text-xs font-bold uppercase tracking-[0.18em] text-zinc-600">
                You have reached the end of this feed
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function dedupeEvents(events: GameFeedEvent[]) {
  const seen = new Set<number>()
  return events.filter((event) => {
    const id = Number(event.id)
    if (!Number.isFinite(id) || seen.has(id)) return false
    seen.add(id)
    return true
  })
}

function formatStableTimestamp(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const month = months[date.getUTCMonth()]
  const day = date.getUTCDate()
  const minutes = String(date.getUTCMinutes()).padStart(2, '0')
  const hour24 = date.getUTCHours()
  const suffix = hour24 >= 12 ? 'PM' : 'AM'
  const hour12 = hour24 % 12 || 12

  return `${month} ${day}, ${hour12}:${minutes} ${suffix} UTC`
}

function formatLocalTimestamp(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function GameFeedCard({
  event,
  leagueId,
  favoriteSet,
  onToggleFavorite,
  myPlayerIds,
  opponentPlayerIds,
  myTeamName,
  opponentTeamName,
}: {
  event: GameFeedEvent
  leagueId: string
  favoriteSet: Set<string>
  onToggleFavorite: (playerId?: string | null) => void
  myPlayerIds: Set<string>
  opponentPlayerIds: Set<string>
  myTeamName: string | null
  opponentTeamName: string | null
}) {
  const icon = eventIcon(event)
  const impact = matchupImpact(event, myPlayerIds, opponentPlayerIds)
  const cardTone = impact > 0
    ? 'border-emerald-400/45 bg-emerald-950/20 shadow-[inset_3px_0_0_rgba(52,211,153,0.85)] sm:shadow-[inset_4px_0_0_rgba(52,211,153,0.85)]'
    : impact < 0
      ? 'border-red-400/45 bg-red-950/20 shadow-[inset_3px_0_0_rgba(248,113,113,0.85)] sm:shadow-[inset_4px_0_0_rgba(248,113,113,0.85)]'
      : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
  const involvement = eventRosterInvolvement(event, myPlayerIds, opponentPlayerIds)
  const confidenceClass = event.confidence === 'high'
    ? 'text-emerald-300 bg-emerald-400/10 border-emerald-400/20'
    : event.confidence === 'medium'
      ? 'text-amber-300 bg-amber-400/10 border-amber-400/20'
      : 'text-zinc-400 bg-zinc-800 border-zinc-700'
  const [timestamp, setTimestamp] = useState(() => formatStableTimestamp(event.detected_at))

  useEffect(() => {
    setTimestamp(formatLocalTimestamp(event.detected_at))
  }, [event.detected_at])

  return (
    <article className={`min-w-0 overflow-hidden rounded-[1.35rem] border transition sm:rounded-[2rem] ${cardTone}`}>
      <div className="flex min-w-0 gap-3 p-3 sm:gap-5 sm:p-6">
        <GameFeedPlayerImage event={event} leagueId={leagueId} icon={icon} />

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-2 sm:gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
                <p className="min-w-0 truncate text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500 sm:text-xs sm:tracking-[0.22em]">
                  {nflTeamName(event.primary_player_team)} · {event.primary_player_position || 'Player'}
                </p>
                {involvement.mine && (
                  <span className="rounded-full bg-emerald-400/15 px-1.5 py-0.5 text-[9px] font-black text-emerald-300 sm:px-2 sm:py-1 sm:text-[10px]">
                    YOUR ROSTER
                  </span>
                )}
                {involvement.opponent && (
                  <span className="rounded-full bg-red-400/15 px-1.5 py-0.5 text-[9px] font-black text-red-300 sm:px-2 sm:py-1 sm:text-[10px]">
                    OPPONENT
                  </span>
                )}
              </div>

              <h2 className="mt-0.5 line-clamp-2 break-words text-lg font-black leading-[1.08] sm:mt-1 sm:text-2xl sm:leading-tight">
                {event.description}
              </h2>

              <div className="mt-1 flex min-w-0 items-center gap-1 sm:gap-2">
                <Link
                  href={`/league/${leagueId}/players/${event.primary_player_id}`}
                  className="truncate text-sm font-bold text-zinc-200 hover:text-emerald-300 sm:text-base"
                >
                  {event.primary_player_name}
                </Link>
                <button
                  type="button"
                  onClick={() => onToggleFavorite(event.primary_player_id)}
                  aria-label={`${favoriteSet.has(event.primary_player_id) ? 'Remove' : 'Add'} ${event.primary_player_name} ${favoriteSet.has(event.primary_player_id) ? 'from' : 'to'} favourites`}
                  className={`shrink-0 rounded-md p-0.5 transition sm:rounded-lg sm:p-1 ${favoriteSet.has(event.primary_player_id) ? 'text-amber-300' : 'text-zinc-600 hover:text-amber-300'}`}
                >
                  <Star size={14} fill={favoriteSet.has(event.primary_player_id) ? 'currentColor' : 'none'} />
                </button>
              </div>
            </div>

            <div className="shrink-0 text-right">
              <p className={`text-lg font-black leading-none sm:text-2xl ${Number(event.primary_fantasy_delta) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatFantasyDelta(event.primary_fantasy_delta)}
              </p>
              <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-600 sm:text-xs sm:tracking-[0.18em]">
                <span className="sm:hidden">FP</span>
                <span className="hidden sm:inline">fantasy points</span>
              </p>
              <p className="mt-1 text-[9px] text-zinc-600 sm:hidden">{timestamp}</p>
            </div>
          </div>

          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5 text-[10px] sm:mt-4 sm:gap-2 sm:text-xs">
            {event.secondary_player_id && event.secondary_player_name && (
              <span className="inline-flex min-w-0 items-center gap-1 rounded-full border border-zinc-700 bg-zinc-950 px-2 py-1 font-bold text-zinc-300 sm:px-3 sm:py-1.5">
                <Link
                  href={`/league/${leagueId}/players/${event.secondary_player_id}`}
                  className="max-w-36 truncate hover:text-emerald-300 sm:max-w-none"
                >
                  From {event.secondary_player_name}
                </Link>
                <button
                  type="button"
                  onClick={() => onToggleFavorite(event.secondary_player_id)}
                  aria-label="Toggle quarterback favourite"
                  className={favoriteSet.has(event.secondary_player_id) ? 'shrink-0 text-amber-300' : 'shrink-0 text-zinc-600 hover:text-amber-300'}
                >
                  <Star size={12} fill={favoriteSet.has(event.secondary_player_id) ? 'currentColor' : 'none'} />
                </button>
              </span>
            )}

            {impact > 0 && myTeamName && (
              <span className="max-w-40 truncate rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 font-black text-emerald-300 sm:max-w-none sm:px-3 sm:py-1.5">
                Helps {myTeamName}
              </span>
            )}
            {impact < 0 && opponentTeamName && (
              <span className="max-w-40 truncate rounded-full border border-red-400/30 bg-red-400/10 px-2 py-1 font-black text-red-300 sm:max-w-none sm:px-3 sm:py-1.5">
                Helps {opponentTeamName}
              </span>
            )}
            {event.feed_mode === 'test' && (
              <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-1 font-black text-amber-300 sm:px-3 sm:py-1.5">
                TEST{event.metadata?.synthetic ? ' · synthetic' : ''}
              </span>
            )}
            <span className={`rounded-full border px-2 py-1 font-black sm:px-3 sm:py-1.5 ${confidenceClass}`}>
              <span className="sm:hidden">{event.confidence}</span>
              <span className="hidden sm:inline">{event.confidence} confidence</span>
            </span>
            {event.is_aggregate && (
              <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-2 py-1 font-black text-violet-300 sm:px-3 sm:py-1.5">
                grouped
                <span className="hidden sm:inline"> update</span>
              </span>
            )}
            <span className="ml-auto hidden text-zinc-600 sm:inline">{timestamp}</span>
          </div>
        </div>
      </div>
    </article>
  )
}

function eventMatchesFilters(
  event: GameFeedEvent,
  filters: {
    eventType: string
    confidence: string
    nflTeam: string
    favoritesOnly: boolean
    favoriteSet: Set<string>
  }
) {
  const typeMatches = filters.eventType === 'all' ||
    event.event_type === filters.eventType ||
    (filters.eventType === 'touchdown' && Number(event.inferred_touchdowns || 0) > 0) ||
    (filters.eventType === 'field_goal' && event.event_type === 'extra_point')
  const confidenceMatches = filters.confidence === 'all' || event.confidence === filters.confidence
  const teamMatches = filters.nflTeam === 'all' || event.primary_player_team === filters.nflTeam
  const favouriteMatches = !filters.favoritesOnly ||
    filters.favoriteSet.has(event.primary_player_id) ||
    Boolean(event.secondary_player_id && filters.favoriteSet.has(event.secondary_player_id))
  return typeMatches && confidenceMatches && teamMatches && favouriteMatches
}

function eventRosterInvolvement(
  event: GameFeedEvent,
  myPlayerIds: Set<string>,
  opponentPlayerIds: Set<string>
) {
  return {
    mine:
      myPlayerIds.has(event.primary_player_id) ||
      Boolean(event.secondary_player_id && myPlayerIds.has(event.secondary_player_id)),
    opponent:
      opponentPlayerIds.has(event.primary_player_id) ||
      Boolean(event.secondary_player_id && opponentPlayerIds.has(event.secondary_player_id)),
  }
}

function matchupImpact(
  event: GameFeedEvent,
  myPlayerIds: Set<string>,
  opponentPlayerIds: Set<string>
) {
  let impact = 0
  const primaryDelta = Number(event.primary_fantasy_delta || 0)
  const secondaryDelta = Number(event.secondary_fantasy_delta || 0)
  if (myPlayerIds.has(event.primary_player_id)) impact += primaryDelta
  if (opponentPlayerIds.has(event.primary_player_id)) impact -= primaryDelta
  if (event.secondary_player_id && myPlayerIds.has(event.secondary_player_id)) impact += secondaryDelta
  if (event.secondary_player_id && opponentPlayerIds.has(event.secondary_player_id)) impact -= secondaryDelta
  return impact
}

function eventIcon(event: GameFeedEvent) {
  if (Number(event.inferred_touchdowns || 0) > 0) return <Trophy size={15} />
  if (event.event_type === 'reception') return <Target size={15} />
  if (event.event_type === 'rush') return <Zap size={15} />
  if (event.event_type === 'defense') return <Shield size={15} />
  if (event.event_type === 'turnover' || event.is_correction) return <AlertTriangle size={15} />
  return <CircleDot size={15} />
}
