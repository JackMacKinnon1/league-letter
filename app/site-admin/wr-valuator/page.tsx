import Link from 'next/link'
import Navbar from '@/components/Navbar'
import WRValuatorUploader from '@/components/WRValuatorUploader'
import { createClient } from '@/lib/supabase/server'
import DynastyValuesSyncButton from '@/components/DynastyValuesSyncButton'
import { redirect } from 'next/navigation'

const SITE_ADMIN_EMAIL = 'mackinnonjack4@gmail.com'

export default async function WRValuatorAdminPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  if (user.email !== SITE_ADMIN_EMAIL) {
    redirect('/dashboard')
  }

  const { data: latestValues } = await supabase
    .from('wr_player_values')
    .select('*')
    .order('final_score', { ascending: false })
    .limit(25)

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <Navbar />

      <section className="border-b border-zinc-800 bg-gradient-to-b from-emerald-950/50 to-zinc-950 px-4 py-10">
        <div className="mx-auto max-w-7xl">
          <Link href="/dashboard" className="text-sm font-bold text-zinc-400">
            ← Back to dashboard
          </Link>

          <p className="mt-6 text-sm font-black uppercase tracking-[0.3em] text-emerald-400">
            Site Admin
          </p>

          <h1 className="mt-3 text-5xl font-black">WR Valuator</h1>

          <p className="mt-3 max-w-3xl text-zinc-400">
            Upload Fantasy Points Data and PFF CSV files, calculate yearly WR
            scores, and store 5-year weighted player values.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        <DynastyValuesSyncButton />
        <WRValuatorUploader />

        <section className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-3xl font-black">Current Top WR Values</h2>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[800px] border-collapse text-left">
              <thead>
                <tr className="border-b border-zinc-800 text-xs uppercase tracking-[0.2em] text-zinc-500">
                  <th className="py-3 pr-4">Rank</th>
                  <th className="py-3 pr-4">Player</th>
                  <th className="py-3 pr-4">Team</th>
                  <th className="py-3 pr-4">Final</th>
                  <th className="py-3 pr-4">5-Year</th>
                  <th className="py-3 pr-4">Recent</th>
                  <th className="py-3 pr-4">Consistency</th>
                  <th className="py-3 pr-4">Age</th>
                  <th className="py-3 pr-4">Track</th>
                </tr>
              </thead>

              <tbody>
                {(latestValues || []).map((player: any, index: number) => (
                  <tr key={player.id} className="border-b border-zinc-800">
                    <td className="py-3 pr-4 font-black text-emerald-400">
                      #{index + 1}
                    </td>
                    <td className="py-3 pr-4 font-black">
                      {player.player_name}
                    </td>
                    <td className="py-3 pr-4 text-zinc-400">
                      {player.latest_team || '—'}
                    </td>
                    <td className="py-3 pr-4 font-black">
                      {Number(player.final_score || 0).toFixed(2)}
                    </td>
                    <td className="py-3 pr-4 text-zinc-400">
                      {Number(player.five_year_weighted_score || 0).toFixed(2)}
                    </td>
                    <td className="py-3 pr-4 text-zinc-400">
                      {Number(player.recent_season_score || 0).toFixed(2)}
                    </td>
                    <td className="py-3 pr-4 text-zinc-400">
                      {Number(player.consistency_score || 0).toFixed(2)}
                    </td>
                    <td className="py-3 pr-4 text-zinc-400">
                      {Number(player.current_age_score || 0).toFixed(2)}
                    </td>
                    <td className="py-3 pr-4 text-zinc-400">
                      {Number(player.track_record_score || 0).toFixed(2)}
                    </td>
                  </tr>
                ))}

                {!latestValues?.length && (
                  <tr>
                    <td colSpan={9} className="py-6 text-zinc-400">
                      No WR values uploaded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  )
}