export type GameFeedEvent = {
  id: number
  league_id: string
  sleeper_league_id: string
  source_sleeper_league_id: string | null
  feed_mode: 'public' | 'test'
  season: string
  week: number
  batch_id: string | null
  event_type:
    | 'reception'
    | 'rush'
    | 'passing'
    | 'touchdown'
    | 'field_goal'
    | 'extra_point'
    | 'defense'
    | 'turnover'
    | 'scoring_update'
    | 'stat_correction'
  description: string
  primary_player_id: string
  primary_player_name: string
  primary_player_position: string | null
  primary_player_team: string | null
  secondary_player_id: string | null
  secondary_player_name: string | null
  secondary_player_position: string | null
  primary_fantasy_delta: number
  secondary_fantasy_delta: number | null
  inferred_yards: number | null
  inferred_receptions: number | null
  inferred_touchdowns: number | null
  confidence: 'high' | 'medium' | 'low'
  is_aggregate: boolean
  is_correction: boolean
  metadata: Record<string, unknown> | null
  occurred_at: string
  detected_at: string
}

export function sleeperPlayerImageUrl(playerId?: string | null) {
  if (!playerId) return null
  return `https://sleepercdn.com/content/nfl/players/${playerId}.jpg`
}

export function formatFantasyDelta(value: number | string | null | undefined) {
  const number = Number(value || 0)
  return `${number >= 0 ? '+' : ''}${number.toFixed(2)}`
}

export function normalizeGameFeedWeek(
  value: string | number | null | undefined,
  fallback = 1
) {
  const safeFallback = Number.isFinite(Number(fallback)) ? Number(fallback) : 1
  const hasValue = value !== null && value !== undefined && String(value).trim() !== ''
  const parsed = hasValue ? Number(value) : safeFallback
  return Math.min(
    25,
    Math.max(1, Number.isFinite(parsed) ? Math.trunc(parsed) : Math.trunc(safeFallback))
  )
}

export function normalizeGameFeedSeason(
  value: string | number | null | undefined,
  fallback: string | number
) {
  const requested = String(value ?? '').trim()
  if (/^\d{4}$/.test(requested)) return requested

  const fallbackValue = String(fallback ?? '').trim()
  return /^\d{4}$/.test(fallbackValue)
    ? fallbackValue
    : String(new Date().getFullYear())
}

export function isSafeSleeperPlayerId(value: string) {
  return /^[A-Za-z0-9_-]{1,64}$/.test(value)
}

export function isReceivingGameFeedEvent(event: GameFeedEvent) {
  const primaryPosition = String(event.primary_player_position || '').toUpperCase()
  const secondaryPosition = String(event.secondary_player_position || '').toUpperCase()

  return Boolean(
    event.secondary_player_id &&
      event.secondary_player_name &&
      secondaryPosition === 'QB' &&
      Number(event.inferred_receptions || 0) > 0 &&
      ['WR', 'TE', 'RB', 'FB'].includes(primaryPosition) &&
      event.event_type !== 'rush'
  )
}
