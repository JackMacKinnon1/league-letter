import assert from 'node:assert/strict'
import { inferGameFeedEvents } from '../game-feed-worker/game-feed-inference.mjs'
import {
  GAME_FEED_SCORING_PROFILE as scoring,
  validateGameFeedScoringSettings,
} from '../game-feed-worker/game-feed-scoring-profile.mjs'

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

function eventByDescription(events, text) {
  return events.find((event) => event.description.includes(text))
}

// 1) Zero-yard screen: QB and receiver both move +1.00.
{
  const context = [
    player('dak', 'Dak Prescott', 'QB', 'DAL', 1),
    player('lamb', 'CeeDee Lamb', 'WR', 'DAL', 1),
  ]
  const events = inferGameFeedEvents(context, scoring, context)
  assert.equal(events.length, 1)
  assert.equal(events[0].description, '0-yard reception')
  assert.equal(events[0].secondary?.id, 'dak')
  assert.equal(events[0].inferredYards, 0)
  assert.equal(events[0].confidence, 'high')
}

// 2) 10-yard catch is +1.10 for both sides of the pass fingerprint.
{
  const context = [
    player('dak', 'Dak Prescott', 'QB', 'DAL', 1.1),
    player('lamb', 'CeeDee Lamb', 'WR', 'DAL', 1.1),
  ]
  const [event] = inferGameFeedEvents(context, scoring, context)
  assert.equal(event.description, '10-yard reception')
  assert.equal(event.inferredYards, 10)
}

// 3) Five-yard passing TD mirrors at +11.05.
{
  const context = [
    player('dak', 'Dak Prescott', 'QB', 'DAL', 11.05),
    player('lamb', 'CeeDee Lamb', 'WR', 'DAL', 11.05),
  ]
  const [event] = inferGameFeedEvents(context, scoring, context)
  assert.equal(event.description, '5-yard touchdown reception')
  assert.equal(event.inferredTouchdowns, 1)
}

// 4) Rush attempts live in the 100-point band and remain distinct from catches.
{
  const context = [
    player('dak', 'Dak Prescott', 'QB', 'DAL', 0),
    player('lamb', 'CeeDee Lamb', 'WR', 'DAL', 100.1),
  ]
  const [event] = inferGameFeedEvents(
    context.filter((entry) => entry.delta !== 0),
    scoring,
    context
  )
  assert.equal(event.description, '10-yard rush')
  assert.equal(event.eventType, 'rush')
  assert.equal(event.confidence, 'high')
}

// 5) Rushing TD adds the 1000-point touchdown band.
{
  const context = [
    player('dak', 'Dak Prescott', 'QB', 'DAL', 0),
    player('lamb', 'CeeDee Lamb', 'WR', 'DAL', 1100.05),
  ]
  const [event] = inferGameFeedEvents(
    context.filter((entry) => entry.delta !== 0),
    scoring,
    context
  )
  assert.equal(event.description, '5-yard touchdown rush')
  assert.equal(event.inferredTouchdowns, 1)
}

// 6) Multiple receiver changes can still be solved against one QB aggregate.
{
  const context = [
    player('dak', 'Dak Prescott', 'QB', 'DAL', 2.2),
    player('lamb', 'CeeDee Lamb', 'WR', 'DAL', 1.08),
    player('ferguson', 'Jake Ferguson', 'TE', 'DAL', 1.12),
  ]
  const events = inferGameFeedEvents(context, scoring, context)
  assert.equal(events.length, 2)
  assert.deepEqual(events.map((event) => event.inferredYards).sort((a, b) => a - b), [8, 12])
  assert.ok(events.every((event) => event.secondary?.id === 'dak'))
  assert.ok(events.every((event) => event.isAggregate))
}

// 7) QB pass + rush in the same poll can be split instead of becoming generic.
{
  const context = [
    player('dak', 'Dak Prescott', 'QB', 'DAL', 101.15), // 10-yard completion + 5-yard rush
    player('lamb', 'CeeDee Lamb', 'WR', 'DAL', 1.1),
  ]
  const events = inferGameFeedEvents(context, scoring, context)
  assert.ok(eventByDescription(events, '10-yard reception'))
  assert.ok(eventByDescription(events, '5-yard rush'))
}

// 8) Normal interception mirrors -100 / +100.
{
  const context = [
    player('dak', 'Dak Prescott', 'QB', 'DAL', -100, 20),
    player('phi', 'PHI Defense', 'DEF', 'PHI', 100, 0),
  ]
  const [event] = inferGameFeedEvents(context, scoring, context)
  assert.equal(event.description, 'Interception thrown')
  assert.equal(event.eventType, 'turnover')
  assert.equal(event.secondary?.id, 'phi')
  assert.equal(event.confidence, 'high')
}

// 9) Pick six stacks interception + pick-six penalties and the defense mirrors it.
{
  const context = [
    player('dak', 'Dak Prescott', 'QB', 'DAL', -1100, 20),
    player('phi', 'PHI Defense', 'DEF', 'PHI', 1100, 0),
  ]
  const [event] = inferGameFeedEvents(context, scoring, context)
  assert.equal(event.description, 'Pick six thrown')
  assert.equal(event.secondary?.id, 'phi')
  assert.equal(event.inferredTouchdowns, 1)
}

// 10) Fumble + fumble lost stacks to -210; defense forced fumble + recovery = +210.
{
  const context = [
    player('lamb', 'CeeDee Lamb', 'WR', 'DAL', -210, 10),
    player('phi', 'PHI Defense', 'DEF', 'PHI', 210, 0),
  ]
  const [event] = inferGameFeedEvents(context, scoring, context)
  assert.equal(event.description, 'Fumble lost')
  assert.equal(event.secondary?.id, 'phi')
}

// 11) A reception can be recovered underneath a stacked lost-fumble penalty.
{
  const context = [
    player('dak', 'Dak Prescott', 'QB', 'DAL', 1.1),
    player('lamb', 'CeeDee Lamb', 'WR', 'DAL', -208.9, 10), // +1.10 catch -210 fumble/lost
    player('phi', 'PHI Defense', 'DEF', 'PHI', 210, 0),
  ]
  const [event] = inferGameFeedEvents(context, scoring, context)
  assert.equal(event.description, '10-yard reception, fumble lost')
  assert.equal(event.secondary?.id, 'dak')
  assert.equal(event.metadata?.defense_id, 'phi')
  assert.equal(event.inferredYards, 10)
}

// 12) Sack uses the -5 / +5 mirror.
{
  const context = [
    player('dak', 'Dak Prescott', 'QB', 'DAL', -5, 20),
    player('phi', 'PHI Defense', 'DEF', 'PHI', 5, 0),
  ]
  const [event] = inferGameFeedEvents(context, scoring, context)
  assert.equal(event.description, 'Quarterback sacked')
  assert.equal(event.secondary?.id, 'phi')
}

// 13) Sack-fumble-lost stacks -5 -10 -200 and +5 +10 +200.
{
  const context = [
    player('dak', 'Dak Prescott', 'QB', 'DAL', -215, 20),
    player('phi', 'PHI Defense', 'DEF', 'PHI', 215, 0),
  ]
  const [event] = inferGameFeedEvents(context, scoring, context)
  assert.equal(event.description, 'Sack-fumble lost')
  assert.equal(event.secondary?.id, 'phi')
}

// 14) Exact made-FG yardage comes from +100 plus 0.01 per FG yard.
{
  const [event] = inferGameFeedEvents([
    player('aubrey', 'Brandon Aubrey', 'K', 'DAL', 100.42),
  ], scoring)
  assert.equal(event.description, '42-yard field goal made')
  assert.equal(event.eventType, 'field_goal')
  assert.equal(event.inferredYards, 42)
}

// 15) PAT made and PAT missed have distinct +/- fingerprints.
{
  const [made] = inferGameFeedEvents([
    player('aubrey', 'Brandon Aubrey', 'K', 'DAL', 1),
  ], scoring)
  assert.equal(made.description, 'Extra point made')

  const [missed] = inferGameFeedEvents([
    player('aubrey', 'Brandon Aubrey', 'K', 'DAL', -10),
  ], scoring)
  assert.equal(missed.description, 'Extra point missed')
}

// 16) Missed FG distance bands decode directly.
{
  const [event] = inferGameFeedEvents([
    player('aubrey', 'Brandon Aubrey', 'K', 'DAL', -104),
  ], scoring)
  assert.equal(event.description, 'Field goal missed (40–49 yards)')
}

// 17) A kicker miss plus +500 defense identifies a blocked attempt.
{
  const context = [
    player('aubrey', 'Brandon Aubrey', 'K', 'DAL', -104),
    player('phi', 'PHI Defense', 'DEF', 'PHI', 500),
  ]
  const [event] = inferGameFeedEvents(context, scoring, context)
  assert.equal(event.description, 'Field goal blocked (40–49 yards)')
  assert.equal(event.secondary?.id, 'phi')
}

// 18) Standalone defense fingerprints.
{
  const safety = inferGameFeedEvents([
    player('phi', 'PHI Defense', 'DEF', 'PHI', 300),
  ], scoring)[0]
  assert.equal(safety.description, 'Safety')

  const forcedRecovery = inferGameFeedEvents([
    player('phi', 'PHI Defense', 'DEF', 'PHI', 210),
  ], scoring)[0]
  assert.equal(forcedRecovery.description, 'Forced fumble and recovery')
}

// 19) Passing two-point conversion mirrors +2000 on QB and receiver.
{
  const context = [
    player('dak', 'Dak Prescott', 'QB', 'DAL', 2000),
    player('lamb', 'CeeDee Lamb', 'WR', 'DAL', 2000),
  ]
  const [event] = inferGameFeedEvents(context, scoring, context)
  assert.equal(event.description, '2-point conversion reception')
  assert.equal(event.secondary?.id, 'dak')
}

// 20) Rushing two-point conversion is identifiable without a passer mirror.
{
  const context = [
    player('dak', 'Dak Prescott', 'QB', 'DAL', 0),
    player('lamb', 'CeeDee Lamb', 'WR', 'DAL', 2000),
  ]
  const [event] = inferGameFeedEvents(
    context.filter((entry) => entry.delta !== 0),
    scoring,
    context
  )
  assert.equal(event.description, 'Rushing 2-point conversion')
}


// 21) Production Sleeper aliases are accepted: Pick 6 = int_ret_td and
// points-per-rush-attempt = bonus_rush_att in league scoring_settings.
{
  const sleeperScoring = { ...scoring }
  delete sleeperScoring.pass_int_td
  delete sleeperScoring.rush_att
  sleeperScoring.int_ret_td = -1000
  sleeperScoring.bonus_rush_att = 100

  assert.deepEqual(validateGameFeedScoringSettings(sleeperScoring), [])
  const noisyDefenseScoring = { ...sleeperScoring, pts_allow_0: 10 }
  assert.ok(
    validateGameFeedScoringSettings(noisyDefenseScoring).some(
      (mismatch) => mismatch.key === 'pts_allow_0' && mismatch.expected === 0
    )
  )

  const rush = inferGameFeedEvents([
    player('lamb', 'CeeDee Lamb', 'WR', 'DAL', 100.1),
  ], sleeperScoring)[0]
  assert.equal(rush.description, '10-yard rush')

  const pickSixContext = [
    player('dak', 'Dak Prescott', 'QB', 'DAL', -1100, 20),
    player('phi', 'PHI Defense', 'DEF', 'PHI', 1100, 0),
  ]
  const pickSix = inferGameFeedEvents(pickSixContext, sleeperScoring, pickSixContext)[0]
  assert.equal(pickSix.description, 'Pick six thrown')
}

console.log('Game Feed inference tests passed (21 encoded-scoring scenarios).')
