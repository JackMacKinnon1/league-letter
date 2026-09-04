'use client'

import { useState } from 'react'
import Link from '@/components/NoPrefetchLink'
import { Newspaper } from 'lucide-react'
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

    const { data, error } = await supabase.auth.signUp({ email: cleanEmail, password })
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
    <main className="ll-auth-page">
      <div className="ll-auth-glow" />
      <div className="ll-card ll-auth-card ll-auth-card-wide">
        <Link href="/" className="ll-auth-brand">
          <span className="ll-brand-mark"><Newspaper size={19} /></span>
          <span className="ll-brand-word"><b>LEAGUE</b><em>LETTER</em></span>
        </Link>
        <p className="ll-eyebrow">New account</p>
        <h1>Create your League Letter</h1>
        <p className="ll-form-intro">Set up your identity, then load or join a Sleeper league.</p>

        <form onSubmit={handleSignup} className="ll-auth-form ll-auth-grid">
          <label className="ll-field">
            <span>Username</span>
            <input className="ll-input" placeholder="username" value={username} autoComplete="username" onChange={(e) => setUsername(e.target.value)} />
          </label>
          <label className="ll-field">
            <span>Display name</span>
            <input className="ll-input" placeholder="Display name" value={displayName} autoComplete="name" onChange={(e) => setDisplayName(e.target.value)} />
          </label>
          <label className="ll-field ll-auth-span">
            <span>Email</span>
            <input className="ll-input" placeholder="you@example.com" type="email" value={email} autoComplete="email" inputMode="email" onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="ll-field ll-auth-span">
            <span>Password</span>
            <input className="ll-input" placeholder="Password" type="password" value={password} autoComplete="new-password" onChange={(e) => setPassword(e.target.value)} />
          </label>
          <button type="submit" disabled={loading} className="ll-btn ll-btn-primary ll-btn-block ll-auth-span">
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <Link href="/login" className="ll-auth-switch">Already have an account? <b>Sign in</b></Link>
        {message && <div className="ll-notice ll-notice-error">{message}</div>}
      </div>
    </main>
  )
}
