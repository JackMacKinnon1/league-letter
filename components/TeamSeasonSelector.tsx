'use client'

export default function TeamSeasonSelector({
  leagueId,
  teamId,
  selectedSeason,
  seasons,
}: {
  leagueId: string
  teamId: string
  selectedSeason: string
  seasons: string[]
}) {
  function changeSeason(value: string) {
    window.location.href = `/league/${leagueId}/teams/${teamId}?season=${value}`
  }

  return (
    <div>
      <label className="text-sm font-bold text-zinc-400">
        View Stats
      </label>

      <select
        value={selectedSeason}
        onChange={(e) => changeSeason(e.target.value)}
        className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 font-bold outline-none focus:border-emerald-500"
      >
        <option value="all">All Time</option>

        {seasons.map((season) => (
          <option key={season} value={season}>
            {season}
          </option>
        ))}
      </select>
    </div>
  )
}