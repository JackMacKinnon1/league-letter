'use client'

import PaginationControls from '@/components/PaginationControls'
import { createClient } from '@/lib/supabase/client'
import { useCallback, useState } from 'react'
import { RefreshCw, Trash2 } from 'lucide-react'

const PAGE_SIZE = 8

export default function ArticleManager({
  leagueId,
  initialArticles,
  initialTotal,
}: {
  leagueId: string
  initialArticles: any[]
  initialTotal: number
}) {
  const supabase = createClient()
  const [articles, setArticles] = useState(initialArticles)
  const [total, setTotal] = useState(initialTotal)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const loadPage = useCallback(async (nextPage: number) => {
    setLoading(true)
    setMessage('')
    try {
      const response = await fetch(
        `/api/league/${leagueId}/admin/articles?page=${nextPage}&pageSize=${PAGE_SIZE}`,
        { cache: 'no-store' }
      )
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Could not load articles.')
      setArticles(json.items || [])
      setTotal(Number(json.total || 0))
      setPage(nextPage)
    } catch (error: any) {
      setMessage(error?.message || 'Could not load articles.')
    } finally {
      setLoading(false)
    }
  }, [leagueId])

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

    const remainingTotal = Math.max(0, total - 1)
    const lastPage = Math.max(1, Math.ceil(remainingTotal / PAGE_SIZE))
    await loadPage(Math.min(page, lastPage))
  }

  return (
    <section className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black">Article Manager</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Delete published articles or clean up league nonsense.
          </p>
        </div>
        {loading && <RefreshCw className="animate-spin text-zinc-500" size={20} />}
      </div>

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
                By {article.profiles?.display_name || article.profiles?.email || 'Unknown'} · {article.status}
              </p>
            </div>

            <button
              onClick={() => deleteArticle(article.id)}
              className="flex items-center justify-center gap-2 rounded-xl border border-red-900 px-4 py-2 text-sm font-bold text-red-300 hover:bg-red-950/40"
            >
              <Trash2 size={16} /> Delete
            </button>
          </div>
        ))}

        {!articles.length && !loading && (
          <p className="text-zinc-400">No articles have been written yet.</p>
        )}
      </div>

      <PaginationControls
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        disabled={loading}
        onPageChange={loadPage}
      />
    </section>
  )
}
