import Link from '@/components/NoPrefetchLink'
import Navbar from '@/components/Navbar'
import TeamSeasonSelector from '@/components/TeamSeasonSelector'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function TeamRosterPage({
    params,
    searchParams,
}: {
    params: Promise<{ leagueId: string; teamId: string }>
    searchParams: Promise<{ season?: string }>
}) {
    const { leagueId, teamId } = await params
    const { season } = await searchParams

    const supabase = await createClient()

    const { data: league } = await supabase
        .from('leagues')
        .select('*')
        .eq('id', leagueId)
        .maybeSingle()

    if (!league) {
        redirect('/')
    }

    let team: any = null

    const { data: teamById } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .eq('league_id', leagueId)
        .maybeSingle()

    team = teamById

    if (!team) {
        const { data: matchupRow } = await supabase
            .from('matchups')
            .select('*')
            .eq('id', teamId)
            .eq('league_id', leagueId)
            .maybeSingle()

        if (matchupRow?.sleeper_roster_id) {
            const { data: teamFromMatchup } = await supabase
                .from('teams')
                .select('*')
                .eq('league_id', leagueId)
                .eq('sleeper_roster_id', matchupRow.sleeper_roster_id)
                .maybeSingle()

            team = teamFromMatchup
        }
    }

    if (!team && !Number.isNaN(Number(teamId))) {
        const { data: teamByRosterId } = await supabase
            .from('teams')
            .select('*')
            .eq('league_id', leagueId)
            .eq('sleeper_roster_id', Number(teamId))
            .maybeSingle()

        team = teamByRosterId
    }

    if (!team) {
        redirect(`/league/${leagueId}`)
    }

    const { data: seasonStatsRows } = await supabase
        .from('team_season_stats')
        .select('*')
        .eq('league_id', leagueId)

    const matchingSeasonStats =
        seasonStatsRows?.filter((row: any) => {
            const sameOwner =
                team.sleeper_owner_id &&
                row.sleeper_owner_id &&
                row.sleeper_owner_id === team.sleeper_owner_id

            const sameRoster =
                Number(row.sleeper_roster_id) === Number(team.sleeper_roster_id)

            return sameOwner || sameRoster
        }) || []

    const teamSeasonBySeason = new Map<string, any>()

    for (const row of matchingSeasonStats) {
        teamSeasonBySeason.set(String(row.season), row)
    }

    const { data: seasonWinners } = await supabase
        .from('season_winners')
        .select('*')
        .eq('league_id', leagueId)

    const leagueTitleYears = (seasonWinners || [])
        .filter((winner: any) => {
            const seasonTeamRow = teamSeasonBySeason.get(String(winner.season))

            if (seasonTeamRow) {
                return (
                    Number(seasonTeamRow.sleeper_roster_id) ===
                    Number(winner.champion_roster_id)
                )
            }

            return Number(team.sleeper_roster_id) === Number(winner.champion_roster_id)
        })
        .map((winner: any) => String(winner.season))
        .sort((a: string, b: string) => Number(b) - Number(a))

    const divisionTitleYears = buildDivisionTitleYears(
        seasonStatsRows || [],
        matchingSeasonStats
    )

    const hasDivisionData = (seasonStatsRows || []).some((row: any) => {
        const divisionId = row.division_id ?? row.division
        return divisionId !== null && divisionId !== undefined && divisionId !== ''
    })

    const seasons = Array.from(
        new Set(matchingSeasonStats.map((row: any) => String(row.season)))
    ).sort((a, b) => Number(b) - Number(a))

    const selectedSeason = season || league.season || seasons[0] || 'all'

    const selectedSeasonRow =
        selectedSeason === 'all'
            ? null
            : matchingSeasonStats.find(
                (row: any) => String(row.season) === String(selectedSeason)
            )

    const allTimeStats = matchingSeasonStats.reduce(
        (acc: any, row: any) => {
            acc.wins += Number(row.wins || 0)
            acc.losses += Number(row.losses || 0)
            acc.ties += Number(row.ties || 0)
            acc.points_for += Number(row.points_for || 0)
            acc.points_against += Number(row.points_against || 0)
            return acc
        },
        {
            wins: 0,
            losses: 0,
            ties: 0,
            points_for: 0,
            points_against: 0,
        }
    )

    const displayStats =
        selectedSeason === 'all'
            ? allTimeStats
            : selectedSeasonRow || team

    const rosterSource =
        selectedSeason === 'all'
            ? team
            : selectedSeasonRow || team

    const playerIds = rosterSource?.players || []

    const { data: localPlayers } = await supabase
        .from('players')
        .select('*')
        .in('id', playerIds.length ? playerIds : [''])

    const playersById = new Map<string, any>()

    for (const player of localPlayers || []) {
        playersById.set(player.id, player)
    }

    const playerRows =
        rosterSource?.players?.map((playerId: string) => {
            const player = playersById.get(playerId)

            return {
                id: playerId,
                name: player?.full_name || playerId,
                position: player?.position || '—',
                nflTeam: player?.team || 'FA',
                isStarter: rosterSource.starters?.includes(playerId),
            }
        }) || []

    const positionOrder: Record<string, number> = {
        QB: 1,
        RB: 2,
        WR: 3,
        TE: 4,
        K: 5,
        DEF: 6,
    }

    const sortedPlayers = playerRows.sort((a: any, b: any) => {
        if (a.isStarter && !b.isStarter) return -1
        if (!a.isStarter && b.isStarter) return 1

        const aOrder = positionOrder[a.position] || 99
        const bOrder = positionOrder[b.position] || 99

        if (aOrder !== bOrder) return aOrder - bOrder

        return a.name.localeCompare(b.name)
    })

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
                        Team Roster
                    </p>

                    <h1 className="mt-3 text-5xl font-black">{team.team_name}</h1>

                    <p className="mt-3 text-zinc-400">
                        {team.owner_name || 'Unknown owner'} ·{' '}
                        {selectedSeason === 'all' ? 'All Time' : selectedSeason}
                    </p>
                </div>
            </section>

            <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 lg:grid-cols-[1.4fr_0.8fr]">
                <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
                    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                        <div>
                            <h2 className="text-3xl font-black">Roster</h2>
                            <p className="mt-2 text-sm text-zinc-400">
                                {selectedSeason === 'all'
                                    ? 'Showing current roster with all-time stats.'
                                    : `Showing ${selectedSeason} roster if available.`}
                            </p>
                        </div>

                        <div className="w-full md:w-56">
                            <TeamSeasonSelector
                                leagueId={leagueId}
                                teamId={teamId}
                                selectedSeason={selectedSeason}
                                seasons={seasons}
                            />
                        </div>
                    </div>

                    <div className="mt-5 overflow-hidden rounded-2xl border border-zinc-800">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-zinc-950 text-xs uppercase tracking-[0.2em] text-zinc-500">
                                <tr>
                                    <th className="px-4 py-3">Player</th>
                                    <th className="px-4 py-3">Pos</th>
                                    <th className="px-4 py-3">NFL</th>
                                    <th className="px-4 py-3">Slot</th>
                                </tr>
                            </thead>

                            <tbody>
                                {sortedPlayers.map((player: any) => (
                                    <tr key={player.id} className="border-t border-zinc-800">
                                        <td className="px-4 py-3 font-bold">{player.name}</td>
                                        <td className="px-4 py-3 text-zinc-300">
                                            {player.position}
                                        </td>
                                        <td className="px-4 py-3 text-zinc-300">
                                            {player.nflTeam}
                                        </td>
                                        <td className="px-4 py-3">
                                            {player.isStarter ? (
                                                <span className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-black text-zinc-950">
                                                    Starter
                                                </span>
                                            ) : (
                                                <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-bold text-zinc-300">
                                                    Bench
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}

                                {!sortedPlayers.length && (
                                    <tr>
                                        <td
                                            colSpan={4}
                                            className="px-4 py-8 text-center text-zinc-400"
                                        >
                                            No roster data found. Go to Admin and sync Sleeper data.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <aside className="space-y-4">
                    <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
                        <h2 className="text-3xl font-black">Team Card</h2>

                        <div className="mt-5 rounded-[1.5rem] border border-amber-400/20 bg-black/15 p-5">
                            <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">
                                Trophy Case
                            </p>

                            <div className="mt-4 grid grid-cols-2 gap-3">
                                <div className="rounded-2xl bg-zinc-950/80 p-4 ring-1 ring-white/10">
                                    <p className="text-4xl font-black text-amber-300">
                                        {leagueTitleYears.length}
                                    </p>
                                    <p className="mt-1 text-xs font-black uppercase tracking-[0.18em] text-zinc-400">
                                        League Titles
                                    </p>
                                </div>

                                {hasDivisionData && (
                                    <div className="rounded-2xl bg-zinc-950/80 p-4 ring-1 ring-white/10">
                                        <p className="text-4xl font-black text-emerald-400">
                                            {divisionTitleYears.length}
                                        </p>
                                        <p className="mt-1 text-xs font-black uppercase tracking-[0.18em] text-zinc-400">
                                            Division Titles
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="mt-4 space-y-3 text-sm">
                                <TrophyYears label="League title years" years={leagueTitleYears} />
                                {hasDivisionData && (
                                    <TrophyYears
                                        label="Division title years"
                                        years={divisionTitleYears}
                                    />
                                )}
                            </div>
                        </div>

                        <div className="mt-4 rounded-2xl bg-zinc-950 p-5">
                            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">
                                Selected View
                            </p>
                            <p className="mt-2 text-4xl font-black">
                                {selectedSeason === 'all' ? 'All Time' : selectedSeason}
                            </p>
                        </div>

                        <div className="mt-4 rounded-2xl bg-zinc-950 p-5">
                            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">
                                Record
                            </p>
                            <p className="mt-2 text-4xl font-black">
                                {displayStats.wins}-{displayStats.losses}
                                {displayStats.ties ? `-${displayStats.ties}` : ''}
                            </p>
                        </div>

                        <div className="mt-4 rounded-2xl bg-zinc-950 p-5">
                            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">
                                Points For
                            </p>
                            <p className="mt-2 text-4xl font-black">
                                {Number(displayStats.points_for || 0).toFixed(1)}
                            </p>
                        </div>

                        <div className="mt-4 rounded-2xl bg-zinc-950 p-5">
                            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">
                                Points Against
                            </p>
                            <p className="mt-2 text-4xl font-black">
                                {Number(displayStats.points_against || 0).toFixed(1)}
                            </p>
                        </div>
                    </div>
                </aside>
            </section>
        </main>
    )
}

function TrophyYears({ label, years }: { label: string; years: string[] }) {
    return (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
                {label}
            </p>

            {years.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                    {years.map((year) => (
                        <span
                            key={`${label}-${year}`}
                            className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-black text-zinc-200"
                        >
                            {year}
                        </span>
                    ))}
                </div>
            ) : (
                <p className="mt-2 text-sm text-zinc-500">None yet</p>
            )}
        </div>
    )
}

function buildDivisionTitleYears(allSeasonRows: any[], teamSeasonRows: any[]) {
    const teamRowsBySeason = new Map<string, any>()

    for (const row of teamSeasonRows) {
        teamRowsBySeason.set(String(row.season), row)
    }

    const rowsBySeason = new Map<string, any[]>()

    for (const row of allSeasonRows) {
        const divisionId = row.division_id ?? row.division

        if (divisionId === null || divisionId === undefined || divisionId === '') {
            continue
        }

        const season = String(row.season)

        if (!rowsBySeason.has(season)) {
            rowsBySeason.set(season, [])
        }

        rowsBySeason.get(season)?.push(row)
    }

    const titleYears: string[] = []

    for (const [season, seasonRows] of rowsBySeason.entries()) {
        const teamRow = teamRowsBySeason.get(season)

        if (!teamRow) continue

        const teamDivisionId = teamRow.division_id ?? teamRow.division

        if (
            teamDivisionId === null ||
            teamDivisionId === undefined ||
            teamDivisionId === ''
        ) {
            continue
        }

        const divisionRows = seasonRows.filter(
            (row) => String(row.division_id ?? row.division) === String(teamDivisionId)
        )

        const [divisionWinner] = [...divisionRows].sort((a, b) => {
            const winDiff = Number(b.wins || 0) - Number(a.wins || 0)
            if (winDiff !== 0) return winDiff

            const tieDiff = Number(b.ties || 0) - Number(a.ties || 0)
            if (tieDiff !== 0) return tieDiff

            return Number(b.points_for || 0) - Number(a.points_for || 0)
        })

        if (
            divisionWinner &&
            Number(divisionWinner.sleeper_roster_id) === Number(teamRow.sleeper_roster_id)
        ) {
            titleYears.push(season)
        }
    }

    return titleYears.sort((a, b) => Number(b) - Number(a))
}

