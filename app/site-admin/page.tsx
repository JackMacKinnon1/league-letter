import Link from '@/components/NoPrefetchLink'
import Navbar from '@/components/Navbar'
import { isSiteAdminEmail } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/server'
import { Activity, ArrowRight, Calculator, ShieldCheck } from 'lucide-react'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

export default async function SiteAdminPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')
  if (!isSiteAdminEmail(user.email)) redirect('/dashboard')

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <Navbar />

      <section className="border-b border-zinc-800 bg-white/[0.015] px-4 py-12">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center gap-3 text-emerald-300">
            <ShieldCheck size={20} />
            <p className="text-sm font-black uppercase tracking-[0.3em]">
              Site owner access
            </p>
          </div>
          <h1 className="mt-4 text-5xl font-black md:text-7xl">Site Admin</h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-zinc-400">
            Control League Letter-wide tools and behaviour. These pages are only visible and accessible to {user.email}.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 lg:grid-cols-2">
        <AdminToolCard
          href="/site-admin/wr-valuator"
          icon={<Calculator size={25} />}
          eyebrow="Player scoring"
          title="WR Valuator"
          description="Upload raw receiver data, adjust the scoring model and publish updated player values."
        />
        <AdminToolCard
          href="/site-admin/game-feed"
          icon={<Activity size={25} />}
          eyebrow="Live scoring"
          title="Game Feed Control"
          description="View your local collector, control Public/Test behaviour and choose which league rooms receive the feed."
        />
      </section>
    </main>
  )
}

function AdminToolCard({
  href,
  icon,
  eyebrow,
  title,
  description,
}: {
  href: string
  icon: ReactNode
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <Link
      href={href}
      className="group rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6 transition duration-300 hover:-translate-y-1 hover:border-emerald-400/30 hover:bg-zinc-800"
    >
      <div className="flex items-start justify-between gap-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
          {icon}
        </div>
        <ArrowRight className="text-zinc-600 transition duration-300 group-hover:translate-x-1 group-hover:text-emerald-300" />
      </div>
      <p className="mt-7 text-xs font-black uppercase tracking-[0.25em] text-emerald-400">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-3xl font-black">{title}</h2>
      <p className="mt-3 leading-7 text-zinc-400">{description}</p>
    </Link>
  )
}
