import { Trophy } from 'lucide-react'
import DataLoadingPanel from './DataLoadingPanel'

export default function PageLoading({
  title = 'Loading',
}: {
  title?: string
}) {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#08090b]/85 text-white shadow-lg shadow-black/10 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-emerald-300 md:h-10 md:w-10">
              <Trophy size={18} />
            </div>
            <div>
              <p className="text-base font-semibold leading-none tracking-tight md:text-lg">
                League Letter
              </p>
              <p className="hidden text-xs font-medium text-zinc-500 sm:block">
                Loading workspace
              </p>
            </div>
          </div>
          <div className="h-10 w-10 rounded-xl border border-white/10 bg-white/[0.04] md:hidden" />
        </div>
      </header>

      <section className="border-b border-white/10 px-4 py-10">
        <div className="mx-auto max-w-7xl">
          <div className="h-3 w-36 animate-pulse rounded-full bg-emerald-400/20" />
          <div className="mt-4 h-12 w-full max-w-2xl animate-pulse rounded-xl bg-white/10" />
          <div className="mt-3 h-5 w-full max-w-lg animate-pulse rounded-full bg-white/5" />
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 lg:grid-cols-[1.6fr_0.9fr]">
        <div className="space-y-6">
          <DataLoadingPanel title={`${title} section`} rows={4} />
          <DataLoadingPanel title="Preparing cards" rows={3} />
        </div>

        <div className="space-y-6">
          <DataLoadingPanel title="Loading sidebar" rows={2} />
        </div>
      </section>
    </main>
  )
}
