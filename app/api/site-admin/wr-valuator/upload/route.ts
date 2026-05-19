import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  buildFiveYearPlayerValues,
  buildWrValuesFromCsvs,
  normalizePlayerKey,
} from '@/lib/wrValuator'

export const dynamic = 'force-dynamic'

const SITE_ADMIN_EMAIL = 'mackinnonjack4@gmail.com'

export async function POST(request: Request) {
  try {
    const supabaseUserClient = await createClient()

    const {
      data: { user },
    } = await supabaseUserClient.auth.getUser()

    if (!user || user.email !== SITE_ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 })
    }

    const formData = await request.formData()

    const season = String(formData.get('season') || '').trim()
    const fpdFile = formData.get('fpdFile') as File | null
    const pffFile = formData.get('pffFile') as File | null

    if (!season || !fpdFile || !pffFile) {
      return NextResponse.json(
        { error: 'Season, Fantasy Points CSV, and PFF CSV are required.' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('*')
      .not('age', 'is', null)

    if (playersError) {
      throw new Error(playersError.message)
    }

    const playerAgesByKey = buildPlayerAgeMap(players || [])

    const fpdCsvText = await fpdFile.text()
    const pffCsvText = await pffFile.text()

    const { yearlyRows, importSummary } = buildWrValuesFromCsvs({
      season,
      fpdCsvText,
      pffCsvText,
      playerAgesByKey,
    })

    if (yearlyRows.length > 0) {
      const chunkSize = 500

      for (let i = 0; i < yearlyRows.length; i += chunkSize) {
        const chunk = yearlyRows.slice(i, i + chunkSize)

        const { error } = await supabase.from('wr_value_seasons').upsert(chunk, {
          onConflict: 'player_key,season',
        })

        if (error) {
          throw new Error(error.message)
        }
      }
    }

    const { data: allSeasonRows, error: allSeasonRowsError } = await supabase
      .from('wr_value_seasons')
      .select('*')

    if (allSeasonRowsError) {
      throw new Error(allSeasonRowsError.message)
    }

    const playerValues = buildFiveYearPlayerValues(allSeasonRows || [])

    if (playerValues.length > 0) {
      const chunkSize = 500

      for (let i = 0; i < playerValues.length; i += chunkSize) {
        const chunk = playerValues.slice(i, i + chunkSize)

        const { error } = await supabase.from('wr_player_values').upsert(chunk, {
          onConflict: 'player_key',
        })

        if (error) {
          throw new Error(error.message)
        }
      }
    }

    return NextResponse.json({
      success: true,
      season,
      yearlyRowsStored: yearlyRows.length,
      playerValuesStored: playerValues.length,
      importSummary: {
        ...importSummary,
        playersWithAgesLoaded: Object.keys(playerAgesByKey).length,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message || 'Failed to import WR values.',
      },
      {
        status: 500,
      }
    )
  }
}

function buildPlayerAgeMap(players: any[]) {
  const agesByKey: Record<string, number> = {}

  for (const player of players) {
    const age = Number(player.age)

    if (!Number.isFinite(age)) continue

    const possibleNames = [
      player.full_name,
      player.player_name,
      player.name,
      player.search_full_name,
      player.first_name && player.last_name
        ? `${player.first_name} ${player.last_name}`
        : null,
    ].filter(Boolean)

    for (const name of possibleNames) {
      agesByKey[normalizePlayerKey(String(name))] = age
    }
  }

  return agesByKey
}
