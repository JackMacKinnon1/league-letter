import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { createClient } from '@/lib/supabase/server'
import {
  getSleeperDraft,
  getSleeperDraftPicks,
  getSleeperTradedPicks,
} from '@/lib/sleeper'
import { Clock, Hash, Trophy, Users } from 'lucide-react'

export default async function DraftBoardPage({
  params,
}: {
  params: Promise<{ leagueId: string; draftId: string }>
}) {
  const { leagueId, draftId } = await params
  const supabase = await createClient()

  const { data: league } = await supabase
    .from('leagues')
    .select('*')
    .eq('id', leagueId)
    .single()

  const { data: teams } = await supabase
    .from('teams')
    .select('*')
    .eq('league_id', leagueId)

  let draft: any = null
  let picks: any[] = []
  let tradedPicks: any[] = []
  let errorMessage = ''

  try {
    draft = await getSleeperDraft(draftId)
    picks = await getSleeperDraftPicks(draftId)
    tradedPicks = await getSleeperTradedPicks(league?.sleeper_league_id)
  } catch {
    errorMessage = 'Could not load this draft from Sleeper.'
  }

  const playerIds = new Set<string>()

  for (const pick of picks || []) {
    if (pick.player_id) playerIds.add(pick.player_id)
  }

  const { data: localPlayers } = await supabase
    .from('players')
    .select('*')
    .in('id', playerIds.size ? Array.from(playerIds) : [''])

  const playersById = new Map<string, any>()

  for (const player of localPlayers || []) {
    playersById.set(player.id, player)
  }

  const teamByRosterId = new Map<number, any>()

  for (const team of teams || []) {
    teamByRosterId.set(Number(team.sleeper_roster_id), team)
  }

  const rounds = Number(draft?.settings?.rounds || 0)
  const teamsCount = Number(draft?.settings?.teams || teams?.length || 0)

  const draftColumns = buildDraftColumns(draft, teams || [])

  const sortedPicks = [...(picks || [])].sort(
    (a, b) => Number(a.pick_no) - Number(b.pick_no)
  )

  const latestPicks = [...sortedPicks].reverse().slice(0, 8)

  const lastPick = sortedPicks.length
    ? sortedPicks[sortedPicks.length - 1]
    : null

  const totalExpectedPicks = rounds && teamsCount ? rounds * teamsCount : 0
  const picksMade = picks.length
  const progress =
    totalExpectedPicks > 0
      ? Math.min(Math.round((picksMade / totalExpectedPicks) * 100), 100)
      : 0

  const draftName =
    draft?.metadata?.name ||
    `${draft?.season || ''} ${capitalize(draft?.type || '')} Draft`

  const statusLabel = draft?.status?.replace('_', ' ') || 'unknown'
  const isComplete = draft?.status === 'complete'
  const isUpcoming = draft?.status === 'pre_draft'
  const isLive = draft?.status === 'drafting' || draft?.status === 'paused'

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <Navbar />

      <section className="border-b border-zinc-800 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.22),_transparent_35%),linear-gradient(to_bottom,_#052e25,_#09090b)] px-4 py-10">
        <div className="mx-auto w-full max-w-none px-0 md:px-2 2xl:px-4">
          <Link
            href={`/league/${leagueId}/drafts`}
            className="text-sm font-bold text-zinc-300 hover:text-white"
          >
            ← Back to draft room
          </Link>

          <div className="mt-8 flex flex-col justify-between gap-6 xl:flex-row xl:items-end">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm font-black uppercase tracking-[0.35em] text-emerald-300">
                  Draft Room
                </p>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.2em] ${
                    isComplete
                      ? 'bg-zinc-800 text-zinc-300'
                      : isLive
                        ? 'bg-emerald-500 text-zinc-950'
                        : 'bg-yellow-400 text-zinc-950'
                  }`}
                >
                  {statusLabel}
                </span>
              </div>

              <h1 className="mt-4 max-w-5xl text-5xl font-black tracking-tight md:text-7xl">
                {draftName}
              </h1>

              <p className="mt-4 max-w-3xl text-lg text-zinc-300">
                Season {draft?.season || '—'} ·{' '}
                {capitalize(draft?.type || 'draft')} · {rounds || '—'} rounds ·{' '}
                {teamsCount || '—'} teams
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[460px]">
              <HeaderStat
                icon={<Hash size={18} />}
                label="Picks Made"
                value={`${picksMade}${
                  totalExpectedPicks ? `/${totalExpectedPicks}` : ''
                }`}
              />

              <HeaderStat
                icon={<Clock size={18} />}
                label="Start"
                value={formatDateTime(draft?.start_time)}
              />
            </div>
          </div>

          <div className="mt-8 overflow-hidden rounded-[2rem] border border-white/10 bg-white/10 p-5 backdrop-blur">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.25em] text-emerald-300">
                  Draft Progress
                </p>
                <p className="mt-1 text-sm text-zinc-300">
                  {isUpcoming
                    ? 'Draft has not started yet.'
                    : isComplete
                      ? 'Draft is complete.'
                      : 'Draft is currently active or paused.'}
                </p>
              </div>

              <p className="text-3xl font-black text-emerald-400">
                {progress}%
              </p>
            </div>

            <div className="mt-4 h-3 overflow-hidden rounded-full bg-zinc-950">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${progress}%` }}
              />
            </div>

            {lastPick && (
              <div className="mt-4 rounded-2xl bg-zinc-950 p-4">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">
                  Latest Pick
                </p>

                <LatestPickLine
                  pick={lastPick}
                  playersById={playersById}
                  teamByRosterId={teamByRosterId}
                  leagueId={leagueId}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-[100vw] gap-6 overflow-hidden px-4 py-8 md:px-6 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:px-8">
        <div className="min-w-0">
          {errorMessage && (
            <div className="mb-6 rounded-[2rem] border border-red-900 bg-red-950/40 p-6 text-red-300">
              {errorMessage}
            </div>
          )}

          <div className="min-w-0 overflow-hidden rounded-[2rem] border border-zinc-800 bg-zinc-900 p-5">
            <div className="flex flex-col justify-between gap-3 border-b border-zinc-800 pb-5 md:flex-row md:items-center">
              <div>
                <h2 className="text-3xl font-black">Draft Board</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Picks stay in their original draft slot. Traded picks are
                  tagged and show the team that holds/used the pick.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Pill icon={<Trophy size={15} />} label={`${rounds || 0} rounds`} />
                <Pill icon={<Users size={15} />} label={`${teamsCount || 0} teams`} />
              </div>
            </div>

            <SleeperStyleDraftBoard
              draft={draft}
              rounds={rounds || 1}
              teamsCount={teamsCount || draftColumns.length || 1}
              draftColumns={draftColumns}
              picks={sortedPicks}
              tradedPicks={tradedPicks}
              playersById={playersById}
              teamByRosterId={teamByRosterId}
              leagueId={leagueId}
            />
          </div>
        </div>

        <aside className="space-y-6">
          <section className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-5 xl:sticky xl:top-6">
            <h2 className="text-2xl font-black">Latest Picks</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Most recent selections from the board.
            </p>

            <div className="mt-5 space-y-3">
              {latestPicks.map((pick) => (
                <LatestPickCard
                  key={`${pick.draft_id}-${pick.pick_no}`}
                  pick={pick}
                  playersById={playersById}
                  teamByRosterId={teamByRosterId}
                  leagueId={leagueId}
                />
              ))}

              {!latestPicks.length && (
                <p className="rounded-2xl bg-zinc-950 p-4 text-zinc-400">
                  No picks have been made yet.
                </p>
              )}
            </div>
          </section>
        </aside>
      </section>
    </main>
  )
}

function SleeperStyleDraftBoard({
  draft,
  rounds,
  teamsCount,
  draftColumns,
  picks,
  tradedPicks,
  playersById,
  teamByRosterId,
  leagueId,
}: {
  draft: any
  rounds: number
  teamsCount: number
  draftColumns: any[]
  picks: any[]
  tradedPicks: any[]
  playersById: Map<string, any>
  teamByRosterId: Map<number, any>
  leagueId: string
}) {
  const pickByRoundAndSlot = new Map<string, any>()

  for (const pick of picks || []) {
    const round = Number(
      pick.round || Math.ceil(Number(pick.pick_no) / teamsCount)
    )

    const slot = getBoardSlotForPick({
      draft,
      pickNo: Number(pick.pick_no),
      round,
      teamsCount,
    })

    pickByRoundAndSlot.set(`${round}-${slot}`, pick)
  }

  const tradedPickByRoundAndOriginalRoster = new Map<string, any>()

  for (const tradedPick of tradedPicks || []) {
    if (String(tradedPick.season) !== String(draft?.season)) continue

    const key = `${Number(tradedPick.round)}-${Number(tradedPick.roster_id)}`
    tradedPickByRoundAndOriginalRoster.set(key, tradedPick)
  }

  return (
    <div className="mt-5 w-full min-w-0 overflow-hidden rounded-[1.5rem] border border-zinc-800 bg-zinc-950 p-2">
      <div className="max-h-[72vh] w-full max-w-full overflow-auto rounded-[1.1rem]">
        <div
          className="relative w-max min-w-[1200px]"
          style={{
            display: 'grid',
            gridTemplateColumns: `120px repeat(${draftColumns.length}, minmax(210px, 1fr))`,
          }}
        >
          <div className="sticky left-0 top-0 z-30 border-b border-r border-zinc-800 bg-zinc-950 p-3 shadow-[6px_0_10px_rgba(0,0,0,0.25)]">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">
              Round
            </p>
          </div>

          {draftColumns.map((column) => (
            <div
              key={column.slot}
              className="sticky top-0 z-20 border-b border-r border-zinc-800 bg-zinc-950 p-3"
            >
              <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">
                Pick {column.slot}
              </p>

              <Link
                href={`/league/${leagueId}/teams/${column.rosterId}`}
                className="mt-1 block truncate font-black hover:text-emerald-400"
              >
                {column.teamName}
              </Link>
            </div>
          ))}

          {Array.from({ length: rounds }, (_, index) => index + 1).map(
            (round) => (
              <DraftBoardRound
                key={round}
                round={round}
                draftColumns={draftColumns}
                pickByRoundAndSlot={pickByRoundAndSlot}
                tradedPickByRoundAndOriginalRoster={
                  tradedPickByRoundAndOriginalRoster
                }
                playersById={playersById}
                teamByRosterId={teamByRosterId}
                leagueId={leagueId}
              />
            )
          )}
        </div>
      </div>
    </div>
  )
}

function DraftBoardRound({
  round,
  draftColumns,
  pickByRoundAndSlot,
  tradedPickByRoundAndOriginalRoster,
  playersById,
  teamByRosterId,
  leagueId,
}: {
  round: number
  draftColumns: any[]
  pickByRoundAndSlot: Map<string, any>
  tradedPickByRoundAndOriginalRoster: Map<string, any>
  playersById: Map<string, any>
  teamByRosterId: Map<number, any>
  leagueId: string
}) {
  return (
    <>
      <div className="sticky left-0 z-10 flex items-center border-b border-r border-zinc-800 bg-zinc-950 p-3 shadow-[6px_0_10px_rgba(0,0,0,0.25)]">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">
            Round
          </p>
          <p className="text-3xl font-black text-emerald-400">{round}</p>
        </div>
      </div>

      {draftColumns.map((column) => {
        const pick = pickByRoundAndSlot.get(`${round}-${column.slot}`)

        const tradedPick = tradedPickByRoundAndOriginalRoster.get(
          `${round}-${column.rosterId}`
        )

        return (
          <div
            key={`${round}-${column.slot}`}
            className="min-h-40 border-b border-r border-zinc-800 bg-zinc-950 p-3"
          >
            {pick ? (
              <DraftBoardPickCell
                pick={pick}
                expectedRosterId={column.rosterId}
                playersById={playersById}
                teamByRosterId={teamByRosterId}
                leagueId={leagueId}
              />
            ) : (
              <EmptyDraftPickCell
                expectedRosterId={column.rosterId}
                tradedPick={tradedPick}
                teamByRosterId={teamByRosterId}
                leagueId={leagueId}
              />
            )}
          </div>
        )
      })}
    </>
  )
}

function DraftBoardPickCell({
  pick,
  expectedRosterId,
  playersById,
  teamByRosterId,
  leagueId,
}: {
  pick: any
  expectedRosterId: number
  playersById: Map<string, any>
  teamByRosterId: Map<number, any>
  leagueId: string
}) {
  const player = getPickPlayer(pick, playersById)
  const draftingTeam = teamByRosterId.get(Number(pick.roster_id))

  const wasTraded =
    Number(pick.roster_id) !== Number(expectedRosterId) &&
    Number(pick.roster_id) > 0

  return (
    <div
      className={`h-full rounded-2xl border p-4 transition ${
        wasTraded
          ? 'border-zinc-700 bg-zinc-900 hover:border-zinc-500'
          : 'border-zinc-800 bg-zinc-900 hover:border-emerald-500'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">
          Pick #{pick.pick_no}
        </p>

        {wasTraded && (
          <span className="rounded-full bg-zinc-700 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-200">
            Traded
          </span>
        )}
      </div>

      <h4 className="mt-2 text-lg font-black leading-tight">{player.name}</h4>

      <p className="mt-1 text-sm text-zinc-400">
        {player.position} · {player.team}
      </p>

      {pick.is_keeper && (
        <span className="mt-3 inline-block rounded-full bg-zinc-800 px-2 py-1 text-[10px] font-black uppercase text-zinc-300">
          Keeper
        </span>
      )}

      <div className="mt-4 rounded-xl bg-zinc-950 p-3">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
          {wasTraded ? 'Used By' : 'Drafted By'}
        </p>

        {draftingTeam ? (
          <Link
            href={`/league/${leagueId}/teams/${draftingTeam.sleeper_roster_id}`}
            className={`mt-1 block text-xs font-black ${
              wasTraded
                ? 'text-zinc-200 hover:text-white'
                : 'text-zinc-300 hover:text-emerald-400'
            }`}
          >
            {draftingTeam.team_name}
          </Link>
        ) : (
          <p
            className={`mt-1 text-xs font-black ${
              wasTraded ? 'text-zinc-200' : 'text-zinc-300'
            }`}
          >
            Roster {pick.roster_id || '—'}
          </p>
        )}
      </div>
    </div>
  )
}

function EmptyDraftPickCell({
  expectedRosterId,
  tradedPick,
  teamByRosterId,
  leagueId,
}: {
  expectedRosterId: number
  tradedPick?: any
  teamByRosterId: Map<number, any>
  leagueId: string
}) {
  const wasTraded =
    tradedPick && Number(tradedPick.owner_id) !== Number(expectedRosterId)

  const pickHolder = wasTraded
    ? teamByRosterId.get(Number(tradedPick.owner_id))
    : null

  return (
    <div className="flex h-full min-h-32 flex-col justify-between rounded-2xl border border-dashed border-zinc-800 bg-zinc-900 p-4">
      <div className="flex flex-1 items-center justify-center text-sm font-bold text-zinc-600">
        Empty
      </div>

      {wasTraded && (
        <div className="rounded-xl bg-zinc-950 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
              Held By
            </p>

            <span className="rounded-full bg-zinc-700 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-200">
              Traded
            </span>
          </div>

          {pickHolder ? (
            <Link
              href={`/league/${leagueId}/teams/${pickHolder.sleeper_roster_id}`}
              className="mt-1 block text-xs font-black text-zinc-200 hover:text-white"
            >
              {pickHolder.team_name}
            </Link>
          ) : (
            <p className="mt-1 text-xs font-black text-zinc-200">
              Roster {tradedPick.owner_id}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function LatestPickCard({
  pick,
  playersById,
  teamByRosterId,
  leagueId,
}: {
  pick: any
  playersById: Map<string, any>
  teamByRosterId: Map<number, any>
  leagueId: string
}) {
  const player = getPickPlayer(pick, playersById)
  const fantasyTeam = teamByRosterId.get(Number(pick.roster_id))

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">
        Pick #{pick.pick_no}
      </p>

      <h3 className="mt-2 text-lg font-black">{player.name}</h3>

      <p className="mt-1 text-sm text-zinc-400">
        {player.position} · {player.team}
      </p>

      {fantasyTeam && (
        <Link
          href={`/league/${leagueId}/teams/${fantasyTeam.sleeper_roster_id}`}
          className="mt-3 block text-sm font-bold text-emerald-400 hover:text-emerald-300"
        >
          {fantasyTeam.team_name}
        </Link>
      )}
    </div>
  )
}

function LatestPickLine({
  pick,
  playersById,
  teamByRosterId,
  leagueId,
}: {
  pick: any
  playersById: Map<string, any>
  teamByRosterId: Map<number, any>
  leagueId: string
}) {
  const player = getPickPlayer(pick, playersById)
  const fantasyTeam = teamByRosterId.get(Number(pick.roster_id))

  return (
    <div className="mt-2 flex flex-col justify-between gap-2 md:flex-row md:items-center">
      <div>
        <p className="text-xl font-black">
          #{pick.pick_no} {player.name}
        </p>
        <p className="text-sm text-zinc-400">
          {player.position} · {player.team}
        </p>
      </div>

      {fantasyTeam && (
        <Link
          href={`/league/${leagueId}/teams/${fantasyTeam.sleeper_roster_id}`}
          className="text-sm font-bold text-emerald-400 hover:text-emerald-300"
        >
          {fantasyTeam.team_name}
        </Link>
      )}
    </div>
  )
}

function HeaderStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/10 p-5 backdrop-blur">
      <div className="flex items-center gap-2 text-emerald-300">
        {icon}
        <p className="text-xs font-black uppercase tracking-[0.25em]">
          {label}
        </p>
      </div>
      <p className="mt-3 text-2xl font-black">{value}</p>
    </div>
  )
}

function Pill({
  icon,
  label,
}: {
  icon: React.ReactNode
  label: string
}) {
  return (
    <span className="flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-black uppercase tracking-[0.15em] text-zinc-300">
      {icon}
      {label}
    </span>
  )
}

function buildDraftColumns(draft: any, teams: any[]) {
  const teamByRosterId = new Map<number, any>()

  for (const team of teams || []) {
    teamByRosterId.set(Number(team.sleeper_roster_id), team)
  }

  const columns: any[] = []

  if (draft?.slot_to_roster_id) {
    for (const [slot, rosterId] of Object.entries(draft.slot_to_roster_id)) {
      const team = teamByRosterId.get(Number(rosterId))

      columns.push({
        slot: Number(slot),
        rosterId: Number(rosterId),
        teamName: team?.team_name || `Roster ${rosterId}`,
      })
    }
  }

  if (!columns.length && draft?.draft_order) {
    for (const [userId, slot] of Object.entries(draft.draft_order)) {
      const draftSlot = Number(slot)

      const matchingTeam = teams.find(
        (team: any) =>
          Number(team.sleeper_roster_id) === draftSlot ||
          String(team.sleeper_owner_id) === String(userId)
      )

      columns.push({
        slot: draftSlot,
        rosterId: Number(matchingTeam?.sleeper_roster_id || draftSlot),
        teamName: matchingTeam?.team_name || `Draft Slot ${draftSlot}`,
      })
    }
  }

  if (!columns.length) {
    for (const team of teams || []) {
      columns.push({
        slot: Number(team.sleeper_roster_id),
        rosterId: Number(team.sleeper_roster_id),
        teamName: team.team_name,
      })
    }
  }

  return columns.sort((a, b) => Number(a.slot) - Number(b.slot))
}

function getBoardSlotForPick({
  draft,
  pickNo,
  round,
  teamsCount,
}: {
  draft: any
  pickNo: number
  round: number
  teamsCount: number
}) {
  const slotWithinRound = ((pickNo - 1) % teamsCount) + 1
  const isSnakeDraft = draft?.type === 'snake'

  if (!isSnakeDraft) {
    return slotWithinRound
  }

  const isEvenRound = round % 2 === 0

  if (!isEvenRound) {
    return slotWithinRound
  }

  return teamsCount - slotWithinRound + 1
}

function getPickPlayer(pick: any, playersById: Map<string, any>) {
  const localPlayer = playersById.get(pick.player_id)

  const name =
    localPlayer?.full_name ||
    [pick.metadata?.first_name, pick.metadata?.last_name]
      .filter(Boolean)
      .join(' ') ||
    pick.player_id ||
    'Unpicked'

  const position = localPlayer?.position || pick.metadata?.position || '—'
  const team = localPlayer?.team || pick.metadata?.team || 'FA'

  return {
    name,
    position,
    team,
  }
}

function formatDateTime(timestamp: number | null) {
  if (!timestamp) return 'TBD'
  return new Date(timestamp).toISOString().replace('T', ' ').slice(0, 16)
}

function capitalize(value: string) {
  if (!value) return ''
  return value.charAt(0).toUpperCase() + value.slice(1)
}