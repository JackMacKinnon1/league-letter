# Pagination and Game Feed filters

## Database pagination

The application no longer loads unbounded collections from Supabase. Large user-facing collections use database-side `.range(...)` pagination, including:

- League article manager: 8 per page
- Breaking News history manager: 6 per page
- League ticker manager: 8 per page
- Full Game Feed: 25 per page
- Site Admin Game Feed room list: 20 per page
- Trade Center: 50 trades per page
- Transaction log: 10 transactions per page
- Player-page recent feed history: 10 events per page

Small, naturally bounded reference collections such as the teams in one fantasy league, one week's matchups, active ticker preview items, and season selectors are capped with explicit limits.

## Game Feed filtering

The full Game Feed supports server-side filters for:

- Play category
- Confidence level
- NFL team
- Favourite players

Player favourites are stored in the browser per League Letter room. Use the star beside a player or quarterback, then enable `Favourites only`.

## Matchup-aware colours

The feed tries to identify the signed-in user's Sleeper roster through `league_members.sleeper_user_id`. If it cannot, choose `My fantasy team` once. That choice is stored in the browser for the room.

- Green means the event has a positive net effect for the selected fantasy team.
- Red means the event has a positive net effect for the current opponent.
- A negative score for one of the user's players is red.
- A positive score for an opponent's player is red.
- Passing plays account for both the receiver and quarterback when either belongs to the fantasy matchup.

The league homepage Game Feed preview also uses the saved/automatically detected roster for the same colour treatment.

No new Supabase migration is required for this update.
