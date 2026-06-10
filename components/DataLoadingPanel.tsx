export default function DataLoadingPanel({
  title = 'Loading data',
  rows = 4,
}: {
  title?: string
  rows?: number
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] shadow-xl shadow-black/20">
      <div className="h-1 w-full overflow-hidden bg-white/5">
        <div className="h-full w-1/2 animate-[loading-bar_1.15s_ease-in-out_infinite] rounded-full bg-emerald-400/80" />
      </div>

      <div className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="h-3 w-24 animate-pulse rounded-full bg-emerald-400/20" />
            <div className="mt-3 h-7 w-48 animate-pulse rounded-lg bg-white/10" />
          </div>
          <p className="text-sm font-medium text-zinc-400">{title}</p>
        </div>

        <div className="mt-6 space-y-3">
          {Array.from({ length: rows }).map((_, index) => (
            <div
              key={index}
              className="rounded-xl border border-white/5 bg-black/15 p-4"
            >
              <div className="h-4 w-2/3 animate-pulse rounded-full bg-white/10" />
              <div className="mt-3 h-3 w-full animate-pulse rounded-full bg-white/5" />
              <div className="mt-2 h-3 w-4/5 animate-pulse rounded-full bg-white/5" />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
