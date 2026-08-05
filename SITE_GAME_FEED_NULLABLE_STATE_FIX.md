# Site Game Feed nullable-state type fix

`SiteGameFeedControl.tsx` now separates the nullable database response shape from the normalized client-state shape.

- `LeagueSetting` accepts `null` values returned by Supabase.
- `NormalizedLeagueSetting` requires a real boolean and `public | test` mode.
- `normalizeLeagues()` converts database values before they enter React state.
- `updateLeague()` and `updateAll()` only accept normalized UI values.

This resolves the Next.js type-check failure where a nullable patch could have been merged into non-nullable React state.
