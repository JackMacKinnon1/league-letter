import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeGameFeedSeason, normalizeGameFeedWeek } from '@/lib/gameFeed'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  try {
    const { leagueId } = await params
    const url = new URL(request.url)
    const requestedSeason = url.searchParams.get('season')
    const requestedWeek = url.searchParams.get('week')
    const supabase = createAdminClient()

    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('id,season,status,current_week,game_feed_enabled')
      .eq('id', leagueId)
      .single()

    if (leagueError || !league) {
      return NextResponse.json({ error: 'League not found.' }, { status: 404 })
    }

    const season = normalizeGameFeedSeason(requestedSeason, league.season || '')
    const selectedWeek = normalizeGameFeedWeek(
      requestedWeek,
      Number(league.current_week || 1)
    )

    const [{ data: matchups, error: matchupError }, { data: teams }] =
      await Promise.all([
        supabase
          .from('matchups')
          .select('*')
          .eq('league_id', leagueId)
          .eq('season', season)
          .eq('week', selectedWeek)
          .order('matchup_id', { ascending: true })
          .limit(64),
        supabase.from('teams').select('*').eq('league_id', leagueId).limit(64),
      ])

    if (matchupError) {
      return NextResponse.json({ error: matchupError.message }, { status: 500 })
    }

    const latestStoredUpdate = (matchups || []).reduce<string | null>((latest, matchup: any) => {
      if (!matchup.updated_at) return latest
      if (!latest || new Date(matchup.updated_at).getTime() > new Date(latest).getTime()) {
        return matchup.updated_at
      }
      return latest
    }, null)

    return NextResponse.json({
      matchups: matchups || [],
      teams: teams || [],
      synced: false,
      feedEnabled: Boolean(league.game_feed_enabled),
      workerOnline: false,
      globalFeedOnly: true,
      leagueStatus: league.status,
      lastSyncedAt: latestStoredUpdate,
      source: 'supabase',
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Could not load live matchups.' },
      { status: 500 }
    )
  }
}

