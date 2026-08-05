const SLEEPER_BASE_URL = 'https://api.sleeper.app/v1'

export type SleeperLeague = {
  league_id: string
  name: string
  avatar: string | null
  season: string
  status: string
  sport: string
  total_rosters: number
  scoring_settings?: Record<string, number>
  previous_league_id?: string | null
  metadata?: {
    [key: string]: unknown
  }
  settings?: {
    week?: number
    playoff_week_start?: number
    divisions?: number
    [key: string]: unknown
  }
}

export type SleeperUser = {
  user_id: string
  username: string
  display_name: string
  avatar: string | null
  metadata?: {
    team_name?: string
    [key: string]: unknown
  }
}

export type SleeperRoster = {
  roster_id: number
  owner_id: string | null
  league_id: string
  players: string[] | null
  starters: string[] | null
  settings?: {
    wins?: number
    losses?: number
    ties?: number
    fpts?: number
    fpts_decimal?: number
    fpts_against?: number
    fpts_against_decimal?: number
    division?: number | string
    [key: string]: unknown
  }
}

export type SleeperMatchup = {
  roster_id: number
  matchup_id: number | null
  points: number
  starters: string[]
  players: string[]
  players_points?: Record<string, number>
}

export type SleeperBracketMatchup = {
  r?: number
  m?: number
  t1?: number | null
  t2?: number | null
  w?: number | null
  l?: number | null
}

export async function getSleeperWinnersBracket(leagueId: string) {
  return sleeperFetch<SleeperBracketMatchup[]>(
    `/league/${leagueId}/winners_bracket`
  )
}

async function sleeperFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${SLEEPER_BASE_URL}${path}`, {
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(`Sleeper request failed: ${path}`)
  }

  return res.json()
}

export function sleeperAvatarUrl(avatarId?: string | null) {
  if (!avatarId) return null
  return `https://sleepercdn.com/avatars/${avatarId}`
}

export async function getSleeperLeague(leagueId: string) {
  return sleeperFetch<SleeperLeague>(`/league/${leagueId}`)
}

export async function getSleeperUsers(leagueId: string) {
  return sleeperFetch<SleeperUser[]>(`/league/${leagueId}/users`)
}

export async function getSleeperUser(username: string) {
  const cleanUsername = username.trim()

  if (!cleanUsername) return null

  const response = await fetch(
    `${SLEEPER_BASE_URL}/user/${encodeURIComponent(cleanUsername)}`,
    { cache: 'no-store' }
  )

  if (response.status === 404) return null

  if (!response.ok) {
    throw new Error('Sleeper could not verify that account right now.')
  }

  const user = (await response.json()) as SleeperUser | null
  return user?.user_id ? user : null
}

export async function getSleeperRosters(leagueId: string) {
  return sleeperFetch<SleeperRoster[]>(`/league/${leagueId}/rosters`)
}

export async function getSleeperMatchups(leagueId: string, week: number) {
  return sleeperFetch<SleeperMatchup[]>(`/league/${leagueId}/matchups/${week}`)
}

export function sleeperFantasyPoints(settings?: SleeperRoster['settings']) {
  if (!settings) return 0

  const whole = Number(settings.fpts || 0)
  const decimal = Number(settings.fpts_decimal || 0) / 100

  return whole + decimal
}

export function sleeperFantasyPointsAgainst(settings?: SleeperRoster['settings']) {
  if (!settings) return 0

  const whole = Number(settings.fpts_against || 0)
  const decimal = Number(settings.fpts_against_decimal || 0) / 100

  return whole + decimal
}

export type SleeperTransaction = {
  transaction_id: string
  type: string
  status: string
  roster_ids: number[]
  adds: Record<string, number> | null
  drops: Record<string, number> | null
  draft_picks: any[] | null
  creator: string
  created: number
}

export async function getSleeperTransactions(leagueId: string, week: number) {
  return sleeperFetch<SleeperTransaction[]>(
    `/league/${leagueId}/transactions/${week}`
  )
}

export async function getSleeperPlayers() {
  return sleeperFetch<Record<string, any>>('/players/nfl')
}

export type SleeperDraft = {
  draft_id: string
  league_id: string
  sport: string
  season: string
  season_type: string
  type: string
  status: 'pre_draft' | 'drafting' | 'paused' | 'complete' | string
  start_time: number | null
  created: number
  last_picked: number | null
  draft_order: Record<string, number> | null
  slot_to_roster_id?: Record<string, number>
  settings?: {
    rounds?: number
    teams?: number
    pick_timer?: number
    [key: string]: any
  }
  metadata?: {
    name?: string
    description?: string
    scoring_type?: string
    [key: string]: any
  }
}

export type SleeperDraftPick = {
  draft_id: string
  pick_no: number
  round: number
  roster_id: number
  picked_by: string
  player_id: string
  is_keeper?: boolean
  metadata?: {
    first_name?: string
    last_name?: string
    position?: string
    team?: string
    [key: string]: any
  }
}

export type SleeperTradedPick = {
  season: string
  round: number
  roster_id: number
  previous_owner_id: number
  owner_id: number
}

export async function getSleeperTradedPicks(leagueId: string) {
  return sleeperFetch<SleeperTradedPick[]>(
    `/league/${leagueId}/traded_picks`
  )
}

export async function getSleeperLeagueDrafts(leagueId: string) {
  return sleeperFetch<SleeperDraft[]>(`/league/${leagueId}/drafts`)
}

export async function getSleeperDraft(draftId: string) {
  return sleeperFetch<SleeperDraft>(`/draft/${draftId}`)
}

export async function getSleeperDraftPicks(draftId: string) {
  return sleeperFetch<SleeperDraftPick[]>(`/draft/${draftId}/picks`)
}