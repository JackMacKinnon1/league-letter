import Link from 'next/link'
import Navbar from '@/components/Navbar'
import TransactionCard from '@/components/TransactionCard'
import TransactionFilters from '@/components/TransactionFilters'
import { createClient } from '@/lib/supabase/server'

const PAGE_SIZE = 10

export default async function TransactionsPage({
    params,
    searchParams,
}: {
    params: Promise<{ leagueId: string }>
    searchParams: Promise<{
        page?: string
        type?: string
        team?: string
        season?: string
    }>
}) {
    const { leagueId } = await params
    const { page, type, team, season } = await searchParams

    const currentPage = Math.max(Number(page || 1), 1)
    const from = (currentPage - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    const selectedType = type || ''
    const selectedTeam = team || ''
    const selectedSeason = season || ''

    const supabase = await createClient()

    const { data: league } = await supabase
        .from('leagues')
        .select('*')
        .eq('id', leagueId)
        .single()

    const { data: teams } = await supabase
        .from('teams')
        .select('*')
        .eq('league_id', leagueId)
        .order('team_name', { ascending: true })

    const { data: transactionSeasonRows } = await supabase
        .from('transactions')
        .select('season')
        .eq('league_id', leagueId)
        .not('season', 'is', null)

    const seasons = Array.from(
        new Set((transactionSeasonRows || []).map((row: any) => String(row.season)))
    ).sort((a, b) => Number(b) - Number(a))

    let query = supabase
        .from('transactions')
        .select('*', { count: 'exact' })
        .eq('league_id', leagueId)
        .order('created_sleeper_at', { ascending: false })

    if (selectedType === 'trade') {
        query = query.eq('type', 'trade')
    }

    if (selectedType === 'waiver') {
        query = query.eq('type', 'waiver')
    }

    if (selectedType === 'free_agent') {
        query = query.eq('type', 'free_agent')
    }

    if (selectedType === 'moves') {
        query = query.in('type', ['waiver', 'free_agent'])
    }

    if (selectedTeam) {
        query = query.contains('roster_ids', [Number(selectedTeam)])
    }

    if (selectedSeason) {
        query = query.eq('season', selectedSeason)
    }

    const { data: transactions, count } = await query.range(from, to)

    const playerIds = new Set<string>()

    for (const transaction of transactions || []) {
        if (transaction.adds) {
            Object.keys(transaction.adds).forEach((id) => playerIds.add(id))
        }

        if (transaction.drops) {
            Object.keys(transaction.drops).forEach((id) => playerIds.add(id))
        }
    }

    const { data: localPlayers } = await supabase
        .from('players')
        .select('*')
        .in('id', playerIds.size ? Array.from(playerIds) : [''])

    const sleeperPlayers: Record<string, any> = {}

    for (const player of localPlayers || []) {
        sleeperPlayers[player.id] = {
            first_name: player.first_name,
            last_name: player.last_name,
            full_name: player.full_name,
            position: player.position,
            team: player.team,
        }
    }

    const teamByRosterId = new Map<number, any>()

    for (const teamRow of teams || []) {
        teamByRosterId.set(Number(teamRow.sleeper_roster_id), teamRow)
    }

    const totalPages = Math.max(Math.ceil((count || 0) / PAGE_SIZE), 1)
    const hasPrevious = currentPage > 1
    const hasNext = currentPage < totalPages

    const filterQuery = new URLSearchParams()

    if (selectedType) filterQuery.set('type', selectedType)
    if (selectedTeam) filterQuery.set('team', selectedTeam)
    if (selectedSeason) filterQuery.set('season', selectedSeason)

    const previousHref = `/league/${leagueId}/transactions?${new URLSearchParams({
        ...Object.fromEntries(filterQuery.entries()),
        page: String(currentPage - 1),
    }).toString()}`

    const nextHref = `/league/${leagueId}/transactions?${new URLSearchParams({
        ...Object.fromEntries(filterQuery.entries()),
        page: String(currentPage + 1),
    }).toString()}`

    const selectedTeamName =
        selectedTeam && teams
            ? teams.find((teamRow: any) => String(teamRow.sleeper_roster_id) === selectedTeam)
                ?.team_name
            : null

    return (
        <main className="min-h-screen bg-zinc-950 text-white">
            <Navbar />

            <section className="border-b border-zinc-800 bg-gradient-to-b from-emerald-950/50 to-zinc-950 px-4 py-10">
                <div className="mx-auto max-w-5xl">
                    <Link
                        href={`/league/${leagueId}`}
                        className="text-sm font-bold text-zinc-400 hover:text-white"
                    >
                        ← Back to league
                    </Link>

                    <p className="mt-6 text-sm font-black uppercase tracking-[0.3em] text-emerald-400">
                        Transaction Log
                    </p>

                    <h1 className="mt-3 text-5xl font-black">
                        {league?.name} Transactions
                    </h1>

                    <p className="mt-3 text-zinc-400">
                        Page {currentPage} of {totalPages}
                        {selectedType && (
                            <>
                                {' '}· Type: <span className="font-bold text-emerald-400">{formatTypeLabel(selectedType)}</span>
                            </>
                        )}
                        {selectedTeamName && (
                            <>
                                {' '}· Team: <span className="font-bold text-emerald-400">{selectedTeamName}</span>
                            </>
                        )}
                        {selectedSeason && (
                            <>
                                {' '}· Season:{' '}
                                <span className="font-bold text-emerald-400">{selectedSeason}</span>
                            </>
                        )}
                    </p>

                    <TransactionFilters
                        leagueId={leagueId}
                        teams={teams || []}
                        seasons={seasons || []}
                        selectedType={selectedType}
                        selectedTeam={selectedTeam}
                        selectedSeason={selectedSeason}
                    />
                </div>
            </section>

            <section className="mx-auto max-w-5xl px-4 py-8">
                <div className="space-y-4">
                    {transactions?.map((transaction: any) => (
                        <TransactionCard
                            key={transaction.id}
                            transaction={transaction}
                            sleeperPlayers={sleeperPlayers}
                            teamByRosterId={teamByRosterId}
                        />
                    ))}

                    {!transactions?.length && (
                        <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-8 text-zinc-400">
                            No transactions found with these filters.
                        </div>
                    )}
                </div>

                <div className="mt-8 flex items-center justify-between gap-3">
                    {hasPrevious ? (
                        <Link
                            href={previousHref}
                            className="rounded-2xl border border-zinc-700 px-5 py-3 font-black hover:bg-zinc-900"
                        >
                            ← Previous
                        </Link>
                    ) : (
                        <div />
                    )}

                    <p className="text-sm font-bold text-zinc-500">
                        {count || 0} matching transactions
                    </p>

                    {hasNext ? (
                        <Link
                            href={nextHref}
                            className="rounded-2xl border border-zinc-700 px-5 py-3 font-black hover:bg-zinc-900"
                        >
                            Next →
                        </Link>
                    ) : (
                        <div />
                    )}
                </div>
            </section>
        </main>
    )
}

function formatTypeLabel(type: string) {
    if (type === 'trade') return 'Trades'
    if (type === 'moves') return 'Waivers + Free Agents'
    if (type === 'waiver') return 'Waivers'
    if (type === 'free_agent') return 'Free Agents'
    return type
}