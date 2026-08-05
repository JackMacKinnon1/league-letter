import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isLeagueAdmin } from '@/lib/permissions'
import { pageRange, parsePage, parsePageSize } from '@/lib/pagination'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !(await isLeagueAdmin({ supabase, leagueId, userId: user.id }))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(request.url)
  const page = parsePage(url.searchParams.get('page'))
  const pageSize = parsePageSize(url.searchParams.get('pageSize'), 8, 25)
  const { from, to } = pageRange(page, pageSize)

  const { data, count, error } = await supabase
    .from('articles')
    .select('*, profiles(display_name, email)', { count: 'exact' })
    .eq('league_id', leagueId)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data || [], total: count || 0, page, pageSize })
}
