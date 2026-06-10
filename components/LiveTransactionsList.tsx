'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import TransactionCard from '@/components/TransactionCard'


export default function LiveTransactionsList({
  leagueId,
  initialTransactions,
  initialPlayers,
  initialTeams,
  selectedSeason,
  selectedType,
  selectedTeam,
  pageSize,
}: {
  leagueId: string
  initialTransactions: any[]
  initialPlayers: Record<string, any>
  initialTeams: any[]
  selectedSeason: string
  selectedType: string
  selectedTeam: string
  pageSize: number
}) {
  const supabase = useMemo(() => createClient(), [])
  const [transactions, setTransactions] = useState<any[]>(initialTransactions || [])
  const [players, setPlayers] = useState<Record<string, any>>(initialPlayers || {})
  const [teams, setTeams] = useState<any[]>(initialTeams || [])
  const [checking, setChecking] = useState(false)
  const [message, setMessage] = useState('Transactions are updating in the background every minute.')
  const [highlightKeys, setHighlightKeys] = useState<Set<string>>(new Set())
  const knownKeysRef = useRef(new Set((initialTransactions || []).map(getTransactionKey).filter(Boolean)))

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

      let query = supabase
        .from('transactions')
        .select('*')
        .eq('league_id', leagueId)
        .order('created_sleeper_at', { ascending: false })
        .limit(pageSize)

      if (selectedType === 'trade') query = query.eq('type', 'trade')
      if (selectedType === 'waiver') query = query.eq('type', 'waiver')
      if (selectedType === 'free_agent') query = query.eq('type', 'free_agent')
      if (selectedType === 'moves') query = query.in('type', ['waiver', 'free_agent'])
      if (selectedTeam) query = query.contains('roster_ids', [Number(selectedTeam)])
      if (selectedSeason) query = query.eq('season', selectedSeason)

      const { data: latestTransactions } = await query
      const nextTransactions = latestTransactions || []
      const nextKeys = nextTransactions.map(getTransactionKey).filter(Boolean)
      const newKeys = new Set<string>()

      for (const key of nextKeys) {
        if (!knownKeysRef.current.has(key)) newKeys.add(key)
      }


      knownKeysRef.current = new Set(nextKeys)
      setTransactions(nextTransactions)

      const { data: latestTeams } = await supabase
        .from('teams')
        .select('*')
        .eq('league_id', leagueId)
      setTeams(latestTeams || [])

      const playerIds = new Set<string>()
      for (const transaction of nextTransactions) {
        if (transaction.adds) Object.keys(transaction.adds).forEach((id) => playerIds.add(id))
        if (transaction.drops) Object.keys(transaction.drops).forEach((id) => playerIds.add(id))
      }

      if (playerIds.size) {
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

      if (newKeys.size) {
        setHighlightKeys(newKeys)
      }

      setMessage(newKeys.size ? 'New transaction found and added without refreshing.' : 'No new transactions found.')
    } catch {
      setMessage('Could not check transactions. The current list stayed as-is.')
    } finally {
      setChecking(false)
    }
  }, [leagueId, pageSize, selectedSeason, selectedTeam, selectedType, supabase])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void refreshTransactions()
    }, 60_000)

    return () => window.clearInterval(intervalId)
  }, [refreshTransactions])

  return (
    <div>
      <div className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-zinc-300">{message}</p>
            <p className="mt-1 text-xs text-zinc-500">This section updates in-place. The page does not refresh.</p>
          </div>

        </div>
        {checking && (
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-emerald-400" />
          </div>
        )}
      </div>

      <div className="space-y-4">
        {transactions.map((transaction: any) => {
          const key = getTransactionKey(transaction)
          return (
            <TransactionCard
              key={key || transaction.id}
              transaction={transaction}
              sleeperPlayers={players}
              teamByRosterId={teamByRosterId}
              highlight={Boolean(key && highlightKeys.has(key))}
            />
          )
        })}

        {!transactions.length && (
          <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-8 text-zinc-400">
            No transactions found with these filters.
          </div>
        )}
      </div>
    </div>
  )
}

function getTransactionKey(transaction: any) {
  return String(transaction?.sleeper_transaction_id || transaction?.id || '')
}
