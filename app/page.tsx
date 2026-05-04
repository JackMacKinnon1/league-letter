import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { Newspaper, ShieldCheck, Swords, TrendingUp } from 'lucide-react'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <Navbar />

      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <p className="mb-4 text-sm font-black uppercase tracking-[0.35em] text-emerald-400">
            Powered by Sleeper
          </p>

          <h1 className="max-w-4xl text-5xl font-black tracking-tight md:text-7xl">
            Turn your fantasy league into a weekly sports newspaper.
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300">
            Load your Sleeper league, publish articles, feature matchups, write
            weekly power rankings, and give your league its own media empire.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="rounded-2xl bg-emerald-500 px-6 py-3 font-black text-zinc-950 transition hover:bg-emerald-400"
            >
              Create Account
            </Link>

            <Link
              href="/leagues/new"
              className="rounded-2xl border border-zinc-700 px-6 py-3 font-black transition hover:bg-zinc-900"
            >
              Load Sleeper League
            </Link>
          </div>
        </div>

        <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
          <div className="rounded-[1.5rem] bg-zinc-950 p-5">
            <div className="border-b border-zinc-800 pb-4">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-zinc-500">
                Week 8 Edition
              </p>
              <h2 className="mt-2 text-4xl font-black">The League Letter</h2>
            </div>

            <div className="mt-5 grid gap-4">
              <PreviewCard
                icon={<Swords size={20} />}
                title="Featured Matchup"
                body="Jack vs Duncan headlines a disgusting week of trash talk."
              />
              <PreviewCard
                icon={<TrendingUp size={20} />}
                title="Power Rankings"
                body="A new team takes the top spot after a 164-point explosion."
              />
              <PreviewCard
                icon={<Newspaper size={20} />}
                title="League Articles"
                body="Owners can publish columns, recaps, rankings, and slander."
              />
              <PreviewCard
                icon={<ShieldCheck size={20} />}
                title="Admin Control"
                body="Admins approve writers, manage features, and delete nonsense."
              />
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
    <div className="flex gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-zinc-950">
        {icon}
      </div>

      <div>
        <h3 className="font-black">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-zinc-400">{body}</p>
      </div>
    </div>
  )
}