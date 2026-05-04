import Navbar from '@/components/Navbar'
import ArticleEditor from '@/components/ArticleEditor'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function NewArticlePage({
  params,
}: {
  params: Promise<{ leagueId: string }>
}) {
  const { leagueId } = await params
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

  const { data: member } = await supabase
    .from('league_members')
    .select('*')
    .eq('league_id', leagueId)
    .eq('user_id', user.id)
    .maybeSingle()

  const canWrite = league?.admin_id === user.id || member?.can_write

  if (!canWrite) {
    redirect(`/league/${leagueId}`)
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <Navbar />

      <ArticleEditor
        leagueId={leagueId}
        mode="create"
        backHref={`/league/${leagueId}`}
      />
    </main>
  )
}