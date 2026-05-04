'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { GripVertical } from 'lucide-react'

type RankingRow = {
  teamId: string
  teamName: string
  blurb: string
}

export default function PowerRankingsManager({
  leagueId,
  week,
  teams,
  currentRankings,
}: {
  leagueId: string
  week: number
  teams: any[]
  currentRankings: any[]
}) {
  const supabase = createClient()
  const [message, setMessage] = useState('')
  const [rows, setRows] = useState<RankingRow[]>([])
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  useEffect(() => {
    if (currentRankings.length) {
      setRows(
        currentRankings.map((ranking: any) => ({
          teamId: ranking.team_id,
          teamName: ranking.team_name,
          blurb: ranking.blurb || '',
        }))
      )
      return
    }

    setRows(
      teams.map((team: any) => ({
        teamId: team.id,
        teamName: team.team_name,
        blurb: '',
      }))
    )
  }, [teams, currentRankings])

  function moveRow(index: number, direction: 'up' | 'down') {
    const newRows = [...rows]
    const target = direction === 'up' ? index - 1 : index + 1

    if (target < 0 || target >= newRows.length) return

    const temp = newRows[index]
    newRows[index] = newRows[target]
    newRows[target] = temp

    setRows(newRows)
  }

  function updateBlurb(index: number, value: string) {
    const newRows = [...rows]
    newRows[index].blurb = value
    setRows(newRows)
  }

  function handleDragStart(index: number) {
    setDraggedIndex(index)
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>, index: number) {
    e.preventDefault()
    setDragOverIndex(index)
  }

  function handleDrop(index: number) {
    if (draggedIndex === null || draggedIndex === index) {
      setDraggedIndex(null)
      setDragOverIndex(null)
      return
    }

    const newRows = [...rows]
    const draggedRow = newRows[draggedIndex]

    newRows.splice(draggedIndex, 1)
    newRows.splice(index, 0, draggedRow)

    setRows(newRows)
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  function handleDragEnd() {
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  async function saveRankings() {
    setMessage('')

    const { error: deleteError } = await supabase
      .from('power_rankings')
      .delete()
      .eq('league_id', leagueId)
      .eq('week', week)

    if (deleteError) {
      setMessage(deleteError.message)
      return
    }

    const rowsToInsert = rows.map((row, index) => ({
      league_id: leagueId,
      week,
      rank: index + 1,
      team_id: row.teamId,
      team_name: row.teamName,
      blurb: row.blurb,
    }))

    const { error } = await supabase.from('power_rankings').insert(rowsToInsert)

    if (error) {
      setMessage(error.message)
      return
    }

    setMessage('Power rankings saved.')
    window.location.reload()
  }

  return (
    <section className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="text-3xl font-black">Power Rankings</h2>
      <p className="mt-2 text-sm text-zinc-400">
        Drag teams to reorder them and add weekly blurbs.
      </p>

      <div className="mt-5 max-h-[520px] space-y-3 overflow-y-auto pr-1">
        {rows.map((row, index) => (
          <div
            key={row.teamId}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={() => handleDrop(index)}
            onDragEnd={handleDragEnd}
            className={`cursor-grab rounded-2xl border bg-zinc-950 p-4 active:cursor-grabbing ${
              dragOverIndex === index
                ? 'border-emerald-500'
                : 'border-zinc-800'
            } ${
              draggedIndex === index
                ? 'opacity-50'
                : 'opacity-100'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="mt-1 text-zinc-500">
                  <GripVertical size={20} />
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">
                    Rank #{index + 1}
                  </p>
                  <h3 className="text-lg font-black">{row.teamName}</h3>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => moveRow(index, 'up')}
                  className="rounded-lg border border-zinc-700 px-3 py-1 text-sm font-bold"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveRow(index, 'down')}
                  className="rounded-lg border border-zinc-700 px-3 py-1 text-sm font-bold"
                >
                  ↓
                </button>
              </div>
            </div>

            <textarea
              className="mt-3 min-h-20 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-emerald-500"
              placeholder="Blurb..."
              value={row.blurb}
              onChange={(e) => updateBlurb(index, e.target.value)}
              onDragStart={(e) => e.preventDefault()}
            />
          </div>
        ))}

        {!rows.length && (
          <p className="text-zinc-400">
            No teams found. Sync Sleeper data first.
          </p>
        )}
      </div>

      <button
        onClick={saveRankings}
        disabled={!rows.length}
        className="mt-5 w-full rounded-2xl bg-emerald-500 py-3 font-black text-zinc-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Save Power Rankings
      </button>

      {message && <p className="mt-3 text-sm text-zinc-400">{message}</p>}
    </section>
  )
}