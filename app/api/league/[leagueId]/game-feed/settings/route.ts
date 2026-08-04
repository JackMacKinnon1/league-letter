import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isLeagueAdmin } from '@/lib/permissions'
import { createAdminClient } from '@/lib/supabase/admin'

const SETTINGS_COLUMNS = [
  'game_feed_enabled',
  'game_feed_display_mode',
  'game_feed_poll_seconds',
  'game_feed_last_polled_at',
  'game_feed_last_success_at',
  'game_feed_last_error',
  'game_feed_worker_heartbeat_at',
  'game_feed_worker_started_at',
  'game_feed_worker_stopped_at',
  'game_feed_worker_name',
  'game_feed_worker_version',
  'game_feed_worker_mode',
  'game_feed_source_sleeper_league_id',
].join(',')

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  try {
    const { leagueId } = await params
    const access = await requireLeagueAdmin(leagueId)
    if (access.response) return access.response

    const adminSupabase = createAdminClient()
    const [{ data, error }, { data: workerStates, error: stateError }] =
      await Promise.all([
        adminSupabase
          .from('leagues')
          .select(SETTINGS_COLUMNS)
          .eq('id', leagueId)
          .single(),
        adminSupabase
          .from('game_feed_source_state')
          .select('*')
          .order('worker_heartbeat_at', { ascending: false, nullsFirst: false }),
      ])

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (stateError) {
      return NextResponse.json({ error: stateError.message }, { status: 500 })
    }

    const activeWorker = selectActiveWorker(workerStates || [])

    return NextResponse.json({
      settings: data,
      workerStates: workerStates || [],
      activeWorker,
      workerOnline: Boolean(activeWorker),
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Could not load Game Feed settings.' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  try {
    const { leagueId } = await params
    const body = await request.json()
    const access = await requireLeagueAdmin(leagueId)
    if (access.response) return access.response

    const displayMode = body.displayMode === 'test' ? 'test' : 'public'
    const adminSupabase = createAdminClient()
    const { data, error } = await adminSupabase
      .from('leagues')
      .update({
        game_feed_enabled: Boolean(body.enabled),
        game_feed_display_mode: displayMode,
      })
      .eq('id', leagueId)
      .select(SETTINGS_COLUMNS)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const { data: workerStates, error: stateError } = await adminSupabase
      .from('game_feed_source_state')
      .select('*')
      .order('worker_heartbeat_at', { ascending: false, nullsFirst: false })

    if (stateError) {
      return NextResponse.json({ error: stateError.message }, { status: 500 })
    }

    const activeWorker = selectActiveWorker(workerStates || [])

    return NextResponse.json({
      settings: data,
      workerStates: workerStates || [],
      activeWorker,
      workerOnline: Boolean(activeWorker),
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Could not update Game Feed settings.' },
      { status: 500 }
    )
  }
}

async function requireLeagueAdmin(leagueId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      response: NextResponse.json(
        { error: 'You need to log in.' },
        { status: 401 }
      ),
    }
  }

  const canAdmin = await isLeagueAdmin({
    supabase,
    leagueId,
    userId: user.id,
  })

  if (!canAdmin) {
    return {
      response: NextResponse.json(
        { error: 'Admin access required.' },
        { status: 403 }
      ),
    }
  }

  return { response: null }
}

function selectActiveWorker(states: any[]) {
  return states.find((state) => isRecentHeartbeat(state.worker_heartbeat_at)) || null
}

function isRecentHeartbeat(value?: string | null) {
  if (!value) return false
  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) && Date.now() - timestamp < 35_000
}
