'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function FeaturedMatchupManager({
  leagueId,
  currentSeason,
  currentWeek,
  seasons,
  initialMatchups,
  currentFeatured,
}: {
  leagueId: string
  currentSeason: string
  currentWeek: number
  seasons: string[]
  initialMatchups: any[]
  currentFeatured: any
}) {
  const supabase = createClient()

  const [selectedSeason, setSelectedSeason] = useState(currentSeason)
  const [selectedWeek, setSelectedWeek] = useState(currentWeek)
  const [matchups, setMatchups] = useState<any[]>(initialMatchups || [])
  const [featured, setFeatured] = useState<any>(currentFeatured)
  const [matchupId, setMatchupId] = useState(
    currentFeatured?.matchup_id ? String(currentFeatured.matchup_id) : ''
  )
  const [headline, setHeadline] = useState(currentFeatured?.headline || '')
  const [description, setDescription] = useState(
    currentFeatured?.description || ''
  )
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const grouped = useMemo(() => {
    return matchups.reduce((acc: Record<string, any[]>, matchup: any) => {
      const key =
        matchup.matchup_id !== null && matchup.matchup_id !== undefined
          ? String(matchup.matchup_id)
          : `solo-${matchup.sleeper_roster_id}`

      if (!acc[key]) acc[key] = []
      acc[key].push(matchup)

      return acc
    }, {})
  }, [matchups])

  useEffect(() => {
    async function loadSeasonWeek() {
      setLoading(true)
      setMessage('')

      const { data: matchupRows, error: matchupError } = await supabase
        .from('matchups')
        .select('*')
        .eq('league_id', leagueId)
        .eq('season', selectedSeason)
        .eq('week', selectedWeek)
        .order('matchup_id', { ascending: true })

      if (matchupError) {
        setMessage(matchupError.message)
        setLoading(false)
        return
      }

      const { data: featuredRow, error: featuredError } = await supabase
        .from('featured_matchups')
        .select('*')
        .eq('league_id', leagueId)
        .eq('season', selectedSeason)
        .eq('week', selectedWeek)
        .maybeSingle()

      if (featuredError) {
        setMessage(featuredError.message)
        setLoading(false)
        return
      }

      setMatchups(matchupRows || [])
      setFeatured(featuredRow)
      setMatchupId(featuredRow?.matchup_id ? String(featuredRow.matchup_id) : '')
      setHeadline(featuredRow?.headline || '')
      setDescription(featuredRow?.description || '')
      setLoading(false)
    }

    loadSeasonWeek()
  }, [leagueId, selectedSeason, selectedWeek, supabase])

  async function saveFeatured() {
    setMessage('')

    if (!matchupId) {
      setMessage('Pick a matchup first.')
      return
    }

    if (matchupId.startsWith('solo-')) {
      setMessage('This matchup cannot be featured because it does not have a real Sleeper matchup ID.')
      return
    }

    const { error } = await supabase.from('featured_matchups').upsert(
      {
        league_id: leagueId,
        season: selectedSeason,
        week: selectedWeek,
        matchup_id: Number(matchupId),
        headline,
        description,
      },
      {
        onConflict: 'league_id,season,week',
      }
    )

    if (error) {
      setMessage(error.message)
      return
    }

    setMessage('Featured matchup saved.')
    window.location.reload()
  }

  return (
    <section className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="text-3xl font-black">Featured Matchup</h2>
      <p className="mt-2 text-sm text-zinc-400">
        Pick a featured matchup for any season and week.
      </p>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <div>
          <label className="text-sm font-bold text-zinc-400">Season</label>
          <select
            className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none focus:border-emerald-500"
            value={selectedSeason}
            onChange={(e) => {
              setSelectedSeason(e.target.value)
              setSelectedWeek(1)
            }}
          >
            {seasons.map((season) => (
              <option key={season} value={season}>
                {season}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-bold text-zinc-400">Week</label>
          <select
            className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none focus:border-emerald-500"
            value={String(selectedWeek)}
            onChange={(e) => setSelectedWeek(Number(e.target.value))}
          >
            {Array.from({ length: 18 }, (_, index) => index + 1).map((week) => (
              <option key={week} value={week}>
                Week {week}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <select
          className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none focus:border-emerald-500"
          value={matchupId}
          onChange={(e) => setMatchupId(e.target.value)}
          disabled={loading}
        >
          <option value="">
            {loading ? 'Loading matchups...' : 'Select matchup'}
          </option>

          {Object.entries(grouped).map(([id, teams]) => {
            const first = teams[0]?.team_name || 'Team A'
            const second = teams[1]?.team_name || 'Team B'

            return (
              <option key={id} value={id}>
                Matchup {id.replace('solo-', '')}: {first} vs {second}
              </option>
            )
          })}
        </select>

        <input
          className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none focus:border-emerald-500"
          placeholder="Headline"
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
        />

        <textarea
          className="min-h-32 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none focus:border-emerald-500"
          placeholder="Why this matchup matters..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <button
          onClick={saveFeatured}
          className="w-full rounded-2xl bg-emerald-500 py-3 font-black text-zinc-950 hover:bg-emerald-400"
        >
          Save Featured Matchup
        </button>

        {featured && (
          <p className="text-sm text-zinc-500">
            Existing featured matchup found for Season {selectedSeason}, Week{' '}
            {selectedWeek}.
          </p>
        )}

        {message && <p className="text-sm text-zinc-400">{message}</p>}
      </div>
    </section>
  )
}