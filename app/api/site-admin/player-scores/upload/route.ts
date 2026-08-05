import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  buildPlayerScoresFromRawRows,
  DEFAULT_PLAYER_SCORE_WEIGHTS,
  parsePlayerScoreWorkbook,
} from '@/lib/playerScoreWorkbook'
import type { PlayerPosition, PlayerScoreWeights } from '@/lib/playerScoreWorkbook'
import { isSiteAdminEmail } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

const VALID_POSITIONS = new Set(['WR', 'TE', 'QB', 'RB'])

async function requireSiteAdmin(): Promise<{ error?: NextResponse }> {
  const supabaseUserClient = await createClient()

  const {
    data: { user },
  } = await supabaseUserClient.auth.getUser()

  if (!user || !isSiteAdminEmail(user.email)) {
    return { error: NextResponse.json({ error: 'Unauthorized.' }, { status: 403 }) }
  }

  return {}
}

export async function GET(request: Request) {
  try {
    const auth = await requireSiteAdmin()
    if (auth.error) return auth.error

    const { searchParams } = new URL(request.url)
    const position = String(searchParams.get('position') || 'WR').trim().toUpperCase()
    const uploadIdParam = String(searchParams.get('uploadId') || '').trim()

    if (!VALID_POSITIONS.has(position)) {
      return NextResponse.json(
        { error: 'Position must be WR, TE, QB, or RB.' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    let uploadQuery = supabase
      .from('player_score_uploads')
      .select('id, position, file_name, upload_label, uploaded_at, summary')
      .eq('position', position)
      .order('uploaded_at', { ascending: false })
      .limit(1)

    if (uploadIdParam) uploadQuery = uploadQuery.eq('id', uploadIdParam)

    const { data: uploads, error: uploadError } = await uploadQuery
    if (uploadError) throw new Error(uploadError.message)

    const upload = uploads?.[0]
    if (!upload) {
      return NextResponse.json({
        upload: null,
        rawRows: [],
        rankings: [],
        weights: DEFAULT_PLAYER_SCORE_WEIGHTS,
      })
    }

    const { data: rankings, error: rankingsError } = await supabase
      .from('player_score_rankings')
      .select('*')
      .eq('upload_id', upload.id)
      .eq('position', position)
      .order('rank', { ascending: true })
      .limit(500)

    if (rankingsError) throw new Error(rankingsError.message)

    const rawRowsByKey = new Map<string, Record<string, any>>()

    for (const ranking of rankings || []) {
      const rawRows = ranking.advanced_stats?.rawRows || []
      for (const row of rawRows) {
        const key = `${ranking.player_key}-${row.Year || row.Season || ''}`
        if (!rawRowsByKey.has(key)) rawRowsByKey.set(key, row)
      }
    }

    return NextResponse.json({
      upload,
      rawRows: Array.from(rawRowsByKey.values()),
      rankings: rankings || [],
      weights: upload.summary?.weights || DEFAULT_PLAYER_SCORE_WEIGHTS,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to load saved WR valuator data.' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSiteAdmin()
    if (auth.error) return auth.error

    const formData = await request.formData()
    const uploadLabel = String(formData.get('uploadLabel') || '').trim()
    const position = String(formData.get('position') || '').trim().toUpperCase()
    const file = formData.get('file') as File | null
    const rawRowsJson = String(formData.get('rawRows') || '').trim()
    const weightsJson = String(formData.get('weights') || '').trim()
    const previewOnly = String(formData.get('previewOnly') || '').trim() === 'true'

    if (!position) {
      return NextResponse.json({ error: 'Position is required.' }, { status: 400 })
    }

    if (!VALID_POSITIONS.has(position)) {
      return NextResponse.json(
        { error: 'Position must be WR, TE, QB, or RB.' },
        { status: 400 }
      )
    }

    const weights = parseWeights(weightsJson)

    const parsed = rawRowsJson
      ? buildPlayerScoresFromRawRows({
          rawRows: JSON.parse(rawRowsJson),
          position: position as PlayerPosition,
          weights,
        })
      : file
        ? await parsePlayerScoreWorkbook({
            file,
            position: position as PlayerPosition,
            weights,
          })
        : null

    if (!parsed) {
      return NextResponse.json(
        { error: 'Upload a Raw Data workbook or submit edited raw rows.' },
        { status: 400 }
      )
    }

    if (previewOnly) {
      return NextResponse.json({
        success: true,
        previewOnly: true,
        uploadId: '',
        uploadedAt: new Date().toISOString(),
        position,
        fileName: file?.name || 'manual-raw-data-preview',
        rowsStored: parsed.rows.length,
        rawRows: parsed.rawRows,
        weights: parsed.weights,
        summary: parsed.summary,
        rankings: parsed.rows,
        topFive: parsed.rows.slice(0, 5).map((row) => ({
          rank: row.rank,
          player_name: row.player_name,
          team: row.team,
          score: row.score,
        })),
      })
    }

    const supabase = createAdminClient()

    const { data: upload, error: uploadError } = await supabase
      .from('player_score_uploads')
      .insert({
        position,
        file_name: file?.name || 'manual-raw-data-update',
        upload_label: uploadLabel || file?.name || `Manual ${position} update`,
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
      fileName: file?.name || 'manual-raw-data-update',
      rowsStored: parsed.rows.length,
      rawRows: parsed.rawRows,
      weights: parsed.weights,
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
      { error: error?.message || 'Failed to calculate and import player scores.' },
      { status: 500 }
    )
  }
}

function parseWeights(value: string): Partial<PlayerScoreWeights> | undefined {
  if (!value) return undefined
  const parsed = JSON.parse(value)
  return parsed && typeof parsed === 'object' ? parsed : undefined
}
