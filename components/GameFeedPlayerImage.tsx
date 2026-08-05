'use client'

import Link from '@/components/NoPrefetchLink'
import {
  isReceivingGameFeedEvent,
  sleeperPlayerImageUrl,
  type GameFeedEvent,
} from '@/lib/gameFeed'
import type { ReactNode } from 'react'

export default function GameFeedPlayerImage({
  event,
  leagueId,
  size = 'card',
  icon,
  interactive = true,
}: {
  event: GameFeedEvent
  leagueId: string
  size?: 'card' | 'preview'
  icon?: ReactNode
  interactive?: boolean
}) {
  const primaryImage = sleeperPlayerImageUrl(event.primary_player_id)
  const quarterbackImage = sleeperPlayerImageUrl(event.secondary_player_id)
  const showQuarterback = isReceivingGameFeedEvent(event)
  const containerClass =
    size === 'preview'
      ? 'h-10 w-10 rounded-xl sm:h-12 sm:w-12'
      : 'h-12 w-12 rounded-xl sm:h-20 sm:w-20 sm:rounded-2xl'
  const quarterbackClass =
    size === 'preview'
      ? 'h-5 w-5 rounded-md border-2 sm:h-6 sm:w-6 sm:rounded-lg'
      : 'h-5 w-5 rounded-md border-2 sm:h-9 sm:w-9 sm:rounded-xl'

  return (
    <div className={`relative shrink-0 ${containerClass}`}>
      {interactive ? (
        <Link
          href={`/league/${leagueId}/players/${event.primary_player_id}`}
          aria-label={`Open ${event.primary_player_name}`}
          className={`absolute inset-0 flex items-end justify-center overflow-hidden border border-white/10 bg-zinc-950 ${
            size === 'preview' ? 'rounded-xl' : 'rounded-xl sm:rounded-2xl'
          }`}
        >
          <PrimaryImage imageUrl={primaryImage} playerName={event.primary_player_name} />
        </Link>
      ) : (
        <span
          className={`absolute inset-0 flex items-end justify-center overflow-hidden border border-white/10 bg-zinc-950 ${
            size === 'preview' ? 'rounded-xl' : 'rounded-xl sm:rounded-2xl'
          }`}
        >
          <PrimaryImage imageUrl={primaryImage} playerName={event.primary_player_name} />
        </span>
      )}

      {icon ? (
        <span className="pointer-events-none absolute left-0.5 top-0.5 rounded-md border border-white/10 bg-zinc-950/90 p-0.5 text-emerald-300 sm:left-1 sm:top-1 sm:rounded-lg sm:p-1">
          {icon}
        </span>
      ) : null}

      {showQuarterback && quarterbackImage ? (
        interactive ? (
          <Link
            href={`/league/${leagueId}/players/${event.secondary_player_id}`}
            aria-label={`Open quarterback ${event.secondary_player_name}`}
            title={`Thrown by ${event.secondary_player_name}`}
            className={`absolute -bottom-1 -right-1 z-10 overflow-hidden border-zinc-950 bg-zinc-900 shadow-lg ${quarterbackClass}`}
          >
            <QuarterbackImage imageUrl={quarterbackImage} playerName={event.secondary_player_name} />
          </Link>
        ) : (
          <span
            title={`Thrown by ${event.secondary_player_name}`}
            className={`absolute -bottom-1 -right-1 z-10 overflow-hidden border-zinc-950 bg-zinc-900 shadow-lg ${quarterbackClass}`}
          >
            <QuarterbackImage imageUrl={quarterbackImage} playerName={event.secondary_player_name} />
          </span>
        )
      ) : null}
    </div>
  )
}


function PrimaryImage({
  imageUrl,
  playerName,
}: {
  imageUrl: string | null
  playerName: string
}) {
  if (!imageUrl) return null

  return (
    <img
      src={imageUrl}
      alt={playerName}
      className="h-full w-full object-cover object-top"
      onError={(imageEvent) => {
        imageEvent.currentTarget.style.display = 'none'
      }}
    />
  )
}

function QuarterbackImage({
  imageUrl,
  playerName,
}: {
  imageUrl: string
  playerName: string | null
}) {
  return (
    <img
      src={imageUrl}
      alt={playerName || 'Quarterback'}
      className="h-full w-full object-cover object-top"
      onError={(imageEvent) => {
        imageEvent.currentTarget.parentElement?.remove()
      }}
    />
  )
}
