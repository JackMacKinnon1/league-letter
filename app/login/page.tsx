import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  async function login(formData: FormData) {
    'use server'

    const supabase = await createClient()

    const email = String(formData.get('email') || '').trim()
    const password = String(formData.get('password') || '')

    if (!email || !password) {
      redirect('/login?error=Email%20and%20password%20are%20required')
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      redirect(`/login?error=${encodeURIComponent(error.message)}`)
    }

    redirect('/dashboard')
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-white">
      <div className="w-full max-w-md rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <Link href="/" className="text-sm font-bold text-zinc-400">
          ← Back home
        </Link>

        <h1 className="mt-6 text-4xl font-black">Log in</h1>

        <p className="mt-2 text-zinc-400">Welcome back to the newsroom.</p>

        <form action={login} className="mt-6 space-y-3">
          <input
            name="email"
            className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none focus:border-emerald-500"
            placeholder="Email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
          />

          <input
            name="password"
            className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none focus:border-emerald-500"
            placeholder="Password"
            type="password"
            autoComplete="current-password"
            required
          />

          <input
            type="submit"
            value="Log In"
            className="h-14 w-full cursor-pointer rounded-2xl bg-emerald-500 py-3 text-center font-black text-zinc-950 transition hover:bg-emerald-400"
          />
        </form>

        <a
          href="/signup"
          className="mt-4 block min-h-12 w-full py-3 text-left text-sm font-semibold text-zinc-400 hover:text-white"
        >
          Need an account? Sign up
        </a>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
            {error}
          </div>
        )}
      </div>
    </main>
  )
}