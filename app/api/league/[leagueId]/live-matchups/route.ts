import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSleeperLeague, getSleeperMatchups } from '@/lib/sleeper'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  try {
    const { leagueId } = await params
    const url = new URL(request.url)
    const selectedSeason = url.searchParams.get('season') || ''
    const selectedWeek = Math.max(Number(url.searchParams.get('week') || 1), 1)
    const supabase = createAdminClient()

    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('*')
      .eq('id', leagueId)
      .single()

    if (leagueError || !league) {
      return NextResponse.json({ error: 'League not found.' }, { status: 404 })
    }

    let synced = false

    try {
      const sleeperLeague = await getSleeperLeague(league.sleeper_league_id)
      const isInSeason = String(sleeperLeague.status || league.status || '').toLowerCase() === 'in_season'
      const isCurrentSeason = !selectedSeason || String(selectedSeason) === String(sleeperLeague.season)

      if (isInSeason && isCurrentSeason) {
        const sleeperMatchups = await getSleeperMatchups(league.sleeper_league_id, selectedWeek)

        const { data: teams } = await supabase
          .from('teams')
          .select('sleeper_roster_id, team_name')
          .eq('league_id', leagueId)

        const teamNameByRosterId = new Map<number, string>()
        for (const team of teams || []) {
          teamNameByRosterId.set(Number(team.sleeper_roster_id), team.team_name)
        }

        const rows = (sleeperMatchups || [])
          .filter((matchup) => matchup.roster_id)
          .map((matchup) => ({
            league_id: leagueId,
            sleeper_league_id: league.sleeper_league_id,
            season: sleeperLeague.season,
            week: selectedWeek,
            matchup_id: matchup.matchup_id ?? null,
            sleeper_roster_id: matchup.roster_id,
            team_name: teamNameByRosterId.get(Number(matchup.roster_id)) || `Team ${matchup.roster_id}`,
            points: matchup.points || 0,
            projected_points: 0,
            starters: matchup.starters || [],
            players: matchup.players || [],
            players_points: matchup.players_points || null,
            updated_at: new Date().toISOString(),
          }))

        if (rows.length) {
          const { error } = await supabase.from('matchups').upsert(rows, {
            onConflict: 'league_id,season,week,sleeper_roster_id',
          })

          if (error) throw new Error(error.message)
          synced = true
        }

        await supabase
          .from('leagues')
          .update({
            status: sleeperLeague.status,
            season: sleeperLeague.season,
            current_week: sleeperLeague.settings?.week || selectedWeek,
            last_synced_at: new Date().toISOString(),
          })
          .eq('id', leagueId)
      }
    } catch {
      // If Sleeper is unavailable, still return the latest database rows.
    }

    const seasonToRead = selectedSeason || league.season

    const { data: matchups } = await supabase
      .from('matchups')
      .select('*')
      .eq('league_id', leagueId)
      .eq('season', seasonToRead)
      .eq('week', selectedWeek)
      .order('matchup_id', { ascending: true })

    const { data: teams } = await supabase
      .from('teams')
      .select('*')
      .eq('league_id', leagueId)

    return NextResponse.json({
      synced,
      matchups: matchups || [],
      teams: teams || [],
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Could not refresh live matchups.' },
      { status: 500 }
    )
  }
}
