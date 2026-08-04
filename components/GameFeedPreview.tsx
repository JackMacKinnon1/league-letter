import GameFeedPlayerImage from '@/components/GameFeedPlayerImage'
import Link from '@/components/NoPrefetchLink'
import {
  formatFantasyDelta,
  type GameFeedEvent,
} from '@/lib/gameFeed'
import { Beaker, Radio } from 'lucide-react'

export default function GameFeedPreview({
  leagueId,
  season,
  week,
  feedMode,
  events,
}: {
  leagueId: string
  season: string
  week: number
  feedMode: 'public' | 'test'
  events: GameFeedEvent[]
}) {
  const isTest = feedMode === 'test'

  return (
    <section className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${
              isTest
                ? 'border-amber-400/20 bg-amber-400/10 text-amber-300'
                : 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
            }`}
          >
            {isTest ? <Beaker size={20} /> : <Radio size={20} />}
          </div>
          <div>
            <p
              className={`text-xs font-black uppercase tracking-[0.24em] ${
                isTest ? 'text-amber-300' : 'text-emerald-400'
              }`}
            >
              {isTest ? 'Test scoring' : 'Live scoring'}
            </p>
            <h2 className="text-3xl font-black">Game Feed</h2>
          </div>
        </div>

        <Link
          href={`/league/${leagueId}/game-feed?season=${season}&week=${week}`}
          className={`text-sm font-black ${
            isTest
              ? 'text-amber-300 hover:text-amber-200'
              : 'text-emerald-400 hover:text-emerald-300'
          }`}
        >
          Open feed →
        </Link>
      </div>

      {isTest && (
        <p className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs font-bold text-amber-100">
          This league is showing test cells only. Public events are hidden.
        </p>
      )}

      <div className="mt-5 space-y-3">
        {events.map((event) => (
          <Link
            key={event.id}
            href={`/league/${leagueId}/players/${event.primary_player_id}?season=${event.season}&week=${event.week}`}
            className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-3 transition hover:border-zinc-600"
          >
            <GameFeedPlayerImage
              event={event}
              leagueId={leagueId}
              size="preview"
              interactive={false}
            />

            <div className="min-w-0 flex-1">
              <p className="truncate font-black">{event.description}</p>
              <p className="truncate text-xs text-zinc-500">
                {event.primary_player_name}
                {event.secondary_player_name
                  ? ` · from ${event.secondary_player_name}`
                  : ''}
              </p>
            </div>

            {event.feed_mode === 'test' && (
              <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-[10px] font-black text-amber-300">
                TEST
              </span>
            )}

            <p
              className={`shrink-0 font-black ${
                Number(event.primary_fantasy_delta) >= 0
                  ? 'text-emerald-400'
                  : 'text-red-400'
              }`}
            >
              {formatFantasyDelta(event.primary_fantasy_delta)}
            </p>
          </Link>
        ))}

        {!events.length && (
          <div className="rounded-2xl border border-dashed border-zinc-700 px-5 py-8 text-center text-sm text-zinc-500">
            {isTest
              ? 'Start the worker in Test mode and choose to add sample feed cells.'
              : 'The first public worker poll seeds player totals. New fantasy-point changes will appear here.'}
          </div>
        )}
      </div>
    </section>
  )
}
