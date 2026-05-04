'use client'

import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import { Trash2 } from 'lucide-react'

export default function ArticleManager({
  leagueId,
  articles,
}: {
  leagueId: string
  articles: any[]
}) {
  const supabase = createClient()
  const [message, setMessage] = useState('')

  async function deleteArticle(articleId: string) {
    const confirmed = window.confirm('Delete this article?')
    if (!confirmed) return

    const { error } = await supabase
      .from('articles')
      .delete()
      .eq('id', articleId)
      .eq('league_id', leagueId)

    if (error) {
      setMessage(error.message)
      return
    }

    window.location.reload()
  }

  return (
    <section className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="text-3xl font-black">Article Manager</h2>
      <p className="mt-2 text-sm text-zinc-400">
        Delete published articles or clean up league nonsense.
      </p>

      {message && (
        <div className="mt-4 rounded-2xl border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
          {message}
        </div>
      )}

      <div className="mt-5 space-y-3">
        {articles.map((article) => (
          <div
            key={article.id}
            className="flex flex-col justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 md:flex-row md:items-center"
          >
            <div>
              <h3 className="text-xl font-black">{article.title}</h3>
              <p className="mt-1 text-sm text-zinc-500">
                By{' '}
                {article.profiles?.display_name ||
                  article.profiles?.email ||
                  'Unknown'}{' '}
                · {article.status}
              </p>
            </div>

            <button
              onClick={() => deleteArticle(article.id)}
              className="flex items-center justify-center gap-2 rounded-xl border border-red-900 px-4 py-2 text-sm font-bold text-red-300 hover:bg-red-950/40"
            >
              <Trash2 size={16} />
              Delete
            </button>
          </div>
        ))}

        {!articles.length && (
          <p className="text-zinc-400">No articles have been written yet.</p>
        )}
      </div>
    </section>
  )
}