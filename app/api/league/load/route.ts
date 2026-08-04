import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getSleeperLeague,
  getSleeperUsers,
  sleeperAvatarUrl,
} from '@/lib/sleeper'
import { syncSleeperLeagueData } from '@/lib/syncSleeperLeague'

export async function POST(req: Request) {
  try {
    const { sleeperLeagueId } = await req.json()

    if (!sleeperLeagueId) {
      return NextResponse.json(
        { error: 'Missing Sleeper league ID.' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'You need to log in first.' },
        { status: 401 }
      )
    }

    await supabase.from('profiles').upsert({
      id: user.id,
      email: user.email,
      username: user.email,
      display_name: user.email,
    })

    const { data: existingLeague } = await supabase
      .from('leagues')
      .select('*')
      .eq('sleeper_league_id', sleeperLeagueId)
      .maybeSingle()

    if (existingLeague) {
      const { data: existingMember } = await supabase
        .from('league_members')
        .select('*')
        .eq('league_id', existingLeague.id)
        .eq('user_id', user.id)
        .maybeSingle()

      if (!existingMember) {
        await supabase.from('league_members').insert({
          league_id: existingLeague.id,
          user_id: user.id,
          display_name: user.email,
          role: 'member',
          can_write: false,
        })
      }

      return NextResponse.json({
        leagueId: existingLeague.id,
        existed: true,
      })
    }

    const sleeperLeague = await getSleeperLeague(sleeperLeagueId)
    const sleeperUsers = await getSleeperUsers(sleeperLeagueId)

    const { data: newLeague, error: leagueError } = await supabase
      .from('leagues')
      .insert({
        sleeper_league_id: sleeperLeagueId,
        name: sleeperLeague.name,
        avatar: sleeperLeague.avatar,
        season: sleeperLeague.season,
        status: sleeperLeague.status,
        sport: sleeperLeague.sport,
        total_rosters: sleeperLeague.total_rosters,
        scoring_settings: sleeperLeague.scoring_settings || {},
        game_feed_metadata_synced_at: new Date().toISOString(),
        current_week: sleeperLeague.settings?.week || 1,
        admin_id: user.id,
      })
      .select()
      .single()

    if (leagueError || !newLeague) {
      return NextResponse.json(
        { error: leagueError?.message || 'Could not create league.' },
        { status: 500 }
      )
    }

    const { error: adminMemberError } = await supabase
      .from('league_members')
      .insert({
        league_id: newLeague.id,
        user_id: user.id,
        display_name: user.email,
        role: 'admin',
        can_write: true,
      })

    if (adminMemberError) {
      return NextResponse.json(
        { error: adminMemberError.message },
        { status: 500 }
      )
    }

    const sleeperMembers = sleeperUsers.map((sleeperUser) => ({
      league_id: newLeague.id,
      user_id: null,
      sleeper_user_id: sleeperUser.user_id,
      display_name:
        sleeperUser.metadata?.team_name ||
        sleeperUser.display_name ||
        sleeperUser.username,
      avatar: sleeperAvatarUrl(sleeperUser.avatar),
      role: 'sleeper_member',
      can_write: false,
    }))

    if (sleeperMembers.length > 0) {
      await supabase.from('league_members').upsert(sleeperMembers, {
        onConflict: 'league_id,sleeper_user_id',
      })
    }

    await syncSleeperLeagueData({
      supabase,
      leagueId: newLeague.id,
      week: sleeperLeague.settings?.week || 1,
    })

    return NextResponse.json({
      leagueId: newLeague.id,
      existed: false,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Something went wrong loading the league.' },
      { status: 500 }
    )
  }
}