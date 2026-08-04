import assert from 'node:assert/strict'
import { inferGameFeedEvents } from '../game-feed-worker/game-feed-inference.mjs'

const scoring = {
  rec: 1,
  rec_yd: 0.1,
  rec_td: 6,
  pass_yd: 0.04,
  pass_td: 4,
  rush_yd: 0.1,
  rush_td: 6,
  pass_int: -2,
  fum_lost: -2,
  xpm: 1,
  fgm_40_49: 4,
}

function player(id, name, position, team, delta, before = 0) {
  return {
    id,
    name,
    position,
    team,
    delta,
    before,
    after: before + delta,
    rosterId: 1,
    isStarter: true,
  }
}

const receptionContext = [
  player('dak', 'Dak Prescott', 'QB', 'DAL', 1),
  player('lamb', 'CeeDee Lamb', 'WR', 'DAL', 3.5),
]
const [reception] = inferGameFeedEvents(receptionContext, scoring, receptionContext)
assert.equal(reception.description, '25-yard reception')
assert.equal(reception.secondary?.name, 'Dak Prescott')
assert.equal(reception.inferredYards, 25)
assert.equal(reception.confidence, 'high')

const rushContext = [
  player('dak', 'Dak Prescott', 'QB', 'DAL', 0),
  player('lamb', 'CeeDee Lamb', 'WR', 'DAL', 2.5),
]
const [rush] = inferGameFeedEvents(
  rushContext.filter((entry) => entry.delta !== 0),
  scoring,
  rushContext
)
assert.equal(rush.description, '25-yard rush')
assert.equal(rush.secondary, undefined)
assert.equal(rush.confidence, 'high')

const touchdownContext = [
  player('dak', 'Dak Prescott', 'QB', 'DAL', 5),
  player('lamb', 'CeeDee Lamb', 'WR', 'DAL', 9.5),
]
const [touchdown] = inferGameFeedEvents(
  touchdownContext,
  scoring,
  touchdownContext
)
assert.equal(touchdown.description, '25-yard touchdown reception')
assert.equal(touchdown.inferredTouchdowns, 1)
assert.equal(touchdown.secondary?.id, 'dak')

const aggregateContext = [
  player('dak', 'Dak Prescott', 'QB', 'DAL', 1.12),
  player('lamb', 'CeeDee Lamb', 'WR', 'DAL', 4.8),
]
const [aggregate] = inferGameFeedEvents(
  aggregateContext,
  scoring,
  aggregateContext
)
assert.equal(aggregate.description, '2 receptions, 28 yards')
assert.equal(aggregate.isAggregate, true)

const multiReceiverContext = [
  player('dak', 'Dak Prescott', 'QB', 'DAL', 1.44),
  player('lamb', 'CeeDee Lamb', 'WR', 'DAL', 4.8),
  player('ferguson', 'Jake Ferguson', 'TE', 'DAL', 1.8),
]
const multiReceiver = inferGameFeedEvents(
  multiReceiverContext,
  scoring,
  multiReceiverContext
)
assert.equal(multiReceiver.length, 2)
assert.deepEqual(
  multiReceiver.map((event) => event.primary.id).sort(),
  ['ferguson', 'lamb']
)
assert.ok(multiReceiver.every((event) => event.secondary?.id === 'dak'))
assert.ok(multiReceiver.every((event) => event.isAggregate))

const halfPprScoring = { ...scoring, rec: 0.5 }
const halfPprContext = [
  player('dak', 'Dak Prescott', 'QB', 'DAL', 1),
  player('lamb', 'CeeDee Lamb', 'WR', 'DAL', 3),
]
const [halfPprReception] = inferGameFeedEvents(
  halfPprContext,
  halfPprScoring,
  halfPprContext
)
assert.equal(halfPprReception.description, '25-yard reception')

const [interception] = inferGameFeedEvents(
  [player('dak', 'Dak Prescott', 'QB', 'DAL', -2, 18)],
  scoring
)
assert.equal(interception.description, 'Interception thrown')
assert.equal(interception.eventType, 'turnover')

const [fieldGoal] = inferGameFeedEvents(
  [player('aubrey', 'Brandon Aubrey', 'K', 'DAL', 4)],
  scoring
)
assert.equal(fieldGoal.description, 'Field goal made (40–49 yards)')
assert.equal(fieldGoal.eventType, 'field_goal')

const [ambiguousRunningBack] = inferGameFeedEvents(
  [player('rb', 'Example Back', 'RB', 'DAL', 2.5)],
  scoring
)
assert.equal(ambiguousRunningBack.eventType, 'scoring_update')
assert.equal(ambiguousRunningBack.confidence, 'low')

console.log('Game Feed inference tests passed (9 scenarios).')
