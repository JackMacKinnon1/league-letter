import Navbar from '@/components/Navbar'
import TradeCenter from '@/components/TradeCenter'
import { createClient } from '@/lib/supabase/server'

export default async function TradeCenterPage({
  params,
}: {
  params: Promise<{ leagueId: string }>
}) {
  const { leagueId } = await params
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

  const { data: trades } = await supabase
    .from('transactions')
    .select('*')
    .eq('league_id', leagueId)
    .eq('type', 'trade')
    .order('created_sleeper_at', { ascending: false })

  const playerIds = new Set<string>()

  for (const trade of trades || []) {
    if (trade.adds) {
      Object.keys(trade.adds).forEach((id) => playerIds.add(id))
    }

    if (trade.drops) {
      Object.keys(trade.drops).forEach((id) => playerIds.add(id))
    }
  }

  const playerIdList = Array.from(playerIds)
  let localPlayers: any[] = []

  if (playerIdList.length) {
    const { data } = await supabase
      .from('players')
      .select('*')
      .in('id', playerIdList)

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

  for (const player of localPlayers || []) {
    if (player.id) playersById[String(player.id)] = player
    if (player.sleeper_player_id) playersById[String(player.sleeper_player_id)] = player
  }

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
    </>
  )
}
