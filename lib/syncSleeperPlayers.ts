import { getSleeperPlayers } from '@/lib/sleeper'

export async function syncSleeperPlayers({
  supabase,
}: {
  supabase: any
}) {
  const sleeperPlayers = await getSleeperPlayers()

  const rows = Object.entries(sleeperPlayers).map(([playerId, player]: any) => {
    const firstName = player.first_name || ''
    const lastName = player.last_name || ''
    const fullName =
      player.full_name ||
      `${firstName} ${lastName}`.trim() ||
      player.search_full_name ||
      playerId

    return {
      id: playerId,
      full_name: fullName,
      first_name: firstName || null,
      last_name: lastName || null,
      position: player.position || null,
      team: player.team || null,
      fantasy_positions: player.fantasy_positions || [],
      status: player.status || null,
      active: player.active ?? null,
      age: player.age || null,
      years_exp: player.years_exp || null,
      search_rank: player.search_rank || null,
      updated_at: new Date().toISOString(),
    }
  })

  const chunkSize = 1000
  let synced = 0

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)

    const { error } = await supabase.from('players').upsert(chunk, {
      onConflict: 'id',
    })

    if (error) {
      throw new Error(error.message)
    }

    synced += chunk.length
  }

  return synced
}