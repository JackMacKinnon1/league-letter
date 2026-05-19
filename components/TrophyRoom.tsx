'use client'

import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronDown,
  Crown,
  Medal,
  Shield,
  Sparkles,
  Trophy,
} from 'lucide-react'
import { useState } from 'react'

type DivisionWinner = {
  division_id: number | string
  division_name: string
  sleeper_roster_id: number
  team_name: string
  owner_name: string | null
  avatar: string | null
  wins: number
  losses: number
  ties: number
  points_for: number
}

type TrophySeason = {
  season: string
  championship_week: number | null
  champion_roster_id: number | null
  champion_team_name: string | null
  champion_points: number | null
  runner_up_roster_id: number | null
  runner_up_team_name: string | null
  runner_up_points: number | null
  division_winners: DivisionWinner[]
}

export default function TrophyRoom({
  leagueId,
  leagueName,
  seasons,
  hasDivisions,
}: {
  leagueId: string
  leagueName?: string | null
  seasons: TrophySeason[]
  hasDivisions: boolean
}) {
  const [openSeason, setOpenSeason] = useState<string | null>(
    seasons[0]?.season || null
  )

  return (
    <main className="min-h-screen overflow-hidden bg-zinc-950 text-white">
      <div className="pointer-events-none fixed inset-0 opacity-70">
        <div className="absolute left-[-10%] top-[-15%] h-[32rem] w-[32rem] rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute bottom-[-20%] right-[-10%] h-[34rem] w-[34rem] rounded-full bg-amber-500/10 blur-3xl" />
      </div>

      <section className="relative border-b border-zinc-800 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.28),_transparent_35%),linear-gradient(to_bottom,_#064e3b,_#09090b)] px-4 py-12 md:py-16">
        <div className="mx-auto max-w-7xl">
          <Link
            href={`/league/${leagueId}`}
            className="text-sm font-bold text-zinc-300 transition hover:text-white"
          >
            ← Back to league
          </Link>

          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px] lg:items-end">
            <div>
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm font-black uppercase tracking-[0.35em] text-emerald-300"
              >
                League History
              </motion.p>

              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="mt-4 text-5xl font-black tracking-tight md:text-7xl"
              >
                Trophy Room
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mt-4 max-w-3xl text-lg text-zinc-300"
              >
                A season-by-season display of league champions
                {hasDivisions ? ', division winners,' : ''} and title game
                results for {leagueName || 'this league'}.
              </motion.p>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="rounded-[2rem] border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-400 text-zinc-950 shadow-lg shadow-amber-500/20">
                  <Trophy size={34} />
                </div>
                <div>
                  <p className="text-4xl font-black">{seasons.length}</p>
                  <p className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-300">
                    Seasons Logged
                  </p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <StatPill label="Champions" value={seasons.filter((s) => s.champion_team_name).length} />
                <StatPill
                  label="Divisions"
                  value={hasDivisions ? 'On' : 'Off'}
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-7xl px-4 py-8 md:py-10">
        <div className="space-y-5">
          {seasons.map((season, index) => {
            const isOpen = openSeason === season.season

            return (
              <motion.div
                key={season.season}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className={`overflow-hidden rounded-[2rem] border bg-zinc-900/80 shadow-2xl backdrop-blur transition ${
                  isOpen
                    ? 'border-emerald-500/40 shadow-emerald-950/30'
                    : 'border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOpenSeason(isOpen ? null : season.season)}
                  className="flex w-full flex-col gap-5 p-6 text-left lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-zinc-950 text-amber-300 ring-1 ring-white/10">
                      <Crown size={28} />
                    </div>

                    <div>
                      <p className="text-sm font-black uppercase tracking-[0.3em] text-emerald-400">
                        Season {season.season}
                      </p>
                      <h2 className="mt-2 text-3xl font-black md:text-4xl">
                        {season.champion_team_name || 'Champion not synced'}
                      </h2>
                      <p className="mt-2 text-sm text-zinc-400">
                        {season.runner_up_team_name
                          ? `Defeated ${season.runner_up_team_name}`
                          : 'Open this year to view available trophy data'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                    {hasDivisions && (
                      <div className="rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-black text-zinc-300 ring-1 ring-zinc-800">
                        {season.division_winners.length} division
                        {season.division_winners.length === 1 ? '' : 's'}
                      </div>
                    )}

                    <div className="rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-black text-zinc-950">
                      {formatPoints(season.champion_points)} pts
                    </div>

                    <motion.div
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-950 text-zinc-300 ring-1 ring-zinc-800"
                    >
                      <ChevronDown size={20} />
                    </motion.div>
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                    >
                      <div className="border-t border-zinc-800 p-6">
                        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
                          <ChampionCard leagueId={leagueId} season={season} />

                          <div className="rounded-[1.5rem] border border-zinc-800 bg-zinc-950 p-5">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
                                <Shield size={21} />
                              </div>
                              <div>
                                <h3 className="text-xl font-black">
                                  Division Winners
                                </h3>
                                <p className="text-sm text-zinc-500">
                                  Regular-season leaders by division
                                </p>
                              </div>
                            </div>

                            {hasDivisions ? (
                              <div className="mt-5 space-y-3">
                                {season.division_winners.map((team, teamIndex) => (
                                  <motion.div
                                    key={`${season.season}-${team.division_id}`}
                                    initial={{ opacity: 0, x: 12 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: teamIndex * 0.05 }}
                                  >
                                    <DivisionWinnerRow
                                      leagueId={leagueId}
                                      team={team}
                                    />
                                  </motion.div>
                                ))}

                                {!season.division_winners.length && (
                                  <p className="rounded-2xl border border-dashed border-zinc-800 p-4 text-sm text-zinc-400">
                                    No division winners found for this season.
                                    Sync again after adding the division columns.
                                  </p>
                                )}
                              </div>
                            ) : (
                              <p className="mt-5 rounded-2xl border border-dashed border-zinc-800 p-4 text-sm text-zinc-400">
                                This league does not have division data synced, so
                                only league champions are shown.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}

          {!seasons.length && (
            <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-8 text-zinc-400">
              No historical winners found yet. Sync Sleeper data from the admin
              page first.
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-zinc-950/70 p-4 ring-1 ring-white/10">
      <p className="text-2xl font-black">{value}</p>
      <p className="mt-1 text-xs font-black uppercase tracking-[0.2em] text-zinc-400">
        {label}
      </p>
    </div>
  )
}

function ChampionCard({
  leagueId,
  season,
}: {
  leagueId: string
  season: TrophySeason
}) {
  return (
    <div className="relative overflow-hidden rounded-[1.5rem] border border-amber-400/20 bg-[radial-gradient(circle_at_top_right,_rgba(251,191,36,0.18),_transparent_40%),#09090b] p-5">
      <div className="absolute right-5 top-5 text-amber-300/20">
        <Sparkles size={80} />
      </div>

      <div className="relative flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-400 text-zinc-950">
          <Trophy size={24} />
        </div>
        <div>
          <p className="text-sm font-black uppercase tracking-[0.25em] text-amber-300">
            League Champion
          </p>
          <h3 className="mt-1 text-2xl font-black">
            {season.champion_team_name || 'Unknown champion'}
          </h3>
        </div>
      </div>

      <div className="relative mt-6 grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <TitleTeamCard
          leagueId={leagueId}
          label="Champion"
          rosterId={season.champion_roster_id}
          teamName={season.champion_team_name}
          points={season.champion_points}
          isWinner
        />

        <div className="text-center text-sm font-black uppercase tracking-[0.25em] text-zinc-500">
          vs
        </div>

        <TitleTeamCard
          leagueId={leagueId}
          label="Runner-Up"
          rosterId={season.runner_up_roster_id}
          teamName={season.runner_up_team_name}
          points={season.runner_up_points}
        />
      </div>

      {season.championship_week && (
        <p className="relative mt-5 text-sm font-bold text-zinc-500">
          Championship Week {season.championship_week}
        </p>
      )}
    </div>
  )
}

function TitleTeamCard({
  leagueId,
  label,
  rosterId,
  teamName,
  points,
  isWinner,
}: {
  leagueId: string
  label: string
  rosterId: number | null
  teamName: string | null
  points: number | null
  isWinner?: boolean
}) {
  const content = (
    <div
      className={`rounded-3xl border p-5 transition ${
        isWinner
          ? 'border-emerald-500/30 bg-emerald-500/10'
          : 'border-zinc-800 bg-zinc-900'
      }`}
    >
      <p
        className={`text-xs font-black uppercase tracking-[0.2em] ${
          isWinner ? 'text-emerald-400' : 'text-zinc-500'
        }`}
      >
        {label}
      </p>
      <p className="mt-2 text-xl font-black">{teamName || 'Unknown team'}</p>
      <p
        className={`mt-3 text-4xl font-black ${
          isWinner ? 'text-emerald-400' : 'text-zinc-300'
        }`}
      >
        {formatPoints(points)}
      </p>
    </div>
  )

  if (!rosterId) return content

  return (
    <Link href={`/league/${leagueId}/teams/${rosterId}`} className="block">
      {content}
    </Link>
  )
}

function DivisionWinnerRow({
  leagueId,
  team,
}: {
  leagueId: string
  team: DivisionWinner
}) {
  return (
    <Link
      href={`/league/${leagueId}/teams/${team.sleeper_roster_id}`}
      className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 transition hover:border-emerald-500/40 hover:bg-zinc-800/80"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-zinc-950 text-emerald-400 ring-1 ring-zinc-800">
          {team.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={team.avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            <Medal size={22} />
          )}
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm font-black uppercase tracking-[0.18em] text-emerald-400">
            {team.division_name}
          </p>
          <p className="truncate text-lg font-black">{team.team_name}</p>
          {team.owner_name && (
            <p className="truncate text-sm text-zinc-500">{team.owner_name}</p>
          )}
        </div>
      </div>

      <div className="shrink-0 text-right">
        <p className="font-black">
          {team.wins}-{team.losses}
          {team.ties ? `-${team.ties}` : ''}
        </p>
        <p className="text-sm text-zinc-500">{formatPoints(team.points_for)} PF</p>
      </div>
    </Link>
  )
}

function formatDivisionFallback(divisionId: string) {
  const numericId = Number(divisionId)

  if (!Number.isFinite(numericId)) {
    return `Division ${divisionId}`
  }

  return `Division ${numericId === 0 ? 1 : numericId}`
}

function formatPoints(points?: number | null) {
  return Number(points || 0).toFixed(2)
}
