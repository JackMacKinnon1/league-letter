'use client'

import Link from 'next/link'
import { Flame, Pause, Zap } from 'lucide-react'

type TickerSettings = {
  is_enabled?: boolean
  label?: string | null
  speed_seconds?: number | null
  pause_on_hover?: boolean | null
  background_style?: string | null
}

type TickerItem = {
  id: string
  text: string
  emoji?: string | null
  link_url?: string | null
  is_active?: boolean
  sort_order?: number | null
}

export default function LeagueTicker({
  settings,
  items,
}: {
  settings: TickerSettings | null
  items: TickerItem[]
}) {
  const activeItems = (items || [])
    .filter((item) => item.is_active !== false && item.text?.trim())
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))

  const tickerSettings = {
    is_enabled: true,
    label: 'League Ticker',
    speed_seconds: 32,
    pause_on_hover: true,
    background_style: 'emerald',
    ...(settings || {}),
  }

  if (!tickerSettings.is_enabled || activeItems.length === 0) return null

  const speed = Math.max(Number(tickerSettings.speed_seconds || 32), 8)
  const label = tickerSettings.label?.trim() || 'League Ticker'
  const loopItems = [...activeItems, ...activeItems]
  const gradientClass = getGradientClass(tickerSettings.background_style)

  return (
    <section className="border-b border-emerald-500/20 bg-zinc-950 text-white">
      <div className="flex overflow-hidden">
        <div className={`relative z-10 flex shrink-0 items-center gap-2 px-4 py-3 ${gradientClass}`}>
          <Flame size={17} className="text-zinc-950" />
          <span className="whitespace-nowrap text-xs font-black uppercase tracking-[0.22em] text-zinc-950">
            {label}
          </span>
        </div>

        <div className="league-ticker-shell group relative flex min-w-0 flex-1 items-center overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.14),_transparent_34%),#09090b]">
          <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-16 bg-gradient-to-r from-zinc-950 to-transparent" />
          <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-16 bg-gradient-to-l from-zinc-950 to-transparent" />

          <div
            className={`league-ticker-track flex w-max items-center gap-3 py-3 ${
              tickerSettings.pause_on_hover !== false ? 'league-ticker-pausable' : ''
            }`}
            style={{ animationDuration: `${speed}s` }}
          >
            {loopItems.map((item, index) => (
              <TickerItemPill key={`${item.id}-${index}`} item={item} />
            ))}
          </div>

          {tickerSettings.pause_on_hover !== false && (
            <div className="pointer-events-none absolute right-4 hidden items-center gap-2 rounded-full border border-white/10 bg-zinc-950/80 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500 backdrop-blur md:group-hover:flex">
              <Pause size={11} /> Hover to read
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .league-ticker-track {
          animation-name: league-ticker-marquee;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          animation-play-state: running;
          will-change: transform;
        }

        .league-ticker-shell:hover .league-ticker-pausable {
          animation-play-state: paused;
        }

        @keyframes league-ticker-marquee {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </section>
  )
}

function TickerItemPill({ item }: { item: TickerItem }) {
  const content = (
    <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-sm font-bold text-zinc-100 shadow-lg shadow-black/20 transition hover:border-emerald-400/70 hover:bg-emerald-400/10">
      <span className="text-base">{item.emoji || '⚡'}</span>
      <span>{item.text}</span>
      <Zap size={13} className="text-emerald-400" />
    </span>
  )

  if (item.link_url?.trim()) {
    return (
      <Link href={item.link_url.trim()} className="block">
        {content}
      </Link>
    )
  }

  return content
}

function getGradientClass(style?: string | null) {
  if (style === 'gold') return 'bg-gradient-to-r from-amber-300 to-yellow-500'
  if (style === 'red') return 'bg-gradient-to-r from-red-400 to-orange-500'
  if (style === 'blue') return 'bg-gradient-to-r from-sky-300 to-blue-500'
  if (style === 'purple') return 'bg-gradient-to-r from-fuchsia-300 to-violet-500'
  return 'bg-gradient-to-r from-emerald-300 to-lime-400'
}
