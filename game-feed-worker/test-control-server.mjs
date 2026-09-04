import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import process from 'node:process'
import {
  GAME_FEED_SCORING_PROFILE,
  ZERO_GAME_FEED_SCORING_KEYS,
} from './game-feed-scoring-profile.mjs'

const MAX_BODY_BYTES = 64 * 1024

export async function startTestControlServer({
  port = 3210,
  leagueId = 'league-letter-test',
  season = String(new Date().getUTCFullYear()),
  week = 1,
  searchPlayers,
  resolvePlayer,
  getWorkerStatus,
  resetWorkerState,
  openBrowser = true,
}) {
  const mock = createMockSleeperState({ leagueId, season, week })

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', `http://${request.headers.host || '127.0.0.1'}`)

      if (request.method === 'GET' && url.pathname === '/') {
        return sendHtml(response, controlPageHtml(port, leagueId))
      }

      if (request.method === 'GET' && url.pathname === '/api/status') {
        const worker = getWorkerStatus ? await getWorkerStatus() : {}
        return sendJson(response, 200, { ...worker, mock: mock.getStatus() })
      }

      if (request.method === 'GET' && url.pathname === '/api/players') {
        const query = String(url.searchParams.get('q') || '').trim()
        const players = query.length >= 1 ? await searchPlayers(query) : []
        return sendJson(response, 200, { players })
      }

      if (request.method === 'POST' && url.pathname === '/api/player-points') {
        const payload = await readJsonBody(request)
        const result = await buildAndQueuePointSnapshot({ payload, resolvePlayer, mock })
        return sendJson(response, 201, result)
      }

      // Helpful error for an old control-page tab left open after upgrading.
      if (request.method === 'POST' && url.pathname === '/api/plays') {
        return sendJson(response, 410, {
          error: 'Preset plays were removed from the Test console. Set player fantasy-point totals with /api/player-points instead.',
        })
      }

      if (request.method === 'POST' && url.pathname === '/api/reset') {
        mock.reset()
        if (resetWorkerState) await resetWorkerState({ clearEvents: true })
        return sendJson(response, 200, {
          message: 'Mock Sleeper points and Test feed history were reset.',
          mock: mock.getStatus(),
        })
      }

      const leagueMatch = url.pathname.match(/^\/v1\/league\/([^/]+)$/)
      if (request.method === 'GET' && leagueMatch) {
        if (decodeURIComponent(leagueMatch[1]) !== leagueId) {
          return sendJson(response, 404, { error: 'League not found.' })
        }
        return sendJson(response, 200, mock.getLeaguePayload())
      }

      const matchupsMatch = url.pathname.match(/^\/v1\/league\/([^/]+)\/matchups\/(\d+)$/)
      if (request.method === 'GET' && matchupsMatch) {
        if (decodeURIComponent(matchupsMatch[1]) !== leagueId) {
          return sendJson(response, 404, { error: 'League not found.' })
        }
        const requestedWeek = Number(matchupsMatch[2])
        return sendJson(response, 200, mock.pollMatchups(requestedWeek))
      }

      return sendJson(response, 404, { error: 'Not found.' })
    } catch (error) {
      return sendJson(response, 400, {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  })

  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => resolve())
  })

  const url = `http://127.0.0.1:${port}`
  const apiBaseUrl = `${url}/v1`
  if (openBrowser) openLocalUrl(url)

  return {
    url,
    apiBaseUrl,
    getStatus: () => mock.getStatus(),
    queuePointSnapshot: (payload) => buildAndQueuePointSnapshot({ payload, resolvePlayer, mock }),
    reset: () => mock.reset(),
    close: () =>
      new Promise((resolve) => {
        server.close(() => resolve())
      }),
  }
}

export function createMockSleeperState({
  leagueId = 'league-letter-test',
  season = String(new Date().getUTCFullYear()),
  week = 1,
} = {}) {
  const scoringSettings = createSleeperStyleScoringSettings()
  const players = new Map()
  const queue = []
  const history = []
  let revision = 0
  let matchupPollCount = 0
  let lastPollAction = 'waiting'

  addBaselineSentinel()

  function addBaselineSentinel() {
    players.set('LL_TEST_BASELINE', {
      id: 'LL_TEST_BASELINE',
      name: 'League Letter Test Baseline',
      position: null,
      team: null,
      rosterId: 1,
      points: 0,
      served: true,
    })
  }

  function registerPlayer(player) {
    if (!player?.id) throw new Error('Mock player is missing an id.')
    const id = String(player.id)
    const existing = players.get(id)
    if (existing) return existing

    const normalized = {
      id,
      name: player.name || player.full_name || id,
      position: player.position || null,
      team: player.team || null,
      rosterId: isDefensePlayer(player) ? 2 : 1,
      points: 0,
      served: false,
    }
    players.set(id, normalized)
    return normalized
  }

  function queuePointSnapshot(snapshot) {
    if (!Array.isArray(snapshot?.updates) || snapshot.updates.length === 0) {
      throw new Error('Add at least one player point total.')
    }

    const updates = snapshot.updates.map((update) => {
      const player = registerPlayer(update.player)
      const points = Number(update.points)
      if (!Number.isFinite(points)) throw new Error(`Invalid fantasy-point total for ${player.name}.`)
      return { player, points: round(points) }
    })

    const item = {
      id: snapshot.id || `points-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      description: String(snapshot.description || '').trim() || 'Fantasy-point snapshot',
      queuedAt: new Date().toISOString(),
      updates,
    }
    queue.push(item)

    return {
      queuePosition: queue.length,
      pendingCount: queue.length,
      snapshot: summarizePendingSnapshot(item),
    }
  }

  function pollMatchups(requestedWeek = week) {
    matchupPollCount += 1

    const unserved = [...players.values()].filter((player) => !player.served)
    if (unserved.length) {
      for (const player of unserved) player.served = true
      lastPollAction = `baseline:${unserved.length}`
    } else if (queue.length) {
      const snapshot = queue.shift()
      const changes = applyPointTargets(snapshot.updates)
      revision += 1
      lastPollAction = `applied:${snapshot.id}`
      history.unshift({
        id: snapshot.id,
        description: snapshot.description,
        appliedAt: new Date().toISOString(),
        changes,
      })
      if (history.length > 20) history.length = 20
    } else {
      lastPollAction = 'no_change'
    }

    return buildMatchupsPayload(Number.isFinite(requestedWeek) ? requestedWeek : week)
  }

  function applyPointTargets(updates) {
    const changes = []
    for (const update of updates) {
      const player = players.get(String(update.player.id)) || registerPlayer(update.player)
      const before = round(player.points)
      const after = round(update.points)
      player.points = after
      changes.push({
        player,
        before,
        after,
        delta: round(after - before),
      })
    }
    return changes
  }

  function buildMatchupsPayload() {
    if (!players.size) return []

    const byRoster = new Map()
    for (const player of players.values()) {
      if (!byRoster.has(player.rosterId)) byRoster.set(player.rosterId, [])
      byRoster.get(player.rosterId).push(player)
    }

    return [...byRoster.entries()]
      .sort(([a], [b]) => a - b)
      .map(([rosterId, rosterPlayers]) => {
        const playersPoints = Object.fromEntries(
          rosterPlayers.map((player) => [player.id, round(player.points)])
        )
        const playerIds = rosterPlayers.map((player) => player.id)
        return {
          roster_id: rosterId,
          matchup_id: 1,
          points: round(Object.values(playersPoints).reduce((sum, value) => sum + Number(value), 0)),
          custom_points: null,
          starters: playerIds,
          starters_points: playerIds.map((id) => playersPoints[id]),
          players: playerIds,
          players_points: playersPoints,
        }
      })
  }

  function getLeaguePayload() {
    return {
      league_id: leagueId,
      name: 'League Letter Mock Sleeper Feed',
      sport: 'nfl',
      season: String(season),
      season_type: 'regular',
      status: 'in_season',
      total_rosters: 2,
      settings: { week: Number(week) },
      scoring_settings: scoringSettings,
      roster_positions: ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'],
    }
  }

  function getStatus() {
    return {
      leagueId,
      season: String(season),
      week: Number(week),
      revision,
      matchupPollCount,
      registeredPlayerCount: Math.max(players.size - 1, 0),
      pendingCount: queue.length,
      lastPollAction,
      players: [...players.values()]
        .filter((player) => player.id !== 'LL_TEST_BASELINE')
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((player) => ({
          id: player.id,
          name: player.name,
          position: player.position,
          team: player.team,
          points: round(player.points),
          served: player.served,
        })),
      pending: queue.slice(0, 10).map(summarizePendingSnapshot),
      recentApplied: history.slice(0, 10).map(summarizeAppliedSnapshot),
    }
  }

  function reset() {
    players.clear()
    queue.length = 0
    history.length = 0
    revision = 0
    matchupPollCount = 0
    lastPollAction = 'waiting'
    addBaselineSentinel()
  }

  return {
    scoringSettings,
    registerPlayer,
    queuePointSnapshot,
    pollMatchups,
    getLeaguePayload,
    getStatus,
    reset,
  }
}

export async function buildAndQueuePointSnapshot({ payload, resolvePlayer, mock }) {
  const rawUpdates = Array.isArray(payload?.updates) ? payload.updates : []
  if (!rawUpdates.length) throw new Error('Add at least one player and fantasy-point total.')
  if (rawUpdates.length > 50) throw new Error('A single snapshot can update at most 50 players.')

  const seen = new Set()
  const updates = []
  for (const raw of rawUpdates) {
    const playerId = String(raw?.playerId || '').trim()
    if (!playerId) throw new Error('Every point update needs a player.')
    if (seen.has(playerId)) throw new Error(`Player ${playerId} was included more than once.`)
    seen.add(playerId)

    const points = Number(raw?.points)
    if (!Number.isFinite(points)) throw new Error(`Enter a valid fantasy-point total for ${playerId}.`)
    const player = await resolvePlayer(playerId)
    if (!player) throw new Error(`Could not resolve player ${playerId}.`)
    updates.push({ player, points: round(points) })
  }

  const description = String(payload?.description || '').trim() || 'Fantasy-point snapshot'
  const queued = mock.queuePointSnapshot({ updates, description })
  return {
    message: `Point snapshot queued for ${updates.length} player${updates.length === 1 ? '' : 's'}. The normal worker will infer the play from the next Sleeper-style score change.`,
    ...queued,
  }
}

function createSleeperStyleScoringSettings() {
  const settings = { ...GAME_FEED_SCORING_PROFILE }
  settings.int_ret_td = settings.pass_int_td
  settings.bonus_rush_att = settings.rush_att
  delete settings.pass_int_td
  delete settings.rush_att
  for (const key of ZERO_GAME_FEED_SCORING_KEYS) {
    if (!(key in settings)) settings[key] = 0
  }
  return settings
}

function isDefensePlayer(player) {
  const position = String(player?.position || '').toUpperCase()
  return position === 'DEF' || position === 'DST' || /^[A-Z]{2,3}$/.test(String(player?.id || ''))
}

function summarizePendingSnapshot(snapshot) {
  return {
    id: snapshot.id,
    description: snapshot.description,
    queuedAt: snapshot.queuedAt || null,
    updates: (snapshot.updates || []).map((update) => ({
      playerId: update.player.id,
      playerName: update.player.name,
      points: round(update.points),
    })),
  }
}

function summarizeAppliedSnapshot(snapshot) {
  return {
    id: snapshot.id,
    description: snapshot.description,
    appliedAt: snapshot.appliedAt || null,
    changes: (snapshot.changes || []).map((change) => ({
      playerId: change.player.id,
      playerName: change.player.name,
      before: round(change.before),
      after: round(change.after),
      delta: round(change.delta),
    })),
  }
}

function round(value) {
  return Math.round(Number(value) * 1000) / 1000
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let bytes = 0

    request.on('data', (chunk) => {
      bytes += chunk.length
      if (bytes > MAX_BODY_BYTES) {
        reject(new Error('Request was too large.'))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })

    request.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8')
        resolve(text ? JSON.parse(text) : {})
      } catch {
        reject(new Error('Invalid JSON request.'))
      }
    })

    request.on('error', reject)
  })
}

function sendHtml(response, html) {
  response.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'self' data: https://sleepercdn.com; connect-src 'self'",
  })
  response.end(html)
}

function sendJson(response, status, value) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  response.end(JSON.stringify(value))
}

function openLocalUrl(url) {
  try {
    if (process.platform === 'win32') {
      const child = spawn('cmd', ['/c', 'start', '', url], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      })
      child.on('error', () => {})
      child.unref()
      return
    }

    const command = process.platform === 'darwin' ? 'open' : 'xdg-open'
    const child = spawn(command, [url], { detached: true, stdio: 'ignore' })
    child.on('error', () => {})
    child.unref()
  } catch {
    // Best effort only; the URL is printed in the worker terminal too.
  }
}

function controlPageHtml(port, leagueId) {
  return String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>League Letter Mock Sleeper Points</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: #09090b; color: #fafafa; }
    main { width: min(1120px, calc(100% - 32px)); margin: 0 auto; padding: 34px 0 64px; }
    .eyebrow { color: #2dd4bf; font-size: 12px; font-weight: 900; letter-spacing: .2em; text-transform: uppercase; }
    h1 { margin: 8px 0; font-size: clamp(32px, 7vw, 56px); line-height: 1; }
    h2 { margin: 0 0 8px; font-size: 20px; }
    .lead { max-width: 900px; color: #a1a1aa; line-height: 1.6; }
    code { color: #99f6e4; }
    .status { margin-top: 20px; display: flex; flex-wrap: wrap; gap: 9px; }
    .pill { border: 1px solid #3f3f46; background: #18181b; border-radius: 999px; padding: 8px 11px; color: #d4d4d8; font-size: 12px; font-weight: 800; }
    .card { margin-top: 22px; border: 1px solid #27272a; background: #18181b; border-radius: 22px; padding: 22px; }
    .subtle { margin: 0 0 16px; color: #71717a; font-size: 14px; line-height: 1.5; }
    label { display: block; color: #d4d4d8; font-size: 13px; font-weight: 800; }
    input { width: 100%; margin-top: 8px; border: 1px solid #3f3f46; border-radius: 12px; background: #09090b; color: #fafafa; padding: 12px 13px; font: inherit; outline: none; }
    input:focus { border-color: #2dd4bf; box-shadow: 0 0 0 3px rgba(45,212,191,.12); }
    .search { position: relative; max-width: 720px; }
    .results { position: absolute; z-index: 10; top: calc(100% + 6px); left: 0; right: 0; display: none; max-height: 300px; overflow: auto; border: 1px solid #3f3f46; border-radius: 14px; background: #09090b; box-shadow: 0 18px 50px rgba(0,0,0,.5); }
    .results.open { display: block; }
    .result { width: 100%; display: flex; align-items: center; gap: 10px; border: 0; border-bottom: 1px solid #27272a; background: transparent; color: #fafafa; padding: 10px 12px; text-align: left; cursor: pointer; }
    .result:last-child { border-bottom: 0; }
    .result:hover { background: #18181b; }
    .avatar { width: 40px; height: 40px; flex: 0 0 auto; border: 1px solid #3f3f46; border-radius: 10px; background: #18181b; object-fit: cover; object-position: top; }
    .result small, .player-meta { display: block; color: #71717a; margin-top: 2px; font-size: 12px; }
    .score-editor { margin-top: 18px; display: grid; gap: 10px; }
    .score-row { display: grid; grid-template-columns: minmax(220px, 1.7fr) 120px 170px 120px 42px; gap: 12px; align-items: center; border: 1px solid #27272a; border-radius: 14px; background: #09090b; padding: 12px; }
    .player-cell { display: flex; align-items: center; gap: 11px; min-width: 0; }
    .player-name { font-weight: 900; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .score-label { color: #71717a; font-size: 10px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; }
    .current-points, .delta { margin-top: 4px; font-variant-numeric: tabular-nums; font-size: 17px; font-weight: 900; }
    .delta.positive { color: #5eead4; }
    .delta.negative { color: #fca5a5; }
    .target-input { margin: 0; font-variant-numeric: tabular-nums; }
    .remove { width: 38px; height: 38px; padding: 0; border-radius: 10px; background: #27272a; color: #a1a1aa; font-size: 20px; }
    .remove:hover { color: #fafafa; background: #3f3f46; }
    .actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-top: 20px; }
    button { border: 0; border-radius: 13px; padding: 12px 16px; font: inherit; font-weight: 900; cursor: pointer; }
    button.primary { background: #2dd4bf; color: #042f2e; }
    button.secondary { background: #27272a; color: #fafafa; }
    button.danger { background: #3f1d24; color: #fecdd3; }
    button:disabled { opacity: .55; cursor: wait; }
    .message { min-height: 22px; color: #a1a1aa; font-size: 14px; font-weight: 700; }
    .message.success { color: #5eead4; }
    .message.error { color: #fca5a5; }
    .hint { margin-top: 16px; border: 1px solid rgba(45,212,191,.2); background: rgba(45,212,191,.07); border-radius: 13px; padding: 12px 14px; color: #99f6e4; font-size: 13px; line-height: 1.55; }
    .queue { display: grid; gap: 9px; }
    .queue-row { border: 1px solid #27272a; border-radius: 12px; background: #09090b; padding: 11px 12px; }
    .queue-row strong { display: block; }
    .queue-row small { color: #a1a1aa; line-height: 1.5; }
    .empty { color: #71717a; font-size: 14px; }
    .points-table { display: grid; gap: 8px; }
    .points-row { display: flex; justify-content: space-between; gap: 18px; border-bottom: 1px solid #27272a; padding: 9px 2px; }
    .points-row:last-child { border-bottom: 0; }
    .points-row span:last-child { font-weight: 900; font-variant-numeric: tabular-nums; }
    .baseline { color: #fbbf24; font-size: 11px; font-weight: 800; margin-left: 8px; }
    .cheats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 18px; margin-top: 10px; color: #a1a1aa; font-size: 12px; }
    .cheats code { white-space: nowrap; }
    @media (max-width: 820px) {
      .score-row { grid-template-columns: 1fr 1fr 42px; }
      .player-cell { grid-column: 1 / -1; }
      .delta-cell { display: none; }
      .cheats { grid-template-columns: 1fr; }
    }
    @media (max-width: 520px) {
      .score-row { grid-template-columns: 1fr 42px; }
      .current-cell { grid-column: 1 / 2; }
      .target-cell { grid-column: 1 / 2; }
      .remove { grid-column: 2; grid-row: 2; }
      .card { padding: 17px; }
    }
  </style>
</head>
<body>
  <main>
    <div class="eyebrow">True pipeline testing</div>
    <h1>Mock Sleeper Points</h1>
    <p class="lead">This console does <strong>not</strong> know what play happened. You only set the cumulative fantasy points that Sleeper would return in <code>players_points</code>. The normal League Letter worker compares snapshots and has to infer the play itself.</p>
    <p class="lead">Mock API: <code>http://127.0.0.1:${port}/v1</code> · League: <code>${escapeHtml(leagueId)}</code></p>
    <div class="status" id="statusPills"></div>

    <section class="card">
      <h2>Set player fantasy points</h2>
      <p class="subtle">Search for every player involved in the same scoring update, enter each player's <strong>new cumulative total</strong>, then publish them together. Example: to simulate a 10-yard completion from 0, set both QB and receiver to <code>1.10</code>.</p>

      <div class="search" id="playerSearch">
        <label for="playerQuery">Add player or D/ST</label>
        <input id="playerQuery" autocomplete="off" placeholder="Start typing a player or defense…" />
        <div class="results" id="playerResults"></div>
      </div>

      <div class="score-editor" id="scoreEditor">
        <div class="empty">No players selected.</div>
      </div>

      <label style="margin-top:16px;max-width:720px">Snapshot note <span style="color:#71717a">(optional, never used for inference)</span>
        <input id="description" placeholder="e.g. test update 1" />
      </label>

      <div class="actions">
        <button class="primary" id="publishPoints" type="button">Publish fantasy points</button>
        <button class="secondary" id="clearSelected" type="button">Clear selected</button>
        <button class="danger" id="resetTest" type="button">Reset Test session</button>
        <div class="message" id="message" aria-live="polite"></div>
      </div>

      <div class="hint">
        New players are exposed at <strong>0 points for one matchup poll</strong> first, so the worker gets a real baseline. Your requested totals are then exposed on the next poll. Set all players from one play in a single snapshot so the worker sees their deltas at the same time.
        <div class="cheats">
          <span>10-yard completion: <code>QB +1.10 · WR +1.10</code></span>
          <span>5-yard pass TD: <code>QB +11.05 · WR +11.05</code></span>
          <span>10-yard rush: <code>RB +100.10</code></span>
          <span>INT: <code>QB -100 · DEF +100</code></span>
          <span>Pick six: <code>QB -1100 · DEF +1100</code></span>
          <span>52-yard FG: <code>K +100.52</code></span>
        </div>
      </div>
    </section>

    <section class="card">
      <h2>Current mock Sleeper <code>players_points</code></h2>
      <p class="subtle">These are the exact cumulative totals returned by the mock matchup endpoint right now.</p>
      <div class="points-table" id="currentPoints"><div class="empty">No test players yet.</div></div>
    </section>

    <section class="card">
      <h2>Pending point snapshots</h2>
      <div class="queue" id="pendingQueue"><div class="empty">No point snapshots queued.</div></div>
    </section>

    <section class="card">
      <h2>Recently exposed to the worker</h2>
      <div class="queue" id="recentApplied"><div class="empty">Nothing exposed yet.</div></div>
    </section>
  </main>

  <script>
    const state = {
      selected: new Map(),
      mockPlayers: new Map(),
      searchTimer: null,
    }

    const ids = ['playerSearch','playerQuery','playerResults','scoreEditor','description','publishPoints','clearSelected',
      'resetTest','message','statusPills','currentPoints','pendingQueue','recentApplied']
    const elements = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]))

    initialize()

    function initialize() {
      bindPlayerSearch()
      elements.publishPoints.addEventListener('click', publishPoints)
      elements.clearSelected.addEventListener('click', () => {
        state.selected.clear()
        renderScoreEditor()
      })
      elements.resetTest.addEventListener('click', resetTest)
      document.addEventListener('click', (event) => {
        if (!elements.playerSearch.contains(event.target)) elements.playerResults.classList.remove('open')
      })
      loadStatus()
      setInterval(loadStatus, 1000)
    }

    function bindPlayerSearch() {
      elements.playerQuery.addEventListener('input', () => {
        clearTimeout(state.searchTimer)
        const query = elements.playerQuery.value.trim()
        if (!query) {
          elements.playerResults.classList.remove('open')
          return
        }
        state.searchTimer = setTimeout(() => searchPlayers(query), 160)
      })
    }

    async function searchPlayers(query) {
      try {
        const response = await fetch('/api/players?q=' + encodeURIComponent(query), { cache: 'no-store' })
        const json = await response.json()
        const players = json.players || []
        elements.playerResults.innerHTML = ''
        for (const player of players) {
          const button = document.createElement('button')
          button.type = 'button'
          button.className = 'result'
          button.innerHTML = '<img class="avatar" src="' + escapeHtml(player.imageUrl || '') + '" alt="" />' +
            '<span><strong>' + escapeHtml(player.name) + '</strong><small>' +
            escapeHtml([player.team, player.position, player.id].filter(Boolean).join(' · ')) + '</small></span>'
          button.addEventListener('click', () => addPlayer(player))
          elements.playerResults.appendChild(button)
        }
        if (!players.length) elements.playerResults.innerHTML = '<div style="padding:12px;color:#71717a">No matching players.</div>'
        elements.playerResults.classList.add('open')
      } catch {
        elements.playerResults.innerHTML = '<div style="padding:12px;color:#fca5a5">Search failed.</div>'
        elements.playerResults.classList.add('open')
      }
    }

    function addPlayer(player) {
      const existing = state.mockPlayers.get(String(player.id))
      const current = Number(existing?.points || 0)
      const prior = state.selected.get(String(player.id))
      state.selected.set(String(player.id), prior || {
        player,
        current,
        target: current,
      })
      elements.playerQuery.value = ''
      elements.playerResults.classList.remove('open')
      renderScoreEditor()
    }

    function renderScoreEditor() {
      if (!state.selected.size) {
        elements.scoreEditor.innerHTML = '<div class="empty">No players selected.</div>'
        return
      }

      elements.scoreEditor.innerHTML = ''
      for (const [id, entry] of state.selected.entries()) {
        const row = document.createElement('div')
        row.className = 'score-row'
        row.innerHTML =
          '<div class="player-cell"><img class="avatar" src="' + escapeHtml(entry.player.imageUrl || '') + '" alt="" />' +
            '<div style="min-width:0"><div class="player-name">' + escapeHtml(entry.player.name) + '</div>' +
            '<div class="player-meta">' + escapeHtml([entry.player.team, entry.player.position, entry.player.id].filter(Boolean).join(' · ')) + '</div></div></div>' +
          '<div class="current-cell"><div class="score-label">Current</div><div class="current-points" data-current="' + escapeHtml(id) + '">' + formatPoints(entry.current) + '</div></div>' +
          '<div class="target-cell"><div class="score-label">New total</div><input class="target-input" data-target="' + escapeHtml(id) + '" type="number" step="0.01" value="' + escapeHtml(String(entry.target)) + '" /></div>' +
          '<div class="delta-cell"><div class="score-label">Delta</div><div class="delta" data-delta="' + escapeHtml(id) + '">' + signed(entry.target - entry.current) + '</div></div>' +
          '<button class="remove" data-remove="' + escapeHtml(id) + '" type="button" aria-label="Remove">×</button>'
        elements.scoreEditor.appendChild(row)
      }

      for (const input of elements.scoreEditor.querySelectorAll('[data-target]')) {
        input.addEventListener('input', () => {
          const id = input.getAttribute('data-target')
          const entry = state.selected.get(id)
          if (!entry) return
          const n = Number(input.value)
          entry.target = Number.isFinite(n) ? n : NaN
          updateDelta(id)
        })
      }
      for (const button of elements.scoreEditor.querySelectorAll('[data-remove]')) {
        button.addEventListener('click', () => {
          state.selected.delete(button.getAttribute('data-remove'))
          renderScoreEditor()
        })
      }
      for (const id of state.selected.keys()) updateDelta(id)
    }

    function updateDelta(id) {
      const entry = state.selected.get(id)
      const element = elements.scoreEditor.querySelector('[data-delta="' + cssEscape(id) + '"]')
      if (!entry || !element) return
      const delta = Number.isFinite(entry.target) ? entry.target - entry.current : NaN
      element.textContent = Number.isFinite(delta) ? signed(delta) : '—'
      element.classList.toggle('positive', Number.isFinite(delta) && delta > 0)
      element.classList.toggle('negative', Number.isFinite(delta) && delta < 0)
    }

    async function publishPoints() {
      if (!state.selected.size) return showMessage('Add at least one player.', true)
      const updates = []
      for (const entry of state.selected.values()) {
        if (!Number.isFinite(entry.target)) return showMessage('Every selected player needs a valid new total.', true)
        if (Math.abs(entry.target - entry.current) >= 0.0005) {
          updates.push({ playerId: entry.player.id, points: entry.target })
        }
      }
      if (!updates.length) return showMessage('Change at least one fantasy-point total first.', true)

      elements.publishPoints.disabled = true
      showMessage('Queueing point snapshot…')
      try {
        const response = await fetch('/api/player-points', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates, description: elements.description.value.trim() || null }),
        })
        const json = await response.json()
        if (!response.ok) throw new Error(json.error || 'Could not queue the point snapshot.')
        showMessage(json.message || 'Point snapshot queued.', false, true)
        elements.description.value = ''
        await loadStatus()
      } catch (error) {
        showMessage(error.message || String(error), true)
      } finally {
        elements.publishPoints.disabled = false
      }
    }

    async function resetTest() {
      if (!confirm('Reset all mock points and delete Test feed events created by this mock source?')) return
      elements.resetTest.disabled = true
      try {
        const response = await fetch('/api/reset', { method: 'POST' })
        const json = await response.json()
        if (!response.ok) throw new Error(json.error || 'Reset failed.')
        state.selected.clear()
        state.mockPlayers.clear()
        renderScoreEditor()
        showMessage(json.message, false, true)
        await loadStatus()
      } catch (error) {
        showMessage(error.message || String(error), true)
      } finally {
        elements.resetTest.disabled = false
      }
    }

    async function loadStatus() {
      try {
        const response = await fetch('/api/status', { cache: 'no-store' })
        const status = await response.json()
        const mock = status.mock || {}
        state.mockPlayers = new Map((mock.players || []).map((player) => [String(player.id), player]))

        for (const [id, entry] of state.selected.entries()) {
          const latest = state.mockPlayers.get(id)
          if (!latest) continue
          entry.current = Number(latest.points || 0)
          const currentEl = elements.scoreEditor.querySelector('[data-current="' + cssEscape(id) + '"]')
          if (currentEl) currentEl.textContent = formatPoints(entry.current)
          updateDelta(id)
        }

        elements.statusPills.innerHTML = [
          '<span class="pill">Worker: ' + escapeHtml(String(status.mode || 'TEST').toUpperCase()) + '</span>',
          '<span class="pill">Source: MOCK SLEEPER</span>',
          '<span class="pill">Enabled feeds: ' + escapeHtml(String(status.enabledLeagueCount || 0)) + '</span>',
          '<span class="pill">Week: ' + escapeHtml(String(mock.week || status.week || '—')) + '</span>',
          '<span class="pill">Polls: ' + escapeHtml(String(mock.matchupPollCount || 0)) + '</span>',
          '<span class="pill">Players: ' + escapeHtml(String(mock.registeredPlayerCount || 0)) + '</span>',
          '<span class="pill">Queued snapshots: ' + escapeHtml(String(mock.pendingCount || 0)) + '</span>',
          '<span class="pill">Revision: ' + escapeHtml(String(mock.revision || 0)) + '</span>'
        ].join('')

        renderCurrentPoints(mock.players || [])
        renderPending(elements.pendingQueue, mock.pending || [])
        renderApplied(elements.recentApplied, mock.recentApplied || [])
      } catch {
        elements.statusPills.innerHTML = '<span class="pill">Status unavailable</span>'
      }
    }

    function renderCurrentPoints(players) {
      if (!players.length) {
        elements.currentPoints.innerHTML = '<div class="empty">No test players yet.</div>'
        return
      }
      elements.currentPoints.innerHTML = players.map((player) =>
        '<div class="points-row"><span><strong>' + escapeHtml(player.name) + '</strong>' +
        '<span class="player-meta">' + escapeHtml([player.team, player.position].filter(Boolean).join(' · ')) +
        (!player.served ? '<span class="baseline">awaiting baseline poll</span>' : '') + '</span></span>' +
        '<span>' + formatPoints(player.points) + '</span></div>'
      ).join('')
    }

    function renderPending(container, rows) {
      if (!rows.length) {
        container.innerHTML = '<div class="empty">No point snapshots queued.</div>'
        return
      }
      container.innerHTML = rows.map((row) => {
        const updates = (row.updates || []).map((update) => escapeHtml((update.playerName || update.playerId) + ' → ' + formatPoints(update.points))).join(' · ')
        return '<div class="queue-row"><strong>' + escapeHtml(row.description || 'Fantasy-point snapshot') + '</strong><small>' + updates + '</small></div>'
      }).join('')
    }

    function renderApplied(container, rows) {
      if (!rows.length) {
        container.innerHTML = '<div class="empty">Nothing exposed yet.</div>'
        return
      }
      container.innerHTML = rows.map((row) => {
        const changes = (row.changes || []).map((change) =>
          escapeHtml((change.playerName || change.playerId) + ' ' + formatPoints(change.before) + ' → ' + formatPoints(change.after) + ' (' + signed(change.delta) + ')')
        ).join(' · ')
        return '<div class="queue-row"><strong>' + escapeHtml(row.description || 'Fantasy-point snapshot') + '</strong><small>' + changes + '</small></div>'
      }).join('')
    }

    function signed(value) {
      const n = Number(value)
      if (!Number.isFinite(n)) return '—'
      return (n >= 0 ? '+' : '') + n.toFixed(2)
    }
    function formatPoints(value) {
      const n = Number(value)
      return Number.isFinite(n) ? n.toFixed(2) : '0.00'
    }
    function showMessage(text, isError = false, success = false) {
      elements.message.textContent = text
      elements.message.className = 'message' + (isError ? ' error' : success ? ' success' : '')
    }
    function cssEscape(value) {
      if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(String(value))
      return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&')
    }
    function escapeHtml(value) {
      return String(value).replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'})[c])
    }
  </script>
</body>
</html>`
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
  })[character])
}
