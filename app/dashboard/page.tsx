import Link from '@/components/NoPrefetchLink'
import Navbar from '@/components/Navbar'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardInvites from '@/components/DashboardInvites'
import { ArrowRight, Link2, Newspaper, PlusCircle, ShieldCheck } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  const { data: leagues } = await supabase
    .from('league_members')
    .select(`*, leagues (*)`)
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

  const displayName = profile?.display_name || profile?.username || user.email?.split('@')[0] || 'Manager'

  return (
    <main className="ll-page">
      <Navbar />

      <section className="ll-shell ll-dashboard-shell">
        <div className="ll-page-header">
          <div>
            <p className="ll-eyebrow">League dashboard</p>
            <h1>Welcome back, {displayName}</h1>
            <p>Open a league, publish the next story, or pull in another Sleeper room.</p>
          </div>

          <div className="ll-header-actions">
            <DashboardInvites invites={invites || []} />
            <Link href="/leagues/new" className="ll-btn ll-btn-primary">
              <PlusCircle size={17} /> Load league
            </Link>
          </div>
        </div>

        {!profile?.sleeper_user_id && (
          <Link href="/profile" className="ll-card ll-connect-card">
            <span className="ll-feature-icon"><Link2 size={20} /></span>
            <div>
              <p className="ll-eyebrow">Recommended setup</p>
              <h2>Connect your Sleeper account</h2>
              <p>
                Link your Sleeper username so Game Feed can recognize your roster,
                opponent, and fantasy-scoring plays automatically.
              </p>
            </div>
            <span className="ll-connect-arrow"><ArrowRight size={19} /></span>
          </Link>
        )}

        <div className="ll-dashboard-section-head">
          <div>
            <p className="ll-eyebrow">Your rooms</p>
            <h2>League Letter leagues</h2>
          </div>
          <span className="ll-pill">{leagues?.length || 0} connected</span>
        </div>

        <div className="ll-league-grid">
          {leagues?.map((membership: any) => (
            <Link href={`/league/${membership.leagues.id}`} key={membership.id} className="ll-card ll-league-card">
              <div className="ll-league-card-top">
                <span className="ll-league-icon"><Newspaper size={20} /></span>
                <span className={`ll-role-chip ${membership.role === 'admin' ? 'is-admin' : ''}`}>
                  {membership.role === 'admin' && <ShieldCheck size={13} />}
                  {membership.role}
                </span>
              </div>

              <div className="ll-league-card-copy">
                <p className="ll-eyebrow">Season {membership.leagues.season}</p>
                <h3>{membership.leagues.name}</h3>
                <p>Matchups, articles, trades, rankings, drafts, and league history.</p>
              </div>

              <span className="ll-open-league">Open league <ArrowRight size={16} /></span>
            </Link>
          ))}

          {!leagues?.length && (
            <div className="ll-card ll-empty-card">
              <span className="ll-feature-icon"><PlusCircle size={20} /></span>
              <h2>No leagues yet</h2>
              <p>Load your first Sleeper league to create its League Letter home.</p>
              <Link href="/leagues/new" className="ll-btn ll-btn-primary">Load first league</Link>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
