# League Letter — Low Score style redesign

This update is visual only. Existing league data, Supabase tables, Sleeper sync logic, game feed logic, rankings, articles, trades, drafts, transactions, and admin behavior were left in place.

## What changed

- Rebuilt the global visual system around the Low Score palette: deep navy background, layered blue panels, electric-blue actions, orange editorial accents, green live-state indicators, and compact borders/radii.
- Rebuilt the desktop/mobile navbar with a League Letter wordmark, live chip, signed-in user chip, site-admin state, and compact navigation.
- Rebuilt the public landing page as a sports-dashboard style hero with scoreboard/newsroom preview panels.
- Rebuilt the signed-in dashboard and league cards.
- Rebuilt login, signup, and Sleeper league import screens.
- Rebuilt the season/week selector to match the Low Score controls.
- Restyled legacy pages globally so league home, matchups, articles, teams, transactions, trade center, drafts, trophy room, profile, rankings, game feed, and site/league admin tools inherit the same design without changing their logic.
- Restyled all dropdowns/select controls so they no longer use the browser's default white select-arrow area.
- Added consistent table, scrollbar, focus, input, card, modal/popover, and loading/progress styling.

## Database

No new Supabase migration is required for this redesign.
