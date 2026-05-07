'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import TransactionCard from '@/components/TransactionCard'

export default function MostRecentTransactionPanel({
  leagueId,
  selectedSeason,
  initialTransaction,
  initialPlayers,
  initialTeams,
}: {
  leagueId: string
  selectedSeason: string
  initialTransaction: any
  initialPlayers: Record<string, any>
  initialTeams: any[]
}) {
  const supabase = createClient()

  const [transaction, setTransaction] = useState<any>(initialTransaction)
  const [players, setPlayers] = useState<Record<string, any>>(
    initialPlayers || {}
  )
  const [teams, setTeams] = useState<any[]>(initialTeams || [])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('Checking Sleeper for new moves...')

  const teamByRosterId = useMemo(() => {
    const map = new Map<number, any>()

    for (const team of teams || []) {
      map.set(Number(team.sleeper_roster_id), team)
    }

    return map
  }, [teams])

  useEffect(() => {
    let cancelled = false

    async function refreshTransactions() {
      setLoading(true)
      setMessage('Checking Sleeper for new moves...')

      try {
        await fetch(`/api/league/${leagueId}/sync-transactions`, {
          method: 'POST',
        })
      } catch {
        // Do not break the page if auto-sync fails.
      }

      if (cancelled) return

      setMessage('Loading latest transaction...')

      const { data: latestTransactions } = await supabase
        .from('transactions')
        .select('*')
        .eq('league_id', leagueId)
        .eq('season', selectedSeason)
        .order('created_sleeper_at', { ascending: false })
        .limit(1)

      if (cancelled) return

      const latestTransaction = latestTransactions?.[0] || null
      setTransaction(latestTransaction)

      const { data: latestTeams } = await supabase
        .from('teams')
        .select('*')
        .eq('league_id', leagueId)

      if (!cancelled) {
        setTeams(latestTeams || [])
      }

      const playerIds = new Set<string>()

      if (latestTransaction?.adds) {
        Object.keys(latestTransaction.adds).forEach((id) => playerIds.add(id))
      }

      if (latestTransaction?.drops) {
        Object.keys(latestTransaction.drops).forEach((id) => playerIds.add(id))
      }

      if (playerIds.size > 0) {
        const { data: playerRows } = await supabase
          .from('players')
          .select('*')
          .in('id', Array.from(playerIds))

        if (!cancelled) {
          const nextPlayers: Record<string, any> = {}

          for (const player of playerRows || []) {
            nextPlayers[player.id] = {
              first_name: player.first_name,
              last_name: player.last_name,
              full_name: player.full_name,
              position: player.position,
              team: player.team,
            }
          }

          setPlayers(nextPlayers)
        }
      } else if (!cancelled) {
        setPlayers({})
      }

      if (!cancelled) {
        setLoading(false)
        setMessage('')
      }
    }

    refreshTransactions()

    return () => {
      cancelled = true
    }
  }, [leagueId, selectedSeason, supabase])

  return (
    <section className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-3xl font-black">Most Recent Transaction</h2>

        <Link
          href={`/league/${leagueId}/transactions?season=${selectedSeason}`}
          className="text-sm font-bold text-emerald-400 hover:text-emerald-300"
        >
          View all →
        </Link>
      </div>

      <div className="mt-5">
        {loading && (
          <div className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-bold text-zinc-300">{message}</p>
              <div className="h-2 w-24 overflow-hidden rounded-full bg-zinc-800">
                <div className="h-full w-1/2 animate-pulse rounded-full bg-emerald-500" />
              </div>
            </div>
          </div>
        )}

        {transaction ? (
          <TransactionCard
            transaction={transaction}
            sleeperPlayers={players}
            teamByRosterId={teamByRosterId}
          />
        ) : (
          <p className="text-zinc-400">
            {loading
              ? 'Looking for transactions...'
              : 'No transactions synced for this season.'}
          </p>
        )}
      </div>
    </section>
  )
}