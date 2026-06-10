'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from '@/components/NoPrefetchLink'
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
  const supabase = useMemo(() => createClient(), [])

  const [transaction, setTransaction] = useState<any>(initialTransaction)
  const [players, setPlayers] = useState<Record<string, any>>(initialPlayers || {})
  const [teams, setTeams] = useState<any[]>(initialTeams || [])
  const [checking, setChecking] = useState(false)
  const [message, setMessage] = useState('Latest transaction updates in the background every minute.')
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null)
  const [glowVersion, setGlowVersion] = useState(0)
  const latestTransactionIdRef = useRef(getTransactionKey(initialTransaction))

  const teamByRosterId = useMemo(() => {
    const map = new Map<number, any>()
    for (const team of teams || []) map.set(Number(team.sleeper_roster_id), team)
    return map
  }, [teams])

  const refreshTransactions = useCallback(async () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return

    setChecking(true)
    setMessage('Checking Sleeper for new transactions...')

    try {
      await fetch(`/api/league/${leagueId}/sync-transactions`, { method: 'POST' })

      const { data: latestTransactions } = await supabase
        .from('transactions')
        .select('*')
        .eq('league_id', leagueId)
        .eq('season', selectedSeason)
        .order('created_sleeper_at', { ascending: false })
        .limit(1)

      const latestTransaction = latestTransactions?.[0] || null
      const nextKey = getTransactionKey(latestTransaction)
      const previousKey = latestTransactionIdRef.current
      const isNewTransaction = Boolean(nextKey && nextKey !== previousKey)

      latestTransactionIdRef.current = nextKey
      setTransaction(latestTransaction)

      const { data: latestTeams } = await supabase
        .from('teams')
        .select('*')
        .eq('league_id', leagueId)

      setTeams(latestTeams || [])

      const playerIds = new Set<string>()
      if (latestTransaction?.adds) Object.keys(latestTransaction.adds).forEach((id) => playerIds.add(id))
      if (latestTransaction?.drops) Object.keys(latestTransaction.drops).forEach((id) => playerIds.add(id))

      if (playerIds.size > 0) {
        const { data: playerRows } = await supabase
          .from('players')
          .select('*')
          .in('id', Array.from(playerIds))

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
      } else {
        setPlayers({})
      }

      if (isNewTransaction && nextKey) {
        setHighlightedKey(String(nextKey))
        setGlowVersion((version) => version + 1)
      }

      setMessage(
        isNewTransaction
          ? 'New transaction found and added without refreshing the page.'
          : 'No new transactions found.'
      )
    } catch {
      setMessage('Could not check transactions. The current page stayed as-is.')
    } finally {
      setChecking(false)
    }
  }, [leagueId, selectedSeason, supabase])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void refreshTransactions()
    }, 60_000)

    return () => window.clearInterval(intervalId)
  }, [refreshTransactions])

  return (
    <section className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-3xl font-black">Most Recent Transaction</h2>
          <p className="mt-2 text-sm text-zinc-500">{message}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/league/${leagueId}/transactions?season=${selectedSeason}`}
            className="rounded-xl border border-white/10 px-3 py-2 text-sm font-black text-emerald-400 hover:bg-white/5"
          >
            View all →
          </Link>

        </div>
      </div>

      {checking && (
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-zinc-800">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-emerald-400" />
        </div>
      )}

      <div className="mt-5">
        {transaction ? (
          <TransactionCard
            key={`${getTransactionKey(transaction)}-${highlightedKey === getTransactionKey(transaction) ? glowVersion : 0}`}
            transaction={transaction}
            sleeperPlayers={players}
            teamByRosterId={teamByRosterId}
            highlight={highlightedKey === getTransactionKey(transaction)}
          />
        ) : (
          <p className="text-zinc-400">No transactions synced for this season.</p>
        )}
      </div>
    </section>
  )
}

function getTransactionKey(transaction: any) {
  return transaction?.sleeper_transaction_id || transaction?.id || null
}
