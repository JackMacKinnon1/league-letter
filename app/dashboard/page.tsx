import Link from '@/components/NoPrefetchLink'
import Navbar from '@/components/Navbar'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardInvites from '@/components/DashboardInvites'
import { Link2 } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  const { data: leagues } = await supabase
    .from('league_members')
    .select(
      `
      *,
      leagues (*)
    `
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const { data: invites } = await supabase
    .from('league_invites')
    .select('*, leagues(*)')
    .eq('invited_user_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <Navbar />

      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.3em] text-emerald-400">
              Dashboard
            </p>
            <h1 className="mt-2 text-4xl font-black">
              Welcome, {profile?.display_name || user.email}
            </h1>
            <p className="mt-2 text-zinc-400">
              Manage your leagues, articles, and weekly fantasy nonsense.
            </p>
          </div>

          <Link
            href="/leagues/new"
            className="rounded-2xl bg-emerald-500 px-5 py-3 text-center font-black text-zinc-950"
          >
            Load Sleeper League
          </Link>

          <DashboardInvites invites={invites || []} />
        </div>

        {!profile?.sleeper_user_id && (
          <Link
            href="/profile"
            className="mt-8 flex flex-col justify-between gap-4 rounded-[2rem] border border-emerald-400/25 bg-emerald-400/[0.08] p-5 transition hover:border-emerald-400/50 md:flex-row md:items-center"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300">
                <Link2 size={20} />
              </div>
              <div>
                <p className="font-black text-emerald-200">Connect your Sleeper account</p>
                <p className="mt-1 text-sm leading-6 text-zinc-400">
                  Link your Sleeper username so Game Feed can automatically recognize your roster and weekly opponent.
                </p>
              </div>
            </div>
            <span className="shrink-0 text-sm font-black text-emerald-300">Open Profile →</span>
          </Link>
        )}

        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {leagues?.map((membership: any) => (
            <Link
              href={`/league/${membership.leagues.id}`}
              key={membership.id}
              className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-5 transition hover:border-emerald-500"
            >
              <p className="text-sm font-bold uppercase text-zinc-500">
                {membership.role}
              </p>
              <h2 className="mt-2 text-2xl font-black">
                {membership.leagues.name}
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                Season {membership.leagues.season}
              </p>
              <p className="mt-4 text-sm font-bold text-emerald-400">
                Open League →
              </p>
            </Link>
          ))}

          {!leagues?.length && (
            <div className="rounded-[2rem] border border-dashed border-zinc-700 bg-zinc-900 p-8">
              <h2 className="text-2xl font-black">No leagues yet</h2>
              <p className="mt-2 text-zinc-400">
                Load your first Sleeper league to create its newspaper.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}