import {
  getSleeperLeague,
  getSleeperMatchups,
  getSleeperRosters,
  getSleeperTransactions,
  getSleeperUsers,
  getSleeperWinnersBracket,
  sleeperAvatarUrl,
  sleeperFantasyPoints,
  sleeperFantasyPointsAgainst,
  SleeperUser,
} from '@/lib/sleeper'
import { syncSleeperPlayers } from '@/lib/syncSleeperPlayers'

function getTeamName(user?: SleeperUser, fallback?: string) {
  return (
    user?.metadata?.team_name ||
    user?.display_name ||
    user?.username ||
    fallback ||
    'Unknown Team'
  )
}


function getDivisionName(sleeperLeague: any, divisionId?: number | string | null) {
  if (divisionId === null || divisionId === undefined || divisionId === '') {
    return null
  }

  const metadata = sleeperLeague?.metadata || {}
  const oneBasedId = Number(divisionId) + 1
  const possibleKeys = [
    `division_${divisionId}`,
    `division_${oneBasedId}`,
    `division_${divisionId}_name`,
    `division_${oneBasedId}_name`,
  ]

  for (const key of possibleKeys) {
    if (metadata[key]) return String(metadata[key])
  }

  return `Division ${Number(divisionId) === 0 ? 1 : Number(divisionId)}`
}

async function syncTeamSeasonStats({
  supabase,
  appLeagueId,
  sleeperLeagueId,
}: {
  supabase: any
  appLeagueId: string
  sleeperLeagueId: string
}) {
  let currentSleeperLeagueId: string | null = sleeperLeagueId
  let seasonsSynced = 0
  const maxSeasonsToSync = 10

  for (let i = 0; i < maxSeasonsToSync && currentSleeperLeagueId; i++) {
    try {
      const sleeperLeague = await getSleeperLeague(currentSleeperLeagueId)
      const sleeperUsers = await getSleeperUsers(currentSleeperLeagueId)
      const sleeperRosters = await getSleeperRosters(currentSleeperLeagueId)

      const usersById = new Map<string, SleeperUser>()

      for (const user of sleeperUsers) {
        usersById.set(user.user_id, user)
      }

      const seasonRows = sleeperRosters.map((roster) => {
        const owner = roster.owner_id
          ? usersById.get(roster.owner_id)
          : undefined

        return {
          league_id: appLeagueId,
          sleeper_league_id: currentSleeperLeagueId,
          season: sleeperLeague.season,
          sleeper_roster_id: roster.roster_id,
          sleeper_owner_id: roster.owner_id,
          team_name: getTeamName(owner, `Team ${roster.roster_id}`),
          owner_name: owner?.display_name || owner?.username || null,
          avatar: sleeperAvatarUrl(owner?.avatar),
          wins: roster.settings?.wins || 0,
          losses: roster.settings?.losses || 0,
          ties: roster.settings?.ties || 0,
          division_id: roster.settings?.division ?? null,
          division_name: getDivisionName(
            sleeperLeague,
            roster.settings?.division ?? null
          ),
          points_for: sleeperFantasyPoints(roster.settings),
          points_against: sleeperFantasyPointsAgainst(roster.settings),
          players: roster.players || [],
          starters: roster.starters || [],
          updated_at: new Date().toISOString(),
        }
      })

      if (seasonRows.length > 0) {
        const { error } = await supabase
          .from('team_season_stats')
          .upsert(seasonRows, {
            onConflict: 'league_id,season,sleeper_roster_id',
          })

        if (error) {
          throw new Error(error.message)
        }
      }

      seasonsSynced += 1
      currentSleeperLeagueId = sleeperLeague.previous_league_id || null
    } catch {
      currentSleeperLeagueId = null
    }
  }

  return seasonsSynced
}

async function syncHistoricalMatchups({
  supabase,
  appLeagueId,
  sleeperLeagueId,
}: {
  supabase: any
  appLeagueId: string
  sleeperLeagueId: string
}) {
  const allMatchupsToUpsert: any[] = []

  let matchupSleeperLeagueId: string | null = sleeperLeagueId
  const maxMatchupSeasonsToSync = 10

  for (
    let seasonIndex = 0;
    seasonIndex < maxMatchupSeasonsToSync && matchupSleeperLeagueId;
    seasonIndex++
  ) {
    try {
      const matchupLeague = await getSleeperLeague(matchupSleeperLeagueId)
      const matchupUsers = await getSleeperUsers(matchupSleeperLeagueId)
      const matchupRosters = await getSleeperRosters(matchupSleeperLeagueId)

      const matchupUsersById = new Map<string, SleeperUser>()

      for (const user of matchupUsers) {
        matchupUsersById.set(user.user_id, user)
      }

      const historicalRosterNameMap = new Map<number, string>()

      for (const roster of matchupRosters) {
        const owner = roster.owner_id
          ? matchupUsersById.get(roster.owner_id)
          : undefined

        historicalRosterNameMap.set(
          roster.roster_id,
          getTeamName(owner, `Team ${roster.roster_id}`)
        )
      }

      const weeksToSync = Array.from({ length: 18 }, (_, index) => index + 1)

      for (const matchupWeek of weeksToSync) {
        try {
          const weekMatchups = await getSleeperMatchups(
            matchupSleeperLeagueId,
            matchupWeek
          )

          for (const matchup of weekMatchups) {
            if (!matchup.roster_id) continue

            allMatchupsToUpsert.push({
              league_id: appLeagueId,
              sleeper_league_id: matchupSleeperLeagueId,
              season: matchupLeague.season,
              week: matchupWeek,
              matchup_id: matchup.matchup_id ?? null,
              sleeper_roster_id: matchup.roster_id,
              team_name:
                historicalRosterNameMap.get(matchup.roster_id) ||
                `Team ${matchup.roster_id}`,
              points: matchup.points || 0,
              projected_points: 0,
              starters: matchup.starters || [],
              players: matchup.players || [],
              players_points: matchup.players_points || null,
              updated_at: new Date().toISOString(),
            })
          }
        } catch {
          // Some weeks may not exist or may not have matchups.
          // Keep syncing the rest.
        }
      }

      matchupSleeperLeagueId = matchupLeague.previous_league_id || null
    } catch {
      matchupSleeperLeagueId = null
    }
  }

  if (allMatchupsToUpsert.length > 0) {
    const chunkSize = 500

    for (let i = 0; i < allMatchupsToUpsert.length; i += chunkSize) {
      const chunk = allMatchupsToUpsert.slice(i, i + chunkSize)

      const { error } = await supabase.from('matchups').upsert(chunk, {
        onConflict: 'league_id,season,week,sleeper_roster_id',
      })

      if (error) {
        throw new Error(error.message)
      }
    }
  }

  return allMatchupsToUpsert.length
}

async function syncHistoricalTransactions({
  supabase,
  appLeagueId,
  sleeperLeagueId,
}: {
  supabase: any
  appLeagueId: string
  sleeperLeagueId: string
}) {
  const allTransactions: any[] = []

  let transactionSleeperLeagueId: string | null = sleeperLeagueId
  const maxTransactionSeasonsToSync = 10

  for (
    let seasonIndex = 0;
    seasonIndex < maxTransactionSeasonsToSync && transactionSleeperLeagueId;
    seasonIndex++
  ) {
    try {
      const transactionLeague = await getSleeperLeague(
        transactionSleeperLeagueId
      )

      const weeksToSync = Array.from({ length: 18 }, (_, index) => index + 1)

      for (const transactionWeek of weeksToSync) {
        try {
          const weekTransactions = await getSleeperTransactions(
            transactionSleeperLeagueId,
            transactionWeek
          )

          for (const transaction of weekTransactions) {
            allTransactions.push({
              ...transaction,
              syncedWeek: transactionWeek,
              syncedSeason: transactionLeague.season,
              syncedSleeperLeagueId: transactionSleeperLeagueId,
            })
          }
        } catch {
          // Some older leagues/weeks may have no transaction data.
          // Keep syncing the rest.
        }
      }

      transactionSleeperLeagueId = transactionLeague.previous_league_id || null
    } catch {
      transactionSleeperLeagueId = null
    }
  }

  const transactionsToUpsert = allTransactions.map((transaction) => ({
    league_id: appLeagueId,
    sleeper_league_id: transaction.syncedSleeperLeagueId,
    sleeper_transaction_id: transaction.transaction_id,
    season: transaction.syncedSeason,
    week: transaction.syncedWeek,
    type: transaction.type,
    status: transaction.status,
    roster_ids: transaction.roster_ids || [],
    adds: transaction.adds || null,
    drops: transaction.drops || null,
    draft_picks: transaction.draft_picks || null,
    creator: transaction.creator,
    created_sleeper_at: transaction.created,
  }))

  if (transactionsToUpsert.length > 0) {
    const chunkSize = 500

    for (let i = 0; i < transactionsToUpsert.length; i += chunkSize) {
      const chunk = transactionsToUpsert.slice(i, i + chunkSize)

      const { error } = await supabase.from('transactions').upsert(chunk, {
        onConflict: 'league_id,sleeper_transaction_id',
      })

      if (error) {
        throw new Error(error.message)
      }
    }
  }

  return transactionsToUpsert.length
}

async function syncSeasonWinners({
  supabase,
  appLeagueId,
  sleeperLeagueId,
}: {
  supabase: any
  appLeagueId: string
  sleeperLeagueId: string
}) {
  let currentSleeperLeagueId: string | null = sleeperLeagueId
  let winnersSynced = 0
  const maxSeasonsToSync = 10

  for (let i = 0; i < maxSeasonsToSync && currentSleeperLeagueId; i++) {
    try {
      const sleeperLeague = await getSleeperLeague(currentSleeperLeagueId)
      const sleeperUsers = await getSleeperUsers(currentSleeperLeagueId)
      const sleeperRosters = await getSleeperRosters(currentSleeperLeagueId)
      const winnersBracket = await getSleeperWinnersBracket(
        currentSleeperLeagueId
      )

      if (!winnersBracket || winnersBracket.length === 0) {
        currentSleeperLeagueId = sleeperLeague.previous_league_id || null
        continue
      }

      const usersById = new Map<string, SleeperUser>()

      for (const user of sleeperUsers) {
        usersById.set(user.user_id, user)
      }

      const rosterNameMap = new Map<number, string>()

      for (const roster of sleeperRosters) {
        const owner = roster.owner_id ? usersById.get(roster.owner_id) : undefined

        rosterNameMap.set(
          roster.roster_id,
          getTeamName(owner, `Team ${roster.roster_id}`)
        )
      }

      const championshipNode = [...winnersBracket].sort(
        (a, b) => Number(b.r || 0) - Number(a.r || 0)
      )[0]

      if (!championshipNode) {
        currentSleeperLeagueId = sleeperLeague.previous_league_id || null
        continue
      }

      const championshipRound = Number(championshipNode.r || 1)
      const playoffStartWeek = Number(
        sleeperLeague.settings?.playoff_week_start || 15
      )
      const championshipWeek = playoffStartWeek + championshipRound - 1

      const championRosterId = championshipNode.w || null

      let runnerUpRosterId = championshipNode.l || null

      if (!runnerUpRosterId && championshipNode.t1 && championshipNode.t2) {
        runnerUpRosterId =
          Number(championshipNode.t1) === Number(championRosterId)
            ? championshipNode.t2
            : championshipNode.t1
      }

      if (!championRosterId || !runnerUpRosterId) {
        currentSleeperLeagueId = sleeperLeague.previous_league_id || null
        continue
      }

      const championshipMatchups = await getSleeperMatchups(
        currentSleeperLeagueId,
        championshipWeek
      )

      const championMatchup = championshipMatchups.find(
        (row) => Number(row.roster_id) === Number(championRosterId)
      )

      const runnerUpMatchup = championshipMatchups.find(
        (row) => Number(row.roster_id) === Number(runnerUpRosterId)
      )

      const row = {
        league_id: appLeagueId,
        sleeper_league_id: currentSleeperLeagueId,
        season: sleeperLeague.season,
        championship_week: championshipWeek,
        championship_round: championshipRound,
        champion_roster_id: championRosterId,
        champion_team_name:
          rosterNameMap.get(championRosterId) || `Roster ${championRosterId}`,
        runner_up_roster_id: runnerUpRosterId,
        runner_up_team_name:
          rosterNameMap.get(runnerUpRosterId) || `Roster ${runnerUpRosterId}`,
        champion_points: championMatchup?.points || 0,
        runner_up_points: runnerUpMatchup?.points || 0,
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase.from('season_winners').upsert(row, {
        onConflict: 'league_id,season',
      })

      if (error) {
        throw new Error(error.message)
      }

      winnersSynced += 1
      currentSleeperLeagueId = sleeperLeague.previous_league_id || null
    } catch {
      currentSleeperLeagueId = null
    }
  }

  return winnersSynced
}

async function syncPlayersIfNeeded({ supabase }: { supabase: any }) {
  const syncKey = 'sleeper_players'
  const now = new Date()

  const { data: metadata, error: metadataError } = await supabase
    .from('sync_metadata')
    .select('*')
    .eq('key', syncKey)
    .maybeSingle()

  if (metadataError) {
    throw new Error(metadataError.message)
  }

  if (metadata?.last_synced_at) {
    const lastSyncedAt = new Date(metadata.last_synced_at)

    const hoursSinceSync =
      (now.getTime() - lastSyncedAt.getTime()) / (1000 * 60 * 60)

    if (hoursSinceSync < 24) {
      return {
        playersSynced: 0,
        playersSkipped: true,
        playersLastSyncedAt: metadata.last_synced_at,
      }
    }
  }

  const playersSynced = await syncSleeperPlayers({ supabase })

  const { error: upsertMetadataError } = await supabase
    .from('sync_metadata')
    .upsert(
      {
        key: syncKey,
        last_synced_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      {
        onConflict: 'key',
      }
    )

  if (upsertMetadataError) {
    throw new Error(upsertMetadataError.message)
  }

  return {
    playersSynced,
    playersSkipped: false,
    playersLastSyncedAt: now.toISOString(),
  }
}

async function syncTeamPointProfiles({
  supabase,
  appLeagueId,
  currentSeason,
}: {
  supabase: any
  appLeagueId: string
  currentSeason: string
}) {
  const lastSeason = String(Number(currentSeason) - 1)

  const { data: lastSeasonMatchups, error: matchupsError } = await supabase
    .from('matchups')
    .select('sleeper_roster_id, points, week')
    .eq('league_id', appLeagueId)
    .eq('season', lastSeason)
    .not('points', 'is', null)

  if (matchupsError) {
    throw new Error(matchupsError.message)
  }

  const { data: lastSeasonTeams, error: lastSeasonTeamsError } = await supabase
    .from('team_season_stats')
    .select('sleeper_roster_id, sleeper_owner_id, team_name, season')
    .eq('league_id', appLeagueId)
    .eq('season', lastSeason)

  if (lastSeasonTeamsError) {
    throw new Error(lastSeasonTeamsError.message)
  }

  const ownerIdByLastSeasonRosterId = new Map<number, string>()

  for (const team of lastSeasonTeams || []) {
    if (!team.sleeper_owner_id) continue

    ownerIdByLastSeasonRosterId.set(
      Number(team.sleeper_roster_id),
      String(team.sleeper_owner_id)
    )
  }

  const scoresByOwnerId = new Map<string, number[]>()

  for (const row of lastSeasonMatchups || []) {
    const lastSeasonRosterId = Number(row.sleeper_roster_id)
    const ownerId = ownerIdByLastSeasonRosterId.get(lastSeasonRosterId)

    if (!ownerId) continue

    const points = Number(row.points || 0)

    if (!scoresByOwnerId.has(ownerId)) {
      scoresByOwnerId.set(ownerId, [])
    }

    scoresByOwnerId.get(ownerId)?.push(points)
  }

  let profilesSynced = 0

  for (const [ownerId, scores] of scoresByOwnerId.entries()) {
    if (!scores.length) continue

    const average =
      scores.reduce((sum, score) => sum + score, 0) / scores.length

    const variance =
      scores.length > 1
        ? scores.reduce((sum, score) => {
            return sum + Math.pow(score - average, 2)
          }, 0) /
          (scores.length - 1)
        : 0

    const standardDeviation = Math.sqrt(variance)

    const { error: updateError } = await supabase
      .from('teams')
      .update({
        avg_points_per_week: average,
        points_std_dev: standardDeviation,
        points_profile_season: lastSeason,
        points_profile_weeks: scores.length,
        updated_at: new Date().toISOString(),
      })
      .eq('league_id', appLeagueId)
      .eq('sleeper_owner_id', ownerId)

    if (updateError) {
      throw new Error(updateError.message)
    }

    profilesSynced += 1
  }

  return profilesSynced
}

export async function syncSleeperLeagueData({
  supabase,
  leagueId,
  week,
}: {
  supabase: any
  leagueId: string
  week?: number
}) {
  const { data: league, error: leagueError } = await supabase
    .from('leagues')
    .select('*')
    .eq('id', leagueId)
    .single()

  if (leagueError || !league) {
    throw new Error('League not found in database.')
  }

  const sleeperLeagueId = league.sleeper_league_id

  const sleeperLeague = await getSleeperLeague(sleeperLeagueId)
  const sleeperUsers = await getSleeperUsers(sleeperLeagueId)
  const sleeperRosters = await getSleeperRosters(sleeperLeagueId)

  const selectedWeek =
    week || sleeperLeague.settings?.week || league.current_week || 1

  const usersById = new Map<string, SleeperUser>()

  for (const user of sleeperUsers) {
    usersById.set(user.user_id, user)
  }

  const teamsToUpsert = sleeperRosters.map((roster) => {
    const owner = roster.owner_id ? usersById.get(roster.owner_id) : undefined

    return {
      league_id: leagueId,
      sleeper_roster_id: roster.roster_id,
      sleeper_owner_id: roster.owner_id,
      team_name: getTeamName(owner, `Team ${roster.roster_id}`),
      owner_name: owner?.display_name || owner?.username || null,
      avatar: sleeperAvatarUrl(owner?.avatar),
      wins: roster.settings?.wins || 0,
      losses: roster.settings?.losses || 0,
      ties: roster.settings?.ties || 0,
      division_id: roster.settings?.division ?? null,
      division_name: getDivisionName(
        sleeperLeague,
        roster.settings?.division ?? null
      ),
      points_for: sleeperFantasyPoints(roster.settings),
      points_against: sleeperFantasyPointsAgainst(roster.settings),
      players: roster.players || [],
      starters: roster.starters || [],
      updated_at: new Date().toISOString(),
    }
  })

  if (teamsToUpsert.length > 0) {
    const { error: teamsError } = await supabase.from('teams').upsert(
      teamsToUpsert,
      {
        onConflict: 'league_id,sleeper_roster_id',
      }
    )

    if (teamsError) {
      throw new Error(teamsError.message)
    }
  }

  const { error: updateLeagueError } = await supabase
    .from('leagues')
    .update({
      name: sleeperLeague.name,
      avatar: sleeperLeague.avatar,
      season: sleeperLeague.season,
      status: sleeperLeague.status,
      sport: sleeperLeague.sport,
      total_rosters: sleeperLeague.total_rosters,
      division_count: sleeperLeague.settings?.divisions || null,
      current_week: selectedWeek,
      last_synced_at: new Date().toISOString(),
    })
    .eq('id', leagueId)

  if (updateLeagueError) {
    throw new Error(updateLeagueError.message)
  }

  const seasonsSynced = await syncTeamSeasonStats({
    supabase,
    appLeagueId: leagueId,
    sleeperLeagueId,
  })

  const matchupsSynced = await syncHistoricalMatchups({
    supabase,
    appLeagueId: leagueId,
    sleeperLeagueId,
  })

  const pointProfilesSynced = await syncTeamPointProfiles({
    supabase,
    appLeagueId: leagueId,
    currentSeason: sleeperLeague.season,
  })

  const transactionsSynced = await syncHistoricalTransactions({
    supabase,
    appLeagueId: leagueId,
    sleeperLeagueId,
  })

  const winnersSynced = await syncSeasonWinners({
    supabase,
    appLeagueId: leagueId,
    sleeperLeagueId,
  })

  const playerSyncResult = await syncPlayersIfNeeded({ supabase })

  return {
    leagueId,
    sleeperLeagueId,
    week: selectedWeek,
    teamsSynced: teamsToUpsert.length,
    matchupsSynced,
    transactionsSynced,
    seasonsSynced,
    winnersSynced,
    pointProfilesSynced,
    playersSynced: playerSyncResult.playersSynced,
    playersSkipped: playerSyncResult.playersSkipped,
    playersLastSyncedAt: playerSyncResult.playersLastSyncedAt,
  }
}