import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parsePlayerScoreWorkbook, PlayerPosition } from '@/lib/playerScoreWorkbook'

export const dynamic = 'force-dynamic'

const SITE_ADMIN_EMAIL = 'mackinnonjack4@gmail.com'
const VALID_POSITIONS = new Set(['WR', 'TE', 'QB', 'RB'])

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
    const uploadLabel = String(formData.get('uploadLabel') || '').trim()
    const position = String(formData.get('position') || '').trim().toUpperCase()
    const file = formData.get('file') as File | null

    if (!position || !file) {
      return NextResponse.json(
        { error: 'Position and Excel workbook are required.' },
        { status: 400 }
      )
    }

    if (!VALID_POSITIONS.has(position)) {
      return NextResponse.json(
        { error: 'Position must be WR, TE, QB, or RB.' },
        { status: 400 }
      )
    }

    const parsed = await parsePlayerScoreWorkbook({
      file,
      position: position as PlayerPosition,
    })

    const supabase = createAdminClient()

    const { data: upload, error: uploadError } = await supabase
      .from('player_score_uploads')
      .insert({
        position,
        file_name: file.name,
        upload_label: uploadLabel || file.name,
        summary: parsed.summary,
      })
      .select('id, uploaded_at')
      .single()

    if (uploadError) throw new Error(uploadError.message)

    const rowsToInsert = parsed.rows.map((row) => ({
      upload_id: upload.id,
      player_key: row.player_key,
      player_name: row.player_name,
      team: row.team,
      position: row.position,
      rank: row.rank,
      rank_label: row.rank_label,
      score: row.score,
      latest_season: row.latest_season,
      seasons_played: row.seasons_played,
      advanced_stats: row.advanced_stats,
    }))

    const chunkSize = 250

    for (let i = 0; i < rowsToInsert.length; i += chunkSize) {
      const chunk = rowsToInsert.slice(i, i + chunkSize)
      const { error } = await supabase.from('player_score_rankings').insert(chunk)
      if (error) throw new Error(error.message)
    }

    return NextResponse.json({
      success: true,
      uploadId: upload.id,
      uploadedAt: upload.uploaded_at,
      position,
      fileName: file.name,
      rowsStored: parsed.rows.length,
      summary: parsed.summary,
      topFive: parsed.rows.slice(0, 5).map((row) => ({
        rank: row.rank,
        player_name: row.player_name,
        team: row.team,
        score: row.score,
      })),
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to import player scores workbook.' },
      { status: 500 }
    )
  }
}
