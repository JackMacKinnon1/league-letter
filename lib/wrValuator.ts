import Papa from 'papaparse'

type CsvRow = Record<string, any>

type PlayerAgeInput = Record<string, number | null | undefined>

type RawPlayer = {
  playerName: string
  playerKey: string
  team: string | null
  position: string | null
  age: number | null
  metrics: Record<string, number | null>
}

type YearlyRow = {
  player_key: string
  player_name: string
  season: string
  team: string | null
  position: string | null
  age: number | null
  raw_metrics: Record<string, number | null>
  feature_scores: Record<string, number>
  category_scores: Record<string, number>
  production_score: number
  volume_score: number
  efficiency_score: number
  after_catch_score: number
  pff_score: number
  age_score: number
  season_score: number
  updated_at: string
}

const SEASON_DECAY_WEIGHTS: Record<string, number> = {
  '0': 0.55,
  '1': 0.3,
  '2': 0.15,
}

const FINAL_BLEND = {
  productionScore: 0.55,
  upsideScore: 0.45,
}

const PRODUCTION_WEIGHTS: Record<string, number> = {
  XFP: 0.3,
  Yards: 0.25,
  Targets: 0.18,
  Receptions: 0.12,
  TeamYardsShare: 0.15,
}

// First-read target % intentionally removed.
// The old first-read weight is moved into PFF receiving grade.
const UPSIDE_WEIGHTS: Record<string, number> = {
  PFF_RECV_Grade: 0.3,
  YPRR: 0.23,
  TPRR: 0.15,
  TargetShare: 0.1,
  AgeUpside: 0.22,
}

const FPD_COLUMN_ALIASES: Record<string, string[]> = {
  player_name: ['player', 'player name', 'name', 'full name'],
  team: ['team', 'tm'],
  position: ['pos', 'position'],

  XFP: ['xfp', 'expected fantasy points'],
  Receptions: ['rec', 'receptions'],
  Yards: ['yds', 'yards', 'receiving yards'],
  Targets: ['tgt', 'targets'],
  TargetShare: ['tgt %', 'tgt%', 'target share', 'targetshare'],
  TPRR: ['tprr'],
  YPRR: ['yprr'],
  TeamYardsShare: [
    'tm yds %',
    'tm yds%',
    'team yds %',
    'team yards %',
    'team receiving yards share',
    'tm receiving yards share',
  ],
}

const PFF_COLUMN_ALIASES: Record<string, string[]> = {
  player_name: ['player', 'player name', 'name', 'full name'],
  team: ['team', 'tm'],
  position: ['pos', 'position'],
  PFF_RECV_Grade: [
    'grades_pass_route',
    'receiving grade',
    'recv grade',
    'pass route grade',
    'pff receiving grade',
  ],
}

export function buildWrValuesFromCsvs({
  season,
  fpdCsvText,
  pffCsvText,
  playerAgesByKey = {},
}: {
  season: string
  fpdCsvText: string
  pffCsvText: string
  playerAgesByKey?: PlayerAgeInput
}) {
  const fpdRows = parseCsv(fpdCsvText)
  const pffRows = parseCsv(pffCsvText)

  const pffByNameTeam = new Map<string, CsvRow>()
  const pffByName = new Map<string, CsvRow>()

  for (const row of pffRows) {
    const playerName = getString(row, PFF_COLUMN_ALIASES.player_name)
    const team = getString(row, PFF_COLUMN_ALIASES.team)

    if (!playerName) continue

    pffByName.set(normalizePlayerKey(playerName), row)

    if (team) {
      pffByNameTeam.set(makeNameTeamKey(playerName, team), row)
    }
  }

  const rawPlayers = fpdRows
    .map((row) => {
      const playerName = getString(row, FPD_COLUMN_ALIASES.player_name)
      const playerKey = normalizePlayerKey(playerName)
      const team = getString(row, FPD_COLUMN_ALIASES.team)
      const position = getString(row, FPD_COLUMN_ALIASES.position)

      if (!playerName) return null

      if (position && position.toUpperCase() !== 'WR') {
        return null
      }

      const pffRow =
        team && pffByNameTeam.get(makeNameTeamKey(playerName, team))
          ? pffByNameTeam.get(makeNameTeamKey(playerName, team))
          : pffByName.get(playerKey)

      const ageFromPlayersTable = getAgeFromMap(playerAgesByKey, playerKey)

      const metrics = {
        XFP: getNumber(row, FPD_COLUMN_ALIASES.XFP),
        Receptions: getNumber(row, FPD_COLUMN_ALIASES.Receptions),
        Yards: getNumber(row, FPD_COLUMN_ALIASES.Yards),
        Targets: getNumber(row, FPD_COLUMN_ALIASES.Targets),
        TargetShare: getNumber(row, FPD_COLUMN_ALIASES.TargetShare),
        TPRR: getNumber(row, FPD_COLUMN_ALIASES.TPRR),
        YPRR: getNumber(row, FPD_COLUMN_ALIASES.YPRR),
        TeamYardsShare: getNumber(row, FPD_COLUMN_ALIASES.TeamYardsShare),
        PFF_RECV_Grade: pffRow
          ? getNumber(pffRow, PFF_COLUMN_ALIASES.PFF_RECV_Grade)
          : null,
        Age: ageFromPlayersTable,
      }

      return {
        playerName,
        playerKey,
        team: team || null,
        position: position || 'WR',
        age: ageFromPlayersTable,
        metrics,
      }
    })
    .filter(Boolean) as RawPlayer[]

  const zScores = buildFeatureZScores(rawPlayers)

  const yearlyRows: YearlyRow[] = rawPlayers.map((player) => {
    const featureScores: Record<string, number> = {}

    for (const feature of Object.keys(player.metrics)) {
      if (feature === 'Age') {
        featureScores.AgeUpside = calculateAgeUpsideScore(player.age)
        featureScores.AgeMultiplier = calculateAgeMultiplier(player.age) * 100
        continue
      }

      featureScores[feature] = zScores.get(`${player.playerKey}-${feature}`) ?? 50
    }

    const productionScore = calculateWeightedScore(featureScores, PRODUCTION_WEIGHTS)
    const upsideScore = calculateWeightedScore(featureScores, UPSIDE_WEIGHTS)

    const pffScore = featureScores.PFF_RECV_Grade ?? 50
    const efficiencyScore = calculateWeightedScore(featureScores, {
      YPRR: 0.6,
      TPRR: 0.4,
    })
    const volumeScore = calculateWeightedScore(featureScores, {
      Targets: 0.55,
      TargetShare: 0.45,
    })
    const ageScore = featureScores.AgeUpside ?? 50

    const rawSeasonScore =
      productionScore * FINAL_BLEND.productionScore +
      upsideScore * FINAL_BLEND.upsideScore

    const seasonScore = rawSeasonScore * calculateAgeMultiplier(player.age)

    return {
      player_key: player.playerKey,
      player_name: player.playerName,
      season,
      team: player.team,
      position: player.position,
      age: player.age,
      raw_metrics: player.metrics,
      feature_scores: featureScores,
      category_scores: {
        Production: round2(productionScore),
        Upside: round2(upsideScore),
        PFF: round2(pffScore),
        Efficiency: round2(efficiencyScore),
        Volume: round2(volumeScore),
        Age: round2(ageScore),
      },
      production_score: round2(productionScore),
      volume_score: round2(volumeScore),
      efficiency_score: round2(efficiencyScore),
      after_catch_score: 0,
      pff_score: round2(pffScore),
      age_score: round2(ageScore),
      season_score: round2(seasonScore),
      updated_at: new Date().toISOString(),
    }
  })

  const unmatchedPffCount = yearlyRows.filter(
    (row) => row.raw_metrics.PFF_RECV_Grade === null
  ).length

  const missingAgeCount = yearlyRows.filter((row) => row.age === null).length

  return {
    yearlyRows,
    importSummary: {
      fpdRows: fpdRows.length,
      pffRows: pffRows.length,
      wrRows: yearlyRows.length,
      unmatchedPffCount,
      missingAgeCount,
    },
  }
}

export function buildFiveYearPlayerValues(allSeasonRows: any[]) {
  const rowsByPlayer = new Map<string, any[]>()

  for (const row of allSeasonRows || []) {
    if (!rowsByPlayer.has(row.player_key)) {
      rowsByPlayer.set(row.player_key, [])
    }

    rowsByPlayer.get(row.player_key)?.push(row)
  }

  const currentLatestSeason = Math.max(
    ...allSeasonRows.map((row) => Number(row.season)).filter(Number.isFinite)
  )

  const unscaledValues: any[] = []

  for (const [playerKey, rows] of rowsByPlayer.entries()) {
    const sortedRows = [...rows]
      .sort((a, b) => Number(b.season) - Number(a.season))
      .slice(0, 3)

    if (!sortedRows.length) continue

    const latestRow = sortedRows[0]

    let productionTotal = 0
    let upsideTotal = 0
    let seasonTotal = 0
    let weightUsed = 0

    for (const row of sortedRows) {
      const seasonsAgo = String(currentLatestSeason - Number(row.season))
      const weight = SEASON_DECAY_WEIGHTS[seasonsAgo]

      if (!weight) continue

      const categoryScores = row.category_scores || {}

      productionTotal += Number(categoryScores.Production || row.production_score || 0) * weight
      upsideTotal += Number(categoryScores.Upside || row.efficiency_score || 0) * weight
      seasonTotal += Number(row.season_score || 0) * weight
      weightUsed += weight
    }

    const productionScore = weightUsed > 0 ? productionTotal / weightUsed : 50
    const upsideScore = weightUsed > 0 ? upsideTotal / weightUsed : 50
    const weightedSeasonScore = weightUsed > 0 ? seasonTotal / weightUsed : 50

    const seasonScores = sortedRows.map((row) => Number(row.season_score || 50))
    const sd = standardDeviation(seasonScores)
    const consistencyScore = clamp(100 - sd * 2, 0, 100)
    const currentAgeScore = Number(latestRow.age_score || 50)
    const trackRecordScore = clamp((sortedRows.length / 3) * 100, 0, 100)

    const rawFinalScore =
      productionScore * FINAL_BLEND.productionScore +
      upsideScore * FINAL_BLEND.upsideScore

    unscaledValues.push({
      player_key: playerKey,
      player_name: latestRow.player_name,
      latest_team: latestRow.team,
      latest_position: latestRow.position,
      raw_final_score: rawFinalScore,
      weighted_season_score: weightedSeasonScore,
      production_score: productionScore,
      upside_score: upsideScore,
      consistency_score: consistencyScore,
      current_age_score: currentAgeScore,
      track_record_score: trackRecordScore,
      seasons_used: sortedRows.map((row) => ({
        season: row.season,
        score: row.season_score,
        production: row.category_scores?.Production ?? row.production_score,
        upside: row.category_scores?.Upside,
        team: row.team,
      })),
      latest_season: latestRow.season,
      updated_at: new Date().toISOString(),
    })
  }

  const finalScores = minMaxScale(
    unscaledValues.map((player) => Number(player.raw_final_score || 0)),
    0,
    9999
  )

  return unscaledValues
    .map((player, index) => ({
      player_key: player.player_key,
      player_name: player.player_name,
      latest_team: player.latest_team,
      latest_position: player.latest_position,
      final_score: Math.round(finalScores[index]),
      five_year_weighted_score: round2(player.weighted_season_score),
      recent_season_score: round2(player.raw_final_score),
      consistency_score: round2(player.consistency_score),
      current_age_score: round2(player.current_age_score),
      track_record_score: round2(player.track_record_score),
      seasons_used: player.seasons_used,
      latest_season: player.latest_season,
      updated_at: player.updated_at,
    }))
    .sort((a, b) => b.final_score - a.final_score)
}

function parseCsv(csvText: string) {
  const parsed = Papa.parse<CsvRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  })

  return parsed.data || []
}

function buildFeatureZScores(players: RawPlayer[]) {
  const result = new Map<string, number>()

  const features = [
    'XFP',
    'Receptions',
    'Yards',
    'Targets',
    'TargetShare',
    'TPRR',
    'YPRR',
    'TeamYardsShare',
    'PFF_RECV_Grade',
  ]

  for (const feature of features) {
    const values = players
      .map((player) => ({
        playerKey: player.playerKey,
        value: player.metrics[feature],
      }))
      .filter((item) => item.value !== null && Number.isFinite(Number(item.value)))

    if (!values.length) continue

    const numbers = values.map((item) => Number(item.value))
    const mean = numbers.reduce((sum, value) => sum + value, 0) / numbers.length
    const sd = standardDeviation(numbers)

    for (const item of values) {
      const z = sd > 0 ? (Number(item.value) - mean) / sd : 0
      result.set(`${item.playerKey}-${feature}`, zScoreToScore(z))
    }
  }

  return result
}

function zScoreToScore(z: number) {
  // Converts z-scores into a stable 0-100 model score centered around 50.
  return round2(clamp(50 + z * 15, 0, 100))
}

function calculateWeightedScore(
  featureScores: Record<string, number>,
  weights: Record<string, number>
) {
  let total = 0
  let weightUsed = 0

  for (const [feature, weight] of Object.entries(weights)) {
    const score = featureScores[feature]

    if (!Number.isFinite(score)) continue

    total += score * weight
    weightUsed += weight
  }

  if (!weightUsed) return 50

  return total / weightUsed
}

function calculateAgeUpsideScore(age: number | null) {
  if (!age || !Number.isFinite(age)) return 50

  if (age <= 22) return 100
  if (age <= 24) return 92
  if (age <= 26) return 82
  if (age <= 28) return 70
  if (age === 29) return 58
  if (age === 30) return 48
  if (age === 31) return 38
  if (age === 32) return 30
  if (age === 33) return 22
  return 15
}

function calculateAgeMultiplier(age: number | null) {
  if (!age || !Number.isFinite(age)) return 1

  if (age <= 22) return 1.2
  if (age <= 24) return 1.15
  if (age <= 26) return 1.05
  if (age <= 28) return 1
  if (age === 29) return 0.93
  if (age === 30) return 0.86
  if (age === 31) return 0.78
  if (age === 32) return 0.7
  if (age === 33) return 0.62
  return 0.5
}

function getAgeFromMap(playerAgesByKey: PlayerAgeInput, playerKey: string) {
  const age = playerAgesByKey[playerKey]

  if (age === null || age === undefined) return null

  const value = Number(age)

  return Number.isFinite(value) ? value : null
}

function getString(row: CsvRow, aliases: string[]) {
  const key = findColumn(row, aliases)
  if (!key) return ''

  return String(row[key] || '').trim()
}

function getNumber(row: CsvRow, aliases: string[]) {
  const key = findColumn(row, aliases)
  if (!key) return null

  const raw = String(row[key] || '')
    .replace('%', '')
    .replace(',', '')
    .trim()

  if (!raw) return null

  const value = Number(raw)

  return Number.isFinite(value) ? value : null
}

function findColumn(row: CsvRow, aliases: string[]) {
  const normalizedAliases = aliases.map(normalizeHeader)

  return Object.keys(row).find((key) =>
    normalizedAliases.includes(normalizeHeader(key))
  )
}

function normalizeHeader(value: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/_/g, '')
    .replace(/-/g, '')
}

export function normalizePlayerKey(value: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function makeNameTeamKey(name: string, team: string) {
  return `${normalizePlayerKey(name)}-${String(team || '').toUpperCase().trim()}`
}

function standardDeviation(values: number[]) {
  if (values.length <= 1) return 0

  const avg = values.reduce((sum, value) => sum + value, 0) / values.length

  const variance =
    values.reduce((sum, value) => sum + Math.pow(value - avg, 2), 0) /
    (values.length - 1)

  return Math.sqrt(variance)
}

function minMaxScale(values: number[], minOut: number, maxOut: number) {
  const min = Math.min(...values)
  const max = Math.max(...values)

  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    return values.map(() => (minOut + maxOut) / 2)
  }

  return values.map((value) => {
    const scaled = ((value - min) / (max - min)) * (maxOut - minOut) + minOut
    return clamp(scaled, minOut, maxOut)
  })
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function round2(value: number) {
  return Math.round(value * 100) / 100
}
