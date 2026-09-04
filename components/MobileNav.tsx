import Link from '@/components/NoPrefetchLink'
import { BarChart3, Menu, PlusCircle, ShieldCheck, UserRound, X } from 'lucide-react'
import LogoutButton from './LogoutButton'

type NavLink = {
  href: string
  label: string
  icon?: string
}

function NavIcon({ name }: { name?: string }) {
  if (name === 'profile') return <UserRound size={17} />
  if (name === 'rankings') return <BarChart3 size={17} />
  if (name === 'load') return <PlusCircle size={17} />
  return null
}

export default function MobileNav({
  links,
  isLoggedIn,
  isSiteAdmin,
  userLabel,
}: {
  links: NavLink[]
  isLoggedIn: boolean
  isSiteAdmin: boolean
  userLabel?: string
}) {
  return (
    <details className="mobile-menu md:hidden">
      <summary aria-label="Toggle navigation menu" className="mobile-menu-summary">
        <span className="mobile-menu-icon mobile-menu-open-icon" aria-hidden="true">
          <Menu size={22} />
        </span>
        <span className="mobile-menu-icon mobile-menu-close-icon" aria-hidden="true">
          <X size={22} />
        </span>
      </summary>

      <div className="mobile-menu-card" role="navigation" aria-label="Mobile navigation">
        <div className="ll-mobile-menu-head">
          <span className="ll-live-chip">2026 live</span>
          {isLoggedIn && <span className="ll-user-chip"><span className="ll-user-dot" />{userLabel || 'Account'}</span>}
        </div>

        <div className="ll-mobile-menu-links">
          {isLoggedIn ? (
            <>
              {links.map((link) => (
                <Link key={link.href} href={link.href} className="ll-mobile-link">
                  <NavIcon name={link.icon} />
                  {link.label}
                </Link>
              ))}

              {isSiteAdmin && (
                <Link href="/site-admin" className="ll-mobile-link ll-mobile-admin">
                  <ShieldCheck size={17} />
                  Site admin
                </Link>
              )}

              <div className="ll-mobile-logout">
                <LogoutButton />
              </div>
            </>
          ) : (
            <>
              <Link href="/login" className="ll-mobile-link">Sign in</Link>
              <Link href="/signup" className="ll-mobile-cta">Create account</Link>
            </>
          )}
        </div>
      </div>
    </details>
  )
}
