import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { isSiteAdminEmail } from '@/lib/permissions'

const LEAGUE_COLUMNS = [
  'id',
  'name',
  'game_feed_enabled',
  'game_feed_display_mode',
].join(',')

export const dynamic = 'force-dynamic'

export async function GET() {
  const access = await requireSiteAdmin()
  if (access.response) return access.response

  try {
    const adminSupabase = createAdminClient()
    const [{ data: leagues, error: leagueError }, { data: workerStates, error: workerError }] =
      await Promise.all([
        adminSupabase.from('leagues').select(LEAGUE_COLUMNS).order('name'),
        adminSupabase
          .from('game_feed_source_state')
          .select('*')
          .order('worker_heartbeat_at', { ascending: false, nullsFirst: false }),
      ])

    if (leagueError) {
      return NextResponse.json({ error: leagueError.message }, { status: 500 })
    }

    if (workerError) {
      return NextResponse.json({ error: workerError.message }, { status: 500 })
    }

    return NextResponse.json({
      leagues: leagues || [],
      workerStates: workerStates || [],
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Could not load site Game Feed settings.' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  const access = await requireSiteAdmin()
  if (access.response) return access.response

  try {
    const body = await request.json()
    const updates = Array.isArray(body.leagues) ? body.leagues.slice(0, 250) : []

    if (!updates.length) {
      return NextResponse.json(
        { error: 'No league settings were supplied.' },
        { status: 400 }
      )
    }

    const adminSupabase = createAdminClient()

    for (const update of updates) {
      const id = String(update?.id || '')
      if (!id) continue

      const displayMode = update?.displayMode === 'test' ? 'test' : 'public'
      const { error } = await adminSupabase
        .from('leagues')
        .update({
          game_feed_enabled: Boolean(update?.enabled),
          game_feed_display_mode: displayMode,
        })
        .eq('id', id)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    const [{ data: leagues, error: leagueError }, { data: workerStates, error: workerError }] =
      await Promise.all([
        adminSupabase.from('leagues').select(LEAGUE_COLUMNS).order('name'),
        adminSupabase
          .from('game_feed_source_state')
          .select('*')
          .order('worker_heartbeat_at', { ascending: false, nullsFirst: false }),
      ])

    if (leagueError) {
      return NextResponse.json({ error: leagueError.message }, { status: 500 })
    }

    if (workerError) {
      return NextResponse.json({ error: workerError.message }, { status: 500 })
    }

    return NextResponse.json({
      leagues: leagues || [],
      workerStates: workerStates || [],
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Could not update site Game Feed settings.' },
      { status: 500 }
    )
  }
}

async function requireSiteAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      response: NextResponse.json({ error: 'You need to log in.' }, { status: 401 }),
    }
  }

  if (!isSiteAdminEmail(user.email)) {
    return {
      response: NextResponse.json({ error: 'Site administrator access required.' }, { status: 403 }),
    }
  }

  return { response: null }
}
