import Navbar from '@/components/Navbar'
import ProfileForm from '@/components/ProfileForm'
import { createClient } from '@/lib/supabase/server'
import { UserRound } from 'lucide-react'
import { redirect } from 'next/navigation'

export default async function ProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'email,username,display_name,sleeper_user_id,sleeper_username,sleeper_display_name,sleeper_avatar,sleeper_connected_at'
    )
    .eq('id', user.id)
    .maybeSingle()

  const emailUsername = (user.email || 'user')
    .split('@')[0]
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .slice(0, 32)
  const savedUsername = String(profile?.username || '')
  const safeUsername = /^[a-zA-Z0-9_-]{3,32}$/.test(savedUsername)
    ? savedUsername
    : emailUsername.length >= 3
      ? emailUsername
      : `user-${user.id.slice(0, 8)}`

  const initialProfile = {
    email: profile?.email || user.email || null,
    username: safeUsername,
    display_name: profile?.display_name || null,
    sleeper_user_id: profile?.sleeper_user_id || null,
    sleeper_username: profile?.sleeper_username || null,
    sleeper_display_name: profile?.sleeper_display_name || null,
    sleeper_avatar: profile?.sleeper_avatar || null,
    sleeper_connected_at: profile?.sleeper_connected_at || null,
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <Navbar />

      <section className="border-b border-zinc-800 bg-white/[0.015] px-4 py-10">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
              <UserRound size={25} />
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-[0.3em] text-emerald-400">
                Account settings
              </p>
              <h1 className="mt-1 text-4xl font-black tracking-tight md:text-6xl">Profile</h1>
            </div>
          </div>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-zinc-400">
            Update your League Letter identity and connect the Sleeper account used to identify your fantasy rosters.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8">
        <ProfileForm initialProfile={initialProfile} />
      </section>
    </main>
  )
}
