# Game Feed mock data

This project includes a large, safe scroll-test seed for the Game Feed.

## Add the mock plays

1. Open Supabase.
2. Go to **SQL Editor → New query**.
3. Copy and run:

   `supabase/seed-game-feed-scroll-test.sql`

The script creates **750 test events per League Letter room**. It uses players already stored in `public.players`, so player photos, NFL-team filters, favourites, quarterback overlays, and fantasy-roster highlighting can all be exercised.

The rows are stored with `feed_mode = 'test'`. In League Letter, open **Site Admin → Game Feed** and set the room's Website feed mode to **Test**.

The feed will then demonstrate:

- automatic loading in groups of 25;
- the 250-play cap on one scroll page;
- the prompt to continue to play page 2;
- multiple NFL-team filters;
- positive and negative point changes;
- receptions with quarterback overlays;
- favourites and roster/opponent highlighting.

Running the seed again is safe. It first removes the earlier rows created by this seed, then creates a fresh set.

## Remove the mock plays

Run:

`supabase/clear-game-feed-scroll-test.sql`

The underlying SQL is:

```sql
delete from public.game_feed_events
where metadata ->> 'seed_source' = 'scroll_test_seed';
```

This deletes only the generated scroll-test events. It does not delete real plays or worker data.

After testing, change the Website feed mode back to **Public** from Site Admin.

## Completely erase every Game Feed record

Only use this when you intentionally want to erase real and test Game Feed history as well:

```sql
truncate table
  public.game_feed_events,
  public.game_feed_poll_batches,
  public.game_feed_player_snapshots,
  public.game_feed_source_snapshots
restart identity cascade;
```

This full wipe is not needed for normal mock-data cleanup.
