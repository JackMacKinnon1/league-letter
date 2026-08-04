export const SITE_ADMIN_EMAIL = 'mackinnonjack4@gmail.com'

export function isSiteAdminEmail(email?: string | null) {
  return String(email || '').trim().toLowerCase() === SITE_ADMIN_EMAIL
}

export async function isLeagueAdmin({
  supabase,
  leagueId,
  userId,
}: {
  supabase: any
  leagueId: string
  userId?: string | null
}) {
  if (!userId) return false

  const { data: league } = await supabase
    .from('leagues')
    .select('admin_id')
    .eq('id', leagueId)
    .maybeSingle()

  if (league?.admin_id === userId) {
    return true
  }

  const { data: member } = await supabase
    .from('league_members')
    .select('role')
    .eq('league_id', leagueId)
    .eq('user_id', userId)
    .maybeSingle()

  return member?.role === 'admin'
}
