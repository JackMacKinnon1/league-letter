import Link from '@/components/NoPrefetchLink'
import { BarChart3, Newspaper, PlusCircle, ShieldCheck, UserRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { isSiteAdminEmail } from '@/lib/permissions'
import LogoutButton from './LogoutButton'
import MobileNav from './MobileNav'

const authedLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { href: '/dynasty-rankings', label: 'Rankings', icon: 'rankings' },
  { href: '/leagues/new', label: 'Load League', icon: 'load' },
  { href: '/profile', label: 'Profile', icon: 'profile' },
]

function NavIcon({ name }: { name?: string }) {
  if (name === 'profile') return <UserRound size={15} />
  if (name === 'rankings') return <BarChart3 size={15} />
  if (name === 'load') return <PlusCircle size={15} />
  return null
}

export default async function Navbar() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isSiteAdmin = isSiteAdminEmail(user?.email)

  let userLabel = user?.email?.split('@')[0] || 'Account'
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name,username')
      .eq('id', user.id)
      .maybeSingle()

    userLabel = profile?.display_name || profile?.username || userLabel
  }

  return (
    <header className="ll-navbar">
      <div className="ll-navbar-inner">
        <Link href="/" className="ll-brand" aria-label="League Letter home">
          <span className="ll-brand-mark" aria-hidden="true">
            <Newspaper size={19} />
          </span>
          <span className="ll-brand-copy">
            <span className="ll-brand-word"><b>LEAGUE</b><em>LETTER</em></span>
            <span className="ll-brand-sub">Fantasy football command center</span>
          </span>
        </Link>

        <nav className="ll-nav-links hidden md:flex">
          <span className="ll-live-chip">2026 live</span>

          {user ? (
            <>
              {authedLinks.map((link) => (
                <Link key={link.href} href={link.href} className="ll-nav-link">
                  <NavIcon name={link.icon} />
                  {link.label}
                </Link>
              ))}

              {isSiteAdmin && (
                <Link href="/site-admin" className="ll-nav-link ll-nav-admin">
                  <ShieldCheck size={15} />
                  Site admin
                </Link>
              )}

              <span className="ll-user-chip" title={user.email || userLabel}>
                <span className="ll-user-dot" />
                <span>{userLabel}</span>
              </span>

              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/login" className="ll-nav-link">Sign in</Link>
              <Link href="/signup" className="ll-nav-cta">Create account</Link>
            </>
          )}
        </nav>

        <MobileNav
          links={authedLinks}
          isLoggedIn={Boolean(user)}
          isSiteAdmin={isSiteAdmin}
          userLabel={userLabel}
        />
      </div>
    </header>
  )
}
