import assert from 'node:assert/strict'
import { inferGameFeedEvents } from '../game-feed-worker/game-feed-inference.mjs'
import { validateGameFeedScoringSettings } from '../game-feed-worker/game-feed-scoring-profile.mjs'
import {
  buildAndQueuePointSnapshot,
  createMockSleeperState,
} from '../game-feed-worker/test-control-server.mjs'

const players = new Map([
  ['QB1', { id: 'QB1', name: 'Test Quarterback', position: 'QB', team: 'DAL' }],
  ['WR1', { id: 'WR1', name: 'Test Receiver', position: 'WR', team: 'DAL' }],
  ['RB1', { id: 'RB1', name: 'Test Running Back', position: 'RB', team: 'DAL' }],
  ['K1', { id: 'K1', name: 'Test Kicker', position: 'K', team: 'DAL' }],
  ['PHI', { id: 'PHI', name: 'Philadelphia Eagles D/ST', position: 'DEF', team: 'PHI' }],
])

async function resolvePlayer(id) {
  const player = players.get(String(id))
  if (!player) throw new Error(`Unknown test player ${id}`)
  return player
}

function pointsFromMatchups(matchups) {
  const result = new Map()
  for (const matchup of matchups) {
    for (const [id, points] of Object.entries(matchup.players_points || {})) {
      result.set(id, Number(points))
    }
  }
  return result
}

function inferBetween(before, after, metadata) {
  const ids = new Set([...before.keys(), ...after.keys()])
  const context = []
  const deltas = []
  for (const id of ids) {
    const player = metadata.get(id)
    if (!player) continue
    const beforePoints = Number(before.get(id) || 0)
    const afterPoints = Number(after.get(id) || 0)
    const row = {
      ...player,
      before: beforePoints,
      after: afterPoints,
      delta: Math.round((afterPoints - beforePoints) * 1000) / 1000,
      rosterId: null,
      isStarter: true,
    }
    context.push(row)
    if (Math.abs(row.delta) >= 0.005) deltas.push(row)
  }
  return inferGameFeedEvents(deltas, mock.scoringSettings, context)
}

async function queue(updates, description = 'Manual point snapshot') {
  return buildAndQueuePointSnapshot({
    mock,
    resolvePlayer,
    payload: { updates, description },
  })
}

const mock = createMockSleeperState({ leagueId: 'league-letter-test', season: '2026', week: 1 })
assert.deepEqual(validateGameFeedScoringSettings(mock.scoringSettings), [])
assert.equal(mock.getLeaguePayload().league_id, 'league-letter-test')
assert.equal(mock.getLeaguePayload().scoring_settings.int_ret_td, -1000)
assert.equal(mock.getLeaguePayload().scoring_settings.bonus_rush_att, 100)

// The console knows only that QB1 and WR1 moved to 1.10. The inference engine
// must decide that this represents a 10-yard completion.
await queue([
  { playerId: 'WR1', points: 1.10 },
  { playerId: 'QB1', points: 1.10 },
])
const receptionBaseline = pointsFromMatchups(mock.pollMatchups(1))
assert.equal(receptionBaseline.get('WR1'), 0)
assert.equal(receptionBaseline.get('QB1'), 0)
const receptionAfter = pointsFromMatchups(mock.pollMatchups(1))
assert.equal(receptionAfter.get('WR1'), 1.1)
assert.equal(receptionAfter.get('QB1'), 1.1)
const receptionEvents = inferBetween(receptionBaseline, receptionAfter, players)
assert.equal(receptionEvents.length, 1)
assert.equal(receptionEvents[0].eventType, 'reception')
assert.equal(receptionEvents[0].inferredYards, 10)
assert.equal(receptionEvents[0].secondary.id, 'QB1')

// Add PHI and set absolute cumulative totals that correspond to a -1100/+1100 change.
await queue([
  { playerId: 'QB1', points: -1098.90 },
  { playerId: 'PHI', points: 1100 },
])
const pickSixBaseline = pointsFromMatchups(mock.pollMatchups(1))
// PHI is new, so this poll only exposes its zero-point baseline.
assert.equal(pickSixBaseline.get('PHI'), 0)
const pickSixAfter = pointsFromMatchups(mock.pollMatchups(1))
const pickSixEvents = inferBetween(pickSixBaseline, pickSixAfter, players)
assert.equal(pickSixEvents.length, 1)
assert.equal(pickSixEvents[0].description, 'Pick six thrown')
assert.equal(pickSixEvents[0].primaryFantasyDelta, -1100)
assert.equal(pickSixEvents[0].secondaryFantasyDelta, 1100)

const fumbleBefore = pointsFromMatchups(mock.pollMatchups(1))
await queue([
  // 5-yard reception + fumble lost = 1.05 - 210 = -208.95 receiver delta.
  { playerId: 'WR1', points: -207.85 },
  { playerId: 'QB1', points: -1097.85 },
  { playerId: 'PHI', points: 1310 },
])
const fumbleAfter = pointsFromMatchups(mock.pollMatchups(1))
const fumbleEvents = inferBetween(fumbleBefore, fumbleAfter, players)
assert.equal(fumbleEvents.length, 1)
assert.equal(fumbleEvents[0].eventType, 'turnover')
assert.match(fumbleEvents[0].description, /5-yard reception, fumble lost/)
assert.equal(fumbleEvents[0].secondary.id, 'QB1')
assert.equal(fumbleEvents[0].metadata.defense_id, 'PHI')

await queue([{ playerId: 'K1', points: 100.52 }])
const fgBaseline = pointsFromMatchups(mock.pollMatchups(1))
assert.equal(fgBaseline.get('K1'), 0)
const fgAfter = pointsFromMatchups(mock.pollMatchups(1))
const fgEvents = inferBetween(fgBaseline, fgAfter, players)
assert.equal(fgEvents.length, 1)
assert.equal(fgEvents[0].description, '52-yard field goal made')

const status = mock.getStatus()
assert.equal(status.players.find((player) => player.id === 'K1').points, 100.52)
assert.equal(status.pendingCount, 0)
assert.ok(status.recentApplied.length >= 1)

console.log('Mock Sleeper manual-point endpoint tests passed.')
