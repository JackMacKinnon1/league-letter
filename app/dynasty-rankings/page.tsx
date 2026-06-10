import Link from '@/components/NoPrefetchLink'
import Navbar from '@/components/Navbar'
import DynastyRankingsTable from '@/components/DynastyRankingsTable'

export const dynamic = 'force-dynamic'

export default async function DynastyRankingsPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <Navbar />

      <section className="border-b border-zinc-800 bg-white/[0.015] px-4 py-12">
        <div className="mx-auto max-w-7xl">
          <Link href="/dashboard" className="text-sm font-bold text-zinc-400">
            ← Back to dashboard
          </Link>

          <p className="mt-8 text-sm font-black uppercase tracking-[0.35em] text-emerald-300">
            Dynasty Market
          </p>

          <h1 className="mt-4 text-5xl font-black tracking-tight md:text-7xl">
            Dynasty Rankings
          </h1>

          <p className="mt-4 max-w-3xl text-lg text-zinc-300">
            Dynasty player values synced from LeagueLogs and matched to your
            local Sleeper player database. Rankings are loaded page-by-page so
            the browser does not need to hold the full database in memory.
          </p>
        </div>
      </section>

      <DynastyRankingsTable />
    </main>
  )
}