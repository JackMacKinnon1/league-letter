import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const VALID_POSITIONS = new Set(['WR', 'TE', 'QB', 'RB'])

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const position = String(searchParams.get('position') || 'WR').toUpperCase()
    const uploadIdParam = String(searchParams.get('uploadId') || '').trim()
    const page = Math.max(Number(searchParams.get('page') || 1), 1)
    const includeAll = String(searchParams.get('all') || '').toLowerCase() === 'true'
    const pageSize = Math.min(Math.max(Number(searchParams.get('pageSize') || 50), 1), 500)
    const search = String(searchParams.get('search') || '').trim()

    if (!VALID_POSITIONS.has(position)) {
      return NextResponse.json({ error: 'Invalid position.' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: uploads, error: uploadsError } = await supabase
      .from('player_score_uploads')
      .select('id, position, file_name, upload_label, uploaded_at, summary')
      .eq('position', position)
      .order('uploaded_at', { ascending: false })
      .limit(50)

    if (uploadsError) throw new Error(uploadsError.message)

    const selectedUpload = uploadIdParam
      ? uploads?.find((upload) => upload.id === uploadIdParam)
      : uploads?.[0]

    if (!selectedUpload) {
      return NextResponse.json({
        rows: [],
        total: 0,
        page,
        pageSize,
        totalPages: 1,
        position,
        uploadId: '',
        uploads: uploads || [],
        debug: { reason: 'No uploaded player score workbooks found for this position.' },
      })
    }

    let query = supabase
      .from('player_score_rankings')
      .select('*', { count: 'exact' })
      .eq('upload_id', selectedUpload.id)
      .eq('position', position)
      .order('rank', { ascending: true })

    if (!includeAll) {
      query = query.range((page - 1) * pageSize, page * pageSize - 1)
    } else {
      query = query.limit(500)
    }

    if (search) {
      const escapedSearch = search.replace(/[%_]/g, (char) => `\\${char}`)
      query = query.or(`player_name.ilike.%${escapedSearch}%,team.ilike.%${escapedSearch}%`)
    }

    const { data: rows, error, count } = await query

    if (error) throw new Error(error.message)

    const total = count || 0

    return NextResponse.json({
      rows: rows || [],
      total,
      page,
      pageSize,
      totalPages: includeAll ? 1 : Math.max(Math.ceil(total / pageSize), 1),
      position,
      uploadId: selectedUpload.id,
      selectedUpload,
      uploads: uploads || [],
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to load player scores.' },
      { status: 500 }
    )
  }
}
