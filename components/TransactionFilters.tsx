'use client'

import { useRouter, useSearchParams } from 'next/navigation'

export default function TransactionFilters({
    leagueId,
    teams,
    seasons = [],
    selectedType,
    selectedTeam,
    selectedSeason,
}: {
    leagueId: string
    teams: any[]
    seasons: string[]
    selectedType: string
    selectedTeam: string
    selectedSeason: string
}) {
    const router = useRouter()
    const searchParams = useSearchParams()

    function updateFilter(key: string, value: string) {
        const params = new URLSearchParams(searchParams.toString())

        if (value === 'all' || value === '') {
            params.delete(key)
        } else {
            params.set(key, value)
        }

        params.set('page', '1')

        router.push(`/league/${leagueId}/transactions?${params.toString()}`)
    }

    return (
        <div className="mt-8 rounded-[2rem] border border-zinc-800 bg-zinc-900 p-5">
            <div className="grid gap-4 md:grid-cols-3">
                <div>
                    <label className="text-sm font-bold text-zinc-400">
                        Transaction Type
                    </label>

                    <select
                        value={selectedType || 'all'}
                        onChange={(e) => updateFilter('type', e.target.value)}
                        className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 font-bold outline-none focus:border-emerald-500"
                    >
                        <option value="all">All Transactions</option>
                        <option value="trade">Trades Only</option>
                        <option value="moves">Waivers + Free Agents</option>
                        <option value="waiver">Waivers Only</option>
                        <option value="free_agent">Free Agents Only</option>
                    </select>
                </div>

                <div>
                    <label className="text-sm font-bold text-zinc-400">Team</label>

                    <select
                        value={selectedTeam || 'all'}
                        onChange={(e) => updateFilter('team', e.target.value)}
                        className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 font-bold outline-none focus:border-emerald-500"
                    >
                        <option value="all">All Teams</option>

                        {(teams || []).map((team) => (
                            <option key={team.id} value={String(team.sleeper_roster_id)}>
                                {team.team_name}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="text-sm font-bold text-zinc-400">Season</label>

                    <select
                        value={selectedSeason || 'all'}
                        onChange={(e) => updateFilter('season', e.target.value)}
                        className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 font-bold outline-none focus:border-emerald-500"
                    >
                        <option value="all">All Time</option>

                        {(seasons || []).map((season) => (
                            <option key={season} value={season}>
                                {season}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {(selectedType || selectedTeam || selectedSeason) && (
                <button
                    onClick={() => router.push(`/league/${leagueId}/transactions`)}
                    className="mt-4 rounded-xl border border-zinc-700 px-4 py-2 text-sm font-bold text-zinc-300 hover:bg-zinc-800"
                >
                    Clear Filters
                </button>
            )}
        </div>
    )
}