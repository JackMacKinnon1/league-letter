'use client'

import { usePathname } from 'next/navigation'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'

export default function LeagueWeekSelector({
  leagueId: _leagueId,
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
  const weekNumber = Number(week)

  return (
    <form action={pathname} method="GET" className="ll-week-selector">
      <div className="ll-week-selector-label">
        <CalendarDays size={16} />
        <div>
          <span>League view</span>
          <b>Season & week</b>
        </div>
      </div>

      <div className="ll-week-control">
        <button
          type="button"
          className="ll-week-arrow"
          aria-label="Previous week"
          disabled={weekNumber <= 1}
          onClick={() => setWeek(String(Math.max(1, weekNumber - 1)))}
        >
          <ChevronLeft size={19} />
        </button>

        <label className="ll-compact-select">
          <span className="sr-only">Season</span>
          <select
            name="season"
            value={season}
            onChange={(e) => {
              setSeason(e.target.value)
              setWeek('1')
            }}
          >
            {seasons.map((seasonOption) => (
              <option key={seasonOption} value={seasonOption}>{seasonOption}</option>
            ))}
          </select>
        </label>

        <label className="ll-compact-select ll-week-select">
          <span className="sr-only">Week</span>
          <select name="week" value={week} onChange={(e) => setWeek(e.target.value)}>
            {Array.from({ length: 18 }, (_, index) => index + 1).map((weekOption) => (
              <option key={weekOption} value={String(weekOption)}>Week {weekOption}</option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="ll-week-arrow"
          aria-label="Next week"
          disabled={weekNumber >= 18}
          onClick={() => setWeek(String(Math.min(18, weekNumber + 1)))}
        >
          <ChevronRight size={19} />
        </button>
      </div>

      <button type="submit" className="ll-btn ll-btn-secondary ll-week-apply">Apply</button>
    </form>
  )
}
