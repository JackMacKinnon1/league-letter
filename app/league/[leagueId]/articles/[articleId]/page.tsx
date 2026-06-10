import Link from '@/components/NoPrefetchLink'
import Navbar from '@/components/Navbar'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ leagueId: string; articleId: string }>
}) {
  const { leagueId, articleId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: league } = await supabase
    .from('leagues')
    .select('*')
    .eq('id', leagueId)
    .single()

  const { data: article } = await supabase
    .from('articles')
    .select('*, profiles(display_name, email)')
    .eq('id', articleId)
    .eq('league_id', leagueId)
    .maybeSingle()

  if (!article || article.status !== 'published') {
    const canViewDraft =
      !!user && (article?.author_id === user.id || league?.admin_id === user.id)

    if (!canViewDraft) {
      notFound()
    }
  }

  const canEdit =
    !!user && (article.author_id === user.id || league?.admin_id === user.id)


  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <Navbar />

      <article className="mx-auto max-w-4xl px-4 py-10">
        <Link
          href={`/league/${leagueId}`}
          className="text-sm font-bold text-zinc-400 hover:text-white"
        >
          ← Back to {league?.name || 'league'}
        </Link>

        <div className="mt-8 border-b border-zinc-800 pb-8">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-emerald-400">
            League Article
          </p>

          <h1 className="mt-4 text-5xl font-black leading-tight md:text-7xl">
            {article.title}
          </h1>

          {article.subtitle && (
            <p className="mt-5 text-xl leading-8 text-zinc-300">
              {article.subtitle}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-zinc-500">
            <span>
              By{' '}
              {article.profiles?.display_name ||
                article.profiles?.email ||
                'League Writer'}
            </span>
            <span>•</span>
            <span>{new Date(article.created_at).toLocaleDateString()}</span>
            <span>•</span>
            <span className="capitalize">{article.status}</span>
          </div>

          {canEdit && (
            <Link
              href={`/league/${leagueId}/articles/${articleId}/edit`}
              className="mt-6 inline-block rounded-2xl bg-emerald-500 px-5 py-3 font-black text-zinc-950 hover:bg-emerald-400"
            >
              Edit Article
            </Link>
          )}
        </div>

        <div
          className="article-body mt-8 max-w-none"
          dangerouslySetInnerHTML={{ __html: article.body || '' }}
        />
      </article>
    </main>
  )
}