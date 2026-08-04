import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSiteAdminEmail } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

const DEFAULT_PROFILE = 'dynasty-2qb-12t-ppr1'

export async function POST() {
  try {
    const userClient = await createClient()

    const {
      data: { user },
    } = await userClient.auth.getUser()

    if (!user || !isSiteAdminEmail(user.email)) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 })
    }

    const response = await fetch(
      `https://developer.leaguelogs.com/v1/market/${DEFAULT_PROFILE}`,
      {
        cache: 'no-store',
      }
    )

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch LeagueLogs values.' },
        { status: 500 }
      )
    }

    const json = await response.json()
    const marketRows = Array.isArray(json?.data) ? json.data : []
    const lastRefreshedAt =
      json?.meta?.lastRefreshed || new Date().toISOString()

    const rawValues = marketRows
      .map((row: any) => {
        const sleeperPlayerId = extractSleeperPlayerId(row)

        return {
          sleeper_player_id: sleeperPlayerId,
          value: safeNumber(row.value ?? row.marketValue ?? row.market_value),
          raw_value: safeNumber(row.rawValue ?? row.raw_value ?? row.value),
          overall_rank: safeInteger(
            row.overallRank ??
              row.overall_rank ??
              row.rank ??
              row.marketRank ??
              row.market_rank
          ),
          position_rank: safeInteger(
            row.positionRank ?? row.position_rank ?? row.posRank
          ),
          profile: DEFAULT_PROFILE,
          last_refreshed_at: lastRefreshedAt,
          updated_at: new Date().toISOString(),
        }
      })
      .filter((row: any) => row.sleeper_player_id)

    const supabase = createAdminClient()

    const sleeperIds = rawValues.map((row: any) => row.sleeper_player_id)

    const { data: existingPlayers, error: playersError } = await supabase
      .from('players')
      .select('sleeper_player_id')
      .in('sleeper_player_id', sleeperIds.length ? sleeperIds : [''])

    if (playersError) {
      throw new Error(playersError.message)
    }

    const existingSleeperIds = new Set(
      (existingPlayers || []).map((player: any) =>
        String(player.sleeper_player_id)
      )
    )

    const valuesToUpsert = rawValues.filter((row: any) =>
      existingSleeperIds.has(String(row.sleeper_player_id))
    )

    const skippedValues = rawValues.filter(
      (row: any) => !existingSleeperIds.has(String(row.sleeper_player_id))
    )

    if (valuesToUpsert.length > 0) {
      const chunkSize = 500

      for (let i = 0; i < valuesToUpsert.length; i += chunkSize) {
        const chunk = valuesToUpsert.slice(i, i + chunkSize)

        const { error } = await supabase
          .from('dynasty_player_values')
          .upsert(chunk, {
            onConflict: 'sleeper_player_id',
          })

        if (error) {
          throw new Error(error.message)
        }
      }
    }

    return NextResponse.json({
      success: true,
      profile: DEFAULT_PROFILE,
      valuesFromApi: rawValues.length,
      valuesStored: valuesToUpsert.length,
      valuesSkipped: skippedValues.length,
      sampleSkippedIds: skippedValues
        .slice(0, 10)
        .map((row: any) => row.sleeper_player_id),
      lastRefreshedAt,
    })
  } catch (error: any) {
    console.error('DYNASTY VALUES SYNC ERROR:', error)

    return NextResponse.json(
      {
        error: error?.message || 'Failed to sync dynasty values.',
      },
      {
        status: 500,
      }
    )
  }
}

function extractSleeperPlayerId(row: any) {
  const value =
    row.sleeperPlayerId ??
    row.sleeper_player_id ??
    row.sleeperId ??
    row.sleeper_id ??
    row.sleeper_playerId ??
    row.playerId ??
    row.player_id ??
    row.id

  return value ? String(value) : ''
}

function safeNumber(value: any) {
  if (value === null || value === undefined || value === '') return null

  const numberValue = Number(value)

  return Number.isFinite(numberValue) ? numberValue : null
}

function safeInteger(value: any) {
  if (value === null || value === undefined || value === '') return null

  const numberValue = Number(value)

  return Number.isFinite(numberValue) ? Math.round(numberValue) : null
}