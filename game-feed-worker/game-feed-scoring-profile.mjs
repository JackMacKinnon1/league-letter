// Purpose-built Sleeper scoring profile for League Letter's live Game Feed.
// These values are intentionally NOT normal fantasy scoring. They encode NFL stat
// changes into distinctive point deltas so the worker can reconstruct plays from
// Sleeper's matchup players_points snapshots.
// Canonical keys below are decoder-facing names. A few Sleeper API keys differ
// from their UI/stat labels; SCORING_SETTING_ALIASES bridges those differences.
export const GAME_FEED_SCORING_PROFILE = Object.freeze({
  // Passing
  pass_yd: 0.01,
  pass_td: 10,
  pass_2pt: 2000,
  pass_int: -100,
  pass_int_td: -1000,
  pass_cmp: 1,
  pass_sack: -5,

  // Rushing
  rush_yd: 0.01,
  rush_td: 1000,
  rush_2pt: 2000,
  rush_att: 100,

  // Receiving
  rec: 1,
  rec_yd: 0.01,
  rec_td: 10,
  rec_2pt: 2000,

  // Miscellaneous turnovers
  fum: -10,
  fum_lost: -200,
  fum_rec_td: 1000,

  // Kicking
  xpm: 1,
  xpmiss: -10,
  fgm: 100,
  fgm_yds: 0.01,
  fgm_yds_over_30: 0,
  fgmiss: 0,
  fgmiss_0_19: -101,
  fgmiss_20_29: -102,
  fgmiss_30_39: -103,
  fgmiss_40_49: -104,
  fgmiss_50_59: -105,
  fgmiss_50p: 0,
  fgmiss_60p: -106,

  // Team defense
  sack: 5,
  int: 100,
  fum_rec: 200,
  fum_force: 10,
  safe: 300,
  blk_kick: 500,
  def_td: 1000,
  def_2pt: 2000,

  // Optional return-yard channels. Keep at 0 unless you deliberately enable the
  // 0.01/yard enhancement in Sleeper; the decoder supports them when present.
  int_ret_yd: 0,
  fum_ret_yd: 0,
  blk_kick_ret_yd: 0,
})


// Sleeper's public league scoring payload does not always use the same key as
// the raw stat/UI concept. In particular:
//   - Pick 6 Thrown is returned as `int_ret_td` by Sleeper.
//   - Rush Attempts / points-per-carry is returned as `bonus_rush_att`.
// Keep canonical decoder names above so the inference math stays readable.
const SCORING_SETTING_ALIASES = Object.freeze({
  pass_int_td: ['int_ret_td'],
  rush_att: ['bonus_rush_att'],
})

function actualScoringValue(settings, key) {
  const keys = [key, ...(SCORING_SETTING_ALIASES[key] || [])]
  for (const candidate of keys) {
    const value = Number(settings?.[candidate])
    if (Number.isFinite(value)) return { key: candidate, value }
  }
  return { key: null, value: null }
}

// These are the non-zero settings that matter to the decoder. Zero-valued bonus,
// first-down, points-allowed, yards-allowed and position-PPR settings should stay 0.
// Missing keys are treated as mismatches because a missing non-zero setting means
// the source league is not using the encoding profile the worker expects.
export const REQUIRED_GAME_FEED_SCORING = Object.freeze({
  pass_yd: 0.01,
  pass_td: 10,
  pass_2pt: 2000,
  pass_int: -100,
  pass_int_td: -1000,
  pass_cmp: 1,
  pass_sack: -5,
  rush_yd: 0.01,
  rush_td: 1000,
  rush_2pt: 2000,
  rush_att: 100,
  rec: 1,
  rec_yd: 0.01,
  rec_td: 10,
  rec_2pt: 2000,
  fum: -10,
  fum_lost: -200,
  xpm: 1,
  xpmiss: -10,
  fgm: 100,
  fgm_yds: 0.01,
  fgmiss_0_19: -101,
  fgmiss_20_29: -102,
  fgmiss_30_39: -103,
  fgmiss_40_49: -104,
  fgmiss_50_59: -105,
  fgmiss_60p: -106,
  sack: 5,
  int: 100,
  fum_rec: 200,
  fum_force: 10,
  safe: 300,
  blk_kick: 500,
  def_td: 1000,
})

// These settings create unrelated score movement or collide with the event codebook.
// They are allowed to be absent from Sleeper's payload; when present they must be 0.
export const ZERO_GAME_FEED_SCORING_KEYS = Object.freeze([
  // Passing / rushing / receiving extras
  'pass_fd',
  'pass_att',
  'pass_inc',
  'pass_icmp',
  'pass_cmp_40p',
  'pass_td_40p',
  'pass_td_50p',
  'rush_fd',
  'rush_40p',
  'rush_td_40p',
  'rush_td_50p',
  'rec_fd',
  'rec_0_4',
  'rec_5_9',
  'rec_10_19',
  'rec_20_29',
  'rec_30_39',
  'rec_40p',
  'rec_td_40p',
  'rec_td_50p',
  'bonus_rec_rb',
  'bonus_rec_wr',
  'bonus_rec_te',

  // Kicking extras. Exact made-FG distance is carried by fgm + fgm_yds.
  'fgm_0_19',
  'fgm_20_29',
  'fgm_30_39',
  'fgm_40_49',
  'fgm_50_59',
  'fgm_50p',
  'fgm_60p',
  'fgm_yds_over_30',
  'fgmiss',
  'fgmiss_50p',

  // Team-defense range scoring must be disabled or it creates score deltas that
  // have nothing to do with a single play fingerprint.
  'pts_allow',
  'pts_allow_0',
  'pts_allow_1_6',
  'pts_allow_7_13',
  'pts_allow_14_20',
  'pts_allow_21_27',
  'pts_allow_28_34',
  'pts_allow_35p',
])

export function gameFeedScoringValue(settings, key, fallback = undefined) {
  const actual = actualScoringValue(settings, key)
  if (Number.isFinite(actual.value)) return actual.value

  const profileValue = Number(GAME_FEED_SCORING_PROFILE[key])
  if (Number.isFinite(profileValue)) return profileValue

  const safeFallback = Number(fallback)
  return Number.isFinite(safeFallback) ? safeFallback : 0
}

export function validateGameFeedScoringSettings(settings) {
  const mismatches = []

  for (const [key, expected] of Object.entries(REQUIRED_GAME_FEED_SCORING)) {
    const actual = actualScoringValue(settings, key)
    if (!Number.isFinite(actual.value) || Math.abs(actual.value - expected) > 0.000001) {
      mismatches.push({
        key,
        expected,
        actual: Number.isFinite(actual.value) ? actual.value : null,
        sleeperKey: actual.key,
      })
    }
  }

  for (const key of ZERO_GAME_FEED_SCORING_KEYS) {
    const actual = Number(settings?.[key])
    if (Number.isFinite(actual) && Math.abs(actual) > 0.000001) {
      mismatches.push({ key, expected: 0, actual, sleeperKey: key })
    }
  }

  return mismatches
}
