import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  isSafeSleeperPlayerId,
  normalizeGameFeedSeason,
  normalizeGameFeedWeek,
} from '@/lib/gameFeed'

export const dynamic = 'force-dynamic'

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
    const parsedBefore = Number(url.searchParams.get('before') || 0)
    const after = Number.isSafeInteger(parsedAfter) && parsedAfter > 0 ? parsedAfter : 0
    const before = Number.isSafeInteger(parsedBefore) && parsedBefore > 0 ? parsedBefore : 0
    const playerId = url.searchParams.get('playerId')
    const eventType = url.searchParams.get('eventType')
    const parsedLimit = Number(url.searchParams.get('limit') || 50)
    const requestedLimit = Number.isFinite(parsedLimit) ? Math.trunc(parsedLimit) : 50
    const limit = Math.min(Math.max(requestedLimit, 1), 200)
    const allowedEventTypes = new Set([
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

    if (playerId && !isSafeSleeperPlayerId(playerId)) {
      return NextResponse.json({ error: 'Invalid player ID.' }, { status: 400 })
    }

    if (eventType && eventType !== 'all' && !allowedEventTypes.has(eventType)) {
      return NextResponse.json({ error: 'Invalid event type.' }, { status: 400 })
    }

    const feedMode = league.game_feed_display_mode === 'test' ? 'test' : 'public'

    let query = supabase
      .from('game_feed_events')
      .select('*')
      .eq('league_id', leagueId)
      .eq('feed_mode', feedMode)
      .eq('season', season)
      .eq('week', week)

    if (playerId) {
      query = query.or(
        `primary_player_id.eq.${playerId},secondary_player_id.eq.${playerId}`
      )
    }

    if (eventType && eventType !== 'all') {
      query = query.eq('event_type', eventType)
    }

    if (after > 0) {
      query = query.gt('id', after).order('id', { ascending: true })
    } else {
      if (before > 0) query = query.lt('id', before)
      query = query.order('id', { ascending: false })
    }

    const { data, error } = await query.limit(limit + 1)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const rows = data || []
    const hasMore = rows.length > limit
    const events = rows.slice(0, limit)
    const ids = events.map((event: any) => Number(event.id)).filter(Number.isFinite)

    return NextResponse.json({
      events,
      hasMore,
      nextCursor: ids.length ? String(Math.max(...ids)) : null,
      oldestCursor: ids.length ? String(Math.min(...ids)) : null,
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
