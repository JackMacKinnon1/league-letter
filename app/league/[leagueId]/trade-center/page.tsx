import Link from '@/components/NoPrefetchLink'
import Navbar from '@/components/Navbar'
import TradeCenter from '@/components/TradeCenter'
import { createClient } from '@/lib/supabase/server'

const PAGE_SIZE = 50

export default async function TradeCenterPage({
  params,
  searchParams,
}: {
  params: Promise<{ leagueId: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const { leagueId } = await params
  const { page } = await searchParams
  const currentPage = Math.max(1, Number(page || 1))
  const from = (currentPage - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
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
    .limit(64)

  const { data: trades, count } = await supabase
    .from('transactions')
    .select('*', { count: 'exact' })
    .eq('league_id', leagueId)
    .eq('type', 'trade')
    .order('created_sleeper_at', { ascending: false })
    .range(from, to)

  const playerIds = new Set<string>()
  for (const trade of trades || []) {
    if (trade.adds) Object.keys(trade.adds).forEach((id) => playerIds.add(id))
    if (trade.drops) Object.keys(trade.drops).forEach((id) => playerIds.add(id))
  }

  const playerIdList = Array.from(playerIds)
  let localPlayers: any[] = []
  if (playerIdList.length) {
    const { data } = await supabase.from('players').select('*').in('id', playerIdList)
    localPlayers = data || []

    const missingIds = playerIdList.filter(
      (playerId) => !localPlayers.some((player: any) => String(player.id) === String(playerId))
    )
    if (missingIds.length) {
      const { data: sleeperIdPlayers } = await supabase
        .from('players')
        .select('*')
        .in('sleeper_player_id', missingIds)
      localPlayers = [...localPlayers, ...(sleeperIdPlayers || [])]
    }
  }

  const playersById: Record<string, any> = {}
  for (const player of localPlayers) {
    if (player.id) playersById[String(player.id)] = player
    if (player.sleeper_player_id) playersById[String(player.sleeper_player_id)] = player
  }

  const totalPages = Math.max(1, Math.ceil((count || 0) / PAGE_SIZE))

  return (
    <>
      <Navbar />
      <TradeCenter
        leagueId={leagueId}
        leagueName={league?.name}
        trades={trades || []}
        teams={teams || []}
        players={playersById}
      />
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 pb-10">
        {currentPage > 1 ? (
          <Link href={`/league/${leagueId}/trade-center?page=${currentPage - 1}`} className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 font-bold text-white hover:border-zinc-500">
            ← Newer trades
          </Link>
        ) : <span />}
        <span className="text-sm font-black text-zinc-400">Page {currentPage} of {totalPages}</span>
        {currentPage < totalPages ? (
          <Link href={`/league/${leagueId}/trade-center?page=${currentPage + 1}`} className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 font-bold text-white hover:border-zinc-500">
            Older trades →
          </Link>
        ) : <span />}
      </div>
    </>
  )
}
