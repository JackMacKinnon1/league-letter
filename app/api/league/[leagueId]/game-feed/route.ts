import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  isSafeSleeperPlayerId,
  normalizeGameFeedSeason,
  normalizeGameFeedWeek,
} from '@/lib/gameFeed'
import { NFL_TEAM_CODES } from '@/lib/nflTeams'
import { pageRange, parsePage, parsePageSize } from '@/lib/pagination'

export const dynamic = 'force-dynamic'

const ALLOWED_EVENT_TYPES = new Set([
  'reception',
  'rush',
  'passing',
  'touchdown',
  'field_goal',
  'extra_point',
  'defense',
  'turnover',
  'scoring_update',
  'stat_correction',
])
const ALLOWED_CONFIDENCE = new Set(['high', 'medium', 'low'])

export async function GET(
  request: Request,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  try {
    const { leagueId } = await params
    const url = new URL(request.url)
    const supabase = createAdminClient()

    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('id,season,current_week,game_feed_display_mode')
      .eq('id', leagueId)
      .maybeSingle()

    if (leagueError || !league) {
      return NextResponse.json({ error: 'League not found.' }, { status: 404 })
    }

    const season = normalizeGameFeedSeason(
      url.searchParams.get('season'),
      String(league.season || '')
    )
    const week = normalizeGameFeedWeek(
      url.searchParams.get('week'),
      Number(league.current_week || 1)
    )
    const parsedAfter = Number(url.searchParams.get('after') || 0)
    const after = Number.isSafeInteger(parsedAfter) && parsedAfter > 0 ? parsedAfter : 0
    const parsedBefore = Number(url.searchParams.get('before') || 0)
    const before = Number.isSafeInteger(parsedBefore) && parsedBefore > 0 ? parsedBefore : 0
    const playerId = url.searchParams.get('playerId')
    const eventType = url.searchParams.get('eventType') || 'all'
    const confidence = url.searchParams.get('confidence') || 'all'
    const nflTeam = String(url.searchParams.get('nflTeam') || 'all').toUpperCase()
    const favoritePlayerIds = String(url.searchParams.get('favoritePlayerIds') || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 100)

    if (playerId && !isSafeSleeperPlayerId(playerId)) {
      return NextResponse.json({ error: 'Invalid player ID.' }, { status: 400 })
    }
    if (eventType !== 'all' && !ALLOWED_EVENT_TYPES.has(eventType)) {
      return NextResponse.json({ error: 'Invalid event type.' }, { status: 400 })
    }
    if (confidence !== 'all' && !ALLOWED_CONFIDENCE.has(confidence)) {
      return NextResponse.json({ error: 'Invalid confidence.' }, { status: 400 })
    }
    if (nflTeam !== 'ALL' && !NFL_TEAM_CODES.has(nflTeam)) {
      return NextResponse.json({ error: 'Invalid NFL team.' }, { status: 400 })
    }
    if (favoritePlayerIds.some((id) => !isSafeSleeperPlayerId(id))) {
      return NextResponse.json({ error: 'Invalid favourite player ID.' }, { status: 400 })
    }

    const feedMode = league.game_feed_display_mode === 'test' ? 'test' : 'public'

    let query = (before > 0 || after > 0
      ? supabase.from('game_feed_events').select('*')
      : supabase.from('game_feed_events').select('*', { count: 'exact' }))
      .eq('league_id', leagueId)
      .eq('feed_mode', feedMode)
      .eq('season', season)
      .eq('week', week)

    if (playerId) {
      query = query.or(`primary_player_id.eq.${playerId},secondary_player_id.eq.${playerId}`)
    }
    if (eventType === 'touchdown') {
      query = query.or('event_type.eq.touchdown,inferred_touchdowns.gt.0')
    } else if (eventType === 'field_goal') {
      query = query.in('event_type', ['field_goal', 'extra_point'])
    } else if (eventType !== 'all') {
      query = query.eq('event_type', eventType)
    }
    if (confidence !== 'all') query = query.eq('confidence', confidence)
    if (nflTeam !== 'ALL') query = query.eq('primary_player_team', nflTeam)
    if (favoritePlayerIds.length) {
      const list = favoritePlayerIds.join(',')
      query = query.or(
        `primary_player_id.in.(${list}),secondary_player_id.in.(${list})`
      )
    }

    if (before > 0) {
      const limit = parsePageSize(url.searchParams.get('limit'), 25, 50)
      const { data, error } = await query
        .lt('id', before)
        .order('id', { ascending: false })
        .limit(limit + 1)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      const rows = data || []
      const hasMore = rows.length > limit
      const events = rows.slice(0, limit)
      const ids = events.map((event: any) => Number(event.id)).filter(Number.isFinite)

      return NextResponse.json({
        events,
        hasMore,
        nextCursor: ids.length ? String(Math.min(...ids)) : String(before),
        season,
        week,
        feedMode,
      })
    }

    if (after > 0) {
      const limit = parsePageSize(url.searchParams.get('limit'), 200, 200)
      const { data, error } = await query
        .gt('id', after)
        .order('id', { ascending: true })
        .limit(limit + 1)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      const rows = data || []
      const hasMore = rows.length > limit
      const events = rows.slice(0, limit)
      const ids = events.map((event: any) => Number(event.id)).filter(Number.isFinite)
      return NextResponse.json({
        events,
        hasMore,
        nextCursor: ids.length ? String(Math.max(...ids)) : String(after),
        season,
        week,
        feedMode,
      })
    }

    const page = parsePage(url.searchParams.get('page'))
    const pageSize = parsePageSize(url.searchParams.get('pageSize'), 25, 50)
    const { from, to } = pageRange(page, pageSize)
    const { data, count, error } = await query
      .order('id', { ascending: false })
      .range(from, to)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      events: data || [],
      total: count || 0,
      page,
      pageSize,
      season,
      week,
      feedMode,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Could not load the game feed.' },
      { status: 500 }
    )
  }
}
