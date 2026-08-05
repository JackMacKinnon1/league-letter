# Mobile league-page and Game Feed update

## League homepage

- Prevents horizontal page overflow on narrow screens.
- Makes the featured-matchup heading, win-chance labels, team names, scores, and description responsive.
- Adds `min-width: 0`, truncation, and wrapping where long league/team text previously widened the layout.
- Reduces mobile padding and corner radius while preserving the desktop design.
- Makes the homepage Game Feed preview denser and keeps the Open Feed link visible.

## Full Game Feed

- Mobile cards use smaller player images, type, badges, padding, and gaps.
- Fantasy points stay at the upper-right instead of moving below the play details.
- Play descriptions are limited to two lines on mobile.
- Timestamps move into the compact score area on mobile.
- Filter controls use a compact two-column mobile grid.
- Desktop card sizing remains unchanged at the `sm` breakpoint and above.

No database migration or environment-variable changes are required.
