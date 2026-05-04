'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Megaphone, Trash2 } from 'lucide-react'

export default function BreakingNewsManager({
  leagueId,
  existingNews,
}: {
  leagueId: string
  existingNews: any[]
}) {
  const supabase = createClient()

  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  async function postBreakingNews() {
    setStatus('')

    if (!title.trim() || !message.trim()) {
      setStatus('Title and message are required.')
      return
    }

    setLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setStatus('You need to log in.')
      setLoading(false)
      return
    }

    const { error } = await supabase.from('breaking_news').insert({
      league_id: leagueId,
      created_by: user.id,
      title: title.trim(),
      message: message.trim(),
      is_active: true,
    })

    if (error) {
      setStatus(error.message)
      setLoading(false)
      return
    }

    window.location.reload()
  }

  async function toggleActive(news: any) {
    const { error } = await supabase
      .from('breaking_news')
      .update({
        is_active: !news.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', news.id)
      .eq('league_id', leagueId)

    if (error) {
      setStatus(error.message)
      return
    }

    window.location.reload()
  }

  async function deleteNews(news: any) {
    const confirmed = window.confirm('Delete this breaking news item?')
    if (!confirmed) return

    const { error } = await supabase
      .from('breaking_news')
      .delete()
      .eq('id', news.id)
      .eq('league_id', leagueId)

    if (error) {
      setStatus(error.message)
      return
    }

    window.location.reload()
  }

  return (
    <section className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500 text-zinc-950">
          <Megaphone size={22} />
        </div>

        <div>
          <h2 className="text-3xl font-black">Breaking News</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Quickly post league alerts, trade bombs, scandals, punishments, or weekly chaos.
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
        <input
          className="w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 outline-none focus:border-emerald-500"
          placeholder="Headline, e.g. BLOCKBUSTER TRADE"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <textarea
          className="mt-3 min-h-28 w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 outline-none focus:border-emerald-500"
          placeholder="What happened?"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />

        <button
          onClick={postBreakingNews}
          disabled={loading}
          className="mt-3 w-full rounded-2xl bg-emerald-500 py-3 font-black text-zinc-950 hover:bg-emerald-400 disabled:opacity-60"
        >
          {loading ? 'Posting...' : 'Post Breaking News'}
        </button>

        {status && <p className="mt-3 text-sm text-zinc-400">{status}</p>}
      </div>

      <div className="mt-6">
        <h3 className="text-xl font-black">Previous Alerts</h3>

        <div className="mt-4 space-y-3">
          {existingNews.map((news) => (
            <div
              key={news.id}
              className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"
            >
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">
                    {news.is_active ? 'Active' : 'Inactive'} ·{' '}
                    {formatDate(news.created_at)}
                  </p>

                  <h4 className="mt-2 text-xl font-black">{news.title}</h4>
                  <p className="mt-1 text-sm leading-6 text-zinc-400">
                    {news.message}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => toggleActive(news)}
                    className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-bold hover:bg-zinc-900"
                  >
                    {news.is_active ? 'Deactivate' : 'Activate'}
                  </button>

                  <button
                    onClick={() => deleteNews(news)}
                    className="flex items-center gap-2 rounded-xl border border-red-900 px-4 py-2 text-sm font-bold text-red-300 hover:bg-red-950/40"
                  >
                    <Trash2 size={15} />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}

          {!existingNews.length && (
            <p className="text-zinc-400">No breaking news posted yet.</p>
          )}
        </div>
      </div>
    </section>
  )
}

function formatDate(dateString: string) {
  return new Date(dateString).toISOString().slice(0, 10)
}