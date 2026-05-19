import Navbar from '@/components/Navbar'
import TrophyRoom from '@/components/TrophyRoom'
import { createClient } from '@/lib/supabase/server'

export default async function TrophyRoomPage({
  params,
}: {
  params: Promise<{ leagueId: string }>
}) {
  const { leagueId } = await params
  const supabase = await createClient()

  const { data: league } = await supabase
    .from('leagues')
    .select('*')
    .eq('id', leagueId)
    .single()

  const { data: seasonWinners } = await supabase
    .from('season_winners')
    .select('*')
    .eq('league_id', leagueId)
    .order('season', { ascending: false })

  const { data: teamSeasons } = await supabase
    .from('team_season_stats')
    .select('*')
    .eq('league_id', leagueId)
    .order('season', { ascending: false })

  const teamsBySeason = new Map<string, any[]>()

  for (const team of teamSeasons || []) {
    const season = String(team.season)

    if (!teamsBySeason.has(season)) {
      teamsBySeason.set(season, [])
    }

    teamsBySeason.get(season)?.push(team)
  }

  const winnerSeasons = new Set(
    (seasonWinners || []).map((winner: any) => String(winner.season))
  )

  const allSeasons = Array.from(
    new Set([
      ...winnerSeasons,
      ...Array.from(teamsBySeason.keys()),
    ])
  ).sort((a, b) => Number(b) - Number(a))

  const winnerBySeason = new Map<string, any>()

  for (const winner of seasonWinners || []) {
    winnerBySeason.set(String(winner.season), winner)
  }

  const trophySeasons = allSeasons.map((season) => {
    const winner = winnerBySeason.get(season)
    const teams = teamsBySeason.get(season) || []

    return {
      season,
      championship_week: winner?.championship_week || null,
      champion_roster_id: winner?.champion_roster_id || null,
      champion_team_name: winner?.champion_team_name || null,
      champion_points: winner?.champion_points || null,
      runner_up_roster_id: winner?.runner_up_roster_id || null,
      runner_up_team_name: winner?.runner_up_team_name || null,
      runner_up_points: winner?.runner_up_points || null,
      division_winners: buildDivisionWinners(teams),
    }
  })

  const hasDivisions = trophySeasons.some(
    (season) => season.division_winners.length > 0
  )

  return (
    <>
      <Navbar />
      <TrophyRoom
        leagueId={leagueId}
        leagueName={league?.name}
        seasons={trophySeasons}
        hasDivisions={hasDivisions}
      />
    </>
  )
}

function buildDivisionWinners(teams: any[]) {
  const teamsWithDivisions = teams.filter((team) => {
    const divisionId = team.division_id ?? team.division
    return divisionId !== null && divisionId !== undefined && divisionId !== ''
  })

  if (!teamsWithDivisions.length) return []

  const teamsByDivision = new Map<string, any[]>()

  for (const team of teamsWithDivisions) {
    const divisionId = String(team.division_id ?? team.division)

    if (!teamsByDivision.has(divisionId)) {
      teamsByDivision.set(divisionId, [])
    }

    teamsByDivision.get(divisionId)?.push(team)
  }

  return Array.from(teamsByDivision.entries())
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([divisionId, divisionTeams]) => {
      const sorted = [...divisionTeams].sort((a, b) => {
        const winDiff = Number(b.wins || 0) - Number(a.wins || 0)
        if (winDiff !== 0) return winDiff

        const tieDiff = Number(b.ties || 0) - Number(a.ties || 0)
        if (tieDiff !== 0) return tieDiff

        return Number(b.points_for || 0) - Number(a.points_for || 0)
      })

      const winner = sorted[0]

      return {
        division_id: winner.division_id ?? winner.division,
        division_name:
          winner.division_name ||
          winner.division_label ||
          `Division ${Number(divisionId) + 1}`,
        sleeper_roster_id: winner.sleeper_roster_id,
        team_name: winner.team_name,
        owner_name: winner.owner_name,
        avatar: winner.avatar,
        wins: Number(winner.wins || 0),
        losses: Number(winner.losses || 0),
        ties: Number(winner.ties || 0),
        points_for: Number(winner.points_for || 0),
      }
    })
}
