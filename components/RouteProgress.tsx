'use client'

import { useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

export default function RouteProgress() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [visible, setVisible] = useState(false)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    setVisible(true)
    setWidth(20)

    const midTimer = window.setTimeout(() => {
      setWidth(70)
    }, 100)

    const endTimer = window.setTimeout(() => {
      setWidth(100)
    }, 300)

    const hideTimer = window.setTimeout(() => {
      setVisible(false)
      setWidth(0)
    }, 500)

    return () => {
      window.clearTimeout(midTimer)
      window.clearTimeout(endTimer)
      window.clearTimeout(hideTimer)
    }
  }, [pathname, searchParams])

  return (
    <div className="fixed left-0 top-0 z-[9999] h-1 w-full bg-transparent">
      <div
        className={`h-full bg-emerald-500 transition-all duration-300 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ width: `${width}%` }}
      />
    </div>
  )
}