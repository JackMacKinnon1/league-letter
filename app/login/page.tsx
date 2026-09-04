import Link from '@/components/NoPrefetchLink'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Newspaper } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  async function login(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const email = String(formData.get('email') || '').trim()
    const password = String(formData.get('password') || '')

    if (!email || !password) redirect('/login?error=Email%20and%20password%20are%20required')

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`)
    redirect('/dashboard')
  }

  return (
    <main className="ll-auth-page">
      <div className="ll-auth-glow" />
      <div className="ll-card ll-auth-card">
        <Link href="/" className="ll-auth-brand">
          <span className="ll-brand-mark"><Newspaper size={19} /></span>
          <span className="ll-brand-word"><b>LEAGUE</b><em>LETTER</em></span>
        </Link>

        <p className="ll-eyebrow">Welcome back</p>
        <h1>Sign in</h1>
        <p className="ll-form-intro">Open your leagues, newsroom tools, rankings, and admin controls.</p>

        <form action={login} className="ll-auth-form">
          <label className="ll-field">
            <span>Email</span>
            <input name="email" className="ll-input" placeholder="you@example.com" type="email" autoComplete="email" inputMode="email" required />
          </label>
          <label className="ll-field">
            <span>Password</span>
            <input name="password" className="ll-input" placeholder="Password" type="password" autoComplete="current-password" required />
          </label>
          <input type="submit" value="Sign in" className="ll-btn ll-btn-primary ll-btn-block" />
        </form>

        <Link href="/signup" className="ll-auth-switch">Need an account? <b>Create one</b></Link>
        {error && <div className="ll-notice ll-notice-error">{error}</div>}
      </div>
    </main>
  )
}
