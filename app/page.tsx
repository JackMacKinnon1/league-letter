import Link from '@/components/NoPrefetchLink'
import Navbar from '@/components/Navbar'
import { BarChart3, Newspaper, ShieldCheck, Swords, TrendingUp } from 'lucide-react'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <Navbar />

      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-20">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
            Powered by Sleeper
          </div>

          <h1 className="mt-6 max-w-4xl text-5xl font-semibold tracking-tight md:text-7xl">
            A real media hub for your fantasy league.
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300">
            League Letter turns your Sleeper league into a polished newsroom with
            articles, matchups, transactions, rankings, drafts, and admin tools
            built for desktop and mobile.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="rounded-xl bg-white px-6 py-3 text-center font-semibold text-zinc-950 transition hover:bg-zinc-200"
            >
              Create Account
            </Link>

            <Link
              href="/leagues/new"
              className="rounded-xl border border-white/10 bg-white/[0.04] px-6 py-3 text-center font-semibold text-zinc-100 transition hover:bg-white/[0.08]"
            >
              Load Sleeper League
            </Link>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] shadow-2xl shadow-black/30">
          <div className="border-b border-white/10 px-5 py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
                  Week 8 Edition
                </p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight">
                  League Command Center
                </h2>
              </div>
              <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-300">
                Live
              </div>
            </div>
          </div>

          <div className="grid gap-px bg-white/10 sm:grid-cols-2">
            <PreviewCard
              icon={<Swords size={19} />}
              title="Featured Matchup"
              body="Highlight the matchup of the week with records, projections, and league context."
            />
            <PreviewCard
              icon={<TrendingUp size={19} />}
              title="Power Rankings"
              body="Publish weekly rankings that look like a real sports media product."
            />
            <PreviewCard
              icon={<Newspaper size={19} />}
              title="Articles"
              body="Owners can write recaps, previews, columns, and league drama."
            />
            <PreviewCard
              icon={<BarChart3 size={19} />}
              title="Transactions"
              body="Track trades, waivers, free agents, and roster movement cleanly."
            />
          </div>

          <div className="border-t border-white/10 p-5">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-emerald-300">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <h3 className="font-semibold">Admin-ready by default</h3>
                  <p className="mt-1 text-sm leading-6 text-zinc-400">
                    Load a league, manage writers, sync Sleeper data, and keep the
                    site feeling fast with polished loading states.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

function PreviewCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode
  title: string
  body: string
}) {
  return (
    <div className="bg-[#101216] p-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.045] text-emerald-300">
        {icon}
      </div>

      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-zinc-400">{body}</p>
    </div>
  )
}
