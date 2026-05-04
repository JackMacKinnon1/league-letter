'use client'

import { useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'

const RichTextEditor = dynamic(() => import('@/components/RichTextEditor'), {
  ssr: false,
})

export default function ArticleEditor({
  leagueId,
  mode,
  article,
  backHref,
}: {
  leagueId: string
  mode: 'create' | 'edit'
  article?: any
  backHref: string
}) {
  const supabase = createClient()

  const [title, setTitle] = useState(article?.title || '')
  const [subtitle, setSubtitle] = useState(article?.subtitle || '')
  const [body, setBody] = useState(article?.body || '<p></p>')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function save(status: 'draft' | 'published') {
    setLoading(true)
    setMessage('')

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setMessage('You need to log in.')
      setLoading(false)
      return
    }

    const bodyWithoutTags = body.replace(/<[^>]*>/g, '').trim()

    if (!title.trim() || !bodyWithoutTags) {
      setMessage('Title and body are required.')
      setLoading(false)
      return
    }

    if (mode === 'create') {
      const { data, error } = await supabase
        .from('articles')
        .insert({
          league_id: leagueId,
          author_id: user.id,
          title,
          subtitle,
          body,
          status,
        })
        .select()
        .single()

      if (error) {
        setMessage(error.message)
        setLoading(false)
        return
      }

      window.location.href = `/league/${leagueId}/articles/${data.id}`
      return
    }

    const { error } = await supabase
      .from('articles')
      .update({
        title,
        subtitle,
        body,
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', article.id)
      .eq('league_id', leagueId)

    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    window.location.href = `/league/${leagueId}/articles/${article.id}`
  }

  return (
    <section className="mx-auto max-w-5xl px-4 py-10">
      <Link href={backHref} className="text-sm font-bold text-zinc-400">
        ← Back
      </Link>

      <div className="mt-6 rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
        <p className="text-sm font-black uppercase tracking-[0.3em] text-emerald-400">
          {mode === 'create' ? 'New Article' : 'Edit Article'}
        </p>

        <h1 className="mt-3 text-4xl font-black">
          {mode === 'create' ? 'Write an article' : 'Update your article'}
        </h1>

        <div className="mt-6 space-y-3">
          <input
            className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none focus:border-emerald-500"
            placeholder="Headline"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <input
            className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none focus:border-emerald-500"
            placeholder="Subtitle"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
          />

          <RichTextEditor value={body} onChange={setBody} leagueId={leagueId} />

          <div className="flex flex-col gap-3 md:flex-row">
            <button
              onClick={() => save('published')}
              disabled={loading}
              className="flex-1 rounded-2xl bg-emerald-500 py-3 font-black text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Publish'}
            </button>

            <button
              onClick={() => save('draft')}
              disabled={loading}
              className="flex-1 rounded-2xl border border-zinc-700 py-3 font-black hover:bg-zinc-800 disabled:opacity-50"
            >
              Save Draft
            </button>
          </div>

          {message && (
            <div className="rounded-2xl border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
              {message}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}