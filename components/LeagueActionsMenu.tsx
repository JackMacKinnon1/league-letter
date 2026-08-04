'use client'

import Link from '@/components/NoPrefetchLink'
import {
  BookOpenText,
  ChevronDown,
  Menu,
  Newspaper,
  PenLine,
  ShieldCheck,
  Swords,
  Trophy,
} from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { LucideIcon } from 'lucide-react'


type LeagueMenuItem = {
  href: string
  label: string
  description: string
  icon: LucideIcon
  accent?: boolean
}

type LeagueActionsMenuProps = {
  leagueId: string
  season: string
  week: number
  isLoggedIn: boolean
  isLeagueAdmin: boolean
}

export default function LeagueActionsMenu({
  leagueId,
  season,
  week,
  isLoggedIn,
  isLeagueAdmin,
}: LeagueActionsMenuProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      const details = detailsRef.current
      if (!details?.open || details.contains(event.target as Node)) return
      details.open = false
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && detailsRef.current?.open) {
        detailsRef.current.open = false
        detailsRef.current.querySelector('summary')?.focus()
      }
    }

    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)

    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  const close = () => {
    if (detailsRef.current) detailsRef.current.open = false
  }

  const items: LeagueMenuItem[] = [
    {
      href: `/league/${leagueId}/game-feed?season=${season}&week=${week}`,
      label: 'Game Feed',
      description: 'Live scoring plays',
      icon: Newspaper,
      accent: true,
    },
    {
      href: `/league/${leagueId}/winners`,
      label: 'Trophy Room',
      description: 'League and division champions',
      icon: Trophy,
    },
    {
      href: `/league/${leagueId}/drafts`,
      label: 'Draft Room',
      description: 'Draft boards and history',
      icon: BookOpenText,
    },
    {
      href: `/league/${leagueId}/trade-center`,
      label: 'Trade Center',
      description: 'Trades and transaction trees',
      icon: Swords,
    },
    {
      href: isLoggedIn ? `/league/${leagueId}/articles/new` : '/login',
      label: isLoggedIn ? 'Write Article' : 'Log in to Write',
      description: 'Publish league news',
      icon: PenLine,
      accent: true,
    },
  ]

  if (isLeagueAdmin) {
    items.push({
      href: `/league/${leagueId}/admin`,
      label: 'League Admin',
      description: 'Manage this league room',
      icon: ShieldCheck,
      accent: false,
    })
  }

  return (
    <details ref={detailsRef} className="league-actions-menu">
      <summary className="league-actions-summary">
        <Menu size={19} />
        <span>League menu</span>
        <ChevronDown className="league-actions-chevron" size={17} />
      </summary>

      <div className="league-actions-popover" role="navigation" aria-label="League pages">
        <div className="border-b border-white/10 px-4 py-3">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-zinc-500">
            League navigation
          </p>
        </div>

        <div className="grid gap-1 p-2 sm:grid-cols-2">
          {items.map(({ href, label, description, icon: Icon, accent }) => (
            <Link
              key={href}
              href={href}
              onClick={close}
              className={`group flex items-center gap-3 rounded-2xl border px-3 py-3 transition duration-200 hover:-translate-y-0.5 ${
                accent
                  ? 'border-emerald-400/20 bg-emerald-400/10 hover:border-emerald-400/40 hover:bg-emerald-400/15'
                  : 'border-transparent hover:border-white/10 hover:bg-white/[0.055]'
              }`}
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                  accent
                    ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300'
                    : 'border-white/10 bg-white/[0.04] text-zinc-300'
                }`}
              >
                <Icon size={18} />
              </span>
              <span className="min-w-0">
                <span className="block font-black text-white">{label}</span>
                <span className="mt-0.5 block truncate text-xs text-zinc-500">
                  {description}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </details>
  )
}
