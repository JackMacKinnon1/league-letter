-- Safely removes only the scroll-test mock events.
-- Real Game Feed events, snapshots, and worker state are left untouched.

delete from public.game_feed_events
where metadata ->> 'seed_source' = 'scroll_test_seed';

-- Verification: should return 0.
select count(*) as remaining_scroll_test_rows
from public.game_feed_events
where metadata ->> 'seed_source' = 'scroll_test_seed';
