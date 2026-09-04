# Game Feed — true mock Sleeper testing

The Test worker can use either:

- `live` — read the real Sleeper API and store inferred rows with `feed_mode = test`.
- `test` — run a local endpoint that mimics Sleeper's league + matchup endpoints and let the normal worker infer plays from cumulative `players_points` changes.

The local mock is the default for `npm run game-feed:test`.

## Start true Test mode

1. In **Site Admin → Game Feed Control**, set the League Letter room's Website feed mode to **Test**.
2. Run:

```powershell
npm run game-feed:test
```

or double-click:

```text
START_GAME_FEED_TEST.bat
```

The worker starts:

```text
Control page: http://127.0.0.1:3210
Mock Sleeper API: http://127.0.0.1:3210/v1
Mock league id: league-letter-test
```

The worker polls the mock matchup endpoint every 5 seconds by default.

## How the Test console works now

The control page does **not** offer preset plays. It only lets you set the cumulative fantasy-point totals that a Sleeper matchup response would contain.

Example: to test a 10-yard completion when both players currently have 0 points:

```text
Dak Prescott     new total: 1.10
CeeDee Lamb      new total: 1.10
```

Publish those two totals in the same snapshot. The mock endpoint does not label this as a reception. It simply changes the two `players_points` values, and the ordinary Game Feed worker has to determine that the matching `+1.10 / +1.10` deltas represent a 10-yard completion.

This makes the local test much closer to the live Sleeper path.

## Important: totals, not deltas

The number entered in the console is the player's **new cumulative fantasy-point total**, not the amount to add.

For example, if CeeDee already has `1.10` and catches another 5-yard pass, his next total should be:

```text
1.10 + 1.05 = 2.15
```

Set CeeDee to `2.15` and the quarterback to his corresponding new cumulative total in the same snapshot.

## What makes this a true pipeline test

When a point snapshot is published:

1. The mock endpoint registers any new players at `0` points.
2. The next matchup request exposes that zero-point baseline for new players.
3. A later matchup request applies the requested cumulative fantasy-point totals.
4. The normal worker sees only the before/after `players_points` values.
5. `inferGameFeedEvents()` decodes the score deltas.
6. Only the inferred event is written to Supabase.
7. The open League Letter site receives it through the normal Game Feed path.

The Test console itself never tells the worker what play happened.

## Useful scoring fingerprints

These are deltas. Add them to the player's existing cumulative total before entering the new value.

```text
10-yard completion          QB +1.10, receiver +1.10
5-yard passing TD           QB +11.05, receiver +11.05
10-yard rush                rusher +100.10
10-yard rushing TD          rusher +1100.10
Interception                QB -100, defense +100
Pick six                    QB -1100, defense +1100
QB sack                     QB -5, defense +5
Fumble lost                 player -210, defense +210
52-yard field goal          kicker +100.52
PAT made                    kicker +1
Safety                      defense +300
Blocked kick                defense +500 plus kicker miss code
2-point conversion          involved player(s) +2000
```

## Mock control endpoint

The browser console posts score snapshots to:

```text
POST http://127.0.0.1:3210/api/player-points
```

Payload shape:

```json
{
  "updates": [
    { "playerId": "QB_PLAYER_ID", "points": 1.10 },
    { "playerId": "WR_PLAYER_ID", "points": 1.10 }
  ],
  "description": "optional test note"
}
```

The note is only for the local console history and is never used by the inference engine.

## Source endpoint switch

Production:

```powershell
npm run game-feed:public
```

Equivalent explicit command:

```powershell
npm run game-feed -- --mode public --source-endpoint live --source SLEEPER_LEAGUE_ID
```

True local mock test:

```powershell
npm run game-feed -- --mode test --source-endpoint test --poll-seconds 5
```

Test-tagged rows while still reading real Sleeper:

```powershell
npm run game-feed:test:live -- --source SLEEPER_LEAGUE_ID
```

Environment variable equivalent:

```env
GAME_FEED_SOURCE_ENDPOINT=test
```

Other mock options:

```env
GAME_FEED_TEST_SOURCE_LEAGUE_ID=league-letter-test
GAME_FEED_TEST_PORT=3210
GAME_FEED_TEST_SEASON=2026
GAME_FEED_TEST_WEEK=1
```

## Reset Test session

Use **Reset Test session** in the local control page. It clears:

- the in-memory mock player totals;
- pending point snapshots;
- the Test source snapshots for `league-letter-test`;
- Test Game Feed events from that mock source;
- Test poll batches from that mock source.

Public events and the Public source baseline are untouched.

The mock Test worker also starts from a clean Test session automatically.
