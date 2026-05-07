import Link from 'next/link'
import { Trophy } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import LogoutButton from './LogoutButton'

export default async function Navbar() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <header className="border-b border-zinc-800 bg-zinc-950 text-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-zinc-950">
            <Trophy size={20} />
          </div>

          <div>
            <p className="text-lg font-black leading-none">League Letter</p>
            <p className="text-xs text-zinc-400">Fantasy football newsroom</p>
          </div>
        </Link>

        <nav className="flex items-center gap-4 text-sm font-semibold text-zinc-300">
          {user ? (
            <>
              <Link href="/dynasty-rankings" className="hover:text-emerald-400">
                Dynasty Rankings
              </Link>
              
              <Link href="/dashboard" className="hover:text-white">
                Dashboard
              </Link>

              <Link href="/leagues/new" className="hover:text-white">
                Load League
              </Link>

              <LogoutButton />
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-xl bg-white px-3 py-2 text-zinc-950 hover:bg-zinc-200"
            >
              Login
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}