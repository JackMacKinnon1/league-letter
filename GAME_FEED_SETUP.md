# League Letter Game Feed — single-source local worker

This version uses one dedicated deep Sleeper league as the only live scoring source.
It does not matter how many League Letter leagues or website visitors are active:
the worker makes one Sleeper matchup request per polling interval.

## How it works

```text
Dedicated deep Sleeper league
        ↓ one request every 10 seconds
Local worker on your main PC
        ↓ infer scoring plays once
Supabase
        ↓ copy each event to every enabled League Letter league
League Letter website
```

The dedicated Sleeper league does **not** need to be loaded as a normal League
Letter league. The worker only needs its Sleeper league ID.

## 1. Prepare the dedicated Sleeper source league

Create a very deep Sleeper league and roster essentially every player you want the
Game Feed to track. Players must appear in that league's weekly matchup response
for their changing point totals to be observed.

Use scoring settings that make the play inference easy to interpret. The expected
standard settings are:

- 1 point per reception
- 0.1 points per receiving/rushing yard
- 0.04 points per passing yard
- 6 points per rushing/receiving touchdown
- Your preferred passing-touchdown value

The worker reads the source league's real scoring settings and uses them for the
math.

Copy the numeric Sleeper league ID from the league URL.

## 2. Copy the updated code into your project

Copy this codebase over your current League Letter project while keeping your
existing `.git` folder and `.env.local` file.

Then install dependencies:

```powershell
npm install
```

## 3. Update `.env.local`

Add the source league ID and global polling interval:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY

GAME_FEED_SOURCE_SLEEPER_LEAGUE_ID=YOUR_DEEP_SLEEPER_LEAGUE_ID
GAME_FEED_POLL_SECONDS=10

# Optional display name for the worker status card
GAME_FEED_WORKER_NAME=Jack-Main-PC
```

Keep `SUPABASE_SERVICE_ROLE_KEY` on your PC and in Netlify's server environment.
Never expose it through a `NEXT_PUBLIC_` variable or commit `.env.local`.

## 4. Run the Supabase migration

Open your Supabase project:

```text
SQL Editor → New query
```

Copy and run the complete contents of:

```text
supabase/game-feed.sql
```

This migration can upgrade the earlier local-worker database. It adds:

- A single-source worker state and lock
- Separate public and test baselines
- Public/test event tags
- A per-league website display mode
- Realtime support for new events

No Supabase CLI, Edge Function, Cron job, Vault secret, or port forwarding is
required.

## 5. Deploy the website normally

Commit the changes and deploy your normal production branch to Netlify.

Netlify needs these existing variables:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

The source Sleeper league ID is only required on the PC that runs the worker. You
may also put it in Netlify, but the website itself does not contact Sleeper.

## 6. Choose the website mode

Log in as `mackinnonjack4@gmail.com`, open **Site Admin** in the main navigation, then open **Game Feed Control**. Ordinary league-room admins cannot access or change these settings.

Choose:

- **Public** — the website shows only real public events and hides all test cells.
- **Test** — the website shows only test-tagged cells and hides public events.

This selection applies to:

- The league homepage preview
- The full Game Feed page
- Realtime updates
- Player pages and biggest plays

The site owner can choose the website display mode for each League Letter room from this one protected page.

## 7. Start the worker

### Interactive launcher

Double-click:

```text
START_GAME_FEED.bat
```

Or run:

```powershell
npm run game-feed
```

The worker asks:

```text
Start collector in [P]ublic or [T]est mode?
```

### Direct public start

```powershell
npm run game-feed:public
```

or double-click:

```text
START_GAME_FEED_PUBLIC.bat
```

### Direct test start

```powershell
npm run game-feed:test
```

or double-click:

```text
START_GAME_FEED_TEST.bat
```

Test mode asks whether it should immediately create four sample cells. These use
real player records when available and are clearly labelled `TEST · synthetic`.

A one-command test is also available:

```powershell
npm run game-feed:test:demo
```

That performs one source poll, adds sample test cells, and exits.

## Public and test mode behavior

Public and test modes have separate player-point baselines.

That means:

- Starting Test mode never changes the Public baseline.
- Test events can never appear while a league's website mode is Public.
- Public events can never appear while a league's website mode is Test.
- Realtime events are checked against the selected website mode before display.

The protected Site Admin Game Feed page shows the current worker mode, heartbeat, source league, and every room's website mode.

## Game-day process

1. Make sure your PC will not sleep while plugged in.
2. Start `START_GAME_FEED_PUBLIC.bat`.
3. Leave the terminal open during the games.
4. Confirm **Site Admin → Game Feed Control** says `Collector Online · PUBLIC`.
5. Press `Ctrl+C` after the games.

The first Public poll for a new week seeds the baseline and creates no plays.
Future point changes create events.

## Testing process

1. Open **Site Admin → Game Feed Control**, set the desired room to **Test**, and save.
2. Start `START_GAME_FEED_TEST.bat`.
3. Answer `Y` when asked to create sample test cells.
4. Open the league homepage, Game Feed, and player pages.
5. Confirm test cells appear and are labelled.
6. Switch the admin setting back to `Public`.
7. Confirm every test cell disappears from public pages.

Test events remain stored for future testing, but public mode always filters them
out.

## Useful worker commands

```powershell
# Interactive Public/Test choice
npm run game-feed

# Continuous public collector
npm run game-feed:public

# Continuous test collector
npm run game-feed:test

# Insert sample test cells and exit
npm run game-feed:test:demo

# One public source poll and exit
npm run game-feed -- --mode public --once

# Override the source league for one run
npm run game-feed -- --mode test --source SLEEPER_LEAGUE_ID --demo --once

# Copy events only into one League Letter league during debugging
npm run game-feed -- --mode test --league LEAGUE_LETTER_UUID --demo --once
```

## Verifying Supabase

### Worker state

```sql
select
  feed_mode,
  source_sleeper_league_id,
  poll_seconds,
  season,
  week,
  worker_heartbeat_at,
  last_polled_at,
  last_success_at,
  last_error
from public.game_feed_source_state
order by feed_mode;
```

### Public and test event counts

```sql
select
  league_id,
  feed_mode,
  count(*) as event_count
from public.game_feed_events
group by league_id, feed_mode
order by league_id, feed_mode;
```

### Recent events

```sql
select
  id,
  feed_mode,
  description,
  primary_player_name,
  secondary_player_name,
  metadata ->> 'synthetic' as synthetic,
  detected_at
from public.game_feed_events
order by id desc
limit 30;
```

### Source baseline size

```sql
select
  feed_mode,
  source_sleeper_league_id,
  season,
  week,
  count(*) as tracked_players
from public.game_feed_source_snapshots
group by feed_mode, source_sleeper_league_id, season, week
order by season desc, week desc, feed_mode;
```

## Troubleshooting

### The worker says the source league ID is missing

Add this to `.env.local`:

```env
GAME_FEED_SOURCE_SLEEPER_LEAGUE_ID=YOUR_DEEP_SLEEPER_LEAGUE_ID
```

### Test cells were created but are not visible

The League Letter room's **Displayed data** setting must be set to `Test` under **Site Admin → Game Feed Control**.

### Test cells are visible publicly

Set the room back to **Public** under **Site Admin → Game Feed Control** and save. Public mode queries only rows
where `feed_mode = 'public'`.

### The first run creates no real plays

That is expected. The first run for each week and mode creates a baseline. A later
point change is needed before a real inferred event can be created.

### A player does not appear in the feed

Confirm that the player is rostered in the dedicated source Sleeper league and is
present in its weekly matchup response. Also confirm the player exists in the
League Letter `players` table so the worker can resolve the name, position, and NFL
team.

### `claim_game_feed_source_poll` does not exist

Run the latest complete `supabase/game-feed.sql` migration.

### The collector is marked offline

The website marks a worker offline when no heartbeat has arrived for roughly 35
seconds. Confirm the terminal is open and no error is shown.

### Sleeper does not return `players_points`

The worker stores one diagnostic copy of the source response and creates no fake
real event. Test demo cells can still be inserted in Test mode.

## Upgrading from the previous single-source version

No additional SQL migration is required for the live test controls, new-play counter, or quarterback image overlay. Keep the existing Game Feed tables and deploy the updated website/worker files.

## Add custom plays while the Test worker is running

Continuous Test mode now starts a local-only control page:

```text
http://127.0.0.1:3210
```

The page normally opens automatically after the worker starts. It is available
only on the PC running the worker and is not exposed to the internet.

1. Set the League Letter website display mode to **Test**.
2. Start `START_GAME_FEED_TEST.bat` or run `npm run game-feed:test`.
3. Keep the worker terminal open.
4. In the Test Play Console, search for the receiver, rusher, kicker, or other
   primary player.
5. Choose the play type, yards, and touchdown status.
6. For a reception, choose the quarterback who threw the pass.
7. Press **Add play to Test feed**.

The worker calculates the fantasy-point changes from the dedicated Sleeper
league's scoring settings. The point fields can be overridden for unusual test
cases. The new row is written directly to Supabase and appears on any open Game
Feed page through Supabase Realtime.

To use another localhost port:

```env
GAME_FEED_TEST_PORT=3211
```

or:

```powershell
npm run game-feed:test -- --test-port 3211
```

To prevent the browser from opening automatically:

```powershell
npm run game-feed:test -- --no-open-test-control
```

## New-play counter

The full Game Feed page now shows a sticky bar whenever new rows arrive or were
missed since the previous visit. It displays the exact number of unique new
plays. Realtime and the 15-second catch-up request share the same event-ID set,
so the same play cannot inflate the counter twice.

Press **View newest** to scroll to the newest cells and clear the counter.

## Quarterback picture overlay

For receptions and receiving touchdowns, the receiver's image now includes a
smaller picture of the quarterback in its bottom-right corner. The event icon
moves to the top-left. Rushes never receive the quarterback overlay, even if a
secondary-player value is present in older data.
