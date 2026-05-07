import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getSleeperLeague,
  getSleeperTransactions,
} from '@/lib/sleeper'

export const dynamic = 'force-dynamic'

const TRANSACTION_SYNC_COOLDOWN_SECONDS = 90

export async function POST(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ leagueId: string }>
  }
) {
  try {
    const { leagueId } = await params
    const supabase = createAdminClient()

    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('*')
      .eq('id', leagueId)
      .single()

    if (leagueError || !league) {
      return NextResponse.json(
        { error: 'League not found.' },
        { status: 404 }
      )
    }

    const syncKey = `league_transactions_${leagueId}`

    const { data: metadata } = await supabase
      .from('sync_metadata')
      .select('*')
      .eq('key', syncKey)
      .maybeSingle()

    if (metadata?.last_synced_at) {
      const lastSyncedAt = new Date(metadata.last_synced_at).getTime()
      const secondsSinceSync = (Date.now() - lastSyncedAt) / 1000

      if (secondsSinceSync < TRANSACTION_SYNC_COOLDOWN_SECONDS) {
        return NextResponse.json({
          skipped: true,
          reason: 'Recently synced.',
          lastSyncedAt: metadata.last_synced_at,
        })
      }
    }

    const sleeperLeague = await getSleeperLeague(league.sleeper_league_id)

    const weeksToSync = Array.from({ length: 18 }, (_, index) => index + 1)

    const allTransactions: any[] = []

    for (const week of weeksToSync) {
      try {
        const weekTransactions = await getSleeperTransactions(
          league.sleeper_league_id,
          week
        )

        for (const transaction of weekTransactions || []) {
          allTransactions.push({
            ...transaction,
            syncedWeek: week,
            syncedSeason: sleeperLeague.season,
            syncedSleeperLeagueId: league.sleeper_league_id,
          })
        }
      } catch {
        // Some weeks may not exist yet. Keep going.
      }
    }

    const transactionsToUpsert = allTransactions.map((transaction) => ({
      league_id: leagueId,
      sleeper_league_id: transaction.syncedSleeperLeagueId,
      sleeper_transaction_id: transaction.transaction_id,
      season: transaction.syncedSeason,
      week: transaction.syncedWeek,
      type: transaction.type,
      status: transaction.status,
      roster_ids: transaction.roster_ids || [],
      adds: transaction.adds || null,
      drops: transaction.drops || null,
      draft_picks: transaction.draft_picks || null,
      creator: transaction.creator,
      created_sleeper_at: transaction.created,
    }))

    let transactionsSynced = 0

    if (transactionsToUpsert.length > 0) {
      const chunkSize = 500

      for (let i = 0; i < transactionsToUpsert.length; i += chunkSize) {
        const chunk = transactionsToUpsert.slice(i, i + chunkSize)

        const { error } = await supabase.from('transactions').upsert(chunk, {
          onConflict: 'league_id,sleeper_transaction_id',
        })

        if (error) {
          throw new Error(error.message)
        }

        transactionsSynced += chunk.length
      }
    }

    const tradeNewsCreated = await createBreakingNewsForNewTrades({
      supabase,
      appLeagueId: leagueId,
      trades: allTransactions.filter(
        (transaction) => transaction.type === 'trade'
      ),
    })

    const now = new Date().toISOString()

    const { error: metadataError } = await supabase
      .from('sync_metadata')
      .upsert(
        {
          key: syncKey,
          last_synced_at: now,
          updated_at: now,
        },
        {
          onConflict: 'key',
        }
      )

    if (metadataError) {
      throw new Error(metadataError.message)
    }

    return NextResponse.json({
      skipped: false,
      transactionsSynced,
      tradeNewsCreated,
      lastSyncedAt: now,
    })
  } catch (error: any) {
    console.error('AUTO TRANSACTION SYNC ERROR:', error)

    return NextResponse.json(
      {
        error: error?.message || 'Failed to sync transactions.',
        stack: error?.stack || null,
      },
      {
        status: 500,
      }
    )
  }
}

async function createBreakingNewsForNewTrades({
  supabase,
  appLeagueId,
  trades,
}: {
  supabase: any
  appLeagueId: string
  trades: any[]
}) {
  if (!trades.length) return 0

  const sleeperTransactionIds = trades
    .map((trade) => trade.transaction_id)
    .filter(Boolean)

  if (!sleeperTransactionIds.length) return 0

  const { data: existingNews, error: existingNewsError } = await supabase
    .from('breaking_news')
    .select('source_sleeper_transaction_id')
    .eq('league_id', appLeagueId)
    .eq('source_type', 'trade')
    .in('source_sleeper_transaction_id', sleeperTransactionIds)

  if (existingNewsError) {
    throw new Error(existingNewsError.message)
  }

  const existingIds = new Set(
    (existingNews || []).map((row: any) => row.source_sleeper_transaction_id)
  )

  const newTrades = trades.filter(
    (trade) => !existingIds.has(trade.transaction_id)
  )

  if (!newTrades.length) return 0

  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('*')
    .eq('league_id', appLeagueId)

  if (teamsError) {
    throw new Error(teamsError.message)
  }

  const teamByRosterId = new Map<number, any>()

  for (const team of teams || []) {
    teamByRosterId.set(Number(team.sleeper_roster_id), team)
  }

  const rows = newTrades.map((trade) => {
    const tradeTeams = (trade.roster_ids || [])
      .map((rosterId: number) => teamByRosterId.get(Number(rosterId)))
      .filter(Boolean)

    const firstTeam =
      tradeTeams[0]?.team_name || `Roster ${trade.roster_ids?.[0] || ''}`

    const secondTeam =
      tradeTeams[1]?.team_name || `Roster ${trade.roster_ids?.[1] || ''}`

    return {
      league_id: appLeagueId,
      title: 'BLOCKBUSTER TRADE',
      message:
        firstTeam && secondTeam
          ? `${firstTeam} and ${secondTeam} have completed a trade.`
          : 'A new trade has been completed in the league.',
      is_active: true,
      source_type: 'trade',
      source_sleeper_transaction_id: trade.transaction_id,
      href: `/league/${appLeagueId}/transactions?type=trade`,
      updated_at: new Date().toISOString(),
    }
  })

  const { error } = await supabase.from('breaking_news').upsert(rows, {
    onConflict: 'league_id,source_type,source_sleeper_transaction_id',
  })

  if (error) {
    throw new Error(error.message)
  }

  return rows.length
}