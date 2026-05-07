'use client'

import { useState } from 'react'
import { RefreshCcw } from 'lucide-react'

export default function AdminSyncButton({ leagueId }: { leagueId: string }) {
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState('')

    async function syncLeague() {
        setLoading(true)
        setMessage('')

        try {
            const res = await fetch(`/api/league/${leagueId}/sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({}),
            })

            const json = await res.json()

            if (!res.ok) {
                setMessage(json.error || 'Could not sync league.')
                setLoading(false)
                return
            }

            const playerText = json.playersSkipped
                ? `Skipped players sync. Last synced ${new Date(
                    json.playersLastSyncedAt
                ).toLocaleString()}.`
                : `Synced ${json.playersSynced || 0} players.`

            setMessage(
                `Synced ${json.teamsSynced} teams, ${json.matchupsSynced} matchup rows, ${json.transactionsSynced || 0
                } transactions, and ${json.pointProfilesSynced || 0
                } team scoring profiles. ${playerText}`
            )

            window.location.reload()
        } catch {
            setMessage('Something went wrong.')
            setLoading(false)
        }
    }

    return (
        <div>
            <button
                onClick={syncLeague}
                disabled={loading}
                className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 font-black text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
                <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
                {loading ? 'Syncing...' : 'Sync Sleeper Data'}
            </button>

            {message && <p className="mt-2 text-sm text-zinc-400">{message}</p>}
        </div>
    )
}