'use client'

import { CheckCircle2, Link2, Loader2, Save, Unlink, UserRound } from 'lucide-react'
import { useState } from 'react'

type ProfileRecord = {
  email: string | null
  username: string | null
  display_name: string | null
  sleeper_user_id: string | null
  sleeper_username: string | null
  sleeper_display_name: string | null
  sleeper_avatar: string | null
  sleeper_connected_at: string | null
}

export default function ProfileForm({ initialProfile }: { initialProfile: ProfileRecord }) {
  const [displayName, setDisplayName] = useState(initialProfile.display_name || '')
  const [username, setUsername] = useState(initialProfile.username || '')
  const [sleeperAccount, setSleeperAccount] = useState(
    initialProfile.sleeper_username || initialProfile.sleeper_user_id || ''
  )
  const [profile, setProfile] = useState(initialProfile)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function saveProfile(nextSleeperAccount = sleeperAccount) {
    setSaving(true)
    setMessage('')
    setError('')

    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName,
          username,
          sleeperAccount: nextSleeperAccount,
        }),
      })
      const json = await response.json()

      if (!response.ok) {
        throw new Error(json.error || 'Could not save your profile.')
      }

      setProfile(json.profile)
      setSleeperAccount(json.profile.sleeper_username || json.profile.sleeper_user_id || '')
      setMessage(
        json.profile.sleeper_user_id
          ? `Sleeper account connected across ${json.linkedLeagueCount} league${json.linkedLeagueCount === 1 ? '' : 's'}.`
          : 'Profile saved and Sleeper account disconnected.'
      )
    } catch (saveError: any) {
      setError(saveError?.message || 'Could not save your profile.')
    } finally {
      setSaving(false)
    }
  }

  async function disconnectSleeper() {
    setSleeperAccount('')
    await saveProfile('')
  }

  const isConnected = Boolean(profile.sleeper_user_id)

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
      <section className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6 md:p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.05] text-zinc-300">
            <UserRound size={21} />
          </div>
          <div>
            <h2 className="text-2xl font-black">League Letter profile</h2>
            <p className="text-sm text-zinc-500">The name other league members see.</p>
          </div>
        </div>

        <div className="mt-7 grid gap-5">
          <label className="grid gap-2">
            <span className="text-sm font-bold text-zinc-300">Email</span>
            <input
              value={profile.email || ''}
              readOnly
              className="w-full rounded-2xl border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-zinc-500 outline-none"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold text-zinc-300">Display name</span>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={80}
              className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none transition focus:border-emerald-500"
              placeholder="Your display name"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold text-zinc-300">League Letter username</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              maxLength={32}
              autoCapitalize="none"
              autoCorrect="off"
              className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none transition focus:border-emerald-500"
              placeholder="username"
            />
            <span className="text-xs text-zinc-500">
              Letters, numbers, underscores and hyphens only.
            </span>
          </label>
        </div>
      </section>

      <section className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6 md:p-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300">
              <Link2 size={21} />
            </div>
            <div>
              <h2 className="text-2xl font-black">Sleeper account</h2>
              <p className="text-sm text-zinc-500">Connect your fantasy identity.</p>
            </div>
          </div>

          <span
            className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wider ${
              isConnected
                ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300'
                : 'border-zinc-700 bg-zinc-950 text-zinc-500'
            }`}
          >
            {isConnected ? 'Connected' : 'Not connected'}
          </span>
        </div>

        {isConnected && (
          <div className="mt-6 flex items-center gap-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.07] p-4">
            {profile.sleeper_avatar ? (
              <img
                src={profile.sleeper_avatar}
                alt="Sleeper profile avatar"
                className="h-14 w-14 rounded-2xl border border-white/10 object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-zinc-950 text-emerald-300">
                <CheckCircle2 size={25} />
              </div>
            )}

            <div className="min-w-0">
              <p className="truncate text-lg font-black">
                {profile.sleeper_display_name || profile.sleeper_username || 'Sleeper account'}
              </p>
              {profile.sleeper_username && (
                <p className="truncate text-sm text-emerald-300">@{profile.sleeper_username}</p>
              )}
              <p className="mt-1 truncate font-mono text-xs text-zinc-500">
                ID {profile.sleeper_user_id}
              </p>
            </div>
          </div>
        )}

        <label className="mt-6 grid gap-2">
          <span className="text-sm font-bold text-zinc-300">Sleeper username or user ID</span>
          <input
            value={sleeperAccount}
            onChange={(event) => setSleeperAccount(event.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none transition focus:border-emerald-500"
            placeholder="Enter your Sleeper username"
          />
          <span className="text-xs leading-5 text-zinc-500">
            A username is easiest. League Letter looks it up and saves the matching Sleeper user ID.
          </span>
        </label>

        <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 text-sm leading-6 text-zinc-400">
          This lets Game Feed automatically recognize your roster and colour plays green or red based on your weekly matchup.
        </div>

        {isConnected && (
          <button
            type="button"
            onClick={disconnectSleeper}
            disabled={saving}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-300 transition hover:bg-red-500/15 disabled:opacity-60"
          >
            <Unlink size={16} />
            Disconnect Sleeper
          </button>
        )}
      </section>

      <div className="lg:col-span-2">
        {error && (
          <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-semibold text-red-200">
            {error}
          </div>
        )}
        {message && (
          <div className="mb-4 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-4 text-sm font-semibold text-emerald-200">
            {message}
          </div>
        )}

        <button
          type="button"
          onClick={() => saveProfile()}
          disabled={saving}
          className="inline-flex min-h-13 items-center gap-2 rounded-2xl bg-emerald-500 px-6 py-3 font-black text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
          {saving ? 'Saving profile...' : 'Save profile'}
        </button>
      </div>
    </div>
  )
}
