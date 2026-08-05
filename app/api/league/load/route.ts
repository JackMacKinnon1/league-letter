import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
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

    const admin = createAdminClient()
    const { data: existingProfile } = await admin
      .from('profiles')
      .select('email,username,display_name,sleeper_user_id')
      .eq('id', user.id)
      .maybeSingle()

    const accountProfile = existingProfile || {
      email: user.email || null,
      username: user.email?.split('@')[0] || `user-${user.id.slice(0, 8)}`,
      display_name: user.email?.split('@')[0] || user.email || 'League Letter user',
      sleeper_user_id: null,
    }

    if (!existingProfile) {
      await admin.from('profiles').upsert({
        id: user.id,
        email: accountProfile.email,
        username: accountProfile.username,
        display_name: accountProfile.display_name,
      })
    }

    const { data: existingLeague } = await supabase
      .from('leagues')
      .select('*')
      .eq('sleeper_league_id', sleeperLeagueId)
      .maybeSingle()

    if (existingLeague) {
      const { data: existingMember } = await admin
        .from('league_members')
        .select('*')
        .eq('league_id', existingLeague.id)
        .eq('user_id', user.id)
        .maybeSingle()

      if (accountProfile.sleeper_user_id) {
        await admin
          .from('league_members')
          .delete()
          .eq('league_id', existingLeague.id)
          .eq('sleeper_user_id', accountProfile.sleeper_user_id)
          .is('user_id', null)
      }

      if (!existingMember) {
        await admin.from('league_members').insert({
          league_id: existingLeague.id,
          user_id: user.id,
          sleeper_user_id: accountProfile.sleeper_user_id,
          display_name: accountProfile.display_name || accountProfile.username || user.email,
          role: 'member',
          can_write: false,
        })
      } else if (
        accountProfile.sleeper_user_id &&
        existingMember.sleeper_user_id !== accountProfile.sleeper_user_id
      ) {
        await admin
          .from('league_members')
          .update({ sleeper_user_id: accountProfile.sleeper_user_id })
          .eq('id', existingMember.id)
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

    const { error: adminMemberError } = await admin
      .from('league_members')
      .insert({
        league_id: newLeague.id,
        user_id: user.id,
        sleeper_user_id: accountProfile.sleeper_user_id,
        display_name: accountProfile.display_name || accountProfile.username || user.email,
        role: 'admin',
        can_write: true,
      })

    if (adminMemberError) {
      return NextResponse.json(
        { error: adminMemberError.message },
        { status: 500 }
      )
    }

    const sleeperMembers = sleeperUsers
      .filter((sleeperUser) => sleeperUser.user_id !== accountProfile.sleeper_user_id)
      .map((sleeperUser) => ({
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
      await admin.from('league_members').upsert(sleeperMembers, {
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