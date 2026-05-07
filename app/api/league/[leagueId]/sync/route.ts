import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncSleeperLeagueData } from '@/lib/syncSleeperLeague'

export async function POST(
  req: Request,
  context: { params: Promise<{ leagueId: string }> }
) {
  try {
    const { leagueId } = await context.params
    const body = await req.json().catch(() => ({}))

    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'You need to log in first.' },
        { status: 401 }
      )
    }

    const { data: league } = await supabase
      .from('leagues')
      .select('*')
      .eq('id', leagueId)
      .single()

    if (!league) {
      return NextResponse.json(
        { error: 'League not found.' },
        { status: 404 }
      )
    }

    if (league.admin_id !== user.id) {
      return NextResponse.json(
        { error: 'Only the league admin can sync this league.' },
        { status: 403 }
      )
    }

    const result = await syncSleeperLeagueData({
      supabase,
      leagueId,
      week: body.week,
    })

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Could not sync league.' },
      { status: 500 }
    )
  }
}