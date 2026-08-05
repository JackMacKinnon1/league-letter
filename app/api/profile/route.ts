import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getSleeperUser, sleeperAvatarUrl } from '@/lib/sleeper'

const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{3,32}$/
const NUMERIC_SLEEPER_ID_PATTERN = /^\d{6,30}$/

type ProfilePayload = {
  displayName?: string
  username?: string
  sleeperAccount?: string
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'You need to log in first.' }, { status: 401 })
    }

    const body = (await request.json()) as ProfilePayload
    const displayName = String(body.displayName || '').trim()
    const username = String(body.username || '').trim()
    const sleeperAccount = String(body.sleeperAccount || '').trim()

    if (!displayName) {
      return NextResponse.json({ error: 'Display name is required.' }, { status: 400 })
    }

    if (!USERNAME_PATTERN.test(username)) {
      return NextResponse.json(
        {
          error:
            'League Letter username must be 3–32 characters and use only letters, numbers, underscores, or hyphens.',
        },
        { status: 400 }
      )
    }

    let sleeperUserId: string | null = null
    let sleeperUsername: string | null = null
    let sleeperDisplayName: string | null = null
    let sleeperAvatar: string | null = null
    let verifiedByUsername = false

    if (sleeperAccount) {
      const sleeperUser = await getSleeperUser(sleeperAccount)

      if (sleeperUser) {
        sleeperUserId = String(sleeperUser.user_id)
        sleeperUsername = sleeperUser.username || sleeperAccount
        sleeperDisplayName = sleeperUser.display_name || sleeperUser.username || sleeperAccount
        sleeperAvatar = sleeperAvatarUrl(sleeperUser.avatar)
        verifiedByUsername = true
      } else if (NUMERIC_SLEEPER_ID_PATTERN.test(sleeperAccount)) {
        sleeperUserId = sleeperAccount
      } else {
        return NextResponse.json(
          {
            error:
              'Sleeper could not find that username. Check the spelling, or paste your numeric Sleeper user ID instead.',
          },
          { status: 404 }
        )
      }
    }

    const admin = createAdminClient()

    const { data: usernameOwner, error: usernameLookupError } = await admin
      .from('profiles')
      .select('id')
      .ilike('username', username)
      .neq('id', user.id)
      .maybeSingle()

    if (usernameLookupError) {
      return NextResponse.json({ error: usernameLookupError.message }, { status: 500 })
    }

    if (usernameOwner) {
      return NextResponse.json(
        { error: 'That League Letter username is already in use.' },
        { status: 409 }
      )
    }

    if (sleeperUserId) {
      const { data: sleeperOwner, error: sleeperOwnerError } = await admin
        .from('profiles')
        .select('id,email')
        .eq('sleeper_user_id', sleeperUserId)
        .neq('id', user.id)
        .maybeSingle()

      if (sleeperOwnerError) {
        return NextResponse.json({ error: sleeperOwnerError.message }, { status: 500 })
      }

      if (sleeperOwner) {
        return NextResponse.json(
          { error: 'That Sleeper account is already connected to another League Letter account.' },
          { status: 409 }
        )
      }
    }

    const profilePatch = {
      id: user.id,
      email: user.email,
      display_name: displayName,
      username,
      sleeper_user_id: sleeperUserId,
      sleeper_username: sleeperUsername,
      sleeper_display_name: sleeperDisplayName,
      sleeper_avatar: sleeperAvatar,
      sleeper_connected_at: sleeperUserId ? new Date().toISOString() : null,
    }

    const { data: savedProfile, error: profileError } = await admin
      .from('profiles')
      .upsert(profilePatch)
      .select(
        'id,email,username,display_name,sleeper_user_id,sleeper_username,sleeper_display_name,sleeper_avatar,sleeper_connected_at'
      )
      .single()

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    const { data: memberships, error: membershipsError } = await admin
      .from('league_members')
      .select('id,league_id')
      .eq('user_id', user.id)
      .limit(250)

    if (membershipsError) {
      return NextResponse.json({ error: membershipsError.message }, { status: 500 })
    }

    for (const membership of memberships || []) {
      if (sleeperUserId) {
        // Imported Sleeper members may already occupy this league/user-ID pair.
        // Remove only the unclaimed placeholder before linking the real site account.
        const { error: placeholderDeleteError } = await admin
          .from('league_members')
          .delete()
          .eq('league_id', membership.league_id)
          .eq('sleeper_user_id', sleeperUserId)
          .is('user_id', null)
          .neq('id', membership.id)

        if (placeholderDeleteError) {
          return NextResponse.json({ error: placeholderDeleteError.message }, { status: 500 })
        }
      }

      const { error: membershipUpdateError } = await admin
        .from('league_members')
        .update({ sleeper_user_id: sleeperUserId })
        .eq('id', membership.id)
        .eq('user_id', user.id)

      if (membershipUpdateError) {
        return NextResponse.json({ error: membershipUpdateError.message }, { status: 500 })
      }
    }

    return NextResponse.json({
      profile: savedProfile,
      sleeperVerified: verifiedByUsername,
      linkedLeagueCount: memberships?.length || 0,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Could not save your profile.' },
      { status: 500 }
    )
  }
}
