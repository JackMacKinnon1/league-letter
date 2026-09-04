import {
  GAME_FEED_SCORING_PROFILE,
  gameFeedScoringValue as setting,
} from './game-feed-scoring-profile.mjs'

const EPSILON = 0.004
const MAX_PASS_PLAYS_PER_POLL = 8
const MAX_RUSH_PLAYS_PER_POLL = 8

function closeEnough(actual, expected) {
  return Math.abs(actual - expected) <= EPSILON
}

function roundPoints(value) {
  return Math.round(value * 1000) / 1000
}

function signedPoints(value) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`
}

function normalizedPosition(player) {
  return String(player?.position || '').toUpperCase()
}

function isDefense(player) {
  const position = normalizedPosition(player)
  return ['DEF', 'DST'].includes(position) || /^[A-Z]{2,3}$/.test(String(player?.id || ''))
}

function isKicker(player) {
  return normalizedPosition(player) === 'K'
}

function isReceiver(player) {
  return ['RB', 'WR', 'TE', 'FB'].includes(normalizedPosition(player))
}

function receiverScore(settings, receptions, yards, touchdowns) {
  return (
    receptions * setting(settings, 'rec') +
    yards * setting(settings, 'rec_yd') +
    touchdowns * setting(settings, 'rec_td')
  )
}

function passerScore(settings, completions, yards, touchdowns) {
  return (
    completions * setting(settings, 'pass_cmp') +
    yards * setting(settings, 'pass_yd') +
    touchdowns * setting(settings, 'pass_td')
  )
}

function rushScore(settings, attempts, yards, touchdowns) {
  return (
    attempts * setting(settings, 'rush_att') +
    yards * setting(settings, 'rush_yd') +
    touchdowns * setting(settings, 'rush_td')
  )
}

function plausibleAggregateYards(yards, plays) {
  if (plays <= 0) return yards === 0
  return yards >= -20 * plays && yards <= 99 * plays
}

function receivingCandidates(delta, settings, maxReceptions = MAX_PASS_PLAYS_PER_POLL) {
  const candidates = []

  for (let receptions = 1; receptions <= maxReceptions; receptions += 1) {
    for (let touchdowns = 0; touchdowns <= Math.min(3, receptions); touchdowns += 1) {
      for (let yards = -20 * receptions; yards <= 99 * receptions; yards += 1) {
        if (!plausibleAggregateYards(yards, receptions)) continue
        const score = receiverScore(settings, receptions, yards, touchdowns)
        if (!closeEnough(delta, score)) continue

        candidates.push({
          receptions,
          yards,
          touchdowns,
          receiverScore: roundPoints(score),
          passerScore: roundPoints(passerScore(settings, receptions, yards, touchdowns)),
        })
      }
    }
  }

  return candidates
    .sort((a, b) => {
      if (a.receptions !== b.receptions) return a.receptions - b.receptions
      if (a.touchdowns !== b.touchdowns) return b.touchdowns - a.touchdowns
      return Math.abs(a.yards) - Math.abs(b.yards)
    })
    .slice(0, 40)
}

function rushingCandidates(delta, settings, maxAttempts = MAX_RUSH_PLAYS_PER_POLL) {
  const candidates = []

  for (let attempts = 1; attempts <= maxAttempts; attempts += 1) {
    for (let touchdowns = 0; touchdowns <= Math.min(3, attempts); touchdowns += 1) {
      for (let yards = -20 * attempts; yards <= 99 * attempts; yards += 1) {
        if (!plausibleAggregateYards(yards, attempts)) continue
        const score = rushScore(settings, attempts, yards, touchdowns)
        if (!closeEnough(delta, score)) continue

        candidates.push({
          attempts,
          yards,
          touchdowns,
          score: roundPoints(score),
        })
      }
    }
  }

  return candidates
    .sort((a, b) => {
      if (a.attempts !== b.attempts) return a.attempts - b.attempts
      if (a.touchdowns !== b.touchdowns) return b.touchdowns - a.touchdowns
      return Math.abs(a.yards) - Math.abs(b.yards)
    })
    .slice(0, 40)
}

function describeReception(candidate) {
  const touchdown = candidate.touchdowns > 0
  if (candidate.receptions === 1) {
    return `${candidate.yards}-yard ${touchdown ? 'touchdown ' : ''}reception`
  }
  return `${candidate.receptions} receptions, ${candidate.yards} yards${
    touchdown
      ? `, ${candidate.touchdowns} TD${candidate.touchdowns === 1 ? '' : 's'}`
      : ''
  }`
}

function describeRush(candidate) {
  const touchdown = candidate.touchdowns > 0
  if (candidate.attempts === 1) {
    return `${candidate.yards}-yard ${touchdown ? 'touchdown ' : ''}rush`
  }
  return `${candidate.attempts} carries, ${candidate.yards} yards${
    touchdown
      ? `, ${candidate.touchdowns} TD${candidate.touchdowns === 1 ? '' : 's'}`
      : ''
  }`
}

function makeGenericEvent(player, reason = 'No unique encoded-stat solution matched the point change.') {
  return {
    eventType: 'scoring_update',
    description: `Scoring update (${signedPoints(player.delta)})`,
    primary: player,
    primaryFantasyDelta: player.delta,
    confidence: 'low',
    isAggregate: true,
    isCorrection: false,
    metadata: {
      reason,
      before: player.before,
      after: player.after,
    },
  }
}

function makeDefenseEvent(player, description, options = {}) {
  return {
    eventType: options.eventType || 'defense',
    description,
    primary: player,
    primaryFantasyDelta: player.delta,
    inferredYards: options.inferredYards ?? null,
    inferredReceptions: 0,
    inferredTouchdowns: options.touchdowns ?? 0,
    confidence: options.confidence || 'high',
    isAggregate: Boolean(options.isAggregate),
    isCorrection: false,
    metadata: {
      before: player.before,
      after: player.after,
      ...(options.metadata || {}),
    },
  }
}

function fieldGoalMissInfo(delta, settings) {
  const buckets = [
    ['fgmiss_0_19', '0–19'],
    ['fgmiss_20_29', '20–29'],
    ['fgmiss_30_39', '30–39'],
    ['fgmiss_40_49', '40–49'],
    ['fgmiss_50_59', '50–59'],
    ['fgmiss_60p', '60+'],
  ]

  for (const [key, range] of buckets) {
    const points = setting(settings, key)
    if (points < 0 && closeEnough(delta, points)) return { key, range, points }
  }

  return null
}

function inferNegativeKickerEvent(player, settings) {
  const patMiss = setting(settings, 'xpmiss')
  if (patMiss < 0 && closeEnough(player.delta, patMiss)) {
    return {
      eventType: 'extra_point',
      description: 'Extra point missed',
      primary: player,
      primaryFantasyDelta: player.delta,
      confidence: 'high',
      isAggregate: false,
      isCorrection: false,
      metadata: { before: player.before, after: player.after, kick_result: 'missed' },
    }
  }

  const miss = fieldGoalMissInfo(player.delta, settings)
  if (miss) {
    return {
      eventType: 'field_goal',
      description: `Field goal missed (${miss.range} yards)`,
      primary: player,
      primaryFantasyDelta: player.delta,
      confidence: 'high',
      isAggregate: false,
      isCorrection: false,
      metadata: {
        before: player.before,
        after: player.after,
        kick_result: 'missed',
        distance_band: miss.range,
      },
    }
  }

  return null
}

function inferKickerPositiveEvent(player, settings) {
  const fieldGoalBase = setting(settings, 'fgm')
  const fieldGoalYard = setting(settings, 'fgm_yds')
  const extraPoint = setting(settings, 'xpm')
  const candidates = []

  for (let fieldGoals = 0; fieldGoals <= 3; fieldGoals += 1) {
    for (let extraPoints = 0; extraPoints <= 4; extraPoints += 1) {
      if (fieldGoals === 0 && extraPoints === 0) continue

      if (fieldGoals === 0) {
        const score = extraPoints * extraPoint
        if (extraPoint !== 0 && closeEnough(player.delta, score)) {
          candidates.push({ fieldGoals, extraPoints, totalFieldGoalYards: 0 })
        }
        continue
      }

      if (fieldGoalBase === 0 || fieldGoalYard === 0) continue
      const fixed = fieldGoals * fieldGoalBase + extraPoints * extraPoint
      const totalFieldGoalYards = Math.round((player.delta - fixed) / fieldGoalYard)
      if (totalFieldGoalYards < 18 * fieldGoals || totalFieldGoalYards > 70 * fieldGoals) continue

      const score = fixed + totalFieldGoalYards * fieldGoalYard
      if (closeEnough(player.delta, score)) {
        candidates.push({ fieldGoals, extraPoints, totalFieldGoalYards })
      }
    }
  }

  if (!candidates.length) return null

  candidates.sort((a, b) => {
    const aEvents = a.fieldGoals + a.extraPoints
    const bEvents = b.fieldGoals + b.extraPoints
    if (aEvents !== bEvents) return aEvents - bEvents
    if (a.fieldGoals !== b.fieldGoals) return b.fieldGoals - a.fieldGoals
    return a.totalFieldGoalYards - b.totalFieldGoalYards
  })

  const candidate = candidates[0]
  const isAggregate = candidate.fieldGoals + candidate.extraPoints > 1

  if (candidate.fieldGoals === 0) {
    return {
      eventType: 'extra_point',
      description:
        candidate.extraPoints === 1
          ? 'Extra point made'
          : `${candidate.extraPoints} extra points made`,
      primary: player,
      primaryFantasyDelta: player.delta,
      confidence: isAggregate ? 'medium' : 'high',
      isAggregate,
      isCorrection: false,
      metadata: { before: player.before, after: player.after },
    }
  }

  const exactSingleDistance = candidate.fieldGoals === 1
    ? candidate.totalFieldGoalYards
    : null
  let description = exactSingleDistance !== null
    ? `${exactSingleDistance}-yard field goal made`
    : `${candidate.fieldGoals} field goals made (${candidate.totalFieldGoalYards} total FG yards)`

  if (candidate.extraPoints > 0) {
    description += ` and ${candidate.extraPoints} extra point${candidate.extraPoints === 1 ? '' : 's'}`
  }

  return {
    eventType: 'field_goal',
    description,
    primary: player,
    primaryFantasyDelta: player.delta,
    inferredYards: exactSingleDistance,
    inferredReceptions: 0,
    inferredTouchdowns: 0,
    confidence: isAggregate ? 'medium' : 'high',
    isAggregate,
    isCorrection: false,
    metadata: {
      before: player.before,
      after: player.after,
      field_goals: candidate.fieldGoals,
      extra_points: candidate.extraPoints,
      total_field_goal_yards: candidate.totalFieldGoalYards,
    },
  }
}

function inferDefenseEvent(player, settings) {
  const sack = setting(settings, 'sack')
  const forcedFumble = setting(settings, 'fum_force')
  const interception = setting(settings, 'int')
  const fumbleRecovery = setting(settings, 'fum_rec')
  const safety = setting(settings, 'safe')
  const blockedKick = setting(settings, 'blk_kick')
  const touchdown = setting(settings, 'def_td')
  const twoPointReturn = setting(settings, 'def_2pt', GAME_FEED_SCORING_PROFILE.def_2pt)

  const exactTemplates = [
    [sack, 'Sack', { sack: true }],
    [forcedFumble, 'Forced fumble', { forced_fumble: true }],
    [sack + forcedFumble, 'Sack and forced fumble', { sack: true, forced_fumble: true }],
    [interception, 'Interception', { interception: true }],
    [fumbleRecovery, 'Fumble recovery', { fumble_recovery: true }],
    [forcedFumble + fumbleRecovery, 'Forced fumble and recovery', { forced_fumble: true, fumble_recovery: true }],
    [sack + forcedFumble + fumbleRecovery, 'Sack, forced fumble and recovery', { sack: true, forced_fumble: true, fumble_recovery: true }],
    [safety, 'Safety', { safety: true }],
    [blockedKick, 'Blocked kick', { blocked_kick: true }],
    [touchdown, 'Defensive touchdown', { defensive_touchdown: true, touchdowns: 1 }],
    [interception + touchdown, 'Interception returned for a touchdown', { interception: true, defensive_touchdown: true, touchdowns: 1 }],
    [forcedFumble + fumbleRecovery + touchdown, 'Fumble returned for a touchdown', { forced_fumble: true, fumble_recovery: true, defensive_touchdown: true, touchdowns: 1 }],
    [sack + forcedFumble + fumbleRecovery + touchdown, 'Sack-fumble returned for a touchdown', { sack: true, forced_fumble: true, fumble_recovery: true, defensive_touchdown: true, touchdowns: 1 }],
    [blockedKick + touchdown, 'Blocked kick returned for a touchdown', { blocked_kick: true, defensive_touchdown: true, touchdowns: 1 }],
    [twoPointReturn, 'Defensive 2-point conversion return', { two_point_return: true }],
  ]

  for (const [points, description, metadata] of exactTemplates) {
    if (points !== 0 && closeEnough(player.delta, points)) {
      return makeDefenseEvent(player, description, {
        eventType:
          metadata.interception || metadata.fumble_recovery || metadata.defensive_touchdown
            ? 'turnover'
            : 'defense',
        touchdowns: metadata.touchdowns || 0,
        metadata,
      })
    }
  }

  // Optional return-yard decoding. This stays dormant with the recommended profile
  // because return-yard settings are 0, but works if the 0.01/yard enhancement is enabled.
  const returnTemplates = [
    {
      base: interception,
      rate: setting(settings, 'int_ret_yd'),
      label: 'Interception',
      metadata: { interception: true },
    },
    {
      base: interception + touchdown,
      rate: setting(settings, 'int_ret_yd'),
      label: 'Interception return touchdown',
      metadata: { interception: true, defensive_touchdown: true, touchdowns: 1 },
    },
    {
      base: forcedFumble + fumbleRecovery,
      rate: setting(settings, 'fum_ret_yd'),
      label: 'Fumble recovery',
      metadata: { forced_fumble: true, fumble_recovery: true },
    },
    {
      base: forcedFumble + fumbleRecovery + touchdown,
      rate: setting(settings, 'fum_ret_yd'),
      label: 'Fumble return touchdown',
      metadata: { forced_fumble: true, fumble_recovery: true, defensive_touchdown: true, touchdowns: 1 },
    },
    {
      base: blockedKick,
      rate: setting(settings, 'blk_kick_ret_yd'),
      label: 'Blocked kick return',
      metadata: { blocked_kick: true },
    },
  ]

  for (const template of returnTemplates) {
    if (template.rate <= 0) continue
    const yards = Math.round((player.delta - template.base) / template.rate)
    if (yards < 0 || yards > 120) continue
    if (!closeEnough(player.delta, template.base + yards * template.rate)) continue

    return makeDefenseEvent(player, `${template.label}, ${yards} return yards`, {
      eventType: template.metadata.interception || template.metadata.fumble_recovery ? 'turnover' : 'defense',
      inferredYards: yards,
      touchdowns: template.metadata.touchdowns || 0,
      metadata: template.metadata,
    })
  }

  return null
}

function findUniquePlayer(players, predicate) {
  const matches = players.filter(predicate)
  return matches.length === 1 ? matches[0] : null
}

function findUniqueDefenseByDelta(players, used, expectedDelta, excludedTeam) {
  return findUniquePlayer(players, (player) =>
    !used.has(player.id) &&
    isDefense(player) &&
    player.team !== excludedTeam &&
    closeEnough(player.delta, expectedDelta)
  )
}

function findUniqueQuarterbackByDelta(players, used, team, expectedDelta) {
  return findUniquePlayer(players, (player) =>
    !used.has(player.id) &&
    normalizedPosition(player) === 'QB' &&
    player.team === team &&
    closeEnough(player.delta, expectedDelta)
  )
}

function turnoverMetadata(primary, defense, extra = {}) {
  return {
    before: primary.before,
    after: primary.after,
    defense_id: defense?.id || null,
    defense_name: defense?.name || null,
    defense_team: defense?.team || null,
    defense_delta: defense?.delta ?? null,
    ...extra,
  }
}

function inferCoupledNegativePlays(meaningful, settings, used) {
  const events = []
  const negatives = meaningful.filter((player) => player.delta < 0)
  const positives = meaningful.filter((player) => player.delta > 0)

  // Kicker misses can be correlated with a +500 defense delta to distinguish blocks.
  for (const kicker of negatives.filter(isKicker)) {
    if (used.has(kicker.id)) continue
    const miss = inferNegativeKickerEvent(kicker, settings)
    if (!miss) continue

    const blockedKick = setting(settings, 'blk_kick')
    const defense = findUniqueDefenseByDelta(positives, used, blockedKick, kicker.team)
    if (defense) {
      miss.secondary = defense
      miss.secondaryFantasyDelta = defense.delta
      miss.description = miss.eventType === 'extra_point'
        ? 'Extra point blocked'
        : `${miss.description.replace('missed', 'blocked')}`
      miss.metadata = {
        ...miss.metadata,
        blocked: true,
        defense_id: defense.id,
        defense_name: defense.name,
      }
      used.add(defense.id)
    }

    events.push(miss)
    used.add(kicker.id)
  }

  const passInt = setting(settings, 'pass_int')
  const pickSix = setting(settings, 'pass_int_td')
  const qbSack = setting(settings, 'pass_sack')
  const fumble = setting(settings, 'fum')
  const fumbleLost = setting(settings, 'fum_lost')
  const defenseInt = setting(settings, 'int')
  const defenseSack = setting(settings, 'sack')
  const defenseForced = setting(settings, 'fum_force')
  const defenseRecovery = setting(settings, 'fum_rec')
  const defenseTd = setting(settings, 'def_td')

  const lostPenalty = fumble + fumbleLost

  for (const player of negatives) {
    if (used.has(player.id) || isKicker(player) || isDefense(player)) continue
    const position = normalizedPosition(player)

    if (position === 'QB' && closeEnough(player.delta, passInt + pickSix)) {
      const defense = findUniqueDefenseByDelta(
        positives,
        used,
        defenseInt + defenseTd,
        player.team
      )
      events.push({
        eventType: 'turnover',
        description: 'Pick six thrown',
        primary: player,
        secondary: defense || undefined,
        primaryFantasyDelta: player.delta,
        secondaryFantasyDelta: defense?.delta ?? null,
        inferredTouchdowns: 1,
        confidence: defense ? 'high' : 'medium',
        isAggregate: false,
        isCorrection: false,
        metadata: turnoverMetadata(player, defense, { interception: true, pick_six: true }),
      })
      used.add(player.id)
      if (defense) used.add(defense.id)
      continue
    }

    if (position === 'QB' && closeEnough(player.delta, passInt)) {
      const defense = findUniqueDefenseByDelta(positives, used, defenseInt, player.team)
      events.push({
        eventType: 'turnover',
        description: 'Interception thrown',
        primary: player,
        secondary: defense || undefined,
        primaryFantasyDelta: player.delta,
        secondaryFantasyDelta: defense?.delta ?? null,
        confidence: defense ? 'high' : 'medium',
        isAggregate: false,
        isCorrection: false,
        metadata: turnoverMetadata(player, defense, { interception: true }),
      })
      used.add(player.id)
      if (defense) used.add(defense.id)
      continue
    }

    const sackFumbleLost = qbSack + lostPenalty
    if (position === 'QB' && closeEnough(player.delta, sackFumbleLost)) {
      const recovered = findUniqueDefenseByDelta(
        positives,
        used,
        defenseSack + defenseForced + defenseRecovery,
        player.team
      )
      const returnedTd = recovered || findUniqueDefenseByDelta(
        positives,
        used,
        defenseSack + defenseForced + defenseRecovery + defenseTd,
        player.team
      )
      const defense = returnedTd
      const isTd = Boolean(defense && closeEnough(
        defense.delta,
        defenseSack + defenseForced + defenseRecovery + defenseTd
      ))
      events.push({
        eventType: 'turnover',
        description: isTd ? 'Sack-fumble returned for a touchdown' : 'Sack-fumble lost',
        primary: player,
        secondary: defense || undefined,
        primaryFantasyDelta: player.delta,
        secondaryFantasyDelta: defense?.delta ?? null,
        inferredTouchdowns: isTd ? 1 : 0,
        confidence: defense ? 'high' : 'medium',
        isAggregate: false,
        isCorrection: false,
        metadata: turnoverMetadata(player, defense, {
          sack: true,
          fumble: true,
          fumble_lost: true,
          defensive_touchdown: isTd,
        }),
      })
      used.add(player.id)
      if (defense) used.add(defense.id)
      continue
    }

    if (position === 'QB' && closeEnough(player.delta, qbSack + fumble)) {
      const defense = findUniqueDefenseByDelta(
        positives,
        used,
        defenseSack + defenseForced,
        player.team
      )
      events.push({
        eventType: 'defense',
        description: 'Sack and forced fumble; offense recovered',
        primary: player,
        secondary: defense || undefined,
        primaryFantasyDelta: player.delta,
        secondaryFantasyDelta: defense?.delta ?? null,
        confidence: defense ? 'high' : 'medium',
        isAggregate: false,
        isCorrection: false,
        metadata: turnoverMetadata(player, defense, { sack: true, fumble: true, fumble_lost: false }),
      })
      used.add(player.id)
      if (defense) used.add(defense.id)
      continue
    }

    if (position === 'QB' && closeEnough(player.delta, qbSack)) {
      const defense = findUniqueDefenseByDelta(positives, used, defenseSack, player.team)
      events.push({
        eventType: 'defense',
        description: 'Quarterback sacked',
        primary: player,
        secondary: defense || undefined,
        primaryFantasyDelta: player.delta,
        secondaryFantasyDelta: defense?.delta ?? null,
        confidence: defense ? 'high' : 'medium',
        isAggregate: false,
        isCorrection: false,
        metadata: turnoverMetadata(player, defense, { sack: true }),
      })
      used.add(player.id)
      if (defense) used.add(defense.id)
      continue
    }

    // A catch/run can produce positive encoded points and then stack a fumble penalty
    // on the same play. Strip the turnover penalty and decode the residual play.
    let decodedResidual = false
    for (const penalty of [
      { points: lostPenalty, label: 'fumble lost', lost: true },
      { points: fumble, label: 'fumble; offense recovered', lost: false },
    ]) {
      const residual = roundPoints(player.delta - penalty.points)
      if (residual <= 0) continue

      const expectedDefense = penalty.lost
        ? defenseForced + defenseRecovery
        : defenseForced
      const defenseNormal = findUniqueDefenseByDelta(positives, used, expectedDefense, player.team)
      const defenseTdPlayer = penalty.lost
        ? findUniqueDefenseByDelta(positives, used, expectedDefense + defenseTd, player.team)
        : null
      const defense = defenseTdPlayer || defenseNormal
      const defenseReturnedTd = Boolean(defenseTdPlayer)

      const recCandidate = isReceiver(player) ? receivingCandidates(residual, settings)[0] : null
      const quarterback = recCandidate
        ? findUniqueQuarterbackByDelta(positives, used, player.team, recCandidate.passerScore)
        : null
      const rushCandidate = rushingCandidates(residual, settings)[0]

      if (recCandidate && quarterback) {
        events.push({
          eventType: penalty.lost ? 'turnover' : 'reception',
          description: `${describeReception(recCandidate)}, ${
            defenseReturnedTd ? 'fumble returned for a touchdown' : penalty.label
          }`,
          primary: player,
          secondary: quarterback,
          primaryFantasyDelta: player.delta,
          secondaryFantasyDelta: quarterback.delta,
          inferredYards: recCandidate.yards,
          inferredReceptions: recCandidate.receptions,
          inferredTouchdowns: recCandidate.touchdowns + (defenseReturnedTd ? 1 : 0),
          confidence: defense ? 'high' : 'medium',
          isAggregate: recCandidate.receptions > 1,
          isCorrection: false,
          metadata: turnoverMetadata(player, defense, {
            before: player.before,
            after: player.after,
            quarterback_before: quarterback.before,
            quarterback_after: quarterback.after,
            fumble: true,
            fumble_lost: penalty.lost,
            defensive_touchdown: defenseReturnedTd,
            underlying_play: 'reception',
          }),
        })
        used.add(player.id)
        used.add(quarterback.id)
        if (defense) used.add(defense.id)
        decodedResidual = true
        break
      }

      if (rushCandidate) {
        events.push({
          eventType: penalty.lost ? 'turnover' : 'rush',
          description: `${describeRush(rushCandidate)}, ${
            defenseReturnedTd ? 'fumble returned for a touchdown' : penalty.label
          }`,
          primary: player,
          secondary: defense || undefined,
          primaryFantasyDelta: player.delta,
          secondaryFantasyDelta: defense?.delta ?? null,
          inferredYards: rushCandidate.yards,
          inferredReceptions: 0,
          inferredTouchdowns: rushCandidate.touchdowns + (defenseReturnedTd ? 1 : 0),
          confidence: defense ? 'high' : 'medium',
          isAggregate: rushCandidate.attempts > 1,
          isCorrection: false,
          metadata: turnoverMetadata(player, defense, {
            fumble: true,
            fumble_lost: penalty.lost,
            defensive_touchdown: defenseReturnedTd,
            underlying_play: 'rush',
          }),
        })
        used.add(player.id)
        if (defense) used.add(defense.id)
        decodedResidual = true
        break
      }
    }
    if (decodedResidual) continue

    if (closeEnough(player.delta, lostPenalty)) {
      const defenseNormal = findUniqueDefenseByDelta(
        positives,
        used,
        defenseForced + defenseRecovery,
        player.team
      )
      const defenseTdPlayer = defenseNormal || findUniqueDefenseByDelta(
        positives,
        used,
        defenseForced + defenseRecovery + defenseTd,
        player.team
      )
      const defense = defenseTdPlayer
      const returnedTd = Boolean(defense && closeEnough(
        defense.delta,
        defenseForced + defenseRecovery + defenseTd
      ))
      events.push({
        eventType: 'turnover',
        description: returnedTd ? 'Fumble returned for a touchdown' : 'Fumble lost',
        primary: player,
        secondary: defense || undefined,
        primaryFantasyDelta: player.delta,
        secondaryFantasyDelta: defense?.delta ?? null,
        inferredTouchdowns: returnedTd ? 1 : 0,
        confidence: defense ? 'high' : 'medium',
        isAggregate: false,
        isCorrection: false,
        metadata: turnoverMetadata(player, defense, {
          fumble: true,
          fumble_lost: true,
          defensive_touchdown: returnedTd,
        }),
      })
      used.add(player.id)
      if (defense) used.add(defense.id)
      continue
    }

    if (closeEnough(player.delta, fumble)) {
      const defense = findUniqueDefenseByDelta(positives, used, defenseForced, player.team)
      events.push({
        eventType: 'defense',
        description: 'Fumble; offense recovered',
        primary: player,
        secondary: defense || undefined,
        primaryFantasyDelta: player.delta,
        secondaryFantasyDelta: defense?.delta ?? null,
        confidence: defense ? 'high' : 'medium',
        isAggregate: false,
        isCorrection: false,
        metadata: turnoverMetadata(player, defense, { fumble: true, fumble_lost: false }),
      })
      used.add(player.id)
      if (defense) used.add(defense.id)
    }
  }

  return events
}

function inferRemainingNegativeEvent(player, settings) {
  if (isKicker(player)) return inferNegativeKickerEvent(player, settings) || makeGenericEvent(player)

  const position = normalizedPosition(player)
  const interception = setting(settings, 'pass_int')
  const pickSix = setting(settings, 'pass_int_td')
  const fumble = setting(settings, 'fum')
  const fumbleLost = setting(settings, 'fum_lost')
  const sack = setting(settings, 'pass_sack')

  if (position === 'QB' && closeEnough(player.delta, interception + pickSix)) {
    return {
      eventType: 'turnover',
      description: 'Pick six thrown',
      primary: player,
      primaryFantasyDelta: player.delta,
      inferredTouchdowns: 1,
      confidence: 'medium',
      isAggregate: false,
      isCorrection: false,
      metadata: { before: player.before, after: player.after, interception: true, pick_six: true },
    }
  }

  if (position === 'QB' && closeEnough(player.delta, interception)) {
    return {
      eventType: 'turnover',
      description: 'Interception thrown',
      primary: player,
      primaryFantasyDelta: player.delta,
      confidence: 'medium',
      isAggregate: false,
      isCorrection: false,
      metadata: { before: player.before, after: player.after, interception: true },
    }
  }

  if (position === 'QB' && closeEnough(player.delta, sack)) {
    return {
      eventType: 'defense',
      description: 'Quarterback sacked',
      primary: player,
      primaryFantasyDelta: player.delta,
      confidence: 'medium',
      isAggregate: false,
      isCorrection: false,
      metadata: { before: player.before, after: player.after, sack: true },
    }
  }

  if (closeEnough(player.delta, fumble + fumbleLost)) {
    return {
      eventType: 'turnover',
      description: 'Fumble lost',
      primary: player,
      primaryFantasyDelta: player.delta,
      confidence: 'medium',
      isAggregate: false,
      isCorrection: false,
      metadata: { before: player.before, after: player.after, fumble: true, fumble_lost: true },
    }
  }

  if (closeEnough(player.delta, fumble)) {
    return {
      eventType: 'defense',
      description: 'Fumble; offense recovered',
      primary: player,
      primaryFantasyDelta: player.delta,
      confidence: 'medium',
      isAggregate: false,
      isCorrection: false,
      metadata: { before: player.before, after: player.after, fumble: true, fumble_lost: false },
    }
  }

  return {
    eventType: 'stat_correction',
    description: `Stat correction (${signedPoints(player.delta)})`,
    primary: player,
    primaryFantasyDelta: player.delta,
    confidence: 'low',
    isAggregate: false,
    isCorrection: true,
    metadata: { before: player.before, after: player.after },
  }
}

function findPassCombination(receivers, quarterbackDelta, settings) {
  const candidateSets = receivers.map((receiver) => receivingCandidates(receiver.delta, settings))
  if (candidateSets.some((set) => set.length === 0)) return null

  let visited = 0
  const maxVisited = 50_000
  const selected = []
  let matchedRush = null

  function search(index, accumulatedPassPoints) {
    if (visited >= maxVisited) return false
    visited += 1

    if (index === candidateSets.length) {
      const residual = roundPoints(quarterbackDelta - accumulatedPassPoints)
      if (closeEnough(residual, 0)) {
        matchedRush = null
        return true
      }

      if (residual > 0) {
        const rush = rushingCandidates(residual, settings)[0]
        if (rush) {
          matchedRush = rush
          return true
        }
      }
      return false
    }

    for (const candidate of candidateSets[index]) {
      selected[index] = candidate
      if (search(index + 1, accumulatedPassPoints + candidate.passerScore)) return true
    }
    return false
  }

  return search(0, 0)
    ? { candidates: [...selected], quarterbackRush: matchedRush }
    : null
}

function findBestPassGroup(receivers, quarterbackDelta, settings) {
  if (!receivers.length) return null
  const capped = receivers.slice(0, 8)
  let best = null

  for (let mask = 1; mask < 1 << capped.length; mask += 1) {
    const subset = capped.filter((_, index) => Boolean(mask & (1 << index)))
    if (best && subset.length < best.receivers.length) continue

    const solution = findPassCombination(subset, quarterbackDelta, settings)
    if (!solution) continue

    const candidate = {
      receivers: subset,
      candidates: solution.candidates,
      quarterbackRush: solution.quarterbackRush,
    }

    if (!best || subset.length > best.receivers.length) {
      best = candidate
      continue
    }

    // When receiver coverage ties, prefer the solution that does not need to invent
    // an additional QB rush component.
    if (best.quarterbackRush && !candidate.quarterbackRush) best = candidate
  }

  return best
}

function inferPassingTwoPointConversions(players, settings, used) {
  const events = []
  const qbPoints = setting(settings, 'pass_2pt')
  const receiverPoints = setting(settings, 'rec_2pt')
  if (qbPoints === 0 || receiverPoints === 0) return events

  const quarterbacks = players.filter((player) =>
    !used.has(player.id) && normalizedPosition(player) === 'QB' && closeEnough(player.delta, qbPoints)
  )

  for (const quarterback of quarterbacks) {
    const receiver = findUniquePlayer(players, (player) =>
      !used.has(player.id) &&
      isReceiver(player) &&
      player.team === quarterback.team &&
      closeEnough(player.delta, receiverPoints)
    )
    if (!receiver) continue

    events.push({
      eventType: 'reception',
      description: '2-point conversion reception',
      primary: receiver,
      secondary: quarterback,
      primaryFantasyDelta: receiver.delta,
      secondaryFantasyDelta: quarterback.delta,
      inferredYards: null,
      inferredReceptions: 0,
      inferredTouchdowns: 0,
      confidence: 'high',
      isAggregate: false,
      isCorrection: false,
      metadata: {
        before: receiver.before,
        after: receiver.after,
        quarterback_before: quarterback.before,
        quarterback_after: quarterback.after,
        two_point_conversion: true,
      },
    })
    used.add(receiver.id)
    used.add(quarterback.id)
  }

  return events
}

function inferTeamPositiveEvents(players, settings, teamContext, used) {
  const events = []
  const available = players.filter((player) => !used.has(player.id))
  const quarterbacks = available.filter((player) => normalizedPosition(player) === 'QB')
  const receivers = available.filter(isReceiver)

  if (quarterbacks.length === 1 && receivers.length > 0) {
    const quarterback = quarterbacks[0]
    const passGroup = findBestPassGroup(receivers, quarterback.delta, settings)

    if (passGroup) {
      passGroup.receivers.forEach((receiver, index) => {
        const candidate = passGroup.candidates[index]
        const aggregate = passGroup.receivers.length > 1 || candidate.receptions > 1
        events.push({
          eventType: 'reception',
          description: describeReception(candidate),
          primary: receiver,
          secondary: quarterback,
          primaryFantasyDelta: receiver.delta,
          secondaryFantasyDelta: candidate.passerScore,
          inferredYards: candidate.yards,
          inferredReceptions: candidate.receptions,
          inferredTouchdowns: candidate.touchdowns,
          confidence: aggregate ? 'medium' : 'high',
          isAggregate: aggregate,
          isCorrection: false,
          metadata: {
            before: receiver.before,
            after: receiver.after,
            quarterback_before: quarterback.before,
            quarterback_after: quarterback.after,
            grouped_receiver_count: passGroup.receivers.length,
          },
        })
        used.add(receiver.id)
      })

      if (passGroup.quarterbackRush) {
        events.push({
          eventType: 'rush',
          description: describeRush(passGroup.quarterbackRush),
          primary: quarterback,
          primaryFantasyDelta: passGroup.quarterbackRush.score,
          inferredYards: passGroup.quarterbackRush.yards,
          inferredReceptions: 0,
          inferredTouchdowns: passGroup.quarterbackRush.touchdowns,
          confidence: 'medium',
          isAggregate: passGroup.quarterbackRush.attempts > 1,
          isCorrection: false,
          metadata: {
            before: quarterback.before,
            after: quarterback.after,
            combined_with_passing_changes: true,
          },
        })
      }
      used.add(quarterback.id)
    }
  }

  for (const player of available) {
    if (used.has(player.id)) continue
    const position = normalizedPosition(player)

    if (isKicker(player)) {
      const kickerEvent = inferKickerPositiveEvent(player, settings)
      events.push(kickerEvent || makeGenericEvent(player))
      used.add(player.id)
      continue
    }

    if (isDefense(player)) {
      const defenseEvent = inferDefenseEvent(player, settings)
      events.push(defenseEvent || makeGenericEvent(player, 'Defense delta did not match a configured event fingerprint.'))
      used.add(player.id)
      continue
    }

    const rushTwoPoint = setting(settings, 'rush_2pt')
    if (rushTwoPoint !== 0 && closeEnough(player.delta, rushTwoPoint)) {
      events.push({
        eventType: 'rush',
        description: 'Rushing 2-point conversion',
        primary: player,
        primaryFantasyDelta: player.delta,
        inferredYards: null,
        inferredReceptions: 0,
        inferredTouchdowns: 0,
        confidence: 'medium',
        isAggregate: false,
        isCorrection: false,
        metadata: { before: player.before, after: player.after, two_point_conversion: true },
      })
      used.add(player.id)
      continue
    }

    if (isReceiver(player)) {
      const recCandidate = receivingCandidates(player.delta, settings)[0]
      const rushCandidate = rushingCandidates(player.delta, settings)[0]
      const observedQuarterback = teamContext.some((contextPlayer) =>
        normalizedPosition(contextPlayer) === 'QB' && contextPlayer.id !== player.id
      )
      const changingQuarterback = quarterbacks.some((quarterback) => !used.has(quarterback.id))

      if (rushCandidate && observedQuarterback && !changingQuarterback) {
        events.push({
          eventType: 'rush',
          description: describeRush(rushCandidate),
          primary: player,
          primaryFantasyDelta: player.delta,
          inferredYards: rushCandidate.yards,
          inferredReceptions: 0,
          inferredTouchdowns: rushCandidate.touchdowns,
          confidence: rushCandidate.attempts === 1 ? 'high' : 'medium',
          isAggregate: rushCandidate.attempts > 1,
          isCorrection: false,
          metadata: {
            before: player.before,
            after: player.after,
            same_team_quarterback_observed_without_matching_pass_delta: true,
          },
        })
        used.add(player.id)
        continue
      }

      if (recCandidate && ['WR', 'TE', 'FB'].includes(position)) {
        events.push({
          eventType: 'reception',
          description: describeReception(recCandidate),
          primary: player,
          primaryFantasyDelta: player.delta,
          inferredYards: recCandidate.yards,
          inferredReceptions: recCandidate.receptions,
          inferredTouchdowns: recCandidate.touchdowns,
          confidence: recCandidate.receptions === 1 ? 'medium' : 'low',
          isAggregate: recCandidate.receptions > 1,
          isCorrection: false,
          metadata: { before: player.before, after: player.after, passer_not_observed: true },
        })
        used.add(player.id)
        continue
      }

      if (rushCandidate && !recCandidate) {
        events.push({
          eventType: 'rush',
          description: describeRush(rushCandidate),
          primary: player,
          primaryFantasyDelta: player.delta,
          inferredYards: rushCandidate.yards,
          inferredReceptions: 0,
          inferredTouchdowns: rushCandidate.touchdowns,
          confidence: rushCandidate.attempts === 1 ? 'medium' : 'low',
          isAggregate: rushCandidate.attempts > 1,
          isCorrection: false,
          metadata: { before: player.before, after: player.after },
        })
        used.add(player.id)
        continue
      }
    }

    if (position === 'QB') {
      const rushCandidate = rushingCandidates(player.delta, settings)[0]
      if (rushCandidate) {
        events.push({
          eventType: 'rush',
          description: describeRush(rushCandidate),
          primary: player,
          primaryFantasyDelta: player.delta,
          inferredYards: rushCandidate.yards,
          inferredReceptions: 0,
          inferredTouchdowns: rushCandidate.touchdowns,
          confidence: rushCandidate.attempts === 1 ? 'high' : 'medium',
          isAggregate: rushCandidate.attempts > 1,
          isCorrection: false,
          metadata: { before: player.before, after: player.after },
        })
      } else {
        events.push({
          ...makeGenericEvent(player),
          eventType: 'passing',
          description: `Passing scoring update (${signedPoints(player.delta)})`,
        })
      }
      used.add(player.id)
      continue
    }

    events.push(makeGenericEvent(player))
    used.add(player.id)
  }

  return events
}

export function inferGameFeedEvents(deltas, settings, contextPlayers = deltas) {
  const meaningful = deltas.filter((player) => Math.abs(player.delta) >= 0.005)
  const events = []
  const used = new Set()

  events.push(...inferCoupledNegativePlays(meaningful, settings, used))
  events.push(...inferPassingTwoPointConversions(meaningful, settings, used))

  const positive = meaningful.filter((entry) => entry.delta > 0 && !used.has(entry.id))
  const byTeam = new Map()

  for (const player of positive) {
    const key = player.team || `unknown:${player.id}`
    if (!byTeam.has(key)) byTeam.set(key, [])
    byTeam.get(key).push(player)
  }

  for (const teamPlayers of byTeam.values()) {
    const teamKey = teamPlayers[0]?.team || `unknown:${teamPlayers[0]?.id || ''}`
    const teamContext = contextPlayers.filter((player) =>
      (player.team || `unknown:${player.id}`) === teamKey
    )
    events.push(...inferTeamPositiveEvents(teamPlayers, settings, teamContext, used))
  }

  for (const player of meaningful.filter((entry) => entry.delta < 0 && !used.has(entry.id))) {
    events.push(inferRemainingNegativeEvent(player, settings))
    used.add(player.id)
  }

  for (const player of meaningful.filter((entry) => !used.has(entry.id))) {
    events.push(makeGenericEvent(player))
    used.add(player.id)
  }

  return events
}
