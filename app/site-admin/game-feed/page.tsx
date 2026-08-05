import Link from '@/components/NoPrefetchLink'
import Navbar from '@/components/Navbar'
import SiteGameFeedControl from '@/components/SiteGameFeedControl'
import { isSiteAdminEmail } from '@/lib/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 20

export default async function SiteGameFeedPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')
  if (!isSiteAdminEmail(user.email)) redirect('/dashboard')

  const adminSupabase = createAdminClient()
  const [{ data: leagues, count: leagueCount }, { data: workerStates }] = await Promise.all([
    adminSupabase
      .from('leagues')
      .select('id,name,game_feed_enabled,game_feed_display_mode', { count: 'exact' })
      .order('name')
      .range(0, PAGE_SIZE - 1),
    adminSupabase
      .from('game_feed_source_state')
      .select('*')
      .order('worker_heartbeat_at', { ascending: false, nullsFirst: false })
      .limit(2),
  ])

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <Navbar />

      <section className="border-b border-zinc-800 bg-white/[0.015] px-4 py-10">
        <div className="mx-auto max-w-7xl">
          <Link href="/site-admin" className="text-sm font-bold text-zinc-400 hover:text-white">
            ← Back to Site Admin
          </Link>
          <p className="mt-6 text-sm font-black uppercase tracking-[0.3em] text-emerald-400">
            Site-wide control
          </p>
          <h1 className="mt-3 text-5xl font-black">Game Feed</h1>
          <p className="mt-3 max-w-3xl text-zinc-400">
            Manage the local collector and every room’s live-feed visibility from one protected page.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8">
        <SiteGameFeedControl
          initialLeagues={(leagues || []) as any}
          initialWorkerStates={(workerStates || []) as any}
          initialTotal={leagueCount || 0}
        />
      </section>
    </main>
  )
}
