import Link from '@/components/NoPrefetchLink'
import { Menu, ShieldCheck, X } from 'lucide-react'
import LogoutButton from './LogoutButton'

type NavLink = {
  href: string
  label: string
}

export default function MobileNav({
  links,
  isLoggedIn,
  isSiteAdmin,
}: {
  links: NavLink[]
  isLoggedIn: boolean
  isSiteAdmin: boolean
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
        <div className="border-b border-white/10 px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
            Navigation
          </p>
        </div>

        <div className="py-2">
          {isLoggedIn ? (
            <>
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block rounded-xl px-3 py-3 text-sm font-semibold text-zinc-200 transition active:bg-white/[0.08] hover:bg-white/[0.06] hover:text-white"
                >
                  {link.label}
                </Link>
              ))}

              {isSiteAdmin && (
                <Link
                  href="/site-admin"
                  className="mx-1 mt-1 flex items-center gap-3 rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-3 py-3 text-sm font-black text-emerald-300 transition active:scale-[0.99] hover:bg-emerald-400/15"
                >
                  <ShieldCheck size={17} />
                  Site Admin
                </Link>
              )}

              <div className="mt-2 border-t border-white/10 px-2 pt-2">
                <LogoutButton />
              </div>
            </>
          ) : (
            <Link
              href="/login"
              className="block rounded-xl bg-white px-4 py-3 text-center text-sm font-semibold text-zinc-950 transition active:scale-[0.99] hover:bg-zinc-200"
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </details>
  )
}
