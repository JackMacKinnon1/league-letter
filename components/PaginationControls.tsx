'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function PaginationControls({
  page,
  pageSize,
  total,
  onPageChange,
  disabled = false,
  compact = false,
}: {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  disabled?: boolean
  compact?: boolean
}) {
  const pages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)))
  const safePage = Math.min(Math.max(page, 1), pages)
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1
  const end = Math.min(total, safePage * pageSize)

  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${compact ? 'mt-4' : 'mt-6'}`}>
      <p className="text-sm text-zinc-500">
        {total === 0 ? 'No results' : `Showing ${start}-${end} of ${total}`}
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(safePage - 1)}
          disabled={disabled || safePage <= 1}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-bold transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft size={16} /> Previous
        </button>
        <span className="min-w-24 text-center text-sm font-black text-zinc-300">
          Page {safePage} of {pages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(safePage + 1)}
          disabled={disabled || safePage >= pages}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-bold transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}
