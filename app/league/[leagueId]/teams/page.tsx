import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { createClient } from '@/lib/supabase/server'
import { getSleeperPlayers } from '@/lib/sleeper'

export default async function TeamRosterPage({
  params,
}: {
  params: Promise<{ leagueId: string; teamId: string }>
}) {
  const { leagueId, teamId } = await params
  const supabase = await createClient()

  const { data: league } = await supabase
    .from('leagues')
    .select('*')
    .eq('id', leagueId)
    .single()

  const { data: team } = await supabase
    .from('teams')
    .select('*')
    .eq('id', teamId)
    .eq('league_id', leagueId)
    .single()

  const players = await getSleeperPlayers()

  const playerRows =
    team?.players?.map((playerId: string) => {
      const player = players[playerId]

      return {
        id: playerId,
        name: player
          ? `${player.first_name || ''} ${player.last_name || ''}`.trim()
          : playerId,
        position: player?.position || '—',
        nflTeam: player?.team || 'FA',
        isStarter: team.starters?.includes(playerId),
      }
    }) || []

  const sortedPlayers = playerRows.sort((a: any, b: any) => {
    if (a.isStarter && !b.isStarter) return -1
    if (!a.isStarter && b.isStarter) return 1
    return String(a.position).localeCompare(String(b.position))
  })

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <Navbar />

      <section className="border-b border-zinc-800 bg-gradient-to-b from-emerald-950/50 to-zinc-950 px-4 py-10">
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

          <h1 className="mt-3 text-5xl font-black">{team?.team_name}</h1>

          <p className="mt-3 text-zinc-400">
            {team?.owner_name || 'Unknown owner'} · {team?.wins}-{team?.losses}
            {team?.ties ? `-${team.ties}` : ''} ·{' '}
            {Number(team?.points_for || 0).toFixed(1)} points for
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 lg:grid-cols-[1.4fr_0.8fr]">
        <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-3xl font-black">Roster</h2>

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
                    <td className="px-4 py-3 text-zinc-300">{player.position}</td>
                    <td className="px-4 py-3 text-zinc-300">{player.nflTeam}</td>
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
                    <td colSpan={4} className="px-4 py-8 text-center text-zinc-400">
                      No roster data found. Sync Sleeper data first.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-3xl font-black">Team Card</h2>

          <div className="mt-5 rounded-2xl bg-zinc-950 p-5">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">
              Record
            </p>
            <p className="mt-2 text-4xl font-black">
              {team?.wins}-{team?.losses}
              {team?.ties ? `-${team.ties}` : ''}
            </p>
          </div>

          <div className="mt-4 rounded-2xl bg-zinc-950 p-5">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">
              Points For
            </p>
            <p className="mt-2 text-4xl font-black">
              {Number(team?.points_for || 0).toFixed(1)}
            </p>
          </div>

          <div className="mt-4 rounded-2xl bg-zinc-950 p-5">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">
              Points Against
            </p>
            <p className="mt-2 text-4xl font-black">
              {Number(team?.points_against || 0).toFixed(1)}
            </p>
          </div>
        </aside>
      </section>
    </main>
  )
}