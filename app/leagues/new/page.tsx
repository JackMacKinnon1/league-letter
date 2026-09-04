import Link from '@/components/NoPrefetchLink'
import Navbar from '@/components/Navbar'
import LoadLeagueForm from '@/components/LoadLeagueForm'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function NewLeaguePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <main className="ll-page">
      <Navbar />
      <section className="ll-shell ll-narrow-shell">
        <Link href="/dashboard" className="ll-back-link">← Back to dashboard</Link>
        <LoadLeagueForm />

        <div className="ll-card ll-help-card">
          <p className="ll-eyebrow">Quick help</p>
          <h2>Where do I find the league ID?</h2>
          <p>Open your Sleeper league in a browser. The league ID is the long number in the URL.</p>
          <code>sleeper.com/leagues/<strong>1124830261361217536</strong></code>
        </div>
      </section>
    </main>
  )
}
