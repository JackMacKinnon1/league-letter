'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

export default function RouteProgress() {
  const pathname = usePathname()
  const [active, setActive] = useState(false)
  const timerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)

  useEffect(() => {
    const begin = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return
      }

      const target = event.target as HTMLElement | null
      const anchor = target?.closest('a') as HTMLAnchorElement | null

      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) {
        return
      }

      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin) return

      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`
      const next = `${url.pathname}${url.search}${url.hash}`
      if (current === next) return

      setActive(true)
    }

    const beginPopState = () => setActive(true)

    document.addEventListener('click', begin, true)
    window.addEventListener('popstate', beginPopState)

    return () => {
      document.removeEventListener('click', begin, true)
      window.removeEventListener('popstate', beginPopState)
    }
  }, [])

  useEffect(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => setActive(false), 260)

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [pathname])

  return (
    <div
      aria-hidden="true"
      className={`route-progress ${active ? 'route-progress-active' : ''}`}
    >
      <span />
    </div>
  )
}
