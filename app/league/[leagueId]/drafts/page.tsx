import Link from '@/components/NoPrefetchLink'
import { Suspense } from 'react'
import Navbar from '@/components/Navbar'
import DataLoadingPanel from '@/components/DataLoadingPanel'
import { createClient } from '@/lib/supabase/server'
import { getSleeperLeagueDrafts } from '@/lib/sleeper'
import { CalendarDays, CheckCircle2, Clock, Trophy } from 'lucide-react'

export default async function DraftsPage({
  params,
}: {
  params: Promise<{ leagueId: string }>
}) {
  const { leagueId } = await params
  const supabase = await createClient()

  const { data: league } = await supabase
    .from('leagues')
    .select('*')
    .eq('id', leagueId)
    .single()

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <Navbar />

      <section className="border-b border-white/10 bg-white/[0.015] px-4 py-12">
        <div className="mx-auto max-w-7xl">
          <Link
            href={`/league/${leagueId}`}
            className="text-sm font-semibold text-zinc-400 hover:text-white"
          >
            ← Back to league
          </Link>

          <p className="mt-8 text-sm font-semibold uppercase tracking-[0.3em] text-emerald-300">
            Draft Room
          </p>

          <h1 className="mt-4 text-5xl font-semibold tracking-tight md:text-7xl">
            {league?.name} Drafts
          </h1>

          <p className="mt-4 max-w-3xl text-lg leading-8 text-zinc-300">
            View upcoming drafts, completed drafts, and full draft boards from Sleeper.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8">
        <Suspense fallback={<DataLoadingPanel title="Fetching drafts from Sleeper" rows={5} />}>
          <DraftsContent leagueId={leagueId} sleeperLeagueId={league?.sleeper_league_id} />
        </Suspense>
      </section>
    </main>
  )
}

async function DraftsContent({
  leagueId,
  sleeperLeagueId,
}: {
  leagueId: string
  sleeperLeagueId?: string | null
}) {
  let drafts: any[] = []
  let errorMessage = ''

  try {
    if (!sleeperLeagueId) throw new Error('Missing Sleeper league id')
    drafts = await getSleeperLeagueDrafts(sleeperLeagueId)
  } catch {
    errorMessage = 'Could not load drafts from Sleeper.'
  }

  const upcomingDrafts = drafts.filter((draft) => draft.status !== 'complete')
  const completedDrafts = drafts.filter((draft) => draft.status === 'complete')

  return (
    <div className="space-y-8">
      {errorMessage && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-red-200">
          {errorMessage}
        </div>
      )}

      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-xl shadow-black/20 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-emerald-300">
            <Clock size={22} />
          </div>

          <div>
            <h2 className="text-3xl font-semibold tracking-tight">Upcoming Drafts</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Drafts that are scheduled, not started, paused, or currently drafting.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {upcomingDrafts.map((draft) => (
            <DraftCard key={draft.draft_id} leagueId={leagueId} draft={draft} />
          ))}

          {!upcomingDrafts.length && (
            <p className="rounded-xl border border-white/10 bg-black/15 p-5 text-zinc-400">
              No upcoming drafts found.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-xl shadow-black/20 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-emerald-300">
            <Trophy size={22} />
          </div>

          <div>
            <h2 className="text-3xl font-semibold tracking-tight">Previous Drafts</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Completed drafts from this Sleeper league.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {completedDrafts.map((draft) => (
            <DraftCard key={draft.draft_id} leagueId={leagueId} draft={draft} />
          ))}

          {!completedDrafts.length && (
            <p className="rounded-xl border border-white/10 bg-black/15 p-5 text-zinc-400">
              No completed drafts found.
            </p>
          )}
        </div>
      </section>
    </div>
  )
}

function DraftCard({
  leagueId,
  draft,
}: {
  leagueId: string
  draft: any
}) {
  const draftName =
    draft.metadata?.name ||
    `${draft.season} ${capitalize(draft.type)} Draft`

  return (
    <Link
      href={`/league/${leagueId}/drafts/${draft.draft_id}`}
      className="block rounded-2xl border border-white/10 bg-black/15 p-5 transition hover:border-emerald-400/50 hover:bg-white/[0.04]"
    >
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300">
            {draft.status.replace('_', ' ')}
          </p>

          <h3 className="mt-2 text-2xl font-semibold tracking-tight">{draftName}</h3>

          <p className="mt-2 text-sm text-zinc-400">
            Season {draft.season} · {capitalize(draft.type)} ·{' '}
            {draft.settings?.rounds || '?'} rounds
          </p>
        </div>

        <DraftStatusBadge status={draft.status} />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <DraftMiniStat
          icon={<CalendarDays size={16} />}
          label="Start"
          value={formatDateTime(draft.start_time)}
        />
        <DraftMiniStat
          icon={<CheckCircle2 size={16} />}
          label="Picks"
          value={draft.last_picked ? 'Started' : 'No picks'}
        />
        <DraftMiniStat
          icon={<Clock size={16} />}
          label="Timer"
          value={
            draft.settings?.pick_timer
              ? `${draft.settings.pick_timer}s`
              : 'No timer'
          }
        />
      </div>

      <p className="mt-5 text-sm font-semibold text-emerald-300">
        Open draft board →
      </p>
    </Link>
  )
}

function DraftStatusBadge({ status }: { status: string }) {
  const label = status.replace('_', ' ')

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
        status === 'complete'
          ? 'border border-white/10 bg-white/[0.04] text-zinc-300'
          : 'border border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
      }`}
    >
      {label}
    </span>
  )
}

function DraftMiniStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
      <div className="flex items-center gap-2 text-emerald-300">
        {icon}
        <p className="text-xs font-semibold uppercase tracking-[0.18em]">
          {label}
        </p>
      </div>

      <p className="mt-2 text-sm font-semibold text-zinc-300">{value}</p>
    </div>
  )
}

function formatDateTime(timestamp: number | null) {
  if (!timestamp) return 'TBD'
  return new Date(timestamp).toISOString().replace('T', ' ').slice(0, 16)
}

function capitalize(value: string) {
  if (!value) return ''
  return value.charAt(0).toUpperCase() + value.slice(1)
}
