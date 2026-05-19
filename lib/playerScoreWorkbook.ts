import * as XLSX from 'xlsx'

export type PlayerPosition = 'WR' | 'TE' | 'QB' | 'RB'

type RawCell = string | number | boolean | Date | null | undefined

type RawRow = Record<string, RawCell>

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

export type WorkbookParseResult = {
  rows: ParsedRankingRow[]
  summary: {
    workbookSheets: string[]
    rawRowsRead: number
    finalRankingRowsRead: number
    rowsStored: number
    rawDataSheet: string | null
    finalRankingsSheet: string | null
  }
}

const RAW_DATA_SHEET_NAMES = ['raw data', 'rawdata', 'data']
const FINAL_RANKINGS_SHEET_NAMES = ['final rankings', 'final ranking', 'rankings']

const RAW_DATA_SHEET_KEYS = RAW_DATA_SHEET_NAMES.map(normalizeHeader)
const FINAL_RANKINGS_SHEET_KEYS = FINAL_RANKINGS_SHEET_NAMES.map(normalizeHeader)

const CORE_STAT_KEYS = [
  'G',
  'Season',
  'YDS',
  'RecYDS/G',
  'TM YDS %',
  'YPRR',
  'Receiving_Grade',
  '1READ %',
  'MTF/REC',
  'TGT',
  'TGT/G',
  'TGT %',
  'TPRR',
  'REC',
  'TD',
  'FP/G',
  'Birth Date',
]

export async function parsePlayerScoreWorkbook({
  file,
  position,
}: {
  file: File
  position: PlayerPosition
}): Promise<WorkbookParseResult> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, {
    type: 'array',
    cellDates: true,
    cellFormula: true,
    cellNF: false,
    cellStyles: false,
  })

  const rawDataSheetName = findSheetName(workbook, RAW_DATA_SHEET_KEYS)
  const finalRankingsSheetName = findSheetName(workbook, FINAL_RANKINGS_SHEET_KEYS)

  if (!finalRankingsSheetName) {
    throw new Error(
      `Could not find a "Final Rankings" sheet in this workbook. Found sheets: ${workbook.SheetNames.join(', ') || 'none'}.`
    )
  }

  const rawRows = rawDataSheetName
    ? sheetToObjects(workbook.Sheets[rawDataSheetName])
    : []

  const rawRowsByPlayer = groupRawRowsByPlayer(rawRows)
  const finalRows = extractFinalRankings(workbook.Sheets[finalRankingsSheetName])

  if (!finalRows.length) {
    throw new Error('No player rankings were found on the Final Rankings sheet.')
  }

  const rows: ParsedRankingRow[] = finalRows.map((ranking, index) => {
    const playerKey = normalizePlayerKey(ranking.player_name)
    const playerRawRows = rawRowsByPlayer.get(playerKey) || []
    const sortedRawRows = sortRowsBySeasonDesc(playerRawRows)
    const latestRawRow = sortedRawRows[0] || null
    const team = getString(latestRawRow || {}, ['Team', 'Tm']) || null
    const seasonsPlayed = Array.from(
      new Set(
        sortedRawRows
          .map((row) => getString(row, ['Season', 'Year']))
          .filter((value): value is string => Boolean(value))
      )
    )

    return {
      player_key: playerKey,
      player_name: ranking.player_name,
      team,
      position,
      rank: ranking.rank || index + 1,
      rank_label: ranking.rank_label,
      score: Math.round(ranking.score),
      latest_season: seasonsPlayed[0] || null,
      seasons_played: seasonsPlayed,
      advanced_stats: buildAdvancedStats({
        ranking,
        rawRows: sortedRawRows,
        latestRawRow,
      }),
    }
  })

  return {
    rows,
    summary: {
      workbookSheets: workbook.SheetNames,
      rawRowsRead: rawRows.length,
      finalRankingRowsRead: finalRows.length,
      rowsStored: rows.length,
      rawDataSheet: rawDataSheetName || null,
      finalRankingsSheet: finalRankingsSheetName || null,
    },
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
    raw: false,
    blankrows: false,
  })

  return rows
    .map((row) => normalizeRowValues(row))
    .filter((row) => Boolean(getString(row, ['Name', 'Player', 'Player Name'])))
}

function extractFinalRankings(sheet: XLSX.WorkSheet) {
  const matrix = XLSX.utils.sheet_to_json<any[]>(sheet, {
    header: 1,
    defval: null,
    raw: false,
    blankrows: false,
  })

  const sortedRankingRows = matrix
    .slice(1)
    .map((row, index) => {
      const playerName = cleanString(row[3])
      const score = toNumber(row[4])
      const rankLabel = cleanString(row[5])
      const parsedRank = parseRank(rankLabel) || index + 1

      return playerName && Number.isFinite(score)
        ? {
            player_name: playerName,
            score: Number(score),
            rank: parsedRank,
            rank_label: rankLabel || null,
          }
        : null
    })
    .filter(Boolean) as Array<{
      player_name: string
      score: number
      rank: number
      rank_label: string | null
    }>

  if (sortedRankingRows.length) return sortedRankingRows

  return matrix
    .slice(1)
    .map((row, index) => {
      const playerName = cleanString(row[0])
      const score = toNumber(row[1])

      return playerName && Number.isFinite(score)
        ? {
            player_name: playerName,
            score: Number(score),
            rank: index + 1,
            rank_label: null,
          }
        : null
    })
    .filter(Boolean) as Array<{
      player_name: string
      score: number
      rank: number
      rank_label: string | null
    }>
}

function groupRawRowsByPlayer(rows: RawRow[]) {
  const map = new Map<string, RawRow[]>()

  for (const row of rows) {
    const playerName = getString(row, ['Name', 'Player', 'Player Name'])
    if (!playerName) continue

    const key = normalizePlayerKey(playerName)
    if (!map.has(key)) map.set(key, [])
    map.get(key)?.push(row)
  }

  return map
}

function sortRowsBySeasonDesc(rows: RawRow[]) {
  return [...rows].sort((a, b) => {
    const seasonA = Number(getString(a, ['Season', 'Year']) || 0)
    const seasonB = Number(getString(b, ['Season', 'Year']) || 0)
    return seasonB - seasonA
  })
}

function buildAdvancedStats({
  ranking,
  rawRows,
  latestRawRow,
}: {
  ranking: { player_name: string; score: number; rank: number; rank_label: string | null }
  rawRows: RawRow[]
  latestRawRow: RawRow | null
}) {
  const latestCoreStats = pickStats(latestRawRow || {}, CORE_STAT_KEYS)
  const seasonStats = rawRows.map((row) => ({
    season: getString(row, ['Season', 'Year']),
    team: getString(row, ['Team', 'Tm']),
    stats: normalizeRowValues(row),
    core: pickStats(row, CORE_STAT_KEYS),
  }))

  return {
    finalRanking: ranking,
    latestCoreStats,
    seasonStats,
    rawRows: rawRows.map((row) => normalizeRowValues(row)),
  }
}

function pickStats(row: RawRow, keys: string[]) {
  const result: Record<string, any> = {}

  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
      result[key] = serializeValue(row[key])
    }
  }

  return result
}

function normalizeRowValues(row: RawRow) {
  const normalized: Record<string, any> = {}

  for (const [key, value] of Object.entries(row)) {
    const cleanedKey = cleanString(key)
    if (!cleanedKey) continue
    normalized[cleanedKey] = serializeValue(value)
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

function getString(row: Record<string, any>, aliases: string[]) {
  for (const alias of aliases) {
    const direct = row[alias]
    if (direct !== undefined && direct !== null && cleanString(direct)) return cleanString(direct)

    const matchedKey = Object.keys(row).find((key) => normalizeHeader(key) === normalizeHeader(alias))
    if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null) {
      const value = cleanString(row[matchedKey])
      if (value) return value
    }
  }

  return ''
}

function parseRank(value: string) {
  const match = value.match(/(\d+)/)
  return match ? Number(match[1]) : null
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
