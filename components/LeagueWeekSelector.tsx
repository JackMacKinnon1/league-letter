'use client'

import { usePathname } from 'next/navigation'
import { useState } from 'react'

export default function LeagueWeekSelector({
  leagueId,
  seasons,
  selectedSeason,
  selectedWeek,
}: {
  leagueId: string
  seasons: string[]
  selectedSeason: string
  selectedWeek: number
}) {
  const pathname = usePathname()

  const [season, setSeason] = useState(selectedSeason)
  const [week, setWeek] = useState(String(selectedWeek))

  return (
    <form
      action={pathname}
      method="GET"
      className="relative z-20 mt-6 rounded-[2rem] border border-white/10 bg-white/10 p-5 backdrop-blur"
    >
      <p className="text-sm font-black uppercase tracking-[0.25em] text-emerald-300">
        View League Week
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <div>
          <label className="text-sm font-bold text-zinc-300">Season</label>

          <select
            name="season"
            value={season}
            onChange={(e) => {
              setSeason(e.target.value)
              setWeek('1')
            }}
            className="mt-2 h-14 w-full rounded-2xl border border-white/10 bg-zinc-950 px-4 py-3 text-base font-bold outline-none focus:border-emerald-500"
          >
            {seasons.map((seasonOption) => (
              <option key={seasonOption} value={seasonOption}>
                {seasonOption}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-bold text-zinc-300">Week</label>

          <select
            name="week"
            value={week}
            onChange={(e) => setWeek(e.target.value)}
            className="mt-2 h-14 w-full rounded-2xl border border-white/10 bg-zinc-950 px-4 py-3 text-base font-bold outline-none focus:border-emerald-500"
          >
            {Array.from({ length: 18 }, (_, index) => index + 1).map(
              (weekOption) => (
                <option key={weekOption} value={String(weekOption)}>
                  Week {weekOption}
                </option>
              )
            )}
          </select>
        </div>

        <button
          type="submit"
          className="h-14 w-full rounded-2xl bg-emerald-500 px-5 py-3 text-base font-black text-zinc-950 hover:bg-emerald-400 md:w-auto"
        >
          Apply
        </button>
      </div>
    </form>
  )
}