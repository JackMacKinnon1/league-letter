import Link from '@/components/NoPrefetchLink'
import Navbar from '@/components/Navbar'
import {
  formatFantasyDelta,
  isSafeSleeperPlayerId,
  normalizeGameFeedSeason,
  normalizeGameFeedWeek,
  sleeperPlayerImageUrl,
  type GameFeedEvent,
} from '@/lib/gameFeed'
import { createClient } from '@/lib/supabase/server'
import { Activity, ArrowLeft, Beaker, Radio, Trophy } from 'lucide-react'
import { notFound, redirect } from 'next/navigation'

export default async function LeaguePlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ leagueId: string; playerId: string }>
  searchParams: Promise<{ season?: string; week?: string }>
}) {
  const { leagueId, playerId } = await params
  const { season, week } = await searchParams
  if (!isSafeSleeperPlayerId(playerId)) notFound()
  const supabase = await createClient()

  const [{ data: league }, { data: player }] = await Promise.all([
    supabase.from('leagues').select('*').eq('id', leagueId).maybeSingle(),
    supabase.from('players').select('*').eq('id', playerId).maybeSingle(),
  ])

  if (!league) redirect('/')

  const selectedSeason = normalizeGameFeedSeason(
    season,
    league.season || new Date().getFullYear()
  )
  const selectedWeek = normalizeGameFeedWeek(week, Number(league.current_week || 1))
  const feedMode = league.game_feed_display_mode === 'test' ? 'test' : 'public'
  const playerName =
    player?.full_name ||
    [player?.first_name, player?.last_name].filter(Boolean).join(' ') ||
    (playerId.length <= 4 ? `${playerId} Defense` : playerId)
  const position = player?.position || (playerId.length <= 4 ? 'DEF' : '—')
  const nflTeam = player?.team || (playerId.length <= 4 ? playerId : 'FA')

  const [{ data: biggest }, { data: recent }, { count: eventCount }] =
    await Promise.all([
      supabase
        .from('game_feed_events')
        .select('*')
        .eq('league_id', leagueId)
        .eq('feed_mode', feedMode)
        .or(`primary_player_id.eq.${playerId},secondary_player_id.eq.${playerId}`)
        .eq('is_aggregate', false)
        .eq('is_correction', false)
        .order('id', { ascending: false })
        .limit(100),
      supabase
        .from('game_feed_events')
        .select('*')
        .eq('league_id', leagueId)
        .eq('feed_mode', feedMode)
        .or(`primary_player_id.eq.${playerId},secondary_player_id.eq.${playerId}`)
        .order('id', { ascending: false })
        .limit(20),
      supabase
        .from('game_feed_events')
        .select('id', { count: 'exact', head: true })
        .eq('league_id', leagueId)
        .eq('feed_mode', feedMode)
        .or(`primary_player_id.eq.${playerId},secondary_player_id.eq.${playerId}`),
    ])

  const biggestPlays = ((biggest || []) as GameFeedEvent[])
    .map((event) => ({
      event,
      playerDelta:
        event.primary_player_id === playerId
          ? Number(event.primary_fantasy_delta || 0)
          : Number(event.secondary_fantasy_delta || 0),
    }))
    .filter((entry) => entry.playerDelta >= 0)
    .sort((a, b) => {
      if (b.playerDelta !== a.playerDelta) return b.playerDelta - a.playerDelta
      return Number(b.event.inferred_yards || 0) - Number(a.event.inferred_yards || 0)
    })
    .slice(0, 8)
  const recentEvents = (recent || []) as GameFeedEvent[]
  const imageUrl = sleeperPlayerImageUrl(playerId)

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <Navbar />

      <section className="border-b border-zinc-800 bg-white/[0.015] px-4 py-10">
        <div className="mx-auto max-w-6xl">
          <Link
            href={`/league/${leagueId}/game-feed?season=${selectedSeason}&week=${selectedWeek}`}
            className="inline-flex items-center gap-2 text-sm font-bold text-zinc-400 hover:text-white"
          >
            <ArrowLeft size={16} /> Back to Game Feed
          </Link>

          <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-end">
            <div className="flex h-36 w-36 shrink-0 items-end justify-center overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-900">
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt={playerName}
                  className="h-full w-full object-cover object-top"
                />
              )}
            </div>

            <div>
              <p className="text-sm font-black uppercase tracking-[0.3em] text-emerald-400">
                {nflTeam} · {position}
              </p>
              <h1 className="mt-2 text-5xl font-black tracking-tight md:text-7xl">
                {playerName}
              </h1>
              <p className="mt-3 text-zinc-400">
                {eventCount || 0} stored {feedMode === 'test' ? 'test ' : ''}Game Feed involvement{eventCount === 1 ? '' : 's'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {feedMode === 'test' && (
        <div className="mx-auto mt-6 flex max-w-6xl gap-3 px-4">
          <div className="flex w-full gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            <Beaker className="mt-0.5 shrink-0" size={17} />
            <p>This player page is showing test Game Feed history only. Public plays are hidden.</p>
          </div>
        </div>
      )}

      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[1fr_0.9fr]">
        <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex items-center gap-3">
            <Trophy className="text-amber-300" size={22} />
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-300">
                Stored history
              </p>
              <h2 className="text-3xl font-black">Biggest Plays</h2>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {biggestPlays.map(({ event, playerDelta }, index) => (
              <div
                key={event.id}
                className="flex items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-4"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/10 font-black text-amber-300">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-black">{event.description}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Week {event.week}, {event.season} · {event.confidence} confidence
                  </p>
                </div>
                <p className="text-lg font-black text-emerald-400">
                  {formatFantasyDelta(playerDelta)}
                </p>
              </div>
            ))}

            {!biggestPlays.length && (
              <div className="rounded-2xl border border-dashed border-zinc-700 px-5 py-10 text-center text-zinc-500">
                No exact, non-aggregate plays have been stored for this player yet.
              </div>
            )}
          </div>
        </div>

        <aside className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex items-center gap-3">
            <Radio className="text-emerald-300" size={22} />
            <h2 className="text-3xl font-black">Recent Feed</h2>
          </div>

          <div className="mt-5 space-y-3">
            {recentEvents.map((event) => {
              const isPrimary = event.primary_player_id === playerId
              return (
                <Link
                  key={event.id}
                  href={`/league/${leagueId}/game-feed?season=${event.season}&week=${event.week}`}
                  className="block rounded-2xl border border-zinc-800 bg-zinc-950 p-4 transition hover:border-zinc-600"
                >
                  <p className="font-black">{event.description}</p>
                  <p className="mt-1 text-sm text-zinc-400">
                    {isPrimary
                      ? formatFantasyDelta(event.primary_fantasy_delta)
                      : `${formatFantasyDelta(event.secondary_fantasy_delta)} passing points on play for ${event.primary_player_name}`}
                  </p>
                  <p className="mt-2 text-xs text-zinc-600">
                    Week {event.week}, {event.season} · {new Date(event.detected_at).toLocaleString()}
                  </p>
                </Link>
              )
            })}

            {!recentEvents.length && (
              <div className="rounded-2xl border border-dashed border-zinc-700 px-5 py-10 text-center text-zinc-500">
                <Activity className="mx-auto mb-3" size={25} />
                No feed events yet.
              </div>
            )}
          </div>
        </aside>
      </section>
    </main>
  )
}
