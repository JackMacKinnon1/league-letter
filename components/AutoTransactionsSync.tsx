'use client'

import { useEffect } from 'react'

export default function AutoTransactionSync({
  leagueId,
}: {
  leagueId: string
}) {
  useEffect(() => {
    let cancelled = false

    async function syncTransactions() {
      try {
        const storageKey = `league-transactions-sync-${leagueId}`
        const lastClientSync = Number(
          window.sessionStorage.getItem(storageKey) || 0
        )

        const secondsSinceClientSync = (Date.now() - lastClientSync) / 1000

        if (secondsSinceClientSync < 60) {
          return
        }

        window.sessionStorage.setItem(storageKey, String(Date.now()))

        const response = await fetch(
          `/api/league/${leagueId}/sync-transactions`,
          {
            method: 'POST',
          }
        )

        if (!response.ok || cancelled) return

        const json = await response.json()

      } catch {
        // Silent. Public page should never break because auto-sync failed.
      }
    }

    syncTransactions()

    return () => {
      cancelled = true
    }
  }, [leagueId])

  return null
}