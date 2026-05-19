import Link from 'next/link'
import Navbar from '@/components/Navbar'
import LeagueWeekSelector from '@/components/LeagueWeekSelector'
import TransactionCard from '@/components/TransactionCard'
import MostRecentTransactionPanel from '@/components/MostRecentTransactionsPanel'
import LeagueTicker from '@/components/LeagueTicker'
import { createClient } from '@/lib/supabase/server'
import { isLeagueAdmin } from '@/lib/permissions'
import {
  Swords,
  Trophy,
  TrendingUp,
  Users,
} from 'lucide-react'

export default async function LeaguePage({
  params,
  searchParams,
}: {
  params: Promise<{ leagueId: string }>
  searchParams: Promise<{ season?: string; week?: string }>
}) {
  const { leagueId } = await params
  const { season, week } = await searchParams

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: league } = await supabase
    .from('leagues')
    .select('*')
    .eq('id', leagueId)
    .single()

  const { data: matchupSeasonRows } = await supabase
    .from('matchups')
    .select('season')
    .eq('league_id', leagueId)
    .not('season', 'is', null)

  const availableSeasons = Array.from(
    new Set((matchupSeasonRows || []).map((row: any) => String(row.season)))
  ).sort((a, b) => Number(b) - Number(a))

  const selectedSeason =
    season ||
    league?.season ||
    availableSeasons[0] ||
    String(new Date().getFullYear())

  const selectedWeek = Math.max(Number(week || league?.current_week || 1), 1)

  const { data: teams } = await supabase
    .from('teams')
    .select('*')
    .eq('league_id', leagueId)
    .order('wins', { ascending: false })
    .order('points_for', { ascending: false })

  const { data: selectedSeasonStats } = await supabase
    .from('team_season_stats')
    .select('*')
    .eq('league_id', leagueId)
    .eq('season', selectedSeason)
    .order('wins', { ascending: false })
    .order('points_for', { ascending: false })

  const teamsForSelectedSeason =
    selectedSeasonStats && selectedSeasonStats.length > 0
      ? selectedSeasonStats
      : teams || []

  const leader = teamsForSelectedSeason?.[0]

  const highestScoringTeam = [...(teamsForSelectedSeason || [])].sort(
    (a: any, b: any) => Number(b.points_for) - Number(a.points_for)
  )[0]

  const { data: matchups } = await supabase
    .from('matchups')
    .select('*')
    .eq('league_id', leagueId)
    .eq('season', selectedSeason)
    .eq('week', selectedWeek)
    .order('matchup_id', { ascending: true })

  const { data: breakingNews } = await supabase
    .from('breaking_news')
    .select('*')
    .eq('league_id', leagueId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)

  const latestBreakingNews = breakingNews?.[0]

  const { data: tickerSettings } = await supabase
    .from('league_ticker_settings')
    .select('*')
    .eq('league_id', leagueId)
    .maybeSingle()

  const { data: tickerItems } = await supabase
    .from('league_ticker_items')
    .select('*')
    .eq('league_id', leagueId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  const { data: featured } = await supabase
    .from('featured_matchups')
    .select('*')
    .eq('league_id', leagueId)
    .eq('season', selectedSeason)
    .eq('week', selectedWeek)
    .maybeSingle()

  const { data: rankings } = await supabase
    .from('power_rankings')
    .select('*')
    .eq('league_id', leagueId)
    .eq('season', selectedSeason)
    .eq('week', selectedWeek)
    .order('rank', { ascending: true })

  const { data: articles } = await supabase
    .from('articles')
    .select('*, profiles(display_name, email)')
    .eq('league_id', leagueId)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(6)

  const { data: mostRecentTransactions } = await supabase
    .from('transactions')
    .select('*')
    .eq('league_id', leagueId)
    .eq('season', selectedSeason)
    .order('created_sleeper_at', { ascending: false })
    .limit(1)

  const mostRecentTransaction = mostRecentTransactions?.[0]

  const transactionPlayerIds = new Set<string>()

  if (mostRecentTransaction?.adds) {
    Object.keys(mostRecentTransaction.adds).forEach((id) =>
      transactionPlayerIds.add(id)
    )
  }

  if (mostRecentTransaction?.drops) {
    Object.keys(mostRecentTransaction.drops).forEach((id) =>
      transactionPlayerIds.add(id)
    )
  }

  const { data: transactionPlayers } = await supabase
    .from('players')
    .select('*')
    .in(
      'id',
      transactionPlayerIds.size ? Array.from(transactionPlayerIds) : ['']
    )

  const sleeperPlayers: Record<string, any> = {}

  for (const player of transactionPlayers || []) {
    sleeperPlayers[player.id] = {
      first_name: player.first_name,
      last_name: player.last_name,
      full_name: player.full_name,
      position: player.position,
      team: player.team,
    }
  }

  const teamByRosterId = new Map<number, any>()

  for (const team of teams || []) {
    teamByRosterId.set(Number(team.sleeper_roster_id), team)
  }

  const isAdmin = await isLeagueAdmin({
    supabase,
    leagueId,
    userId: user?.id,
  })

  const showProjectedWinChances = shouldShowProjectedWinChances(league?.status)

  const groupedMatchups =
    matchups?.reduce((acc: Record<string, any[]>, matchup: any) => {
      const key =
        matchup.matchup_id !== null && matchup.matchup_id !== undefined
          ? String(matchup.matchup_id)
          : `solo-${matchup.sleeper_roster_id}`

      if (!acc[key]) {
        acc[key] = []
      }

      acc[key].push(matchup)

      return acc
    }, {}) || {}

  const featuredTeams =
    featured?.matchup_id && groupedMatchups[String(featured.matchup_id)]
      ? groupedMatchups[String(featured.matchup_id)]
      : null

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <Navbar />
      <LeagueTicker settings={tickerSettings} items={tickerItems || []} />
      <section className="border-b border-zinc-800 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.25),_transparent_35%),linear-gradient(to_bottom,_#064e3b,_#09090b)] px-4 py-12">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-black uppercase tracking-[0.35em] text-emerald-300">
            League Letter
          </p>

          <div className="mt-4 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <h1 className="max-w-4xl text-5xl font-black tracking-tight md:text-7xl">
                {league?.name}
              </h1>

              <p className="mt-4 text-lg text-zinc-300">
                Season {selectedSeason} · Week {selectedWeek} ·{' '}
                {league?.total_rosters || teams?.length || 0} teams
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href={`/league/${leagueId}/winners`}
                className="rounded-2xl border border-white/20 bg-white/10 px-5 py-3 font-black backdrop-blur transition hover:bg-white/20"
              >
                Trophy Room
              </Link>
              <Link
                href={`/league/${leagueId}/drafts`}
                className="rounded-2xl border border-white/20 bg-white/10 px-5 py-3 font-black backdrop-blur transition hover:bg-white/20"
              >
                Draft Room
              </Link>
              <Link
                href={`/league/${leagueId}/trade-center`}
                className="rounded-2xl border border-white/20 bg-white/10 px-5 py-3 font-black backdrop-blur transition hover:bg-white/20"
              >
                Trade Center
              </Link>
              {user ? (
                <Link
                  href={`/league/${leagueId}/articles/new`}
                  className="rounded-2xl bg-emerald-500 px-5 py-3 font-black text-zinc-950 transition hover:bg-emerald-400"
                >
                  Write Article
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="rounded-2xl bg-emerald-500 px-5 py-3 font-black text-zinc-950 transition hover:bg-emerald-400"
                >
                  Log in to Write
                </Link>
              )}

              {isAdmin && (
                <Link
                  href={`/league/${leagueId}/admin`}
                  className="rounded-2xl border border-white/20 bg-white/10 px-5 py-3 font-black backdrop-blur transition hover:bg-white/20"
                >
                  Admin
                </Link>
              )}
            </div>
          </div>

          {latestBreakingNews && (
            <div className="mt-8 overflow-hidden rounded-[2rem] border border-emerald-500/40 bg-zinc-950 shadow-2xl">
              <div className="flex items-center gap-3 border-b border-emerald-500/20 bg-emerald-500 px-5 py-3 text-zinc-950">
                <span className="rounded-full bg-zinc-950 px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-emerald-400">
                  Breaking
                </span>
                <p className="font-black uppercase tracking-[0.15em]">
                  League Alert
                </p>
              </div>

              <div className="p-5">
                <h2 className="text-3xl font-black">
                  {latestBreakingNews.title}
                </h2>

                <p className="mt-2 leading-7 text-zinc-300">
                  {latestBreakingNews.message}
                </p>

                <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
                  Posted {formatDateTime(latestBreakingNews.created_at)}
                </p>
              </div>
            </div>
          )}

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <StatCard
              icon={<Trophy size={20} />}
              label="League Leader"
              value={leader?.team_name || 'No teams'}
              subvalue={
                leader
                  ? `${leader.wins}-${leader.losses}${leader.ties ? `-${leader.ties}` : ''
                  } · ${Number(leader.points_for).toFixed(1)} PF`
                  : 'Sync needed'
              }
            />

            <StatCard
              icon={<TrendingUp size={20} />}
              label="Highest Scoring"
              value={highestScoringTeam?.team_name || 'No data'}
              subvalue={
                highestScoringTeam
                  ? `${Number(highestScoringTeam.points_for).toFixed(1)} PF`
                  : 'Sync needed'
              }
            />

            <StatCard
              icon={<Users size={20} />}
              label="Teams"
              value={String(teamsForSelectedSeason?.length || 0)}
              subvalue="Synced from Sleeper"
            />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <LeagueActionLink
              href={`/league/${leagueId}/trade-center`}
              eyebrow="Trades"
              title="Trade Center"
              description="Trade history, superlatives, and trade trees."
            />
            <LeagueActionLink
              href={`/league/${leagueId}/transactions`}
              eyebrow="Activity"
              title="Transactions"
              description="Adds, drops, waivers, and league moves."
            />
            <LeagueActionLink
              href={`/league/${leagueId}/drafts`}
              eyebrow="Drafts"
              title="Draft Room"
              description="Draft boards and pick ownership history."
            />
            <LeagueActionLink
              href={`/league/${leagueId}/winners`}
              eyebrow="History"
              title="Trophy Room"
              description="Champions and division winners by year."
            />
          </div>

          <LeagueWeekSelector
            leagueId={leagueId}
            seasons={availableSeasons.length ? availableSeasons : [selectedSeason]}
            selectedSeason={selectedSeason}
            selectedWeek={selectedWeek}
          />
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 lg:grid-cols-[1.65fr_0.95fr]">
        <div className="space-y-6">
          <section className="rounded-[2rem] border border-emerald-900/70 bg-zinc-900 p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500 text-zinc-950">
                <Swords size={22} />
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-400">
                  Featured Matchup
                </p>
                <h2 className="text-3xl font-black">
                  {featured?.headline || 'No featured matchup yet'}
                </h2>
              </div>
            </div>

            {featuredTeams ? (
              <div className="mt-6">
                {showProjectedWinChances && featuredTeams[0] && featuredTeams[1] && (
                  <FeaturedWinChanceOverlay
                    firstTeam={featuredTeams[0]}
                    secondTeam={featuredTeams[1]}
                    teamByRosterId={teamByRosterId}
                  />
                )}

                <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
                  <FeaturedTeam
                    team={featuredTeams[0]}
                    leagueId={leagueId}
                    selectedSeason={selectedSeason}
                  />

                  <div className="text-center text-xl font-black text-zinc-500">
                    VS
                  </div>

                  <FeaturedTeam
                    team={featuredTeams[1]}
                    leagueId={leagueId}
                    selectedSeason={selectedSeason}
                  />
                </div>

                {featured?.description && (
                  <p className="mt-5 rounded-2xl bg-zinc-950 p-4 leading-7 text-zinc-300">
                    {featured.description}
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-5 rounded-2xl bg-zinc-950 p-4 text-zinc-400">
                Admin can choose a matchup from the admin dashboard for this
                season/week.
              </p>
            )}
          </section>

          <section className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-zinc-500">
                  Season {selectedSeason} · Week {selectedWeek}
                </p>
                <h2 className="text-3xl font-black">Matchups</h2>
              </div>

              <Link
                href={`/league/${leagueId}/matchups?season=${selectedSeason}&week=${selectedWeek}`}
                className="text-sm font-bold text-emerald-400 hover:text-emerald-300"
              >
                View all →
              </Link>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {Object.entries(groupedMatchups)
                .slice(0, 4)
                .map(([matchupId, teams]) => (
                  <MatchupCard
                    key={matchupId}
                    matchupId={matchupId}
                    teams={teams}
                    leagueId={leagueId}
                    selectedSeason={selectedSeason}
                    teamByRosterId={teamByRosterId}
                    showProjectedWinChances={showProjectedWinChances}
                  />
                ))}

              {!matchups?.length && (
                <p className="text-zinc-400">
                  No matchup data found for this season/week. Admin should sync
                  Sleeper data.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-zinc-500">
                  Newsroom
                </p>
                <h2 className="text-3xl font-black">Latest Articles</h2>
              </div>

              {user ? (
                <Link
                  href={`/league/${leagueId}/articles/new`}
                  className="text-sm font-bold text-emerald-400 hover:text-emerald-300"
                >
                  Write →
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="text-sm font-bold text-emerald-400 hover:text-emerald-300"
                >
                  Log in to write →
                </Link>
              )}
            </div>

            <div className="mt-5 grid gap-4">
              {articles?.map((article: any) => (
                <Link
                  key={article.id}
                  href={`/league/${leagueId}/articles/${article.id}`}
                  className="block rounded-2xl border border-zinc-800 bg-zinc-950 p-5 transition hover:border-emerald-500"
                >
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">
                    {article.profiles?.display_name ||
                      article.profiles?.email ||
                      'League Writer'}
                  </p>

                  <h3 className="mt-2 text-2xl font-black">{article.title}</h3>

                  {article.subtitle && (
                    <p className="mt-1 text-zinc-400">{article.subtitle}</p>
                  )}

                  <p className="mt-4 line-clamp-3 leading-7 text-zinc-300">
                    {stripHtml(article.body)}
                  </p>

                  <p className="mt-4 text-sm font-black text-emerald-400">
                    Read article →
                  </p>
                </Link>
              ))}

              {!articles?.length && (
                <p className="text-zinc-400">
                  No articles have been published yet.
                </p>
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-black">Power Rankings</h2>

              <Link
                href={`/league/${leagueId}/rankings?season=${selectedSeason}&week=${selectedWeek}`}
                className="text-sm font-bold text-emerald-400 hover:text-emerald-300"
              >
                Full list →
              </Link>
            </div>

            <div className="mt-5 space-y-3">
              {rankings?.slice(0, 5).map((ranking: any) => (
                <div
                  key={ranking.id}
                  className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"
                >
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">
                    Rank #{ranking.rank}
                  </p>
                  <h3 className="mt-1 text-lg font-black">
                    {ranking.team_name}
                  </h3>
                  {ranking.blurb && (
                    <p className="mt-2 text-sm leading-6 text-zinc-400">
                      {ranking.blurb}
                    </p>
                  )}
                </div>
              ))}

              {!rankings?.length && (
                <p className="text-zinc-400">
                  No power rankings have been posted for this season/week.
                </p>
              )}
            </div>
          </section>

          <MostRecentTransactionPanel
            leagueId={leagueId}
            selectedSeason={selectedSeason}
            initialTransaction={mostRecentTransaction || null}
            initialPlayers={sleeperPlayers}
            initialTeams={teams || []}
          />

          <section className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="text-3xl font-black">Standings</h2>

            <div className="mt-5 space-y-3">
              {teamsForSelectedSeason?.map((team: any, index: number) => (
                <div
                  key={`${team.season || selectedSeason}-${team.sleeper_roster_id}`}
                  className="flex items-center justify-between rounded-2xl bg-zinc-950 p-4"
                >
                  <div>
                    <Link
                      href={`/league/${leagueId}/teams/${team.sleeper_roster_id}?season=${selectedSeason}`}
                      className="font-black hover:text-emerald-400"
                    >
                      #{index + 1} {team.team_name}
                    </Link>

                    <p className="text-sm text-zinc-500">
                      {team.wins}-{team.losses}
                      {team.ties ? `-${team.ties}` : ''}
                    </p>
                  </div>

                  <p className="font-black text-emerald-400">
                    {Number(team.points_for).toFixed(1)}
                  </p>
                </div>
              ))}

              {!teamsForSelectedSeason?.length && (
                <p className="text-zinc-400">No standings found.</p>
              )}
            </div>
          </section>
        </aside>
      </section>
    </main>
  )
}


function LeagueActionLink({
  href,
  eyebrow,
  title,
  description,
}: {
  href: string
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <Link
      href={href}
      className="group rounded-[1.5rem] border border-white/10 bg-zinc-950/60 p-4 shadow-lg backdrop-blur transition hover:-translate-y-0.5 hover:border-emerald-400/60 hover:bg-zinc-950"
    >
      <p className="text-[0.65rem] font-black uppercase tracking-[0.25em] text-emerald-300">
        {eyebrow}
      </p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <h3 className="text-lg font-black text-white">{title}</h3>
        <span className="rounded-full bg-white/10 px-2 py-1 text-sm font-black text-emerald-300 transition group-hover:bg-emerald-400 group-hover:text-zinc-950">
          →
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-zinc-400">{description}</p>
    </Link>
  )
}

function StatCard({
  icon,
  label,
  value,
  subvalue,
}: {
  icon: React.ReactNode
  label: string
  value: string
  subvalue: string
}) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/10 p-5 backdrop-blur">
      <div className="flex items-center gap-3 text-emerald-300">
        {icon}
        <p className="text-xs font-black uppercase tracking-[0.25em]">
          {label}
        </p>
      </div>
      <h3 className="mt-3 truncate text-2xl font-black">{value}</h3>
      <p className="mt-1 text-sm text-zinc-300">{subvalue}</p>
    </div>
  )
}

function FeaturedTeam({
  team,
  leagueId,
  selectedSeason,
}: {
  team: any
  leagueId: string
  selectedSeason: string
}) {
  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 text-center">
      <Link
        href={`/league/${leagueId}/teams/${team?.sleeper_roster_id}?season=${selectedSeason}`}
        className="text-xl font-black hover:text-emerald-400"
      >
        {team?.team_name || 'Unknown Team'}
      </Link>

      <p className="mt-2 text-5xl font-black text-emerald-400">
        {Number(team?.points || 0).toFixed(2)}
      </p>

      <p className="mt-2 text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
        Roster {team?.sleeper_roster_id}
      </p>
    </div>
  )
}

function MatchupCard({
  matchupId,
  teams,
  leagueId,
  selectedSeason,
  teamByRosterId,
  showProjectedWinChances,
}: {
  matchupId: string
  teams: any[]
  leagueId: string
  selectedSeason: string
  teamByRosterId: Map<number, any>
  showProjectedWinChances: boolean
}) {
  const first = teams[0]
  const second = teams[1]

  const firstProfile = first
    ? teamByRosterId.get(Number(first.sleeper_roster_id))
    : null

  const secondProfile = second
    ? teamByRosterId.get(Number(second.sleeper_roster_id))
    : null

  const prediction =
    firstProfile && secondProfile
      ? calculateWinChances(firstProfile, secondProfile)
      : null

  return (
    <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
      {showProjectedWinChances && prediction && (
        <div className="mb-4 grid overflow-hidden rounded-2xl border border-zinc-800 md:grid-cols-2">
          <WinChanceOverlay
            label={first?.team_name || 'Team A'}
            chance={prediction.firstChance}
          />
          <WinChanceOverlay
            label={second?.team_name || 'Team B'}
            chance={prediction.secondChance}
          />
        </div>
      )}

      <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
        Matchup {matchupId}
      </p>

      <SmallTeamRow
        team={first}
        leagueId={leagueId}
        selectedSeason={selectedSeason}
      />

      <div className="my-3 border-t border-zinc-800" />

      {second ? (
        <SmallTeamRow
          team={second}
          leagueId={leagueId}
          selectedSeason={selectedSeason}
        />
      ) : (
        <p className="text-sm text-zinc-500">No opponent found</p>
      )}

      {showProjectedWinChances && prediction && (
        <p className="mt-4 text-xs leading-5 text-zinc-500">
          Projected using last season average points/week and weekly volatility.
        </p>
      )}
    </div>
  )
}

function SmallTeamRow({
  team,
  leagueId,
  selectedSeason,
}: {
  team: any
  leagueId: string
  selectedSeason: string
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <Link
          href={`/league/${leagueId}/teams/${team?.sleeper_roster_id}?season=${selectedSeason}`}
          className="font-black hover:text-emerald-400"
        >
          {team?.team_name}
        </Link>

        <p className="text-xs text-zinc-500">Roster {team?.sleeper_roster_id}</p>
      </div>

      <p className="text-2xl font-black text-emerald-400">
        {Number(team?.points || 0).toFixed(2)}
      </p>
    </div>
  )
}

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function formatDateTime(dateString: string) {
  return new Date(dateString).toISOString().replace('T', ' ').slice(0, 16)
}

function WinChanceOverlay({
  label,
  chance,
}: {
  label: string
  chance: number
}) {
  const isFavored = chance >= 50

  return (
    <div
      className={`p-3 ${isFavored
        ? 'bg-emerald-500/15 text-emerald-300'
        : 'bg-red-500/10 text-red-300'
        }`}
    >
      <p className="truncate text-xs font-black uppercase tracking-[0.2em]">
        {label}
      </p>
      <p className="mt-1 text-2xl font-black">{chance.toFixed(1)}%</p>
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-70">
        Win chance
      </p>
    </div>
  )
}

function calculateWinChances(firstTeam: any, secondTeam: any) {
  const firstAvg = Number(firstTeam.avg_points_per_week)
  const secondAvg = Number(secondTeam.avg_points_per_week)

  const firstSd = Math.max(Number(firstTeam.points_std_dev || 0), 1)
  const secondSd = Math.max(Number(secondTeam.points_std_dev || 0), 1)

  if (!Number.isFinite(firstAvg) || !Number.isFinite(secondAvg)) {
    return null
  }

  const combinedSd = Math.sqrt(firstSd ** 2 + secondSd ** 2)

  if (!combinedSd || !Number.isFinite(combinedSd)) {
    return null
  }

  const z = (firstAvg - secondAvg) / combinedSd
  const firstChance = normalCdf(z) * 100
  const secondChance = 100 - firstChance

  return {
    firstChance,
    secondChance,
  }
}

function normalCdf(z: number) {
  return 0.5 * (1 + erf(z / Math.sqrt(2)))
}

function erf(x: number) {
  const sign = x >= 0 ? 1 : -1
  const absX = Math.abs(x)

  const a1 = 0.254829592
  const a2 = -0.284496736
  const a3 = 1.421413741
  const a4 = -1.453152027
  const a5 = 1.061405429
  const p = 0.3275911

  const t = 1 / (1 + p * absX)

  const y =
    1 -
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) *
      t *
      Math.exp(-absX * absX))

  return sign * y
}

function FeaturedWinChanceOverlay({
  firstTeam,
  secondTeam,
  teamByRosterId,
}: {
  firstTeam: any
  secondTeam: any
  teamByRosterId: Map<number, any>
}) {
  const firstProfile = teamByRosterId.get(Number(firstTeam.sleeper_roster_id))
  const secondProfile = teamByRosterId.get(Number(secondTeam.sleeper_roster_id))

  const prediction =
    firstProfile && secondProfile
      ? calculateWinChances(firstProfile, secondProfile)
      : null

  if (!prediction) return null

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
      <div className="grid md:grid-cols-2">
        <WinChanceOverlay
          label={firstTeam?.team_name || 'Team A'}
          chance={prediction.firstChance}
        />

        <WinChanceOverlay
          label={secondTeam?.team_name || 'Team B'}
          chance={prediction.secondChance}
        />
      </div>

      <div className="border-t border-zinc-800 px-4 py-2">
        <p className="text-xs text-zinc-500">
          Projected using last season average points/week and weekly volatility.
        </p>
      </div>
    </div>
  )
}

function shouldShowProjectedWinChances(leagueStatus?: string | null) {
  const status = String(leagueStatus || '').toLowerCase()

  // Sleeper usually treats non-active leagues as not in-season.
  // For your use case, show projections all offseason.
  const isInSeason = status === 'in_season'

  if (!isInSeason) {
    return true
  }

  const day = new Date().getDay()

  // Sunday = 0, Monday = 1, Tuesday = 2, ... Saturday = 6
  const isTuesdayThroughSaturday = day >= 2 && day <= 6

  return isTuesdayThroughSaturday
}