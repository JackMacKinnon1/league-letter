import { createHash, randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { hostname } from 'node:os'
import process, { stdin as input, stdout as output } from 'node:process'
import { createInterface } from 'node:readline/promises'
import { createClient } from '@supabase/supabase-js'
import { inferGameFeedEvents } from './game-feed-inference.mjs'
import { startTestControlServer } from './test-control-server.mjs'

const WORKER_VERSION = '2.1.0-live-test-console'
const SLEEPER_BASE_URL = 'https://api.sleeper.app/v1'
const METADATA_REFRESH_MS = 15 * 60 * 1000
const LOOP_DELAY_MS = 1_000
const HEARTBEAT_MS = 10 * 1000
const QUIET_LOG_MS = 60 * 1000
const PLAYER_QUERY_CHUNK = 200
const UPSERT_CHUNK = 500
const TEST_PLAYER_CACHE_MS = 15 * 60 * 1000

loadEnvironmentFiles()

const parsedOptions = parseArguments(process.argv.slice(2))
const options = await resolveStartupOptions(parsedOptions)
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const workerName = process.env.GAME_FEED_WORKER_NAME || `${hostname()}-${process.pid}`

if (!supabaseUrl || !serviceRoleKey) {
  console.error('\nGame Feed could not start.')
  console.error('Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local.')
  process.exit(1)
}

if (!options.sourceSleeperLeagueId) {
  console.error('\nGame Feed could not start.')
  console.error('Add GAME_FEED_SOURCE_SLEEPER_LEAGUE_ID to .env.local, or pass --source LEAGUE_ID.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

let stopping = false
let knownTargetLeagueIds = []
let lastHeartbeatAt = 0
let demoPending = options.mode === 'test' && options.demo
let testControlServer = null
let testPlayerCache = { loadedAt: 0, players: [] }
const lastQuietLogByKey = new Map()
const startedAt = new Date().toISOString()

process.on('SIGINT', requestStop)
process.on('SIGTERM', requestStop)
process.on('uncaughtException', (error) => {
  console.error('\nUncaught worker error:', error)
  requestStop()
})
process.on('unhandledRejection', (error) => {
  console.error('\nUnhandled worker error:', error)
})

await main()

async function main() {
  printBanner()

  if (options.mode === 'test' && !options.once) {
    testControlServer = await startTestControlServer({
      port: options.testPort,
      searchPlayers: searchTestPlayers,
      createPlay: insertCustomTestPlay,
      getStatus: getTestControlStatus,
      openBrowser: options.openTestControl,
    })
    console.log(`[${time()}] Live Test Play Console: ${testControlServer.url}`)
    console.log('Keep this worker open, then add custom plays from that local page.\n')
  }

  do {
    const cycleStartedAt = Date.now()

    try {
      const targetLeagues = await loadTargetLeagues()
      const enabledTargets = targetLeagues.filter((league) => league.game_feed_enabled)
      knownTargetLeagueIds = targetLeagues.map((league) => league.id)

      if (Date.now() - lastHeartbeatAt >= HEARTBEAT_MS) {
        await writeHeartbeat(knownTargetLeagueIds)
        lastHeartbeatAt = Date.now()
      }

      if (enabledTargets.length === 0) {
        logOccasionally(
          'no-enabled-leagues',
          'No League Letter leagues have Game Feed enabled. Enable one from its admin page.'
        )
      } else {
        const force = options.once || demoPending
        const result = await pollSourceLeague(enabledTargets, force)
        logPollResult(result, enabledTargets.length)

        if (demoPending && result.status !== 'failed') {
          const demoResult = await insertDemoEvents({
            targetLeagues: enabledTargets,
            season: result.season || String(new Date().getFullYear()),
            week: result.week || 1,
            contextPlayers: result.contextPlayers || [],
          })
          demoPending = false
          console.log(
            `[${time()}] TEST MODE: added ${demoResult.eventCount} sample feed cells across ${enabledTargets.length} enabled league${enabledTargets.length === 1 ? '' : 's'}.`
          )
        }
      }
    } catch (error) {
      console.error(`[${time()}] Worker cycle failed: ${errorMessage(error)}`)
    }

    if (options.once || stopping) break

    const elapsed = Date.now() - cycleStartedAt
    await sleep(Math.max(LOOP_DELAY_MS - elapsed, 250))
  } while (!stopping)

  if (testControlServer) await testControlServer.close()
  await markStopped()
  console.log(`[${time()}] Game Feed collector stopped.`)
}

async function loadTargetLeagues() {
  let query = supabase
    .from('leagues')
    .select('id,name,season,current_week,game_feed_enabled,game_feed_display_mode')
    .order('name', { ascending: true })

  if (options.targetLeagueId) query = query.eq('id', options.targetLeagueId)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  if (options.targetLeagueId && (!data || data.length === 0)) {
    throw new Error(`League Letter league ${options.targetLeagueId} was not found.`)
  }

  return data || []
}

async function writeHeartbeat(targetLeagueIds) {
  const now = new Date().toISOString()
  const statePayload = {
    feed_mode: options.mode,
    source_sleeper_league_id: options.sourceSleeperLeagueId,
    poll_seconds: options.pollSeconds,
    worker_heartbeat_at: now,
    worker_started_at: startedAt,
    worker_stopped_at: null,
    worker_name: workerName,
    worker_version: WORKER_VERSION,
  }

  const { error: stateError } = await supabase
    .from('game_feed_source_state')
    .upsert(statePayload, { onConflict: 'feed_mode' })

  if (stateError) throw new Error(`Could not write worker heartbeat: ${stateError.message}`)

  if (!targetLeagueIds.length) return

  const { error: leagueError } = await supabase
    .from('leagues')
    .update({
      game_feed_worker_heartbeat_at: now,
      game_feed_worker_started_at: startedAt,
      game_feed_worker_stopped_at: null,
      game_feed_worker_name: workerName,
      game_feed_worker_version: WORKER_VERSION,
      game_feed_worker_mode: options.mode,
      game_feed_source_sleeper_league_id: options.sourceSleeperLeagueId,
      game_feed_poll_seconds: options.pollSeconds,
    })
    .in('id', targetLeagueIds)

  if (leagueError) throw new Error(`Could not mirror worker heartbeat: ${leagueError.message}`)
}

async function markStopped() {
  const now = new Date().toISOString()

  await supabase
    .from('game_feed_source_state')
    .update({ worker_stopped_at: now })
    .eq('feed_mode', options.mode)

  if (knownTargetLeagueIds.length) {
    await supabase
      .from('leagues')
      .update({ game_feed_worker_stopped_at: now })
      .in('id', knownTargetLeagueIds)
  }
}

async function pollSourceLeague(targetLeagues, force = false) {
  const { data: claimed, error: claimError } = await supabase.rpc(
    'claim_game_feed_source_poll',
    {
      p_feed_mode: options.mode,
      p_source_sleeper_league_id: options.sourceSleeperLeagueId,
      p_poll_seconds: options.pollSeconds,
      p_force: force,
    }
  )

  if (claimError) throw new Error(claimError.message)
  if (!claimed) return { status: 'not_due' }

  try {
    const { data: state, error: stateError } = await supabase
      .from('game_feed_source_state')
      .select('*')
      .eq('feed_mode', options.mode)
      .single()

    if (stateError) throw new Error(stateError.message)

    let scoringSettings = state.scoring_settings || {}
    let season = String(state.season || new Date().getUTCFullYear())
    let week = Math.max(Number(state.week || 1), 1)
    let leagueStatus = String(state.league_status || '')
    const metadataSyncedAt = state.metadata_synced_at
      ? new Date(state.metadata_synced_at).getTime()
      : 0
    const metadataIsStale =
      state.metadata_source_sleeper_league_id !== options.sourceSleeperLeagueId ||
      !Number.isFinite(metadataSyncedAt) ||
      Date.now() - metadataSyncedAt > METADATA_REFRESH_MS

    if (force || metadataIsStale || !hasScoringSettings(scoringSettings)) {
      const sleeperLeague = await sleeperFetch(
        `/league/${options.sourceSleeperLeagueId}`
      )
      scoringSettings = sleeperLeague.scoring_settings || scoringSettings
      season = String(sleeperLeague.season || season)
      week = Math.max(Number(sleeperLeague.settings?.week || week), 1)
      leagueStatus = String(sleeperLeague.status || leagueStatus)

      const { error } = await supabase
        .from('game_feed_source_state')
        .update({
          scoring_settings: scoringSettings,
          metadata_source_sleeper_league_id: options.sourceSleeperLeagueId,
          season,
          week,
          league_status: leagueStatus,
          metadata_synced_at: new Date().toISOString(),
        })
        .eq('feed_mode', options.mode)

      if (error) throw new Error(error.message)
    }

    if (!force && leagueStatus.toLowerCase() !== 'in_season') {
      await finishSourcePoll(true, null)
      await updateTargetPollStatus(targetLeagues, true, null)
      return { status: 'not_in_season', season, week }
    }

    const matchups = await sleeperFetch(
      `/league/${options.sourceSleeperLeagueId}/matchups/${week}`
    )

    const currentPoints = new Map()
    for (const matchup of matchups) {
      const starters = new Set(matchup.starters || [])
      for (const [playerId, points] of Object.entries(matchup.players_points || {})) {
        currentPoints.set(playerId, {
          points: toNumber(points),
          rosterId: matchup.roster_id ?? null,
          isStarter: starters.has(playerId),
        })
      }
    }

    if (currentPoints.size === 0) {
      const message = 'Sleeper did not return players_points for the source league matchup poll.'
      await createDiagnosticBatches(targetLeagues, {
        season,
        week,
        status: 'skipped',
        scoringSettings,
        rawMatchups: matchups,
        errorMessage: message,
      })
      await finishSourcePoll(false, message)
      await updateTargetPollStatus(targetLeagues, false, message)
      return { status: 'no_player_points', season, week }
    }

    const playerIds = Array.from(currentPoints.keys())
    const [snapshotResult, playerRows] = await Promise.all([
      supabase
        .from('game_feed_source_snapshots')
        .select('sleeper_player_id,fantasy_points')
        .eq('feed_mode', options.mode)
        .eq('source_sleeper_league_id', options.sourceSleeperLeagueId)
        .eq('season', season)
        .eq('week', week),
      loadPlayerMetadata(playerIds),
    ])

    if (snapshotResult.error) throw new Error(snapshotResult.error.message)

    const previousByPlayer = new Map()
    for (const snapshot of snapshotResult.data || []) {
      previousByPlayer.set(snapshot.sleeper_player_id, toNumber(snapshot.fantasy_points))
    }

    const playerById = new Map()
    for (const player of playerRows) playerById.set(player.id, player)

    const isSeed = previousByPlayer.size === 0
    const deltas = []
    const contextPlayers = []
    const snapshotRows = []
    const now = new Date().toISOString()

    for (const [playerId, current] of currentPoints.entries()) {
      const previous = previousByPlayer.get(playerId)
      const before = previous ?? current.points
      const delta = round(current.points - before)
      const player = playerById.get(playerId) || playerFallback(playerId)
      const name =
        player.full_name ||
        [player.first_name, player.last_name].filter(Boolean).join(' ') ||
        playerId

      const pointContext = {
        id: playerId,
        name,
        position: player.position || null,
        team: player.team || null,
        delta: isSeed ? 0 : delta,
        before,
        after: current.points,
        rosterId: current.rosterId,
        isStarter: current.isStarter,
      }

      contextPlayers.push(pointContext)
      if (!isSeed && Math.abs(delta) >= 0.005) deltas.push(pointContext)

      snapshotRows.push({
        feed_mode: options.mode,
        source_sleeper_league_id: options.sourceSleeperLeagueId,
        season,
        week,
        sleeper_player_id: playerId,
        sleeper_roster_id: current.rosterId,
        is_starter: current.isStarter,
        fantasy_points: current.points,
        previous_fantasy_points: previous ?? null,
        last_delta: isSeed ? 0 : delta,
        last_polled_at: now,
      })
    }

    const inferred = isSeed
      ? []
      : inferGameFeedEvents(deltas, scoringSettings, contextPlayers)

    const batchByLeague = await createTargetBatches(targetLeagues, {
      season,
      week,
      status: isSeed ? 'seeded' : 'started',
      playerChangeCount: deltas.length,
      scoringSettings,
    })

    const eventRows = []
    for (const league of targetLeagues) {
      for (const event of inferred) {
        const uniqueInput = [
          options.mode,
          options.sourceSleeperLeagueId,
          league.id,
          season,
          week,
          event.primary.id,
          event.secondary?.id || '',
          event.eventType,
          event.primary.before,
          event.primary.after,
          event.secondary?.before ?? '',
          event.secondary?.after ?? '',
          event.description,
        ].join('|')

        eventRows.push({
          league_id: league.id,
          sleeper_league_id: options.sourceSleeperLeagueId,
          source_sleeper_league_id: options.sourceSleeperLeagueId,
          feed_mode: options.mode,
          season,
          week,
          batch_id: batchByLeague.get(league.id) || null,
          event_type: event.eventType,
          description: event.description,
          primary_player_id: event.primary.id,
          primary_player_name: event.primary.name,
          primary_player_position: event.primary.position,
          primary_player_team: event.primary.team,
          secondary_player_id: event.secondary?.id || null,
          secondary_player_name: event.secondary?.name || null,
          secondary_player_position: event.secondary?.position || null,
          primary_fantasy_delta: event.primaryFantasyDelta,
          secondary_fantasy_delta: event.secondaryFantasyDelta ?? null,
          inferred_yards: event.inferredYards ?? null,
          inferred_receptions: event.inferredReceptions ?? null,
          inferred_touchdowns: event.inferredTouchdowns ?? null,
          confidence: event.confidence,
          is_aggregate: event.isAggregate,
          is_correction: event.isCorrection,
          metadata: {
            ...event.metadata,
            collector: 'local-pc-single-source',
            worker_name: workerName,
            feed_mode: options.mode,
            source_sleeper_league_id: options.sourceSleeperLeagueId,
            primary_roster_id: event.primary.rosterId,
            primary_is_starter: event.primary.isStarter,
            secondary_roster_id: event.secondary?.rosterId ?? null,
          },
          fingerprint: fingerprint(uniqueInput),
          occurred_at: now,
          detected_at: now,
        })
      }
    }

    await upsertInChunks('game_feed_events', eventRows, {
      onConflict: 'fingerprint',
      ignoreDuplicates: true,
    })
    await upsertInChunks('game_feed_source_snapshots', snapshotRows, {
      onConflict:
        'feed_mode,source_sleeper_league_id,season,week,sleeper_player_id',
    })

    await finishTargetBatches(batchByLeague, {
      status: isSeed ? 'seeded' : 'completed',
      playerChangeCount: deltas.length,
      eventCountPerLeague: inferred.length,
    })

    await finishSourcePoll(true, null)
    await updateTargetPollStatus(targetLeagues, true, null)

    return {
      status: isSeed ? 'seeded' : 'completed',
      season,
      week,
      changedPlayers: deltas.length,
      events: inferred,
      contextPlayers,
    }
  } catch (error) {
    const message = errorMessage(error)
    await finishSourcePoll(false, message)
    await updateTargetPollStatus(targetLeagues, false, message)
    return { status: 'failed', error: message }
  }
}

async function loadPlayerMetadata(playerIds) {
  const rows = []

  for (const ids of chunk(playerIds, PLAYER_QUERY_CHUNK)) {
    const { data, error } = await supabase
      .from('players')
      .select('id,full_name,first_name,last_name,position,team,active')
      .in('id', ids)

    if (error) throw new Error(error.message)
    rows.push(...(data || []))
  }

  return rows
}

async function createTargetBatches(
  targetLeagues,
  { season, week, status, playerChangeCount, scoringSettings }
) {
  if (!targetLeagues.length || (status !== 'seeded' && playerChangeCount === 0)) {
    return new Map()
  }

  const rows = targetLeagues.map((league) => ({
    league_id: league.id,
    sleeper_league_id: options.sourceSleeperLeagueId,
    source_sleeper_league_id: options.sourceSleeperLeagueId,
    feed_mode: options.mode,
    season,
    week,
    status,
    player_change_count: playerChangeCount,
    scoring_settings: scoringSettings,
    raw_matchups: null,
    completed_at: status === 'seeded' ? new Date().toISOString() : null,
  }))

  const { data, error } = await supabase
    .from('game_feed_poll_batches')
    .insert(rows)
    .select('id,league_id')

  if (error) throw new Error(error.message)
  return new Map((data || []).map((row) => [row.league_id, row.id]))
}

async function finishTargetBatches(
  batchByLeague,
  { status, playerChangeCount, eventCountPerLeague }
) {
  if (!batchByLeague.size || status === 'seeded') return

  const batchIds = Array.from(batchByLeague.values())
  const { error } = await supabase
    .from('game_feed_poll_batches')
    .update({
      status,
      player_change_count: playerChangeCount,
      event_count: eventCountPerLeague,
      completed_at: new Date().toISOString(),
    })
    .in('id', batchIds)

  if (error) throw new Error(error.message)
}

async function createDiagnosticBatches(
  targetLeagues,
  { season, week, status, scoringSettings, rawMatchups, errorMessage }
) {
  if (!targetLeagues.length) return

  const rows = targetLeagues.map((league, index) => ({
    league_id: league.id,
    sleeper_league_id: options.sourceSleeperLeagueId,
    source_sleeper_league_id: options.sourceSleeperLeagueId,
    feed_mode: options.mode,
    season,
    week,
    status,
    scoring_settings: scoringSettings,
    // Keep one diagnostic copy of the large Sleeper payload, not one per target league.
    raw_matchups: index === 0 ? rawMatchups : null,
    error_message: errorMessage,
    completed_at: new Date().toISOString(),
  }))

  const { error } = await supabase.from('game_feed_poll_batches').insert(rows)
  if (error) throw new Error(error.message)
}

async function updateTargetPollStatus(targetLeagues, succeeded, errorMessageValue) {
  if (!targetLeagues.length) return

  const payload = {
    game_feed_last_polled_at: new Date().toISOString(),
    game_feed_last_success_at: succeeded ? new Date().toISOString() : undefined,
    game_feed_last_error: succeeded ? null : String(errorMessageValue || '').slice(0, 1000),
    game_feed_worker_mode: options.mode,
    game_feed_source_sleeper_league_id: options.sourceSleeperLeagueId,
  }

  if (!succeeded) delete payload.game_feed_last_success_at

  const { error } = await supabase
    .from('leagues')
    .update(payload)
    .in('id', targetLeagues.map((league) => league.id))

  if (error) throw new Error(error.message)
}

async function finishSourcePoll(succeeded, errorValue) {
  const { error } = await supabase.rpc('finish_game_feed_source_poll', {
    p_feed_mode: options.mode,
    p_succeeded: succeeded,
    p_error: errorValue,
  })
  if (error) throw new Error(error.message)
}


async function getTestControlStatus() {
  const [targetLeagues, stateResult] = await Promise.all([
    loadTargetLeagues(),
    supabase
      .from('game_feed_source_state')
      .select('season,week,scoring_settings,last_polled_at,last_success_at')
      .eq('feed_mode', 'test')
      .maybeSingle(),
  ])

  return {
    mode: 'test',
    enabledLeagueCount: targetLeagues.filter((league) => league.game_feed_enabled).length,
    season: stateResult.data?.season || null,
    week: stateResult.data?.week || null,
    lastPolledAt: stateResult.data?.last_polled_at || null,
    lastSuccessAt: stateResult.data?.last_success_at || null,
  }
}

async function searchTestPlayers(query) {
  const normalizedQuery = String(query || '').trim().toLowerCase()
  if (!normalizedQuery) return []

  const players = await loadTestPlayerCache()
  return players
    .map((player) => {
      const name = playerDisplayName(player)
      const haystack = [name, player.team, player.position, player.id]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      const startsWithName = name.toLowerCase().startsWith(normalizedQuery)
      const containsName = name.toLowerCase().includes(normalizedQuery)
      return { player, name, haystack, startsWithName, containsName }
    })
    .filter((entry) => entry.haystack.includes(normalizedQuery))
    .sort((a, b) => {
      if (a.startsWithName !== b.startsWithName) return a.startsWithName ? -1 : 1
      if (a.containsName !== b.containsName) return a.containsName ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    .slice(0, 15)
    .map(({ player, name }) => ({
      id: player.id,
      name,
      position: player.position || null,
      team: player.team || null,
      imageUrl: `https://sleepercdn.com/content/nfl/players/${player.id}.jpg`,
    }))
}

async function loadTestPlayerCache() {
  if (
    testPlayerCache.players.length > 0 &&
    Date.now() - testPlayerCache.loadedAt < TEST_PLAYER_CACHE_MS
  ) {
    return testPlayerCache.players
  }

  const rows = []
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('players')
      .select('id,full_name,first_name,last_name,position,team,active')
      .eq('active', true)
      .range(from, from + pageSize - 1)

    if (error) throw new Error(`Could not load test players: ${error.message}`)
    rows.push(...(data || []))
    if (!data || data.length < pageSize) break
  }

  testPlayerCache = { loadedAt: Date.now(), players: rows }
  return rows
}

async function insertCustomTestPlay(payload) {
  if (options.mode !== 'test') {
    throw new Error('Custom test plays can only be added while the worker is in Test mode.')
  }

  const targetLeagues = (await loadTargetLeagues()).filter(
    (league) => league.game_feed_enabled
  )
  if (!targetLeagues.length) {
    throw new Error('No League Letter leagues currently have Game Feed enabled.')
  }

  const playType = String(payload?.playType || '').trim().toLowerCase()
  const allowedTypes = new Set([
    'reception',
    'rush',
    'field_goal',
    'extra_point',
    'turnover',
    'custom',
  ])
  if (!allowedTypes.has(playType)) throw new Error('Choose a valid play type.')

  const primary = await getTestPlayerById(payload?.primaryPlayerId)
  let secondary = payload?.secondaryPlayerId
    ? await getTestPlayerById(payload.secondaryPlayerId)
    : null

  if (!['reception', 'custom'].includes(playType)) secondary = null

  if (playType === 'reception' && !secondary) {
    throw new Error('A reception requires the quarterback who threw the pass.')
  }
  if (playType === 'reception' && String(secondary.position || '').toUpperCase() !== 'QB') {
    throw new Error('The secondary player for a reception must be a quarterback.')
  }

  const { data: sourceState, error: stateError } = await supabase
    .from('game_feed_source_state')
    .select('season,week,scoring_settings')
    .eq('feed_mode', 'test')
    .maybeSingle()
  if (stateError) throw new Error(stateError.message)

  const season = String(sourceState?.season || new Date().getUTCFullYear())
  const week = Math.max(Number(sourceState?.week || 1), 1)
  const scoringSettings = sourceState?.scoring_settings || {}
  const template = buildCustomTestTemplate({
    payload,
    playType,
    primary,
    secondary,
    scoringSettings,
  })

  const runId = randomUUID()
  const detectedAt = new Date().toISOString()
  const batchRows = targetLeagues.map((league) => ({
    league_id: league.id,
    sleeper_league_id: options.sourceSleeperLeagueId,
    source_sleeper_league_id: options.sourceSleeperLeagueId,
    feed_mode: 'test',
    season: String(league.season || season),
    week: Math.max(Number(league.current_week || week), 1),
    status: 'started',
    player_change_count: 1,
    scoring_settings: scoringSettings,
    raw_matchups: null,
  }))

  const { data: batches, error: batchError } = await supabase
    .from('game_feed_poll_batches')
    .insert(batchRows)
    .select('id,league_id')
  if (batchError) throw new Error(batchError.message)
  const batchByLeague = new Map((batches || []).map((row) => [row.league_id, row.id]))

  const eventRows = targetLeagues.map((league) => {
    const targetSeason = String(league.season || season)
    const targetWeek = Math.max(Number(league.current_week || week), 1)
    return {
      league_id: league.id,
      sleeper_league_id: options.sourceSleeperLeagueId,
      source_sleeper_league_id: options.sourceSleeperLeagueId,
      feed_mode: 'test',
      season: targetSeason,
      week: targetWeek,
      batch_id: batchByLeague.get(league.id) || null,
      event_type: template.eventType,
      description: template.description,
      primary_player_id: primary.id,
      primary_player_name: primary.name,
      primary_player_position: primary.position,
      primary_player_team: primary.team,
      secondary_player_id: secondary?.id || null,
      secondary_player_name: secondary?.name || null,
      secondary_player_position: secondary?.position || null,
      primary_fantasy_delta: template.primaryDelta,
      secondary_fantasy_delta: template.secondaryDelta,
      inferred_yards: template.yards,
      inferred_receptions: template.receptions,
      inferred_touchdowns: template.touchdowns,
      confidence: 'high',
      is_aggregate: false,
      is_correction: false,
      metadata: {
        collector: 'local-pc-single-source',
        worker_name: workerName,
        feed_mode: 'test',
        synthetic: true,
        custom_test_play: true,
        test_run_id: runId,
        play_family: template.playFamily,
        source_sleeper_league_id: options.sourceSleeperLeagueId,
      },
      fingerprint: fingerprint(
        ['custom-test', runId, league.id, primary.id, secondary?.id || '', playType].join('|')
      ),
      occurred_at: detectedAt,
      detected_at: detectedAt,
    }
  })

  await upsertInChunks('game_feed_events', eventRows, {
    onConflict: 'fingerprint',
    ignoreDuplicates: true,
  })

  await finishTargetBatches(batchByLeague, {
    status: 'completed',
    playerChangeCount: 1,
    eventCountPerLeague: 1,
  })

  console.log(
    `[${time()}] TEST CONTROL: ${primary.name} — ${template.description}${secondary ? ` — from ${secondary.name}` : ''}`
  )

  return {
    message: `${template.description} added to ${targetLeagues.length} enabled Test feed${targetLeagues.length === 1 ? '' : 's'}.`,
    eventCount: eventRows.length,
    description: template.description,
    primaryPlayerName: primary.name,
    secondaryPlayerName: secondary?.name || null,
  }
}

async function getTestPlayerById(playerIdValue) {
  const playerId = String(playerIdValue || '').trim()
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(playerId)) {
    throw new Error('Choose a valid player from the search results.')
  }

  const players = await loadTestPlayerCache()
  const player = players.find((entry) => String(entry.id) === playerId)
  if (!player) throw new Error(`Player ${playerId} was not found in the players table.`)

  return {
    id: player.id,
    name: playerDisplayName(player),
    position: player.position || null,
    team: player.team || null,
  }
}

function buildCustomTestTemplate({ payload, playType, primary, secondary, scoringSettings }) {
  const yards = Math.trunc(toNumber(payload?.yards))
  const touchdown = Boolean(payload?.touchdown)
  const primaryOverride = optionalNumber(payload?.primaryDelta)
  const secondaryOverride = optionalNumber(payload?.secondaryDelta)
  const customDescription = String(payload?.description || '').trim()

  let eventType = 'scoring_update'
  let description = customDescription
  let primaryDelta = primaryOverride
  let secondaryDelta = secondary ? secondaryOverride : null
  let receptions = 0
  let touchdowns = touchdown ? 1 : 0
  let inferredYards = ['reception', 'rush', 'field_goal'].includes(playType) ? yards : null
  let playFamily = playType

  if (playType === 'reception') {
    eventType = 'reception'
    receptions = 1
    description ||= `${yards}-yard ${touchdown ? 'touchdown ' : ''}reception`
    primaryDelta ??=
      scoreSetting(scoringSettings, 'rec', 1) +
      yards * scoreSetting(scoringSettings, 'rec_yd', 0.1) +
      touchdowns * scoreSetting(scoringSettings, 'rec_td', 6)
    secondaryDelta ??=
      scoreSetting(scoringSettings, 'pass_cmp', 0) +
      yards * scoreSetting(scoringSettings, 'pass_yd', 0.04) +
      touchdowns * scoreSetting(scoringSettings, 'pass_td', 4)
  } else if (playType === 'rush') {
    eventType = 'rush'
    description ||= `${yards}-yard ${touchdown ? 'touchdown ' : ''}rush`
    primaryDelta ??=
      scoreSetting(scoringSettings, 'rush_att', 0) +
      yards * scoreSetting(scoringSettings, 'rush_yd', 0.1) +
      touchdowns * scoreSetting(scoringSettings, 'rush_td', 6)
    secondaryDelta = null
  } else if (playType === 'field_goal') {
    eventType = 'field_goal'
    touchdowns = 0
    description ||= `${yards}-yard field goal`
    primaryDelta ??= fieldGoalPoints(scoringSettings, yards)
    secondaryDelta = null
  } else if (playType === 'extra_point') {
    eventType = 'extra_point'
    touchdowns = 0
    inferredYards = null
    description ||= 'Extra point made'
    primaryDelta ??= scoreSetting(scoringSettings, 'xpm', 1)
    secondaryDelta = null
  } else if (playType === 'turnover') {
    eventType = 'turnover'
    touchdowns = 0
    inferredYards = null
    description ||= primary.position === 'QB' ? 'Interception thrown' : 'Fumble lost'
    primaryDelta ??=
      primary.position === 'QB'
        ? scoreSetting(scoringSettings, 'pass_int', -2)
        : scoreSetting(scoringSettings, 'fum_lost', -2)
    secondaryDelta = null
  } else {
    eventType = 'scoring_update'
    touchdowns = 0
    inferredYards = null
    playFamily = 'custom'
    if (!description) throw new Error('A custom scoring update requires a description.')
    if (primaryDelta === null) {
      throw new Error('A custom scoring update requires primary fantasy points.')
    }
  }

  if (primaryDelta === null || !Number.isFinite(primaryDelta)) {
    throw new Error('Could not calculate primary fantasy points. Enter an override.')
  }

  return {
    eventType,
    description,
    primaryDelta: round(primaryDelta),
    secondaryDelta:
      secondary && secondaryDelta !== null ? round(secondaryDelta) : null,
    yards: inferredYards,
    receptions,
    touchdowns,
    playFamily,
  }
}

function playerDisplayName(player) {
  return (
    player.full_name ||
    [player.first_name, player.last_name].filter(Boolean).join(' ') ||
    String(player.id)
  )
}

function optionalNumber(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function scoreSetting(settings, key, fallback = 0) {
  const number = Number(settings?.[key])
  return Number.isFinite(number) ? number : fallback
}

function fieldGoalPoints(settings, yards) {
  if (yards < 20) return scoreSetting(settings, 'fgm_0_19', 3)
  if (yards < 30) return scoreSetting(settings, 'fgm_20_29', 3)
  if (yards < 40) return scoreSetting(settings, 'fgm_30_39', 3)
  if (yards < 50) return scoreSetting(settings, 'fgm_40_49', 4)
  return scoreSetting(settings, 'fgm_50p', 5)
}

async function insertDemoEvents({ targetLeagues, season, week, contextPlayers }) {
  let players = contextPlayers
  if (!players.length) {
    const { data, error } = await supabase
      .from('players')
      .select('id,full_name,first_name,last_name,position,team')
      .eq('active', true)
      .not('team', 'is', null)
      .limit(1000)
    if (error) throw new Error(error.message)
    players = (data || []).map((player) => ({
      id: player.id,
      name:
        player.full_name ||
        [player.first_name, player.last_name].filter(Boolean).join(' ') ||
        player.id,
      position: player.position,
      team: player.team,
    }))
  }

  const selected = selectDemoPlayers(players)
  const runId = randomUUID()
  const now = Date.now()
  const demoTemplates = [
    {
      primary: selected.receiver,
      secondary: selected.quarterback,
      eventType: 'reception',
      description: '25-yard reception',
      primaryDelta: 3.5,
      secondaryDelta: 1,
      yards: 25,
      receptions: 1,
      touchdowns: 0,
      offset: 0,
    },
    {
      primary: selected.runningBack,
      secondary: null,
      eventType: 'rush',
      description: '18-yard rushing touchdown',
      primaryDelta: 7.8,
      secondaryDelta: null,
      yards: 18,
      receptions: 0,
      touchdowns: 1,
      offset: 1,
    },
    {
      primary: selected.receiver,
      secondary: selected.quarterback,
      eventType: 'touchdown',
      description: '42-yard touchdown reception',
      primaryDelta: 11.2,
      secondaryDelta: 5.68,
      yards: 42,
      receptions: 1,
      touchdowns: 1,
      offset: 2,
    },
    {
      primary: selected.kicker,
      secondary: null,
      eventType: 'field_goal',
      description: '47-yard field goal',
      primaryDelta: 4,
      secondaryDelta: null,
      yards: 47,
      receptions: 0,
      touchdowns: 0,
      offset: 3,
    },
  ].filter((template) => template.primary)

  const demoBatchRows = targetLeagues.map((league) => ({
    league_id: league.id,
    sleeper_league_id: options.sourceSleeperLeagueId,
    source_sleeper_league_id: options.sourceSleeperLeagueId,
    feed_mode: 'test',
    season: String(league.season || season),
    week: Math.max(Number(league.current_week || week), 1),
    status: 'started',
    player_change_count: demoTemplates.length,
    scoring_settings: { test_mode: true },
    raw_matchups: null,
  }))
  const { data: demoBatches, error: demoBatchError } = await supabase
    .from('game_feed_poll_batches')
    .insert(demoBatchRows)
    .select('id,league_id')
  if (demoBatchError) throw new Error(demoBatchError.message)
  const batchByLeague = new Map(
    (demoBatches || []).map((row) => [row.league_id, row.id])
  )

  const rows = []
  for (const league of targetLeagues) {
    const targetSeason = String(league.season || season)
    const targetWeek = Math.max(Number(league.current_week || week), 1)

    for (const template of demoTemplates) {
      const detectedAt = new Date(now + template.offset * 1000).toISOString()
      const primary = normalizeDemoPlayer(template.primary)
      const secondary = template.secondary
        ? normalizeDemoPlayer(template.secondary)
        : null

      rows.push({
        league_id: league.id,
        sleeper_league_id: options.sourceSleeperLeagueId,
        source_sleeper_league_id: options.sourceSleeperLeagueId,
        feed_mode: 'test',
        season: targetSeason,
        week: targetWeek,
        batch_id: batchByLeague.get(league.id) || null,
        event_type: template.eventType,
        description: template.description,
        primary_player_id: primary.id,
        primary_player_name: primary.name,
        primary_player_position: primary.position,
        primary_player_team: primary.team,
        secondary_player_id: secondary?.id || null,
        secondary_player_name: secondary?.name || null,
        secondary_player_position: secondary?.position || null,
        primary_fantasy_delta: template.primaryDelta,
        secondary_fantasy_delta: template.secondaryDelta,
        inferred_yards: template.yards,
        inferred_receptions: template.receptions,
        inferred_touchdowns: template.touchdowns,
        confidence: 'high',
        is_aggregate: false,
        is_correction: false,
        metadata: {
          collector: 'local-pc-single-source',
          worker_name: workerName,
          feed_mode: 'test',
          synthetic: true,
          test_run_id: runId,
          source_sleeper_league_id: options.sourceSleeperLeagueId,
        },
        fingerprint: fingerprint(
          ['test-demo', runId, league.id, template.offset, primary.id].join('|')
        ),
        occurred_at: detectedAt,
        detected_at: detectedAt,
      })
    }
  }

  await upsertInChunks('game_feed_events', rows, {
    onConflict: 'fingerprint',
    ignoreDuplicates: true,
  })

  await finishTargetBatches(batchByLeague, {
    status: 'completed',
    playerChangeCount: demoTemplates.length,
    eventCountPerLeague: demoTemplates.length,
  })

  return { eventCount: rows.length }
}

function selectDemoPlayers(players) {
  const normalized = players.map(normalizeDemoPlayer)
  const quarterback = normalized.find((player) => player.position === 'QB')
  const receiver =
    normalized.find(
      (player) =>
        player.position === 'WR' &&
        quarterback?.team &&
        player.team === quarterback.team
    ) || normalized.find((player) => player.position === 'WR')
  const runningBack = normalized.find((player) => player.position === 'RB') || receiver
  const kicker = normalized.find((player) => player.position === 'K') || runningBack

  return { quarterback, receiver, runningBack, kicker }
}

function normalizeDemoPlayer(player) {
  if (!player) return null
  return {
    id: player.id,
    name:
      player.name ||
      player.full_name ||
      [player.first_name, player.last_name].filter(Boolean).join(' ') ||
      player.id,
    position: player.position || null,
    team: player.team || null,
  }
}

async function upsertInChunks(table, rows, optionsValue) {
  if (!rows.length) return

  for (const rowChunk of chunk(rows, UPSERT_CHUNK)) {
    const { error } = await supabase.from(table).upsert(rowChunk, optionsValue)
    if (error) throw new Error(error.message)
  }
}

async function sleeperFetch(path) {
  const response = await fetch(`${SLEEPER_BASE_URL}${path}`, {
    headers: { 'User-Agent': 'League-Letter-Local-Game-Feed/2.0' },
    signal: AbortSignal.timeout(15_000),
  })

  if (!response.ok) {
    throw new Error(`Sleeper request failed (${response.status}) for ${path}`)
  }

  return response.json()
}

function logPollResult(result, targetCount) {
  if (result.status === 'not_due') return

  if (result.status === 'seeded') {
    console.log(
      `[${time()}] ${options.mode.toUpperCase()}: source baseline seeded for Week ${result.week}. ${targetCount} League Letter feed${targetCount === 1 ? '' : 's'} will receive future plays.`
    )
    return
  }

  if (result.status === 'not_in_season') {
    logOccasionally(
      `${options.mode}:not-in-season`,
      `Source Sleeper league is not currently in season.`
    )
    return
  }

  if (result.status === 'no_player_points') {
    console.warn(
      `[${time()}] Source league did not include player point totals in this response.`
    )
    return
  }

  if (result.status === 'failed') {
    console.error(`[${time()}] Source poll failed — ${result.error}`)
    return
  }

  if (result.events?.length) {
    for (const event of result.events) {
      const passer = event.secondary?.name ? ` — from ${event.secondary.name}` : ''
      console.log(
        `[${time()}] ${options.mode.toUpperCase()}: ${event.primary.name} — ${event.description}${passer}`
      )
    }
    return
  }

  logOccasionally(
    `${options.mode}:quiet`,
    `Checked source Week ${result.week} — no fantasy scoring changes.`
  )
}

function logOccasionally(key, message) {
  const previous = lastQuietLogByKey.get(key) || 0
  if (Date.now() - previous < QUIET_LOG_MS) return
  lastQuietLogByKey.set(key, Date.now())
  console.log(`[${time()}] ${message}`)
}

function loadEnvironmentFiles() {
  for (const filename of ['.env.game-feed.local', '.env.local', '.env']) {
    if (!existsSync(filename)) continue
    const contents = readFileSync(filename, 'utf8')

    for (const rawLine of contents.split(/\r?\n/)) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue

      const separator = line.indexOf('=')
      if (separator < 1) continue

      const key = line.slice(0, separator).trim()
      let value = line.slice(separator + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }

      if (!(key in process.env)) process.env[key] = value
    }
  }
}

function parseArguments(args) {
  const result = {
    once: false,
    targetLeagueId: null,
    sourceSleeperLeagueId: null,
    mode: null,
    demo: null,
    pollSeconds: null,
    testPort: null,
    openTestControl: true,
  }

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]

    if (argument === '--once') {
      result.once = true
      continue
    }

    if (argument === '--demo') {
      result.demo = true
      continue
    }

    if (argument === '--no-demo') {
      result.demo = false
      continue
    }

    if (argument === '--league') {
      const leagueId = args[index + 1]
      if (!leagueId) throw new Error('--league requires a League Letter league UUID.')
      result.targetLeagueId = leagueId
      index += 1
      continue
    }

    if (argument === '--source') {
      const sourceId = args[index + 1]
      if (!sourceId) throw new Error('--source requires a Sleeper league ID.')
      result.sourceSleeperLeagueId = sourceId
      index += 1
      continue
    }

    if (argument === '--mode') {
      const mode = String(args[index + 1] || '').toLowerCase()
      if (!['public', 'test'].includes(mode)) {
        throw new Error('--mode must be public or test.')
      }
      result.mode = mode
      index += 1
      continue
    }

    if (argument === '--test-port') {
      const port = Number(args[index + 1])
      if (!Number.isInteger(port) || port < 1024 || port > 65535) {
        throw new Error('--test-port requires a port between 1024 and 65535.')
      }
      result.testPort = port
      index += 1
      continue
    }

    if (argument === '--no-open-test-control') {
      result.openTestControl = false
      continue
    }

    if (argument === '--poll-seconds') {
      const seconds = Number(args[index + 1])
      if (!Number.isFinite(seconds)) {
        throw new Error('--poll-seconds requires a number.')
      }
      result.pollSeconds = seconds
      index += 1
      continue
    }

    if (argument === '--help' || argument === '-h') {
      console.log(`\nLeague Letter local Game Feed collector\n\nUsage:\n  npm run game-feed\n  npm run game-feed:public\n  npm run game-feed:test\n  npm run game-feed:test:demo\n  npm run game-feed -- --once --mode public\n  npm run game-feed -- --league LEAGUE_LETTER_UUID\n\nOptions:\n  --source SLEEPER_LEAGUE_ID\n  --mode public|test\n  --demo / --no-demo\n  --test-port 3210\n  --no-open-test-control\n  --poll-seconds 10\n  --once\n  --league LEAGUE_LETTER_UUID\n`)
      process.exit(0)
    }

    throw new Error(`Unknown option: ${argument}`)
  }

  return result
}

async function resolveStartupOptions(parsed) {
  let mode = parsed.mode || normalizeMode(process.env.GAME_FEED_MODE)
  let sourceSleeperLeagueId =
    parsed.sourceSleeperLeagueId || process.env.GAME_FEED_SOURCE_SLEEPER_LEAGUE_ID || null
  let demo = parsed.demo
  const pollSeconds = clampPollSeconds(
    parsed.pollSeconds || process.env.GAME_FEED_POLL_SECONDS || 10
  )
  const testPort = clampTestPort(
    parsed.testPort || process.env.GAME_FEED_TEST_PORT || 3210
  )

  if (process.stdin.isTTY && (!mode || !sourceSleeperLeagueId || (mode === 'test' && demo === null))) {
    const readline = createInterface({ input, output })

    try {
      if (!mode) {
        const answer = await readline.question(
          '\nStart collector in [P]ublic or [T]est mode? (P/T): '
        )
        mode = answer.trim().toLowerCase().startsWith('t') ? 'test' : 'public'
      }

      if (!sourceSleeperLeagueId) {
        sourceSleeperLeagueId = (
          await readline.question('Dedicated deep Sleeper league ID: ')
        ).trim()
      }

      if (mode === 'test' && demo === null) {
        const answer = await readline.question(
          'Create four sample test feed cells now? (Y/n): '
        )
        demo = !answer.trim().toLowerCase().startsWith('n')
      }
    } finally {
      readline.close()
    }
  }

  mode = mode || 'public'
  if (demo === null) demo = false
  if (mode !== 'test') demo = false

  return {
    ...parsed,
    mode,
    demo,
    sourceSleeperLeagueId,
    pollSeconds,
    testPort,
  }
}

function printBanner() {
  console.log('\nLeague Letter Game Feed collector')
  console.log('---------------------------------')
  console.log(`Worker: ${workerName}`)
  console.log(`Feed mode: ${options.mode.toUpperCase()}`)
  console.log(`Source Sleeper league: ${options.sourceSleeperLeagueId}`)
  console.log(`Sleeper requests: one matchup request every ${options.pollSeconds} seconds`)
  console.log(
    options.targetLeagueId
      ? `League Letter target filter: ${options.targetLeagueId}`
      : 'League Letter targets: every enabled league'
  )
  console.log(options.once ? 'Run mode: one poll, then exit' : 'Run mode: continuous')
  if (options.mode === 'test') {
    if (!options.once) {
      console.log(`Live Test Play Console: http://127.0.0.1:${options.testPort}`)
    }
    console.log(
      options.demo
        ? 'Test cells: four sample events will be inserted after startup'
        : 'Test cells: use the local Test Play Console or wait for test-tagged score changes'
    )
  }
  console.log('Stop with Ctrl+C. Your PC only makes outbound connections.\n')
}

function requestStop() {
  if (stopping) return
  stopping = true
  console.log('\nStopping after the current request finishes…')
}

function playerFallback(playerId) {
  const isDefense = playerId.length <= 4
  return {
    id: playerId,
    full_name: isDefense ? `${playerId} Defense` : playerId,
    position: isDefense ? 'DEF' : null,
    team: isDefense ? playerId : null,
  }
}

function normalizeMode(value) {
  const mode = String(value || '').trim().toLowerCase()
  return ['public', 'test'].includes(mode) ? mode : null
}

function clampPollSeconds(value) {
  const number = Number(value)
  return Math.min(300, Math.max(5, Number.isFinite(number) ? Math.trunc(number) : 10))
}

function clampTestPort(value) {
  const number = Number(value)
  return Number.isInteger(number) && number >= 1024 && number <= 65535
    ? number
    : 3210
}

function hasScoringSettings(settings) {
  return Boolean(settings && Object.keys(settings).length > 0)
}

function toNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function round(value) {
  return Math.round(value * 1000) / 1000
}

function fingerprint(value) {
  return createHash('sha256').update(value).digest('hex')
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

function time() {
  return new Date().toLocaleTimeString()
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function chunk(values, size) {
  const chunks = []
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size))
  }
  return chunks
}
