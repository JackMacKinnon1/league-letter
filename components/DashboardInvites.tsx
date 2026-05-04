'use client'

import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import { Check, X } from 'lucide-react'

export default function DashboardInvites({ invites }: { invites: any[] }) {
  const supabase = createClient()
  const [message, setMessage] = useState('')

  async function acceptInvite(invite: any) {
    setMessage('')

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setMessage('You need to log in.')
      return
    }

    const { error: memberError } = await supabase.from('league_members').upsert(
      {
        league_id: invite.league_id,
        user_id: user.id,
        display_name:
          invite.profiles?.display_name ||
          invite.profiles?.username ||
          invite.profiles?.email,
        role: 'member',
        can_write: invite.can_write,
      },
      {
        onConflict: 'league_id,user_id',
      }
    )

    if (memberError) {
      setMessage(memberError.message)
      return
    }

    const { error: inviteError } = await supabase
      .from('league_invites')
      .update({
        status: 'accepted',
      })
      .eq('id', invite.id)
      .eq('invited_user_id', user.id)

    if (inviteError) {
      setMessage(inviteError.message)
      return
    }

    window.location.reload()
  }

  async function declineInvite(invite: any) {
    setMessage('')

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setMessage('You need to log in.')
      return
    }

    const { error } = await supabase
      .from('league_invites')
      .update({
        status: 'declined',
      })
      .eq('id', invite.id)
      .eq('invited_user_id', user.id)

    if (error) {
      setMessage(error.message)
      return
    }

    window.location.reload()
  }

  if (!invites.length) return null

  return (
    <section className="mt-8 rounded-[2rem] border border-emerald-900/70 bg-emerald-950/20 p-6">
      <h2 className="text-3xl font-black">Pending Invites</h2>
      <p className="mt-2 text-sm text-zinc-400">
        You’ve been invited to join these League Letter pages.
      </p>

      {message && (
        <div className="mt-4 rounded-2xl border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
          {message}
        </div>
      )}

      <div className="mt-5 space-y-3">
        {invites.map((invite) => (
          <div
            key={invite.id}
            className="flex flex-col justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 md:flex-row md:items-center"
          >
            <div>
              <p className="text-xl font-black">{invite.leagues?.name}</p>
              <p className="mt-1 text-sm text-zinc-500">
                Season {invite.leagues?.season} ·{' '}
                {invite.can_write ? 'Writer access included' : 'Member access'}
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => acceptInvite(invite)}
                className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-black text-zinc-950 hover:bg-emerald-400"
              >
                <Check size={16} />
                Accept
              </button>

              <button
                onClick={() => declineInvite(invite)}
                className="flex items-center gap-2 rounded-xl border border-zinc-700 px-4 py-2 text-sm font-bold hover:bg-zinc-900"
              >
                <X size={16} />
                Decline
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}