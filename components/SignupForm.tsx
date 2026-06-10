'use client'

import { useState } from 'react'
import Link from '@/components/NoPrefetchLink'
import { createClient } from '@/lib/supabase/client'

export default function SignupForm() {
  const supabase = createClient()

  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSignup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    event.stopPropagation()

    setLoading(true)
    setMessage('')

    const cleanEmail = email.trim()
    const cleanUsername = username.trim()

    if (!cleanEmail || !password || !cleanUsername) {
      setMessage('Username, email, and password are required.')
      setLoading(false)
      return
    }

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
    })

    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: data.user.id,
        email: cleanEmail,
        username: cleanUsername,
        display_name: displayName.trim() || cleanUsername,
      })

      if (profileError) {
        setMessage(profileError.message)
        setLoading(false)
        return
      }
    }

    window.location.assign('/dashboard')
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-white">
      <div className="w-full max-w-md rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <Link href="/" className="text-sm font-bold text-zinc-400">
          ← Back home
        </Link>

        <h1 className="mt-6 text-4xl font-black">Create account</h1>

        <p className="mt-2 text-zinc-400">Make your League Letter account.</p>

        <form onSubmit={handleSignup} className="mt-6 space-y-3">
          <input
            className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none focus:border-emerald-500"
            placeholder="Username"
            value={username}
            autoComplete="username"
            onChange={(e) => setUsername(e.target.value)}
          />

          <input
            className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none focus:border-emerald-500"
            placeholder="Display name"
            value={displayName}
            autoComplete="name"
            onChange={(e) => setDisplayName(e.target.value)}
          />

          <input
            className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none focus:border-emerald-500"
            placeholder="Email"
            type="email"
            value={email}
            autoComplete="email"
            inputMode="email"
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none focus:border-emerald-500"
            placeholder="Password"
            type="password"
            value={password}
            autoComplete="new-password"
            onChange={(e) => setPassword(e.target.value)}
          />

          <button
            type="submit"
            disabled={loading}
            className="h-14 w-full rounded-2xl bg-emerald-500 py-3 font-black text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <a
          href="/login"
          className="mt-4 block min-h-12 w-full py-3 text-left text-sm font-semibold text-zinc-400 hover:text-white"
        >
          Already have an account? Log in
        </a>

        {message && (
          <div className="mt-4 rounded-2xl border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
            {message}
          </div>
        )}
      </div>
    </main>
  )
}