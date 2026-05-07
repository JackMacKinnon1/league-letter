import Papa from 'papaparse'

type CsvRow = Record<string, any>

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

const CATEGORY_WEIGHTS = {
  Production: 0.12,
  Volume: 0.18,
  Efficiency: 0.22,
  AfterCatch: 0.08,
  PFF: 0.3,
  Age: 0.1,
}

const FEATURE_GROUPS: Record<string, Record<string, number>> = {
  Production: {
    TD: 0.25,
    Receptions: 0.3,
    Yards: 0.45,
  },
  Volume: {
    Targets: 0.35,
    TargetShare: 0.3,
    TPRR: 0.2,
    FirstReadPct: 0.15,
  },
  Efficiency: {
    YPRR: 0.32,
    YPT: 0.18,
    YPR: 0.1,
    YPTOE: 0.4,
  },
  AfterCatch: {
    YAC_REC: 0.36,
    YACO_REC: 0.34,
    MTF_REC: 0.3,
  },
  PFF: {
    PFF_RECV_Grade: 1,
  },
  Age: {
    AgeSeason: 1,
  },
}

const RECENCY_WEIGHTS: Record<string, number> = {
  '0': 0.4,
  '1': 0.25,
  '2': 0.18,
  '3': 0.1,
  '4': 0.08,
}

const FINAL_BLEND = {
  fiveYearWeightedScore: 0.58,
  recentSeasonScore: 0.07,
  consistencyScore: 0.06,
  currentAgeScore: 0.17,
  trackRecordScore: 0.12,
}

const FPD_COLUMN_ALIASES: Record<string, string[]> = {
  player_name: ['player', 'player name', 'name', 'full name'],
  team: ['team', 'tm'],
  position: ['pos', 'position'],
  age: ['age', 'ageseason'],

  TD: ['td', 'touchdowns'],
  Receptions: ['rec', 'receptions'],
  Yards: ['yds', 'yards'],
  Targets: ['tgt', 'targets'],
  TargetShare: ['tgt %', 'tgt%', 'target share', 'targetshare'],
  TPRR: ['tprr'],
  FirstReadPct: ['1read %', '1read%', 'first read %', 'firstreadpct'],
  YPRR: ['yprr'],
  YPT: ['ypt'],
  YPR: ['ypr'],
  YPTOE: ['yptoe'],
  YAC_REC: ['yac/rec', 'yac_rec'],
  YACO_REC: ['yaco/rec', 'yaco_rec'],
  MTF_REC: ['mtf/rec', 'mtf_rec'],
}

const PFF_COLUMN_ALIASES: Record<string, string[]> = {
  player_name: ['player', 'player name', 'name', 'full name'],
  team: ['team', 'tm'],
  position: ['pos', 'position'],
  PFF_RECV_Grade: ['grades_pass_route', 'pass route grade', 'receiving grade'],
}

export function buildWrValuesFromCsvs({
  season,
  fpdCsvText,
  pffCsvText,
}: {
  season: string
  fpdCsvText: string
  pffCsvText: string
}) {
  const fpdRows = parseCsv(fpdCsvText)
  const pffRows = parseCsv(pffCsvText)

  const pffByNameTeam = new Map<string, CsvRow>()
  const pffByName = new Map<string, CsvRow>()

  for (const row of pffRows) {
    const playerName = getString(row, PFF_COLUMN_ALIASES.player_name)
    const team = getString(row, PFF_COLUMN_ALIASES.team)

    if (!playerName) continue

    pffByName.set(normalizeName(playerName), row)

    if (team) {
      pffByNameTeam.set(makeNameTeamKey(playerName, team), row)
    }
  }

  const rawPlayers = fpdRows
    .map((row) => {
      const playerName = getString(row, FPD_COLUMN_ALIASES.player_name)
      const team = getString(row, FPD_COLUMN_ALIASES.team)
      const position = getString(row, FPD_COLUMN_ALIASES.position)

      if (!playerName) return null

      if (position && position.toUpperCase() !== 'WR') {
        return null
      }

      const pffRow =
        team && pffByNameTeam.get(makeNameTeamKey(playerName, team))
          ? pffByNameTeam.get(makeNameTeamKey(playerName, team))
          : pffByName.get(normalizeName(playerName))

      const metrics = {
        TD: getNumber(row, FPD_COLUMN_ALIASES.TD),
        Receptions: getNumber(row, FPD_COLUMN_ALIASES.Receptions),
        Yards: getNumber(row, FPD_COLUMN_ALIASES.Yards),
        Targets: getNumber(row, FPD_COLUMN_ALIASES.Targets),
        TargetShare: getNumber(row, FPD_COLUMN_ALIASES.TargetShare),
        TPRR: getNumber(row, FPD_COLUMN_ALIASES.TPRR),
        FirstReadPct: getNumber(row, FPD_COLUMN_ALIASES.FirstReadPct),
        YPRR: getNumber(row, FPD_COLUMN_ALIASES.YPRR),
        YPT: getNumber(row, FPD_COLUMN_ALIASES.YPT),
        YPR: getNumber(row, FPD_COLUMN_ALIASES.YPR),
        YPTOE: getNumber(row, FPD_COLUMN_ALIASES.YPTOE),
        YAC_REC: getNumber(row, FPD_COLUMN_ALIASES.YAC_REC),
        YACO_REC: getNumber(row, FPD_COLUMN_ALIASES.YACO_REC),
        MTF_REC: getNumber(row, FPD_COLUMN_ALIASES.MTF_REC),
        PFF_RECV_Grade: pffRow
          ? getNumber(pffRow, PFF_COLUMN_ALIASES.PFF_RECV_Grade)
          : null,
        AgeSeason: getNumber(row, FPD_COLUMN_ALIASES.age),
      }

      return {
        playerName,
        team: team || null,
        position: position || 'WR',
        age: metrics.AgeSeason,
        metrics,
      }
    })
    .filter(Boolean) as Array<{
    playerName: string
    team: string | null
    position: string | null
    age: number | null
    metrics: Record<string, number | null>
  }>

  const percentileScores = buildFeaturePercentileScores(rawPlayers)

  const yearlyRows: YearlyRow[] = rawPlayers.map((player) => {
    const featureScores: Record<string, number> = {}

    for (const feature of Object.keys(player.metrics)) {
      if (feature === 'AgeSeason') {
        featureScores[feature] = calculateAgeScore(player.metrics.AgeSeason)
      } else {
        featureScores[feature] =
          percentileScores.get(`${player.playerName}-${feature}`) ?? 35
      }
    }

    const categoryScores = {
      Production: calculateGroupScore(featureScores, FEATURE_GROUPS.Production),
      Volume: calculateGroupScore(featureScores, FEATURE_GROUPS.Volume),
      Efficiency: calculateGroupScore(featureScores, FEATURE_GROUPS.Efficiency),
      AfterCatch: calculateGroupScore(featureScores, FEATURE_GROUPS.AfterCatch),
      PFF: calculateGroupScore(featureScores, FEATURE_GROUPS.PFF),
      Age: calculateGroupScore(featureScores, FEATURE_GROUPS.Age),
    }

    const seasonScore =
      categoryScores.Production * CATEGORY_WEIGHTS.Production +
      categoryScores.Volume * CATEGORY_WEIGHTS.Volume +
      categoryScores.Efficiency * CATEGORY_WEIGHTS.Efficiency +
      categoryScores.AfterCatch * CATEGORY_WEIGHTS.AfterCatch +
      categoryScores.PFF * CATEGORY_WEIGHTS.PFF +
      categoryScores.Age * CATEGORY_WEIGHTS.Age

    return {
      player_key: normalizeName(player.playerName),
      player_name: player.playerName,
      season,
      team: player.team,
      position: player.position,
      age: player.age,
      raw_metrics: player.metrics,
      feature_scores: featureScores,
      category_scores: categoryScores,
      production_score: round2(categoryScores.Production),
      volume_score: round2(categoryScores.Volume),
      efficiency_score: round2(categoryScores.Efficiency),
      after_catch_score: round2(categoryScores.AfterCatch),
      pff_score: round2(categoryScores.PFF),
      age_score: round2(categoryScores.Age),
      season_score: round2(seasonScore),
      updated_at: new Date().toISOString(),
    }
  })

  const unmatchedPffCount = yearlyRows.filter(
    (row) => row.raw_metrics.PFF_RECV_Grade === null
  ).length

  return {
    yearlyRows,
    importSummary: {
      fpdRows: fpdRows.length,
      pffRows: pffRows.length,
      wrRows: yearlyRows.length,
      unmatchedPffCount,
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

  const playerValues: any[] = []

  for (const [playerKey, rows] of rowsByPlayer.entries()) {
    const sortedRows = [...rows]
      .sort((a, b) => Number(b.season) - Number(a.season))
      .slice(0, 5)

    if (!sortedRows.length) continue

    const latestRow = sortedRows[0]

    let recencyTotal = 0
    let recencyWeightUsed = 0

    for (const row of sortedRows) {
      const seasonsAgo = String(currentLatestSeason - Number(row.season))
      const weight = RECENCY_WEIGHTS[seasonsAgo]

      if (!weight) continue

      recencyTotal += Number(row.season_score || 0) * weight
      recencyWeightUsed += weight
    }

    const fiveYearWeightedScore =
      recencyWeightUsed > 0 ? recencyTotal / recencyWeightUsed : 35

    const recentSeasonScore = Number(latestRow.season_score || 35)

    const seasonScores = sortedRows.map((row) => Number(row.season_score || 35))
    const sd = standardDeviation(seasonScores)

    const consistencyScore = clamp(100 - sd * 2, 0, 100)
    const currentAgeScore = Number(latestRow.age_score || 50)
    const trackRecordScore = clamp((sortedRows.length / 5) * 100, 0, 100)

    const finalScore =
      fiveYearWeightedScore * FINAL_BLEND.fiveYearWeightedScore +
      recentSeasonScore * FINAL_BLEND.recentSeasonScore +
      consistencyScore * FINAL_BLEND.consistencyScore +
      currentAgeScore * FINAL_BLEND.currentAgeScore +
      trackRecordScore * FINAL_BLEND.trackRecordScore

    playerValues.push({
      player_key: playerKey,
      player_name: latestRow.player_name,
      latest_team: latestRow.team,
      latest_position: latestRow.position,
      final_score: round2(finalScore),
      five_year_weighted_score: round2(fiveYearWeightedScore),
      recent_season_score: round2(recentSeasonScore),
      consistency_score: round2(consistencyScore),
      current_age_score: round2(currentAgeScore),
      track_record_score: round2(trackRecordScore),
      seasons_used: sortedRows.map((row) => ({
        season: row.season,
        score: row.season_score,
        team: row.team,
      })),
      latest_season: latestRow.season,
      updated_at: new Date().toISOString(),
    })
  }

  return playerValues.sort((a, b) => b.final_score - a.final_score)
}

function parseCsv(csvText: string) {
  const parsed = Papa.parse<CsvRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  })

  return parsed.data || []
}

function buildFeaturePercentileScores(
  players: Array<{
    playerName: string
    metrics: Record<string, number | null>
  }>
) {
  const result = new Map<string, number>()

  const features = [
    'TD',
    'Receptions',
    'Yards',
    'Targets',
    'TargetShare',
    'TPRR',
    'FirstReadPct',
    'YPRR',
    'YPT',
    'YPR',
    'YPTOE',
    'YAC_REC',
    'YACO_REC',
    'MTF_REC',
    'PFF_RECV_Grade',
  ]

  for (const feature of features) {
    const values = players
      .map((player) => ({
        playerName: player.playerName,
        value: player.metrics[feature],
      }))
      .filter((item) => item.value !== null && Number.isFinite(Number(item.value)))
      .sort((a, b) => Number(a.value) - Number(b.value))

    if (!values.length) continue

    for (let index = 0; index < values.length; index++) {
      const percentile =
        values.length === 1 ? 100 : (index / (values.length - 1)) * 100

      result.set(`${values[index].playerName}-${feature}`, round2(percentile))
    }
  }

  return result
}

function calculateGroupScore(
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

  if (!weightUsed) return 35

  return total / weightUsed
}

function calculateAgeScore(age: number | null) {
  if (!age || !Number.isFinite(age)) {
    return 50
  }

  if (age < 28) {
    return 100
  }

  return clamp(100 - (age - 28) * 10, 0, 100)
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

function normalizeName(value: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function makeNameTeamKey(name: string, team: string) {
  return `${normalizeName(name)}-${String(team || '').toUpperCase().trim()}`
}

function standardDeviation(values: number[]) {
  if (values.length <= 1) return 0

  const avg = values.reduce((sum, value) => sum + value, 0) / values.length

  const variance =
    values.reduce((sum, value) => sum + Math.pow(value - avg, 2), 0) /
    (values.length - 1)

  return Math.sqrt(variance)
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function round2(value: number) {
  return Math.round(value * 100) / 100
}