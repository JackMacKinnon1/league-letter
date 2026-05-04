'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, UserPlus, PenLine, Shield, Trash2 } from 'lucide-react'

export default function MemberInviteManager({
  leagueId,
  members,
  invites,
}: {
  leagueId: string
  members: any[]
  invites: any[]
}) {
  const supabase = createClient()

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [message, setMessage] = useState('')
  const [searching, setSearching] = useState(false)

  async function searchUsers() {
    setMessage('')
    setSearching(true)

    if (!query.trim()) {
      setMessage('Search by username or email.')
      setSearching(false)
      return
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .or(`username.ilike.%${query}%,email.ilike.%${query}%,display_name.ilike.%${query}%`)
      .limit(8)

    if (error) {
      setMessage(error.message)
      setSearching(false)
      return
    }

    setResults(data || [])
    setSearching(false)
  }

  async function inviteUser(profile: any) {
    setMessage('')

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setMessage('You need to log in.')
      return
    }

    const { error } = await supabase.from('league_invites').upsert(
      {
        league_id: leagueId,
        invited_user_id: profile.id,
        invited_by: user.id,
        can_write: true,
        status: 'pending',
      },
      {
        onConflict: 'league_id,invited_user_id',
      }
    )

    if (error) {
      setMessage(error.message)
      return
    }

    setMessage(`Invite sent to ${profile.display_name || profile.email}.`)
    window.location.reload()
  }

  async function toggleWriter(member: any) {
    setMessage('')

    const { error } = await supabase
      .from('league_members')
      .update({
        can_write: !member.can_write,
      })
      .eq('id', member.id)
      .eq('league_id', leagueId)

    if (error) {
      setMessage(error.message)
      return
    }

    window.location.reload()
  }

  async function removeMember(member: any) {
    const confirmed = window.confirm(
      `Remove ${member.display_name || 'this member'} from the league?`
    )

    if (!confirmed) return

    const { error } = await supabase
      .from('league_members')
      .delete()
      .eq('id', member.id)
      .eq('league_id', leagueId)

    if (error) {
      setMessage(error.message)
      return
    }

    window.location.reload()
  }

  async function cancelInvite(invite: any) {
    const confirmed = window.confirm('Cancel this invite?')
    if (!confirmed) return

    const { error } = await supabase
      .from('league_invites')
      .delete()
      .eq('id', invite.id)
      .eq('league_id', leagueId)

    if (error) {
      setMessage(error.message)
      return
    }

    window.location.reload()
  }

  const siteMembers = members.filter((member) => member.user_id)

  return (
    <section className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="text-3xl font-black">Members & Writers</h2>
      <p className="mt-2 text-sm text-zinc-400">
        Invite site users and control who can write articles.
      </p>

      <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
        <h3 className="text-xl font-black">Invite User</h3>

        <div className="mt-4 flex flex-col gap-3 md:flex-row">
          <input
            className="flex-1 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 outline-none focus:border-emerald-500"
            placeholder="Search username, display name, or email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') searchUsers()
            }}
          />

          <button
            onClick={searchUsers}
            disabled={searching}
            className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 font-black text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
          >
            <Search size={18} />
            {searching ? 'Searching...' : 'Search'}
          </button>
        </div>

        {results.length > 0 && (
          <div className="mt-4 space-y-2">
            {results.map((profile) => (
              <div
                key={profile.id}
                className="flex flex-col justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 md:flex-row md:items-center"
              >
                <div>
                  <p className="font-black">
                    {profile.display_name || profile.username || profile.email}
                  </p>
                  <p className="text-sm text-zinc-500">
                    @{profile.username || 'no-username'} · {profile.email}
                  </p>
                </div>

                <button
                  onClick={() => inviteUser(profile)}
                  className="flex items-center justify-center gap-2 rounded-xl border border-emerald-700 px-4 py-2 text-sm font-bold text-emerald-300 hover:bg-emerald-950/40"
                >
                  <UserPlus size={16} />
                  Invite
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {message && (
        <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-300">
          {message}
        </div>
      )}

      <div className="mt-6">
        <h3 className="text-xl font-black">Current Site Members</h3>

        <div className="mt-4 space-y-3">
          {siteMembers.map((member) => (
            <div
              key={member.id}
              className="flex flex-col justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 md:flex-row md:items-center"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-black">
                    {member.profiles?.display_name ||
                      member.display_name ||
                      member.profiles?.email ||
                      'Unknown Member'}
                  </p>

                  {member.role === 'admin' && (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-500 px-3 py-1 text-xs font-black text-zinc-950">
                      <Shield size={12} />
                      Admin
                    </span>
                  )}

                  {member.can_write && (
                    <span className="flex items-center gap-1 rounded-full bg-zinc-800 px-3 py-1 text-xs font-bold text-emerald-300">
                      <PenLine size={12} />
                      Writer
                    </span>
                  )}
                </div>

                <p className="mt-1 text-sm text-zinc-500">
                  {member.profiles?.email || member.display_name}
                </p>
              </div>

              {member.role !== 'admin' && (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => toggleWriter(member)}
                    className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-bold hover:bg-zinc-900"
                  >
                    {member.can_write ? 'Remove Writer' : 'Make Writer'}
                  </button>

                  <button
                    onClick={() => removeMember(member)}
                    className="flex items-center gap-2 rounded-xl border border-red-900 px-4 py-2 text-sm font-bold text-red-300 hover:bg-red-950/40"
                  >
                    <Trash2 size={15} />
                    Remove
                  </button>
                </div>
              )}
            </div>
          ))}

          {!siteMembers.length && (
            <p className="text-zinc-400">No site members have joined yet.</p>
          )}
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-xl font-black">Pending Invites</h3>

        <div className="mt-4 space-y-3">
          {invites.map((invite) => (
            <div
              key={invite.id}
              className="flex flex-col justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 md:flex-row md:items-center"
            >
              <div>
                <p className="font-black">
                  {invite.profiles?.display_name ||
                    invite.profiles?.email ||
                    'Invited User'}
                </p>
                <p className="mt-1 text-sm text-zinc-500">
                  {invite.profiles?.email} · {invite.status}
                </p>
              </div>

              <button
                onClick={() => cancelInvite(invite)}
                className="rounded-xl border border-red-900 px-4 py-2 text-sm font-bold text-red-300 hover:bg-red-950/40"
              >
                Cancel Invite
              </button>
            </div>
          ))}

          {!invites.length && (
            <p className="text-zinc-400">No pending invites.</p>
          )}
        </div>
      </div>
    </section>
  )
}