import Link from 'next/link'
import Navbar from '@/components/Navbar'
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

  let drafts: any[] = []
  let errorMessage = ''

  try {
    drafts = await getSleeperLeagueDrafts(league?.sleeper_league_id)
  } catch {
    errorMessage = 'Could not load drafts from Sleeper.'
  }

  const upcomingDrafts = drafts.filter((draft) => draft.status !== 'complete')
  const completedDrafts = drafts.filter((draft) => draft.status === 'complete')

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <Navbar />

      <section className="border-b border-zinc-800 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.25),_transparent_35%),linear-gradient(to_bottom,_#064e3b,_#09090b)] px-4 py-12">
        <div className="mx-auto max-w-7xl">
          <Link
            href={`/league/${leagueId}`}
            className="text-sm font-bold text-zinc-300 hover:text-white"
          >
            ← Back to league
          </Link>

          <p className="mt-8 text-sm font-black uppercase tracking-[0.35em] text-emerald-300">
            Draft Room
          </p>

          <h1 className="mt-4 text-5xl font-black tracking-tight md:text-7xl">
            {league?.name} Drafts
          </h1>

          <p className="mt-4 max-w-3xl text-lg text-zinc-300">
            View upcoming drafts, completed drafts, and full draft boards from Sleeper.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl space-y-8 px-4 py-8">
        {errorMessage && (
          <div className="rounded-[2rem] border border-red-900 bg-red-950/40 p-6 text-red-300">
            {errorMessage}
          </div>
        )}

        <section className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500 text-zinc-950">
              <Clock size={22} />
            </div>

            <div>
              <h2 className="text-3xl font-black">Upcoming Drafts</h2>
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
              <p className="rounded-2xl bg-zinc-950 p-5 text-zinc-400">
                No upcoming drafts found.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-950 text-emerald-400">
              <Trophy size={22} />
            </div>

            <div>
              <h2 className="text-3xl font-black">Previous Drafts</h2>
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
              <p className="rounded-2xl bg-zinc-950 p-5 text-zinc-400">
                No completed drafts found.
              </p>
            )}
          </div>
        </section>
      </section>
    </main>
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
      className="block rounded-[2rem] border border-zinc-800 bg-zinc-950 p-5 transition hover:border-emerald-500"
    >
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-400">
            {draft.status.replace('_', ' ')}
          </p>

          <h3 className="mt-2 text-2xl font-black">{draftName}</h3>

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

      <p className="mt-5 text-sm font-black text-emerald-400">
        Open draft board →
      </p>
    </Link>
  )
}

function DraftStatusBadge({ status }: { status: string }) {
  const label = status.replace('_', ' ')

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.2em] ${
        status === 'complete'
          ? 'bg-zinc-800 text-zinc-300'
          : 'bg-emerald-500 text-zinc-950'
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
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center gap-2 text-emerald-400">
        {icon}
        <p className="text-xs font-black uppercase tracking-[0.2em]">
          {label}
        </p>
      </div>

      <p className="mt-2 text-sm font-bold text-zinc-300">{value}</p>
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