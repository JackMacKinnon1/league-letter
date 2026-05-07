import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const DEFAULT_PAGE_SIZE = 50
const MAX_PAGE_SIZE = 100

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    const position = normalizePosition(searchParams.get('position'))
    const page = Math.max(Number(searchParams.get('page') || 1), 1)
    const requestedPageSize = Number(searchParams.get('pageSize') || DEFAULT_PAGE_SIZE)
    const pageSize = Math.min(Math.max(requestedPageSize, 1), MAX_PAGE_SIZE)

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const supabase = await createClient()

    const playerJoin =
      position === 'ALL'
        ? `
          players(
            id,
            sleeper_player_id,
            full_name,
            first_name,
            last_name,
            position,
            team,
            age
          )
        `
        : `
          players!inner(
            id,
            sleeper_player_id,
            full_name,
            first_name,
            last_name,
            position,
            team,
            age
          )
        `

    let query = supabase
      .from('dynasty_player_values')
      .select(
        `
        *,
        ${playerJoin}
        `,
        {
          count: 'exact',
        }
      )
      .order('overall_rank', { ascending: true })
      .range(from, to)

    if (position !== 'ALL') {
      query = query.eq('players.position', position)
    }

    const { data, error, count } = await query

    if (error) {
      throw new Error(error.message)
    }

    const rows = (data || []).map((row: any) => {
      const player = Array.isArray(row.players) ? row.players[0] : row.players

      const fullName =
        player?.full_name ||
        [player?.first_name, player?.last_name].filter(Boolean).join(' ') ||
        row.sleeper_player_id

      return {
        sleeper_player_id: row.sleeper_player_id,
        value: row.value,
        raw_value: row.raw_value,
        overall_rank: row.overall_rank,
        position_rank: row.position_rank,
        profile: row.profile,
        last_refreshed_at: row.last_refreshed_at,
        fullName,
        position: String(player?.position || '—').toUpperCase(),
        team: player?.team || 'FA',
        age: player?.age || null,
        foundInDatabase: Boolean(player),
      }
    })

    return NextResponse.json({
      rows,
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.max(Math.ceil((count || 0) / pageSize), 1),
      position,
      profile: rows[0]?.profile || null,
      lastRefreshedAt: rows[0]?.last_refreshed_at || null,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message || 'Failed to load dynasty rankings.',
      },
      {
        status: 500,
      }
    )
  }
}

function normalizePosition(position?: string | null) {
  const value = String(position || 'ALL').toUpperCase()

  if (['QB', 'RB', 'WR', 'TE'].includes(value)) {
    return value
  }

  return 'ALL'
}