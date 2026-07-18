import * as XLSX from 'xlsx'

export type PlayerPosition = 'WR' | 'TE' | 'QB' | 'RB'

type MetricCategory = 'Yards' | 'YPRR' | 'PFF' | 'First Read' | 'Target Share' | 'MTF' | 'Age'

type MetricConfig = {
  key: string
  label: string
  aliases: string[]
  weight: number
  category: MetricCategory
  higherIsBetter?: boolean
  scoreType?: 'percentrank' | 'age'
}

type RawRow = Record<string, any>

type RawPlayer = {
  player_key: string
  player_name: string
  team: string | null
  position: PlayerPosition
  season: string
  age: number | null
  raw_metrics: Record<string, number | null>
}

export type PlayerScoreSeasonRow = RawPlayer & {
  feature_scores: Record<string, number>
  category_scores: Record<string, number>
  final_score: number
  rank: number
  updated_at: string
}

export type StoredPlayerScoreRow = PlayerScoreSeasonRow & {
  id?: string
}

export type CombinedPlayerScoreRow = StoredPlayerScoreRow & {
  seasons_used: string[]
  season_scores: Record<string, number>
  recency_multiplier: number
}

export const YEAR_WEIGHTS = [0.65, 0.25, 0.1]

const POSITION_CONFIGS: Record<PlayerPosition, MetricConfig[]> = {
  WR: [
    metric('Yards', 'Yards', ['YDS', 'Yards', 'Receiving Yards'], 0.45, 'Yards'),
    metric('YPRR', 'YPRR', ['YPRR'], 0.25, 'YPRR'),
    metric('PFFReceivingGrade', 'PFF', ['Receiving_Grade', 'Receiving Grade', 'grades_pass_route', 'PFF Grade', 'PFF'], 0.15, 'PFF'),
    metric('FirstReadShare', 'First Read %', ['1READ %', '1Read %', 'First Read %', 'First Rd %'], 0.1, 'First Read'),
    metric('TargetShare', 'Target Share', ['TGT %', 'TGT%', 'Target Share', 'TargetShare'], 0.05, 'Target Share'),
    ageMetric(),
  ],

  // These are intentionally placeholders so the upload/page is position-flexible.
  // You can tune these when you have your TE/QB/RB raw sheets finalized.
  TE: [
    metric('Yards', 'Yards', ['YDS', 'Yards', 'Receiving Yards'], 0.45, 'Yards'),
    metric('YPRR', 'YPRR', ['YPRR'], 0.25, 'YPRR'),
    metric('PFFReceivingGrade', 'PFF', ['Receiving_Grade', 'Receiving Grade', 'grades_pass_route', 'PFF Grade', 'PFF'], 0.15, 'PFF'),
    metric('FirstReadShare', 'First Read %', ['1READ %', '1Read %', 'First Read %', 'First Rd %'], 0.1, 'First Read'),
    metric('MTFPerRec', 'MTF/REC', ['MTF/REC', 'MTF Per Rec'], 0.05, 'MTF'),
    ageMetric(),
  ],
  RB: [
    metric('Yards', 'Yards', ['YDS', 'Yards', 'Rush YDS', 'Rushing Yards'], 0.45, 'Yards'),
    metric('YPRR', 'YPRR', ['YPRR'], 0.25, 'YPRR'),
    metric('PFFGrade', 'PFF', ['PFF Grade', 'Rushing_Grade', 'Receiving_Grade', 'Receiving Grade'], 0.15, 'PFF'),
    metric('FirstReadShare', 'First Read %', ['1READ %', '1Read %', 'First Read %', 'First Rd %'], 0.1, 'First Read'),
    metric('MTFPerRec', 'MTF/REC', ['MTF/REC', 'MTF Per Rec', 'MTF/ATT', 'MTF/Touch'], 0.05, 'MTF'),
    ageMetric(),
  ],
  QB: [
    metric('Yards', 'Yards', ['YDS', 'Yards', 'Pass YDS', 'Passing Yards'], 0.45, 'Yards'),
    metric('YPRR', 'YPRR/YPA', ['YPRR', 'YPA', 'YPT'], 0.25, 'YPRR'),
    metric('PFFGrade', 'PFF', ['PFF Grade', 'Passing_Grade', 'Passing Grade', 'grades_pass'], 0.15, 'PFF'),
    metric('FirstReadShare', 'First Read %', ['1READ %', '1Read %', 'First Read %', 'First Rd %'], 0.1, 'First Read'),
    metric('MTFPerRec', 'MTF/Rush', ['MTF/REC', 'MTF/ATT', 'MTF/Touch'], 0.05, 'MTF'),
    ageMetric(),
  ],
}

const IGNORED_CALCULATED_COLUMNS = new Set([
  'yards%',
  'yprr%',
  'mtf%',
  'targetshare%',
  'firstrd%',
  'pff%',
  'rawscore',
])

function metric(
  key: string,
  label: string,
  aliases: string[],
  weight: number,
  category: MetricCategory,
  higherIsBetter = true
): MetricConfig {
  return { key, label, aliases, weight, category, higherIsBetter, scoreType: 'percentrank' }
}

function ageMetric(): MetricConfig {
  return {
    key: 'AgeMultiplier',
    label: 'Age Multiplier',
    aliases: ['Age', 'AgeSeason'],
    weight: 0,
    category: 'Age',
    higherIsBetter: true,
    scoreType: 'age',
  }
}

export async function buildPlayerScoresFromFile({
  file,
  season,
  position,
}: {
  file: File
  season: string
  position: PlayerPosition
}) {
  const rows = await parseUploadedFile(file)
  const configs = POSITION_CONFIGS[position]

  const cleanedRows = rows.map(cleanRow)
  const rawPlayers = cleanedRows
    .map((row) => rowToRawPlayer(row, season, position, configs))
    .filter(Boolean) as RawPlayer[]

  const featureScoresByPlayer = buildFeatureScores(rawPlayers, configs)

  const scoredRows = rawPlayers.map((player) => {
    const feature_scores = featureScoresByPlayer[player.player_key] || {}
    const category_scores = buildCategoryScores(feature_scores, configs)
    const baseMetricScore = weightedMetricScore(feature_scores, configs)
    // Store the raw, non-age-adjusted season score.
    // The age multiplier is intentionally applied only when rankings are viewed
    // on /player-scores, not during upload/storage.
    const finalScore = baseMetricScore * 9999

    return {
      ...player,
      feature_scores,
      category_scores,
      final_score: Math.round(finalScore),
      rank: 0,
      updated_at: new Date().toISOString(),
    }
  })

  const rankedRows = scoredRows
    .sort((a, b) => b.final_score - a.final_score)
    .map((row, index) => ({ ...row, rank: index + 1 }))

  return {
    rows: rankedRows,
    summary: {
      uploadedRows: rows.length,
      eligibleRows: rawPlayers.length,
      scoredRows: rankedRows.length,
      season,
      position,
      missingAgeCount: rankedRows.filter((row) => row.age === null).length,
    },
  }
}

export function buildCombinedRankings({
  rows,
  anchorSeason,
  applyAgeMultiplier = true,
}: {
  rows: StoredPlayerScoreRow[]
  anchorSeason?: string
  applyAgeMultiplier?: boolean
}) {
  const numericSeasons = rows
    .map((row) => Number(row.season))
    .filter((season) => Number.isFinite(season))

  const anchor = Number(anchorSeason) || Math.max(...numericSeasons)
  if (!Number.isFinite(anchor)) return []

  const targetSeasons = [anchor, anchor - 1, anchor - 2].map(String)
  const seasonWeightMap = Object.fromEntries(
    targetSeasons.map((season, index) => [season, YEAR_WEIGHTS[index]])
  )

  const grouped = new Map<string, StoredPlayerScoreRow[]>()
  for (const row of rows) {
    if (!targetSeasons.includes(String(row.season))) continue
    const group = grouped.get(row.player_key) || []
    group.push(row)
    grouped.set(row.player_key, group)
  }

  const combined: CombinedPlayerScoreRow[] = []

  for (const playerRows of grouped.values()) {
    const bySeason = new Map<string, StoredPlayerScoreRow>()
    for (const row of playerRows) bySeason.set(String(row.season), row)

    let weightedTotal = 0
    let weightTotal = 0
    const seasonsUsed: string[] = []
    const seasonScores: Record<string, number> = {}

    for (const season of targetSeasons) {
      const row = bySeason.get(season)
      if (!row) continue
      const weight = seasonWeightMap[season] || 0
      weightedTotal += Number(row.final_score || 0) * weight
      weightTotal += weight
      seasonsUsed.push(season)
      seasonScores[season] = Number(row.final_score || 0)
    }

    if (weightTotal <= 0) continue

    const latestRow = seasonsUsed
      .map((season) => bySeason.get(season))
      .filter(Boolean)[0] as StoredPlayerScoreRow

    const recencyMultiplier = bySeason.has(String(anchor))
      ? 1
      : bySeason.has(String(anchor - 1))
        ? 0.85
        : 0.65

    const baseCombinedScore = (weightedTotal / weightTotal) * recencyMultiplier
    const ageAdjustment = applyAgeMultiplier ? Number(latestRow.category_scores?.Age || 1) : 1

    combined.push({
      ...latestRow,
      id: `${latestRow.player_key}-${anchor}-combined`,
      season: String(anchor),
      seasons_used: seasonsUsed,
      season_scores: seasonScores,
      recency_multiplier: recencyMultiplier,
      final_score: Math.round(baseCombinedScore * ageAdjustment),
      rank: 0,
    })
  }

  return combined
    .sort((a, b) => b.final_score - a.final_score)
    .map((row, index) => ({ ...row, rank: index + 1 }))
}

async function parseUploadedFile(file: File): Promise<RawRow[]> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheetName =
    workbook.SheetNames.find((name) => normalize(name) === 'rawdata') ||
    workbook.SheetNames[0]

  const worksheet = workbook.Sheets[sheetName]
  return XLSX.utils.sheet_to_json<RawRow>(worksheet, { defval: null })
}

function cleanRow(row: RawRow) {
  const cleaned: RawRow = {}

  for (const [key, value] of Object.entries(row)) {
    if (IGNORED_CALCULATED_COLUMNS.has(normalize(key))) continue
    cleaned[key] = value
  }

  return cleaned
}

function rowToRawPlayer(
  row: RawRow,
  selectedSeason: string,
  selectedPosition: PlayerPosition,
  configs: MetricConfig[]
): RawPlayer | null {
  const playerName = getString(row, ['Name', 'Player', 'Player Name', 'full_name'])
  if (!playerName) return null

  const rowPosition = getString(row, ['POS', 'Position'])?.toUpperCase()
  if (rowPosition && rowPosition !== selectedPosition) return null

  const rowSeason = getString(row, ['Season', 'Year'])
  if (rowSeason && String(rowSeason) !== String(selectedSeason)) return null

  const raw_metrics: Record<string, number | null> = {}

  for (const config of configs) {
    if (config.scoreType === 'age') continue
    raw_metrics[config.key] = getNumber(row, config.aliases)
  }

  raw_metrics.Age = getNumber(row, ['Age', 'AgeSeason'])

  const birthDate = getDate(row, ['Birth Date', 'DOB', 'Date of Birth'])
  if (raw_metrics.Age === null && birthDate) {
    raw_metrics.Age = calculateAgeForSeason(birthDate, selectedSeason)
  }

  return {
    player_key: normalizePlayerKey(playerName),
    player_name: playerName,
    team: getString(row, ['Team', 'TM', 'Tm']) || null,
    position: selectedPosition,
    season: selectedSeason,
    age: raw_metrics.Age,
    raw_metrics,
  }
}

function buildFeatureScores(players: RawPlayer[], configs: MetricConfig[]) {
  const result: Record<string, Record<string, number>> = {}

  for (const player of players) result[player.player_key] = {}

  for (const config of configs) {
    if (config.scoreType === 'age') {
      for (const player of players) {
        result[player.player_key].AgeMultiplier = ageMultiplier(player.age)
      }
      continue
    }

    const values = players
      .map((player) => player.raw_metrics[config.key])
      .filter((value) => Number.isFinite(Number(value)))
      .map(Number)

    for (const player of players) {
      const value = player.raw_metrics[config.key]
      if (!Number.isFinite(Number(value)) || values.length < 2) {
        result[player.player_key][config.key] = 0.5
        continue
      }

      const percentile = percentRankInc(values, Number(value))
      result[player.player_key][config.key] = config.higherIsBetter === false ? 1 - percentile : percentile
    }
  }

  return result
}

function buildCategoryScores(
  featureScores: Record<string, number>,
  configs: MetricConfig[]
) {
  const output: Record<string, number> = {}

  for (const config of configs) {
    if (config.scoreType === 'age') {
      output.Age = round2(featureScores.AgeMultiplier ?? 1)
      continue
    }

    const score = featureScores[config.key]
    output[config.category] = round2(Number.isFinite(score) ? score : 0.5)
  }

  return output
}

function weightedMetricScore(featureScores: Record<string, number>, configs: MetricConfig[]) {
  let weightedTotal = 0
  let weightTotal = 0

  for (const config of configs) {
    if (config.scoreType === 'age') continue
    const score = featureScores[config.key]
    if (!Number.isFinite(score)) continue

    weightedTotal += score * config.weight
    weightTotal += config.weight
  }

  return weightTotal > 0 ? weightedTotal / weightTotal : 0.5
}

function percentRankInc(values: number[], target: number) {
  const sorted = [...values].filter(Number.isFinite).sort((a, b) => a - b)
  const n = sorted.length

  if (n <= 1) return 0.5
  if (target <= sorted[0]) return 0
  if (target >= sorted[n - 1]) return 1

  for (let i = 0; i < n - 1; i += 1) {
    const low = sorted[i]
    const high = sorted[i + 1]

    if (target === low) return i / (n - 1)
    if (target > low && target < high) {
      const between = high === low ? 0 : (target - low) / (high - low)
      return (i + between) / (n - 1)
    }
  }

  const exactIndex = sorted.findIndex((value) => value === target)
  return exactIndex >= 0 ? exactIndex / (n - 1) : 0.5
}

function ageMultiplier(age: number | null) {
  if (!Number.isFinite(Number(age))) return 1
  const value = Number(age)

  if (value < 21) return 1.5
  if (value < 23) return 1.25
  if (value < 25) return 1.15
  if (value < 28) return 1
  if (value < 29) return 0.95
  if (value < 31) return 0.9
  if (value < 33) return 0.85
  return 0.75
}

function calculateAgeForSeason(date: Date, season: string) {
  const year = Number(season)
  if (!Number.isFinite(year)) return null

  const seasonDate = new Date(Date.UTC(year, 8, 1))
  let age = seasonDate.getUTCFullYear() - date.getUTCFullYear()
  const beforeBirthday =
    seasonDate.getUTCMonth() < date.getUTCMonth() ||
    (seasonDate.getUTCMonth() === date.getUTCMonth() &&
      seasonDate.getUTCDate() < date.getUTCDate())

  if (beforeBirthday) age -= 1
  return age
}

function getString(row: RawRow, aliases: string[]) {
  for (const alias of aliases) {
    const actualKey = findActualKey(row, alias)
    if (!actualKey) continue
    const value = row[actualKey]
    if (value === null || value === undefined || String(value).trim() === '') continue
    return String(value).trim()
  }
  return ''
}

function getNumber(row: RawRow, aliases: string[]) {
  for (const alias of aliases) {
    const actualKey = findActualKey(row, alias)
    if (!actualKey) continue

    const value = row[actualKey]
    if (value === null || value === undefined || value === '') continue

    if (typeof value === 'number' && Number.isFinite(value)) return value

    const cleaned = String(value).replace(/[$,%]/g, '').trim()
    const parsed = Number(cleaned)
    if (Number.isFinite(parsed)) return parsed
  }

  return null
}

function getDate(row: RawRow, aliases: string[]) {
  for (const alias of aliases) {
    const actualKey = findActualKey(row, alias)
    if (!actualKey) continue
    const value = row[actualKey]

    if (value instanceof Date && !Number.isNaN(value.getTime())) return value
    if (typeof value === 'number') {
      const parsed = XLSX.SSF.parse_date_code(value)
      if (parsed) return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d))
    }

    const parsed = new Date(String(value))
    if (!Number.isNaN(parsed.getTime())) return parsed
  }

  return null
}

function findActualKey(row: RawRow, alias: string) {
  const wanted = normalize(alias)
  return Object.keys(row).find((key) => normalize(key) === wanted)
}

function normalize(value: string) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function normalizePlayerKey(value: string) {
  return normalize(value)
}

function round2(value: number) {
  return Math.round(value * 100) / 100
}
