export type PlayerSeasonStatRow = {
  season: string | null
  team: string | null
  stats: Record<string, any>
  core: Record<string, any>
}

export type PlayerScoreRow = {
  id: string
  upload_id?: string
  player_key?: string
  player_name: string
  team: string | null
  position: string
  rank: number
  rank_label: string | null
  score: number
  latest_season: string | null
  seasons_played: string[]
  advanced_stats: {
    finalRanking?: {
      player_name: string
      score: number
      rank: number
      rank_label: string | null
    }
    latestCoreStats?: Record<string, any>
    seasonStats?: PlayerSeasonStatRow[]
    rawRows?: Record<string, any>[]
  }
}

export type RouteVolume = {
  routes: number | null
  source: 'column' | 'derived' | null
}

const ROUTE_ALIASES = [
  'Routes',
  'Route',
  'Routes Run',
  'Route Run',
  'Route Runs',
  'Routes_Run',
  'RoutesRun',
  'Receiving Routes',
  'Receiving_Routes',
  'Pass Routes',
  'Pass Routes Run',
  'routes',
  'routes_run',
  'route_run',
]

export function getPlayerSeasonRows(player: PlayerScoreRow) {
  return [...(player.advanced_stats?.seasonStats || [])].sort(
    (a, b) => Number(b.season || 0) - Number(a.season || 0),
  )
}

export function getPlayerSeasonRow(player: PlayerScoreRow, season?: string | null) {
  const rows = getPlayerSeasonRows(player)
  if (!season) return rows[0] || null
  return rows.find((row) => String(row.season || '') === String(season)) || rows[0] || null
}

export function getStatValue(row: PlayerSeasonStatRow | null, aliases: string[]) {
  if (!row) return undefined
  return findValue(row.stats || {}, aliases) ?? findValue(row.core || {}, aliases)
}

export function findValue(record: Record<string, any>, aliases: string[]) {
  for (const alias of aliases) {
    const direct = record?.[alias]
    if (hasValue(direct)) return direct

    const normalizedAlias = normalizeKey(alias)
    const matchingKey = Object.keys(record || {}).find((key) => normalizeKey(key) === normalizedAlias)
    if (matchingKey && hasValue(record[matchingKey])) return record[matchingKey]
  }

  return undefined
}

export function toStatNumber(value: any) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null

  const parsed = Number(String(value).replace(/[$,%]/g, '').replace(/,/g, '').trim())
  return Number.isFinite(parsed) ? parsed : null
}

export function normalizeRate(value: number | null) {
  if (value === null) return null
  return Math.abs(value) > 1.5 ? value / 100 : value
}

export function getRouteVolume(row: PlayerSeasonStatRow | null): RouteVolume {
  const directRoutes = toStatNumber(getStatValue(row, ROUTE_ALIASES))
  if (directRoutes !== null && directRoutes > 0) {
    return { routes: directRoutes, source: 'column' }
  }

  const yards = toStatNumber(getStatValue(row, ['YDS', 'Receiving Yards', 'Rec Yards']))
  const yprr = toStatNumber(getStatValue(row, ['YPRR', 'Yards Per Route Run']))

  if (yards !== null && yprr !== null && yards >= 0 && yprr > 0) {
    return { routes: yards / yprr, source: 'derived' }
  }

  return { routes: null, source: null }
}

export function formatStatValue(value: any, maximumFractionDigits = 2) {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'number') {
    return value.toLocaleString(undefined, {
      maximumFractionDigits,
    })
  }
  return String(value)
}

export function getPlayerId(player: PlayerScoreRow) {
  return player.id || player.player_key || `${player.position}-${player.player_name}`
}

function hasValue(value: any) {
  return value !== undefined && value !== null && String(value).trim() !== ''
}

function normalizeKey(value: string) {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, '')
}
