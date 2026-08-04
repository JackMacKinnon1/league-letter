import Link from '@/components/NoPrefetchLink'
import Navbar from '@/components/Navbar'
import PlayerScoresUploader from '@/components/PlayerScoresUploader'
import { isSiteAdminEmail } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function PlayerScoresAdminPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')
  if (!isSiteAdminEmail(user.email)) redirect('/dashboard')

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <Navbar />
      <section className="mx-auto max-w-6xl px-4 py-8">
        <Link href="/site-admin" className="text-sm font-bold text-zinc-400 hover:text-white">
          ← Back to Site Admin
        </Link>
        <div className="mt-6">
          <PlayerScoresUploader />
        </div>
      </section>
    </main>
  )
}
