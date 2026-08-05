# Profile and Sleeper account linking

## One-time database update

Run `supabase/profile-sleeper-link.sql` in the Supabase SQL Editor before deploying this version.

It adds these nullable columns to `profiles`:

- `sleeper_user_id`
- `sleeper_username`
- `sleeper_display_name`
- `sleeper_avatar`
- `sleeper_connected_at`

It also prevents one Sleeper account from being linked to multiple League Letter accounts.

## User flow

1. Sign in and open **Profile** from the main navigation.
2. Enter a Sleeper username or numeric Sleeper user ID.
3. Select **Save profile**.
4. League Letter resolves usernames through Sleeper, saves the canonical user ID, and links current league memberships.
5. Game Feed uses the profile-level Sleeper ID as a fallback even when an individual league membership has not yet been linked.

Users can disconnect their Sleeper account from the same page.
