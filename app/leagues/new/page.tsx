import Link from 'next/link'
import Navbar from '@/components/Navbar'
import LoadLeagueForm from '@/components/LoadLeagueForm'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function NewLeaguePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <Navbar />

      <section className="mx-auto max-w-3xl px-4 py-12">
        <Link href="/dashboard" className="text-sm font-bold text-zinc-400">
          ← Back to dashboard
        </Link>

        <LoadLeagueForm />

        <div className="mt-6 rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-xl font-black">Where do I find the league ID?</h2>

          <p className="mt-2 leading-7 text-zinc-400">
            Open your Sleeper league in the browser. The league ID is the long
            number in the URL.
          </p>

          <div className="mt-4 rounded-2xl bg-zinc-950 p-4 text-sm text-zinc-300">
            sleeper.com/leagues/
            <span className="font-black text-emerald-400">
              1124830261361217536
            </span>
          </div>
        </div>
      </section>
    </main>
  )
}