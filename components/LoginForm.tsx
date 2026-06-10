'use client'

import { useState } from 'react'
import Link from '@/components/NoPrefetchLink'
import { createClient } from '@/lib/supabase/client'

export default function LoginForm() {
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    setLoading(true)
    setMessage('')

    const cleanEmail = email.trim()

    if (!cleanEmail || !password) {
      setMessage('Email and password are required.')
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    })

    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    window.location.href = '/dashboard'
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-white">
      <div className="w-full max-w-md rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <Link href="/" className="text-sm font-bold text-zinc-400">
          ← Back home
        </Link>

        <h1 className="mt-6 text-4xl font-black">Log in</h1>

        <p className="mt-2 text-zinc-400">Welcome back to the newsroom.</p>

        <div className="mt-6 space-y-3">
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
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleLogin()
              }
            }}
          />

          <button
            type="button"
            onClick={handleLogin}
            disabled={loading}
            className="h-14 w-full rounded-2xl bg-emerald-500 py-3 font-black text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </div>

        <a
          href="/signup"
          className="mt-4 block min-h-12 w-full py-3 text-left text-sm font-semibold text-zinc-400 hover:text-white"
        >
          Need an account? Sign up
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