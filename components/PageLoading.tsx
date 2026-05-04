export default function PageLoading({
  title = 'Loading',
}: {
  title?: string
}) {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="mb-8">
          <div className="h-4 w-40 animate-pulse rounded-full bg-emerald-500/30" />
          <div className="mt-4 h-12 w-full max-w-xl animate-pulse rounded-2xl bg-zinc-800" />
          <div className="mt-3 h-5 w-72 animate-pulse rounded-full bg-zinc-800" />
        </div>

        <div className="mb-6 flex items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-zinc-800 border-t-emerald-500" />
          <p className="text-sm font-bold text-zinc-400">{title}...</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.6fr_0.9fr]">
          <div className="space-y-6">
            <LoadingCard tall />
            <LoadingCard />
            <LoadingCard />
          </div>

          <div className="space-y-6">
            <LoadingCard />
            <LoadingCard />
          </div>
        </div>
      </div>
    </main>
  )
}

function LoadingCard({ tall = false }: { tall?: boolean }) {
  return (
    <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
      <div className="h-4 w-32 animate-pulse rounded-full bg-emerald-500/20" />
      <div className="mt-4 h-8 w-64 animate-pulse rounded-xl bg-zinc-800" />

      <div className="mt-6 space-y-3">
        <div className="h-5 w-full animate-pulse rounded-full bg-zinc-800" />
        <div className="h-5 w-5/6 animate-pulse rounded-full bg-zinc-800" />
        <div className="h-5 w-2/3 animate-pulse rounded-full bg-zinc-800" />
      </div>

      {tall && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="h-28 animate-pulse rounded-2xl bg-zinc-950" />
          <div className="h-28 animate-pulse rounded-2xl bg-zinc-950" />
        </div>
      )}
    </div>
  )
}