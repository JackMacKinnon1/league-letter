'use client'

import { useEffect, useMemo, useState } from 'react'

type DynastyRankingRow = {
  sleeper_player_id: string
  value: number | null
  raw_value: number | null
  overall_rank: number | null
  position_rank: number | null
  profile: string | null
  last_refreshed_at: string | null
  fullName: string
  position: string
  team: string
  age: number | null
  foundInDatabase: boolean
}

const PAGE_SIZE_OPTIONS = [25, 50, 100]

export default function DynastyRankingsTable() {
  const [rows, setRows] = useState<DynastyRankingRow[]>([])
  const [selectedPosition, setSelectedPosition] = useState('ALL')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [profile, setProfile] = useState<string | null>(null)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadRankings() {
      setLoading(true)
      setMessage('')

      try {
        const params = new URLSearchParams()
        params.set('position', selectedPosition)
        params.set('page', String(page))
        params.set('pageSize', String(pageSize))

        const response = await fetch(`/api/dynasty-rankings?${params.toString()}`)
        const json = await response.json()

        if (!response.ok) {
          throw new Error(json.error || 'Failed to load rankings.')
        }

        if (cancelled) return

        setRows(json.rows || [])
        setTotal(json.total || 0)
        setTotalPages(json.totalPages || 1)
        setProfile(json.profile || null)
        setLastRefreshedAt(json.lastRefreshedAt || null)
      } catch (error: any) {
        if (!cancelled) {
          setMessage(error?.message || 'Failed to load rankings.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadRankings()

    return () => {
      cancelled = true
    }
  }, [selectedPosition, page, pageSize])

  function changePosition(position: string) {
    setSelectedPosition(position)
    setPage(1)
  }

  function changePageSize(nextPageSize: number) {
    setPageSize(nextPageSize)
    setPage(1)
  }

  const startRow = total ? (page - 1) * pageSize + 1 : 0
  const endRow = Math.min(page * pageSize, total)

  const pageNumbers = useMemo(() => {
    return buildPageNumbers(page, totalPages)
  }, [page, totalPages])

  return (
    <section className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <MiniStat label="Profile" value={profile || 'Loading...'} />
        <MiniStat label="Players" value={String(total)} />
        <MiniStat label="Last Refresh" value={formatDateTime(lastRefreshedAt)} />
        <MiniStat label="Loaded" value={`${rows.length} rows`} />
      </div>

      <PositionFilters
        selectedPosition={selectedPosition}
        setSelectedPosition={changePosition}
      />

      <div className="mt-6 overflow-hidden rounded-[2rem] border border-zinc-800 bg-zinc-900">
        <div className="flex flex-col justify-between gap-3 border-b border-zinc-800 p-5 md:flex-row md:items-center">
          <div>
            <h2 className="text-3xl font-black">
              {selectedPosition === 'ALL'
                ? 'All Players'
                : `${selectedPosition} Rankings`}
            </h2>

            <p className="mt-1 text-sm text-zinc-400">
              {loading
                ? 'Loading rankings...'
                : `Showing ${startRow}-${endRow} of ${total} players.`}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <select
              value={String(pageSize)}
              onChange={(event) => changePageSize(Number(event.target.value))}
              className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm font-bold outline-none focus:border-emerald-500"
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option} per page
                </option>
              ))}
            </select>

            <p className="rounded-full border border-zinc-700 bg-zinc-950 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-emerald-400">
              Powered by LeagueLogs API
            </p>
          </div>
        </div>

        {message && (
          <div className="border-b border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
            {message}
          </div>
        )}

        <div className="max-h-[75vh] overflow-auto">
          <table className="w-full min-w-[1000px] border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-zinc-900">
              <tr className="border-b border-zinc-800 text-xs uppercase tracking-[0.2em] text-zinc-500">
                <th className="px-5 py-4">Rank</th>
                <th className="px-5 py-4">Player</th>
                <th className="px-5 py-4">Pos</th>
                <th className="px-5 py-4">Team</th>
                <th className="px-5 py-4">Value</th>
                <th className="px-5 py-4">Raw</th>
                <th className="px-5 py-4">Pos Rank</th>
                <th className="px-5 py-4">Age</th>
                <th className="px-5 py-4">Sleeper ID</th>
                <th className="px-5 py-4">Match</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <LoadingRows pageSize={pageSize} />
              ) : (
                rows.map((row, index) => (
                  <tr
                    key={`${row.sleeper_player_id}-${index}`}
                    className="border-b border-zinc-800 bg-zinc-950/40 transition hover:bg-zinc-900"
                  >
                    <td className="px-5 py-4">
                      <span className="font-black text-emerald-400">
                        #{row.overall_rank || startRow + index}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <p className="font-black">{row.fullName}</p>
                    </td>

                    <td className="px-5 py-4">
                      <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-black text-zinc-200">
                        {row.position}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-zinc-300">
                      {row.team || 'FA'}
                    </td>

                    <td className="px-5 py-4">
                      <p className="text-2xl font-black text-emerald-400">
                        {formatValue(row.value)}
                      </p>
                    </td>

                    <td className="px-5 py-4 text-zinc-300">
                      {formatValue(row.raw_value)}
                    </td>

                    <td className="px-5 py-4 text-zinc-300">
                      {row.position_rank ? `#${row.position_rank}` : '—'}
                    </td>

                    <td className="px-5 py-4 text-zinc-300">
                      {row.age || '—'}
                    </td>

                    <td className="px-5 py-4 font-mono text-xs text-zinc-500">
                      {row.sleeper_player_id}
                    </td>

                    <td className="px-5 py-4">
                      {row.foundInDatabase ? (
                        <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-black text-emerald-300">
                          Matched
                        </span>
                      ) : (
                        <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-black text-red-300">
                          Missing
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}

              {!loading && !rows.length && (
                <tr>
                  <td colSpan={10} className="px-5 py-8 text-zinc-400">
                    No dynasty values found for this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col justify-between gap-4 border-t border-zinc-800 p-5 md:flex-row md:items-center">
          <p className="text-sm font-bold text-zinc-400">
            Page {page} of {totalPages}
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPage(1)}
              disabled={page === 1 || loading}
              className="rounded-xl border border-zinc-700 px-3 py-2 text-sm font-bold text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              First
            </button>

            <button
              type="button"
              onClick={() => setPage(Math.max(page - 1, 1))}
              disabled={page === 1 || loading}
              className="rounded-xl border border-zinc-700 px-3 py-2 text-sm font-bold text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Prev
            </button>

            {pageNumbers.map((pageNumber, index) =>
              pageNumber === 'ellipsis' ? (
                <span
                  key={`ellipsis-${index}`}
                  className="rounded-xl px-3 py-2 text-sm font-bold text-zinc-500"
                >
                  ...
                </span>
              ) : (
                <button
                  key={pageNumber}
                  type="button"
                  onClick={() => setPage(pageNumber)}
                  disabled={loading}
                  className={`rounded-xl px-3 py-2 text-sm font-black ${
                    pageNumber === page
                      ? 'bg-emerald-500 text-zinc-950'
                      : 'border border-zinc-700 text-zinc-300 hover:bg-zinc-800'
                  } disabled:cursor-not-allowed disabled:opacity-40`}
                >
                  {pageNumber}
                </button>
              )
            )}

            <button
              type="button"
              onClick={() => setPage(Math.min(page + 1, totalPages))}
              disabled={page === totalPages || loading}
              className="rounded-xl border border-zinc-700 px-3 py-2 text-sm font-bold text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>

            <button
              type="button"
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages || loading}
              className="rounded-xl border border-zinc-700 px-3 py-2 text-sm font-bold text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Last
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

function PositionFilters({
  selectedPosition,
  setSelectedPosition,
}: {
  selectedPosition: string
  setSelectedPosition: (position: string) => void
}) {
  const positions = ['ALL', 'QB', 'RB', 'WR', 'TE']

  return (
    <div className="flex flex-wrap gap-2">
      {positions.map((position) => {
        const active = selectedPosition === position

        return (
          <button
            key={position}
            type="button"
            onClick={() => setSelectedPosition(position)}
            className={`rounded-2xl px-5 py-3 text-sm font-black transition ${
              active
                ? 'bg-emerald-500 text-zinc-950'
                : 'border border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-emerald-500'
            }`}
          >
            {position === 'ALL' ? 'All' : position}
          </button>
        )
      })}
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.5rem] border border-zinc-800 bg-zinc-900 p-5">
      <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-300">
        {label}
      </p>
      <p className="mt-3 text-xl font-black">{value}</p>
    </div>
  )
}

function LoadingRows({ pageSize }: { pageSize: number }) {
  return (
    <>
      {Array.from({ length: Math.min(pageSize, 10) }, (_, index) => (
        <tr key={index} className="border-b border-zinc-800 bg-zinc-950/40">
          {Array.from({ length: 10 }, (_, cellIndex) => (
            <td key={cellIndex} className="px-5 py-4">
              <div className="h-5 animate-pulse rounded bg-zinc-800" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

function buildPageNumbers(page: number, totalPages: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const pages: Array<number | 'ellipsis'> = [1]

  const start = Math.max(page - 1, 2)
  const end = Math.min(page + 1, totalPages - 1)

  if (start > 2) {
    pages.push('ellipsis')
  }

  for (let current = start; current <= end; current++) {
    pages.push(current)
  }

  if (end < totalPages - 1) {
    pages.push('ellipsis')
  }

  pages.push(totalPages)

  return pages
}

function formatValue(value: number | string | null) {
  if (value === null || value === undefined) return '—'

  const numberValue = Number(value)

  if (!Number.isFinite(numberValue)) return '—'

  return numberValue.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })
}

function formatDateTime(value: string | null) {
  if (!value) return '—'

  return new Date(value).toISOString().replace('T', ' ').slice(0, 16)
}