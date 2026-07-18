import * as XLSX from 'xlsx'

export type PlayerPosition = 'WR' | 'TE' | 'QB' | 'RB'

type RawCell = string | number | boolean | Date | null | undefined
export type RawRow = Record<string, RawCell>

export type ParsedRankingRow = {
  player_key: string
  player_name: string
  team: string | null
  position: PlayerPosition
  rank: number
  rank_label: string | null
  score: number
  latest_season: string | null
  seasons_played: string[]
  advanced_stats: Record<string, any>
}

export type PlayerScoreWeights = {
  metricWeights: {
    yprr: number
    pff: number
    yards: number
    firstRead: number
    targetShare: number
  }
  seasonWeights: {
    current: number
    previous: number
    twoAgo: number
  }
  ageMultipliers: Array<{ age: number; multiplier: number }>
  missingSeasonScore: number
  eliteThreshold: number
  eliteBoost: number
  eliteDecay: {
    current: number
    previous: number
    twoAgo: number
  }
  ageBoostCap: number
  maxScore: number
}

export type WorkbookParseResult = {
  rows: ParsedRankingRow[]
  rawRows: Record<string, any>[]
  weights: PlayerScoreWeights
  summary: {
    workbookSheets: string[]
    rawRowsRead: number
    finalRankingRowsRead: number
    rowsStored: number
    rawDataSheet: string | null
    finalRankingsSheet: string | null
    calculatedFromRawData: boolean
    seasons: string[]
    weights: PlayerScoreWeights
  }
}

const RAW_DATA_SHEET_NAMES = ['raw data', 'rawdata', 'data']
const RAW_DATA_SHEET_KEYS = RAW_DATA_SHEET_NAMES.map(normalizeHeader)

function isNonEmptyString(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

const CORE_STAT_KEYS = [
  'G',
  'Season',
  'Year',
  'Team',
  'POS',
  'YDS',
  'RecYDS/G',
  'TM YDS %',
  'YPRR',
  'Receiving_Grade',
  '1READ %',
  'TGT',
  'TGT/G',
  'TGT %',
  'TPRR',
  'REC',
  'TD',
  'FP/G',
  'Raw Score',
  'Birth Date',
]

export const DEFAULT_PLAYER_SCORE_WEIGHTS: PlayerScoreWeights = {
  metricWeights: {
    yprr: 0.25,
    pff: 0.15,
    yards: 0.45,
    firstRead: 0.1,
    targetShare: 0.05,
  },
  seasonWeights: {
    current: 0.6,
    previous: 0.25,
    twoAgo: 0.15,
  },
  ageMultipliers: [
    { age: 19, multiplier: 1.5 },
    { age: 21, multiplier: 1.075 },
    { age: 23, multiplier: 1.05 },
    { age: 25, multiplier: 1 },
    { age: 28, multiplier: 0.95 },
    { age: 29, multiplier: 0.9 },
    { age: 31, multiplier: 0.85 },
    { age: 33, multiplier: 0.75 },
  ],
  missingSeasonScore: 3500,
  eliteThreshold: 9000,
  eliteBoost: 0.08,
  eliteDecay: {
    current: 1,
    previous: 0.7,
    twoAgo: 0.4,
  },
  ageBoostCap: 500,
  maxScore: 9999,
}

const METRIC_ALIASES = {
  yards: ['RecYDS/G', 'Receiving Yards/G', 'Yards/G', 'YDS'],
  yprr: ['YPRR'],
  targetShare: ['TGT %', 'TGT%', 'Target Share', 'TargetShare'],
  firstRead: ['1READ %', '1Read %', 'First Read %', 'First Rd %'],
  pff: ['Receiving_Grade', 'Receiving Grade', 'grades_pass_route', 'PFF Grade', 'PFF'],
}

export async function parsePlayerScoreWorkbook({
  file,
  position,
  weights,
}: {
  file: File
  position: PlayerPosition
  weights?: Partial<PlayerScoreWeights>
}): Promise<WorkbookParseResult> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, {
    type: 'array',
    cellDates: true,
    cellFormula: false,
    cellNF: false,
    cellStyles: false,
  })

  const rawDataSheetName = findSheetName(workbook, RAW_DATA_SHEET_KEYS) || workbook.SheetNames[0]

  if (!rawDataSheetName) {
    throw new Error('No sheets were found in this workbook.')
  }

  const rawRows = sheetToObjects(workbook.Sheets[rawDataSheetName])

  return buildPlayerScoresFromRawRows({
    rawRows,
    position,
    weights,
    workbookSheets: workbook.SheetNames,
    rawDataSheetName,
  })
}

export function buildPlayerScoresFromRawRows({
  rawRows,
  position,
  weights,
  workbookSheets = [],
  rawDataSheetName = null,
}: {
  rawRows: RawRow[] | Record<string, any>[]
  position: PlayerPosition
  weights?: Partial<PlayerScoreWeights>
  workbookSheets?: string[]
  rawDataSheetName?: string | null
}): WorkbookParseResult {
  const mergedWeights = mergeWeights(weights)
  const cleanedRows = (rawRows || [])
    .map((row) => normalizeRowValues(row as RawRow))
    .filter((row) => Boolean(getString(row, ['Name', 'Player', 'Player Name'])))
    .filter((row) => {
      const rowPosition = getString(row, ['POS', 'Position']).toUpperCase()
      return !rowPosition || rowPosition === position
    })

  if (!cleanedRows.length) {
    throw new Error('No matching raw-data player rows were found for this position.')
  }

  const rowsWithSeasonScores = calculateSeasonRawScores(cleanedRows, mergedWeights)
  const rowsByPlayer = groupRawRowsByPlayer(rowsWithSeasonScores)
  const seasons: string[] = Array.from(
    new Set(
      rowsWithSeasonScores
        .map((row) => getSeason(row))
        .filter(isNonEmptyString)
    )
  ).sort((a, b) => Number(b) - Number(a))

  const targetSeasons: string[] = seasons.slice(0, 3)
  const rows: ParsedRankingRow[] = []

  for (const [playerKey, playerRows] of rowsByPlayer.entries()) {
    const sortedRawRows = sortRowsBySeasonDesc(playerRows)
    const latestRawRow = sortedRawRows[0] || null
    const playerName = getString(latestRawRow || {}, ['Name', 'Player', 'Player Name'])
    if (!playerName) continue

    const seasonScoreBySeason = new Map<string, number>()
    for (const row of sortedRawRows) {
      const season = getSeason(row)
      if (!season) continue
      seasonScoreBySeason.set(season, toFiniteNumber(row['Raw Score']) ?? 0)
    }

    const finalScore = calculateFinalScore({
      targetSeasons,
      seasonScoreBySeason,
      birthDate: getDate(latestRawRow || {}, ['Birth Date', 'DOB', 'Date of Birth']),
      weights: mergedWeights,
    })

    const seasonsPlayed = sortedRawRows
      .map((row) => getSeason(row))
      .filter((value): value is string => Boolean(value))

    rows.push({
      player_key: playerKey,
      player_name: playerName,
      team: getString(latestRawRow || {}, ['Team', 'Tm']) || null,
      position,
      rank: 0,
      rank_label: null,
      score: finalScore,
      latest_season: seasonsPlayed[0] || null,
      seasons_played: Array.from(new Set(seasonsPlayed)),
      advanced_stats: buildAdvancedStats({
        rawRows: sortedRawRows,
        latestRawRow,
        score: finalScore,
      }),
    })
  }

  const rankedRows = rows
    .sort((a, b) => b.score - a.score || a.player_name.localeCompare(b.player_name))
    .map((row, index) => ({
      ...row,
      rank: index + 1,
      rank_label: `${position} ${index + 1}`,
      advanced_stats: {
        ...row.advanced_stats,
        finalRanking: {
          player_name: row.player_name,
          score: row.score,
          rank: index + 1,
          rank_label: `${position} ${index + 1}`,
        },
      },
    }))

  return {
    rows: rankedRows,
    rawRows: rowsWithSeasonScores.map((row) => normalizeRowValues(row)),
    weights: mergedWeights,
    summary: {
      workbookSheets,
      rawRowsRead: cleanedRows.length,
      finalRankingRowsRead: 0,
      rowsStored: rankedRows.length,
      rawDataSheet: rawDataSheetName,
      finalRankingsSheet: null,
      calculatedFromRawData: true,
      seasons: targetSeasons,
      weights: mergedWeights,
    },
  }
}

function calculateSeasonRawScores(rows: Record<string, any>[], weights: PlayerScoreWeights) {
  const rowsBySeason = new Map<string, Record<string, any>[]>()

  for (const row of rows) {
    const season = getSeason(row) || 'unknown'
    const group = rowsBySeason.get(season) || []
    group.push(row)
    rowsBySeason.set(season, group)
  }

  const output: Record<string, any>[] = []

  for (const seasonRows of rowsBySeason.values()) {
    const metricPercentiles = new Map<string, Map<Record<string, any>, number>>()

    for (const [metricKey, aliases] of Object.entries(METRIC_ALIASES)) {
      const values = seasonRows
        .map((row) => getNumber(row, aliases))
        .filter((value): value is number => Number.isFinite(value))

      const byRow = new Map<Record<string, any>, number>()
      for (const row of seasonRows) {
        const value = getNumber(row, aliases)
        byRow.set(row, Number.isFinite(value) && values.length > 1 ? percentRankInc(values, Number(value)) : 0.5)
      }
      metricPercentiles.set(metricKey, byRow)
    }

    for (const row of seasonRows) {
      const yprrPct = metricPercentiles.get('yprr')?.get(row) ?? 0.5
      const pffPct = metricPercentiles.get('pff')?.get(row) ?? 0.5
      const yardsPct = metricPercentiles.get('yards')?.get(row) ?? 0.5
      const firstReadPct = metricPercentiles.get('firstRead')?.get(row) ?? 0.5
      const targetSharePct = metricPercentiles.get('targetShare')?.get(row) ?? 0.5

      const metricWeights = weights.metricWeights
      const totalWeight =
        metricWeights.yprr +
        metricWeights.pff +
        metricWeights.yards +
        metricWeights.firstRead +
        metricWeights.targetShare

      const weightedPercentile = totalWeight > 0
        ? (
            yprrPct * metricWeights.yprr +
            pffPct * metricWeights.pff +
            yardsPct * metricWeights.yards +
            firstReadPct * metricWeights.firstRead +
            targetSharePct * metricWeights.targetShare
          ) / totalWeight
        : 0.5

      output.push({
        ...row,
        'Yards %': round4(yardsPct),
        'YPRR %': round4(yprrPct),
        'Target Share %': round4(targetSharePct),
        'First Rd %': round4(firstReadPct),
        'PFF %': round4(pffPct),
        'Raw Score': round2(weightedPercentile * 9999),
      })
    }
  }

  return output
}

function calculateFinalScore({
  targetSeasons,
  seasonScoreBySeason,
  birthDate,
  weights,
}: {
  targetSeasons: string[]
  seasonScoreBySeason: Map<string, number>
  birthDate: Date | null
  weights: PlayerScoreWeights
}) {
  const currentSeason = targetSeasons[0]
  const previousSeason = targetSeasons[1]
  const twoAgoSeason = targetSeasons[2]

  const hasCurrent = isNonEmptyString(currentSeason) && seasonScoreBySeason.has(currentSeason)
  const hasPrevious = isNonEmptyString(previousSeason) && seasonScoreBySeason.has(previousSeason)
  const hasTwoAgo = isNonEmptyString(twoAgoSeason) && seasonScoreBySeason.has(twoAgoSeason)

  const getSeasonScore = (season: string | undefined) => {
    if (!isNonEmptyString(season)) return 0
    return Number(seasonScoreBySeason.get(season) ?? 0)
  }

  const currentScore = getSeasonScore(currentSeason)
  const previousScore = getSeasonScore(previousSeason)
  const twoAgoScore = getSeasonScore(twoAgoSeason)

  // Rookie handling:
  // - 2025 rookie: has current year, but no previous/two-ago seasons. Only current counts.
  // - 2024 rookie: has previous year, but no two-ago season. Current + previous count.
  // - Non-rookies: all 3 season slots count. Missing seasons are filled below.
  const isCurrentSeasonRookie = hasCurrent && !hasPrevious && !hasTwoAgo
  const isPreviousSeasonRookie = hasPrevious && !hasTwoAgo

  const includedSeasonSlots: Array<{ hasSeason: boolean; score: number; weight: number }> = isCurrentSeasonRookie
    ? [
        {
          hasSeason: hasCurrent,
          score: currentScore,
          weight: weights.seasonWeights.current,
        },
      ]
    : isPreviousSeasonRookie
      ? [
          {
            hasSeason: hasCurrent,
            score: currentScore,
            weight: weights.seasonWeights.current,
          },
          {
            hasSeason: hasPrevious,
            score: previousScore,
            weight: weights.seasonWeights.previous,
          },
        ]
      : [
          {
            hasSeason: hasCurrent,
            score: currentScore,
            weight: weights.seasonWeights.current,
          },
          {
            hasSeason: hasPrevious,
            score: previousScore,
            weight: weights.seasonWeights.previous,
          },
          {
            hasSeason: hasTwoAgo,
            score: twoAgoScore,
            weight: weights.seasonWeights.twoAgo,
          },
        ]

  const realSeasonScores = includedSeasonSlots
    .filter((slot) => slot.hasSeason && Number.isFinite(slot.score))
    .map((slot) => slot.score)

  // For non-rookies with 2 real seasons, fill the missed season with the average
  // of the 2 real seasons. For non-rookies with only 1 real season, use the
  // configurable missingSeasonScore, which defaults to 3500.
  const missingScore = realSeasonScores.length >= 2
    ? realSeasonScores.reduce((total, score) => total + score, 0) / realSeasonScores.length
    : weights.missingSeasonScore

  const denominator = includedSeasonSlots.reduce((total, slot) => total + slot.weight, 0)
  const weightedScoreTotal = includedSeasonSlots.reduce((total, slot) => (
    total + (slot.hasSeason ? slot.score : missingScore) * slot.weight
  ), 0)

  const baseScore = realSeasonScores.length > 0 && denominator > 0
    ? weightedScoreTotal / denominator
    : 0

  const currentRealScore = hasCurrent ? currentScore : null
  const previousRealScore = hasPrevious ? previousScore : null
  const twoAgoRealScore = hasTwoAgo ? twoAgoScore : null

  const eliteMultiplier = 1 + Math.max(
    currentRealScore !== null && currentRealScore > weights.eliteThreshold ? weights.eliteBoost * weights.eliteDecay.current : 0,
    previousRealScore !== null && previousRealScore > weights.eliteThreshold ? weights.eliteBoost * weights.eliteDecay.previous : 0,
    twoAgoRealScore !== null && twoAgoRealScore > weights.eliteThreshold ? weights.eliteBoost * weights.eliteDecay.twoAgo : 0
  )

  const preAgeScore = baseScore * eliteMultiplier
  const ageMultiplier = getAgeMultiplier(birthDate, weights.ageMultipliers)
  const ageAdjustedScore = ageMultiplier > 1
    ? Math.min(preAgeScore * ageMultiplier, preAgeScore + weights.ageBoostCap)
    : preAgeScore * ageMultiplier

  return Math.min(weights.maxScore, Math.round(ageAdjustedScore))
}

function buildAdvancedStats({
  rawRows,
  latestRawRow,
  score,
}: {
  rawRows: Record<string, any>[]
  latestRawRow: Record<string, any> | null
  score: number
}) {
  const latestCoreStats = pickStats(latestRawRow || {}, CORE_STAT_KEYS)
  const seasonStats = rawRows.map((row) => ({
    season: getSeason(row),
    team: getString(row, ['Team', 'Tm']),
    stats: normalizeRowValues(row),
    core: pickStats(row, CORE_STAT_KEYS),
  }))

  return {
    finalRanking: {
      player_name: getString(latestRawRow || {}, ['Name', 'Player', 'Player Name']),
      score,
      rank: 0,
      rank_label: null,
    },
    latestCoreStats,
    seasonStats,
    rawRows: rawRows.map((row) => normalizeRowValues(row)),
  }
}

function findSheetName(workbook: XLSX.WorkBook, normalizedNames: string[]) {
  return (
    workbook.SheetNames.find((sheetName) =>
      normalizedNames.includes(normalizeHeader(sheetName))
    ) || null
  )
}

function sheetToObjects(sheet: XLSX.WorkSheet): RawRow[] {
  const rows = XLSX.utils.sheet_to_json<RawRow>(sheet, {
    defval: null,
    raw: true,
    blankrows: false,
  })

  return rows.map((row) => normalizeRowValues(row))
}

function groupRawRowsByPlayer(rows: Record<string, any>[]) {
  const map = new Map<string, Record<string, any>[]>()

  for (const row of rows) {
    const playerName = getString(row, ['Name', 'Player', 'Player Name'])
    if (!playerName) continue

    const key = normalizePlayerKey(playerName)
    if (!map.has(key)) map.set(key, [])
    map.get(key)?.push(row)
  }

  return map
}

function sortRowsBySeasonDesc(rows: Record<string, any>[]) {
  return [...rows].sort((a, b) => Number(getSeason(b) || 0) - Number(getSeason(a) || 0))
}

function pickStats(row: Record<string, any>, keys: string[]) {
  const result: Record<string, any> = {}

  for (const key of keys) {
    const value = getValue(row, [key])
    if (value !== undefined && value !== null && value !== '') result[key] = serializeValue(value)
  }

  return result
}

function normalizeRowValues(row: RawRow | Record<string, any>) {
  const normalized: Record<string, any> = {}

  for (const [key, value] of Object.entries(row || {})) {
    const cleanedKey = cleanString(key)
    if (!cleanedKey) continue
    normalized[cleanedKey] = serializeValue(value as RawCell)
  }

  return normalized
}

function serializeValue(value: RawCell) {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'boolean') return value

  const cleaned = cleanString(value)
  if (cleaned === '') return null

  const numeric = toNumber(cleaned)
  if (Number.isFinite(numeric) && /^-?\d+(\.\d+)?$/.test(cleaned.replace(/,/g, ''))) {
    return numeric
  }

  return cleaned
}

function getSeason(row: Record<string, any>) {
  const value = getString(row, ['Year', 'Season'])
  return value || null
}

function getString(row: Record<string, any>, aliases: string[]) {
  const value = getValue(row, aliases)
  if (value === undefined || value === null) return ''
  return cleanString(value)
}

function getNumber(row: Record<string, any>, aliases: string[]) {
  const value = getValue(row, aliases)
  return toFiniteNumber(value)
}

function getDate(row: Record<string, any>, aliases: string[]) {
  const value = getValue(row, aliases)
  if (value === undefined || value === null || value === '') return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (parsed) return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d))
  }
  const parsed = new Date(String(value))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function getValue(row: Record<string, any>, aliases: string[]) {
  for (const alias of aliases) {
    const direct = row[alias]
    if (direct !== undefined && direct !== null && cleanString(direct) !== '') return direct

    const matchedKey = Object.keys(row).find((key) => normalizeHeader(key) === normalizeHeader(alias))
    if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null) {
      return row[matchedKey]
    }
  }

  return undefined
}

function toFiniteNumber(value: any) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (value === null || value === undefined) return null
  const cleaned = String(value).replace(/[$,%]/g, '').replace(/,/g, '').trim()
  if (!cleaned) return null
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
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

function getAgeMultiplier(birthDate: Date | null, multipliers: Array<{ age: number; multiplier: number }>) {
  if (!birthDate) return 1

  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const beforeBirthday =
    today.getMonth() < birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())
  if (beforeBirthday) age -= 1

  const sorted = [...multipliers].sort((a, b) => a.age - b.age)
  let match = sorted[0]

  for (const item of sorted) {
    if (age >= item.age) match = item
  }

  return Number(match?.multiplier || 1)
}

function mergeWeights(weights?: Partial<PlayerScoreWeights>): PlayerScoreWeights {
  const fallback = DEFAULT_PLAYER_SCORE_WEIGHTS
  return {
    metricWeights: {
      yprr: Number(weights?.metricWeights?.yprr ?? fallback.metricWeights.yprr),
      pff: Number(weights?.metricWeights?.pff ?? fallback.metricWeights.pff),
      yards: Number(weights?.metricWeights?.yards ?? fallback.metricWeights.yards),
      firstRead: Number(weights?.metricWeights?.firstRead ?? fallback.metricWeights.firstRead),
      targetShare: Number(
        weights?.metricWeights?.targetShare ??
        (weights?.metricWeights as any)?.mtfPerRec ??
        fallback.metricWeights.targetShare
      ),
    },
    seasonWeights: {
      ...fallback.seasonWeights,
      ...(weights?.seasonWeights || {}),
    },
    ageMultipliers: weights?.ageMultipliers?.length ? weights.ageMultipliers : fallback.ageMultipliers,
    missingSeasonScore: Number(weights?.missingSeasonScore ?? fallback.missingSeasonScore),
    eliteThreshold: Number(weights?.eliteThreshold ?? fallback.eliteThreshold),
    eliteBoost: Number(weights?.eliteBoost ?? fallback.eliteBoost),
    eliteDecay: {
      ...fallback.eliteDecay,
      ...(weights?.eliteDecay || {}),
    },
    ageBoostCap: Number(weights?.ageBoostCap ?? fallback.ageBoostCap),
    maxScore: Number(weights?.maxScore ?? fallback.maxScore),
  }
}

function toNumber(value: any) {
  if (typeof value === 'number') return value
  if (value === null || value === undefined) return NaN
  const cleaned = String(value).replace(/,/g, '').trim()
  if (!cleaned) return NaN
  return Number(cleaned)
}

function cleanString(value: any) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function normalizeHeader(value: string) {
  return cleanString(value).toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function normalizePlayerKey(name: string) {
  return cleanString(name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function round2(value: number) {
  return Math.round(value * 100) / 100
}

function round4(value: number) {
  return Math.round(value * 10000) / 10000
}
