import Navbar from '@/components/Navbar'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import AdminSyncButton from '@/components/AdminSyncButton'
import FeaturedMatchupManager from '@/components/FeaturedMatchupManager'
import ArticleManager from '@/components/ArticleManager'
import PowerRankingsManager from '@/components/PowerRankingsManager'
import MemberInviteManager from '@/components/MemberInvitedManager'
import BreakingNewsManager from '@/components/BreakingNewsManager'

export default async function AdminPage({
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

    if (!league || league.admin_id !== user.id) {
        redirect(`/league/${leagueId}`)
    }

    const { data: breakingNews } = await supabase
        .from('breaking_news')
        .select('*')
        .eq('league_id', leagueId)
        .order('created_at', { ascending: false })

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

    const { data: articles } = await supabase
        .from('articles')
        .select('*, profiles(display_name, email)')
        .eq('league_id', leagueId)
        .order('created_at', { ascending: false })

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
        .eq('week', league.current_week || 1)
        .order('rank', { ascending: true })

    const { data: members } = await supabase
        .from('league_members')
        .select('*, profiles(display_name, email, username)')
        .eq('league_id', leagueId)
        .order('created_at', { ascending: true })

    const { data: invites } = await supabase
        .from('league_invites')
        .select('*, profiles(display_name, email, username)')
        .eq('league_id', leagueId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

    return (
        <main className="min-h-screen bg-zinc-950 text-white">
            <Navbar />

            <section className="mx-auto max-w-7xl px-4 py-10">
                <Link
                    href={`/league/${leagueId}`}
                    className="text-sm font-bold text-zinc-400 hover:text-white"
                >
                    ← Back to league
                </Link>

                <div className="mt-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
                    <div>
                        <p className="text-sm font-black uppercase tracking-[0.3em] text-emerald-400">
                            Admin Dashboard
                        </p>
                        <h1 className="mt-2 text-5xl font-black">{league.name}</h1>
                        <p className="mt-2 text-zinc-400">
                            Season {league.season} · Week {league.current_week}
                        </p>
                    </div>

                    <AdminSyncButton leagueId={leagueId} />
                </div>

                <div className="mt-8">
                    <BreakingNewsManager
                        leagueId={leagueId}
                        existingNews={breakingNews || []}
                    />
                </div>

                <div className="mt-8 grid gap-6 lg:grid-cols-2">
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
                        week={league.current_week || 1}
                        teams={teams || []}
                        currentRankings={rankings || []}
                    />
                </div>

                <div className="mt-6">
                    <ArticleManager leagueId={leagueId} articles={articles || []} />
                </div>
                <div className="mt-6">
                    <MemberInviteManager
                        leagueId={leagueId}
                        members={members || []}
                        invites={invites || []}
                    />
                </div>
            </section>
        </main>
    )
}