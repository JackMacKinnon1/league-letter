import Link from '@/components/NoPrefetchLink'
import { Trophy } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import LogoutButton from './LogoutButton'
import MobileNav from './MobileNav'

const authedLinks = [
  { href: '/dynasty-rankings', label: 'Dynasty Rankings' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/leagues/new', label: 'Load League' },
]

export default async function Navbar() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <header className="sticky top-0 z-[2147483000] isolate border-b border-white/10 bg-[#08090b]/90 text-white shadow-lg shadow-black/10 backdrop-blur-xl supports-[backdrop-filter]:bg-[#08090b]/75">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:py-4">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-emerald-300 shadow-inner shadow-white/5 md:h-10 md:w-10">
            <Trophy size={18} />
          </div>

          <div className="min-w-0">
            <p className="truncate text-base font-semibold leading-none tracking-tight md:text-lg">
              League Letter
            </p>
            <p className="hidden text-xs font-medium text-zinc-500 sm:block">
              Fantasy football command center
            </p>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 rounded-2xl border border-white/10 bg-white/[0.035] p-1 text-sm font-medium text-zinc-300 md:flex">
          {user ? (
            <>
              {authedLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-xl px-3 py-2 transition hover:bg-white/[0.07] hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
              <div className="ml-1 border-l border-white/10 pl-2">
                <LogoutButton />
              </div>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-xl bg-white px-4 py-2 font-semibold text-zinc-950 transition hover:bg-zinc-200"
            >
              Login
            </Link>
          )}
        </nav>

        <MobileNav links={authedLinks} isLoggedIn={Boolean(user)} />
      </div>
    </header>
  )
}
