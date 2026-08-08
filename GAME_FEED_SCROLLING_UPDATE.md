# Game Feed scrolling update

The full Game Feed now uses its own fixed-height scroll panel instead of extending the entire page.

## Behaviour

- The feed loads 25 scoring plays at a time.
- Scrolling near the bottom automatically requests the next 25 older plays.
- The browser only requests rows older than the oldest visible event, so newly inserted live events do not break the infinite-scroll cursor.
- A maximum of 250 plays is displayed inside one feed page.
- After 250 plays, the feed shows a prompt to continue to the next group of up to 250 plays.
- Older feed pages include a Previous page button.
- Changing a team, play type, confidence, or favourites filter resets the feed to page 1.
- The feed panel uses overscroll containment so scrolling at its edges does not continue scrolling the surrounding page.

## API

`GET /api/league/:leagueId/game-feed` now also supports:

```text
before=<event id>&limit=25
```

This returns the next cursor-based batch in descending event order. No database migration is required.
