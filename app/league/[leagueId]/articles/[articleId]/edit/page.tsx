import Navbar from '@/components/Navbar'
import ArticleEditor from '@/components/ArticleEditor'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function EditArticlePage({
  params,
}: {
  params: Promise<{ leagueId: string; articleId: string }>
}) {
  const { leagueId, articleId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: league } = await supabase
    .from('leagues')
    .select('*')
    .eq('id', leagueId)
    .single()

  const { data: article } = await supabase
    .from('articles')
    .select('*')
    .eq('league_id', leagueId)
    .eq('id', articleId)
    .single()

  if (!article) {
    redirect(`/league/${leagueId}`)
  }

  const canEdit = article.author_id === user.id || league?.admin_id === user.id

  if (!canEdit) {
    redirect(`/league/${leagueId}/articles/${articleId}`)
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <Navbar />

      <ArticleEditor
        leagueId={leagueId}
        mode="edit"
        article={article}
        backHref={`/league/${leagueId}/articles/${articleId}`}
      />
    </main>
  )
}