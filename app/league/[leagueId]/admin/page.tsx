import Link from '@/components/NoPrefetchLink'
import Navbar from '@/components/Navbar'
import AdminSyncButton from '@/components/AdminSyncButton'
import FeaturedMatchupManager from '@/components/FeaturedMatchupManager'
import PowerRankingsManager from '@/components/PowerRankingsManager'
import ArticleManager from '@/components/ArticleManager'
import MemberInviteManager from '@/components/MemberInviteManager'
import BreakingNewsManager from '@/components/BreakingNewsManager'
import LeagueTickerManager from '@/components/LeagueTickerManager'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { isLeagueAdmin } from '@/lib/permissions'

export default async function LeagueAdminPage({
  params,
}: {
  params: Promise<{ leagueId: string }>
}) {
  const { leagueId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: league } = await supabase
    .from('leagues')
    .select('*')
    .eq('id', leagueId)
    .single()

  if (!league) {
    redirect('/dashboard')
  }

  const canAdmin = await isLeagueAdmin({
    supabase,
    leagueId,
    userId: user.id,
  })

  if (!canAdmin) {
    redirect(`/league/${leagueId}`)
  }

  const currentSeason = league.season
  const currentWeek = league.current_week || 1

  const { data: matchupSeasonRows } = await supabase
    .from('matchups')
    .select('season')
    .eq('league_id', leagueId)
    .not('season', 'is', null)

  const availableSeasons = Array.from(
    new Set((matchupSeasonRows || []).map((row: any) => String(row.season)))
  ).sort((a, b) => Number(b) - Number(a))

  const { data: matchups } = await supabase
    .from('matchups')
    .select('*')
    .eq('league_id', leagueId)
    .eq('season', currentSeason)
    .eq('week', currentWeek)
    .order('matchup_id', { ascending: true })

  const { data: featured } = await supabase
    .from('featured_matchups')
    .select('*')
    .eq('league_id', leagueId)
    .eq('season', currentSeason)
    .eq('week', currentWeek)
    .maybeSingle()

  const { data: teams } = await supabase
    .from('teams')
    .select('*')
    .eq('league_id', leagueId)
    .order('wins', { ascending: false })
    .order('points_for', { ascending: false })

  const { data: rankings } = await supabase
    .from('power_rankings')
    .select('*')
    .eq('league_id', leagueId)
    .eq('season', currentSeason)
    .eq('week', currentWeek)
    .order('rank', { ascending: true })

  const { data: articles } = await supabase
    .from('articles')
    .select('*, profiles(display_name, email)')
    .eq('league_id', leagueId)
    .order('created_at', { ascending: false })

  const { data: members } = await supabase
    .from('league_members')
    .select(
      `
      *,
      profiles!league_members_user_id_fkey(display_name, email, username)
    `
    )
    .eq('league_id', leagueId)
    .order('created_at', { ascending: true })

  const { data: invites } = await supabase
    .from('league_invites')
    .select(
      `
      *,
      profiles!league_invites_invited_user_id_fkey(display_name, email, username)
    `
    )
    .eq('league_id', leagueId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  const { data: breakingNews } = await supabase
    .from('breaking_news')
    .select('*')
    .eq('league_id', leagueId)
    .order('created_at', { ascending: false })

  const { data: tickerSettings, error: tickerSettingsError } = await supabase
    .from('league_ticker_settings')
    .select('*')
    .eq('league_id', leagueId)
    .maybeSingle()

  const { data: tickerItems, error: tickerItemsError } = await supabase
    .from('league_ticker_items')
    .select('*')
    .eq('league_id', leagueId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <Navbar />

      <section className="border-b border-zinc-800 bg-white/[0.015] px-4 py-10">
        <div className="mx-auto max-w-7xl">
          <Link
            href={`/league/${leagueId}`}
            className="text-sm font-bold text-zinc-400 hover:text-white"
          >
            ← Back to league
          </Link>

          <p className="mt-6 text-sm font-black uppercase tracking-[0.3em] text-emerald-400">
            Admin Dashboard
          </p>

          <h1 className="mt-3 text-5xl font-black">{league.name}</h1>

          <p className="mt-3 text-zinc-400">
            Manage league content, sync Sleeper data, assign featured matchups,
            and control writers/admins. Site-wide tools are managed separately by the site owner.
          </p>

          <div className="mt-6">
            <AdminSyncButton leagueId={leagueId} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        <LeagueTickerManager
          leagueId={leagueId}
          initialSettings={tickerSettings}
          initialItems={tickerItems || []}
          setupError={tickerSettingsError?.message || tickerItemsError?.message}
        />

        <BreakingNewsManager
          leagueId={leagueId}
          existingNews={breakingNews || []}
        />

        <FeaturedMatchupManager
          leagueId={leagueId}
          currentSeason={currentSeason}
          currentWeek={currentWeek}
          seasons={availableSeasons.length ? availableSeasons : [currentSeason]}
          initialMatchups={matchups || []}
          currentFeatured={featured}
        />

        <PowerRankingsManager
          leagueId={leagueId}
          week={currentWeek}
          teams={teams || []}
          currentRankings={rankings || []}
        />

        <ArticleManager leagueId={leagueId} articles={articles || []} />

        <MemberInviteManager
          leagueId={leagueId}
          members={members || []}
          invites={invites || []}
          currentUserId={user.id}
        />
      </section>
    </main>
  )
}