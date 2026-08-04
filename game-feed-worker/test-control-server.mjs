import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import process from 'node:process'

const MAX_BODY_BYTES = 64 * 1024

export async function startTestControlServer({
  port = 3210,
  searchPlayers,
  createPlay,
  getStatus,
  openBrowser = true,
}) {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', `http://${request.headers.host || '127.0.0.1'}`)

      if (request.method === 'GET' && url.pathname === '/') {
        return sendHtml(response, controlPageHtml(port))
      }

      if (request.method === 'GET' && url.pathname === '/api/status') {
        return sendJson(response, 200, await getStatus())
      }

      if (request.method === 'GET' && url.pathname === '/api/players') {
        const query = String(url.searchParams.get('q') || '').trim()
        const players = query.length >= 1 ? await searchPlayers(query) : []
        return sendJson(response, 200, { players })
      }

      if (request.method === 'POST' && url.pathname === '/api/plays') {
        const payload = await readJsonBody(request)
        const result = await createPlay(payload)
        return sendJson(response, 201, result)
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
  if (openBrowser) openLocalUrl(url)

  return {
    url,
    close: () =>
      new Promise((resolve) => {
        server.close(() => resolve())
      }),
  }
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
    // The URL is also printed in the worker terminal, so opening is best-effort.
  }
}

function controlPageHtml(port) {
  return String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>League Letter Test Play Console</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: #09090b; color: #fafafa; }
    main { width: min(920px, calc(100% - 32px)); margin: 0 auto; padding: 36px 0 64px; }
    .eyebrow { color: #fbbf24; font-size: 12px; font-weight: 900; letter-spacing: .22em; text-transform: uppercase; }
    h1 { margin: 8px 0 6px; font-size: clamp(32px, 7vw, 58px); line-height: 1; }
    .lead { max-width: 720px; color: #a1a1aa; line-height: 1.6; }
    .status { margin-top: 22px; display: flex; flex-wrap: wrap; gap: 10px; }
    .pill { border: 1px solid #3f3f46; background: #18181b; border-radius: 999px; padding: 8px 12px; color: #d4d4d8; font-size: 13px; font-weight: 700; }
    .card { margin-top: 24px; border: 1px solid #27272a; background: #18181b; border-radius: 24px; padding: 24px; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
    .wide { grid-column: 1 / -1; }
    label { display: block; color: #d4d4d8; font-size: 13px; font-weight: 800; }
    input, select { width: 100%; margin-top: 8px; border: 1px solid #3f3f46; border-radius: 12px; background: #09090b; color: #fafafa; padding: 12px 13px; font: inherit; outline: none; }
    input:focus, select:focus { border-color: #34d399; box-shadow: 0 0 0 3px rgba(52, 211, 153, .12); }
    input[type="checkbox"] { width: auto; margin: 0; }
    .check { display: flex; align-items: center; gap: 10px; min-height: 46px; margin-top: 24px; }
    .search { position: relative; }
    .results { position: absolute; z-index: 5; top: calc(100% + 6px); left: 0; right: 0; display: none; max-height: 260px; overflow: auto; border: 1px solid #3f3f46; border-radius: 14px; background: #09090b; box-shadow: 0 18px 50px rgba(0,0,0,.5); }
    .results.open { display: block; }
    .result { width: 100%; display: flex; align-items: center; gap: 10px; border: 0; border-bottom: 1px solid #27272a; background: transparent; color: #fafafa; padding: 10px 12px; text-align: left; cursor: pointer; }
    .result:last-child { border-bottom: 0; }
    .result:hover { background: #18181b; }
    .avatar { width: 38px; height: 38px; flex: 0 0 auto; overflow: hidden; border: 1px solid #3f3f46; border-radius: 10px; background: #18181b; object-fit: cover; object-position: top; }
    .result small { display: block; color: #71717a; margin-top: 2px; }
    .selected { margin-top: 8px; min-height: 18px; color: #34d399; font-size: 12px; font-weight: 800; }
    .actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-top: 22px; }
    button.primary { border: 0; border-radius: 14px; background: #34d399; color: #052e24; padding: 13px 18px; font: inherit; font-weight: 900; cursor: pointer; }
    button.primary:hover { background: #6ee7b7; }
    button.primary:disabled { opacity: .55; cursor: wait; }
    .message { min-height: 22px; color: #a1a1aa; font-size: 14px; font-weight: 700; }
    .message.success { color: #6ee7b7; }
    .message.error { color: #fca5a5; }
    .hint { margin-top: 18px; border: 1px solid rgba(251,191,36,.2); background: rgba(251,191,36,.08); border-radius: 14px; padding: 12px 14px; color: #fde68a; font-size: 13px; line-height: 1.5; }
    .hidden { display: none !important; }
    @media (max-width: 700px) { .grid { grid-template-columns: 1fr; } .wide { grid-column: auto; } .card { padding: 18px; } }
  </style>
</head>
<body>
  <main>
    <div class="eyebrow">Local test controls</div>
    <h1>Add a live test play</h1>
    <p class="lead">This page exists only on your PC while the Test worker is running. Submit a play here and it is inserted into Supabase immediately, so any League Letter site set to Test mode receives it live.</p>

    <div class="status" id="statusPills">
      <span class="pill">Loading worker status…</span>
    </div>

    <section class="card">
      <div class="grid">
        <label>
          Play type
          <select id="playType">
            <option value="reception">Reception</option>
            <option value="rush">Rush</option>
            <option value="field_goal">Field goal</option>
            <option value="extra_point">Extra point</option>
            <option value="turnover">Turnover</option>
            <option value="custom">Custom scoring update</option>
          </select>
        </label>

        <label id="yardsField">
          Yards
          <input id="yards" type="number" step="1" value="25" />
        </label>

        <div class="search wide" id="primarySearch">
          <label for="primaryQuery">Player</label>
          <input id="primaryQuery" autocomplete="off" placeholder="Start typing a player name…" />
          <input id="primaryId" type="hidden" />
          <div class="selected" id="primarySelected"></div>
          <div class="results" id="primaryResults"></div>
        </div>

        <div class="search wide" id="secondarySearch">
          <label for="secondaryQuery">Quarterback who threw it</label>
          <input id="secondaryQuery" autocomplete="off" placeholder="Start typing the quarterback name…" />
          <input id="secondaryId" type="hidden" />
          <div class="selected" id="secondarySelected"></div>
          <div class="results" id="secondaryResults"></div>
        </div>

        <label class="check" id="touchdownField">
          <input id="touchdown" type="checkbox" />
          Touchdown
        </label>

        <label>
          Primary fantasy points <span style="color:#71717a">(optional override)</span>
          <input id="primaryDelta" type="number" step="0.01" placeholder="Calculated automatically" />
        </label>

        <label id="secondaryDeltaField">
          Quarterback fantasy points <span style="color:#71717a">(optional override)</span>
          <input id="secondaryDelta" type="number" step="0.01" placeholder="Calculated automatically" />
        </label>

        <label class="wide">
          Description <span style="color:#71717a">(optional)</span>
          <input id="description" placeholder="Example: 25-yard reception" />
        </label>
      </div>

      <div class="actions">
        <button class="primary" id="submitPlay" type="button">Add play to Test feed</button>
        <div class="message" id="message" aria-live="polite"></div>
      </div>

      <div class="hint">The quarterback picture is shown only for a reception or receiving touchdown. Rushes never receive a quarterback overlay.</div>
    </section>
  </main>

  <script>
    const state = {
      primary: null,
      secondary: null,
      searchTimers: new Map(),
    }

    const elements = Object.fromEntries([
      'playType','yardsField','yards','primarySearch','primaryQuery','primaryId','primarySelected','primaryResults',
      'secondarySearch','secondaryQuery','secondaryId','secondarySelected','secondaryResults','touchdownField','touchdown',
      'primaryDelta','secondaryDeltaField','secondaryDelta','description','submitPlay','message','statusPills'
    ].map((id) => [id, document.getElementById(id)]))

    initialize()

    async function initialize() {
      elements.playType.addEventListener('change', updateFormForPlayType)
      elements.submitPlay.addEventListener('click', submitPlay)
      bindPlayerSearch('primary')
      bindPlayerSearch('secondary')
      document.addEventListener('click', (event) => {
        if (!elements.primarySearch.contains(event.target)) elements.primaryResults.classList.remove('open')
        if (!elements.secondarySearch.contains(event.target)) elements.secondaryResults.classList.remove('open')
      })
      updateFormForPlayType()
      await loadStatus()
    }

    async function loadStatus() {
      try {
        const response = await fetch('/api/status', { cache: 'no-store' })
        const status = await response.json()
        elements.statusPills.innerHTML = [
          '<span class="pill">Mode: TEST</span>',
          '<span class="pill">Enabled feeds: ' + escapeHtml(String(status.enabledLeagueCount || 0)) + '</span>',
          '<span class="pill">Source week: ' + escapeHtml(String(status.week || '—')) + '</span>',
          '<span class="pill">Control port: ${port}</span>'
        ].join('')
      } catch {
        elements.statusPills.innerHTML = '<span class="pill">Worker is running, but status could not be loaded.</span>'
      }
    }

    function updateFormForPlayType() {
      const type = elements.playType.value
      const reception = type === 'reception'
      const hasYards = ['reception','rush','field_goal'].includes(type)
      const hasTouchdown = ['reception','rush'].includes(type)
      const customSecondary = type === 'custom'

      elements.yardsField.classList.toggle('hidden', !hasYards)
      elements.touchdownField.classList.toggle('hidden', !hasTouchdown)
      elements.secondarySearch.classList.toggle('hidden', !(reception || customSecondary))
      elements.secondaryDeltaField.classList.toggle('hidden', !(reception || customSecondary))

      const labels = {
        reception: 'Receiver', rush: 'Rusher', field_goal: 'Kicker', extra_point: 'Kicker',
        turnover: 'Player', custom: 'Primary player'
      }
      elements.primarySearch.querySelector('label').textContent = labels[type] || 'Player'
      elements.secondarySearch.querySelector('label').textContent = reception ? 'Quarterback who threw it' : 'Secondary player (optional)'

      if (!reception && !customSecondary) clearPlayer('secondary')
      if (!hasTouchdown) elements.touchdown.checked = false
    }

    function bindPlayerSearch(kind) {
      const input = elements[kind + 'Query']
      const results = elements[kind + 'Results']

      input.addEventListener('input', () => {
        clearTimeout(state.searchTimers.get(kind))
        state[kind] = null
        elements[kind + 'Id'].value = ''
        elements[kind + 'Selected'].textContent = ''
        const query = input.value.trim()
        if (!query) {
          results.classList.remove('open')
          return
        }
        state.searchTimers.set(kind, setTimeout(() => searchPlayers(kind, query), 180))
      })
    }

    async function searchPlayers(kind, query) {
      const results = elements[kind + 'Results']
      try {
        const response = await fetch('/api/players?q=' + encodeURIComponent(query), { cache: 'no-store' })
        const json = await response.json()
        const players = json.players || []
        results.innerHTML = ''
        for (const player of players) {
          const button = document.createElement('button')
          button.type = 'button'
          button.className = 'result'
          button.innerHTML = '<img class="avatar" src="' + escapeHtml(player.imageUrl || '') + '" alt="" />' +
            '<span><strong>' + escapeHtml(player.name) + '</strong><small>' +
            escapeHtml([player.team, player.position, player.id].filter(Boolean).join(' · ')) + '</small></span>'
          button.addEventListener('click', () => selectPlayer(kind, player))
          results.appendChild(button)
        }
        if (!players.length) results.innerHTML = '<div style="padding:12px;color:#71717a">No matching players.</div>'
        results.classList.add('open')
      } catch {
        results.innerHTML = '<div style="padding:12px;color:#fca5a5">Player search failed.</div>'
        results.classList.add('open')
      }
    }

    function selectPlayer(kind, player) {
      state[kind] = player
      elements[kind + 'Id'].value = player.id
      elements[kind + 'Query'].value = player.name
      elements[kind + 'Selected'].textContent = [player.team, player.position, player.id].filter(Boolean).join(' · ')
      elements[kind + 'Results'].classList.remove('open')
    }

    function clearPlayer(kind) {
      state[kind] = null
      elements[kind + 'Id'].value = ''
      elements[kind + 'Query'].value = ''
      elements[kind + 'Selected'].textContent = ''
      elements[kind + 'Results'].classList.remove('open')
    }

    async function submitPlay() {
      const type = elements.playType.value
      if (!state.primary) return showMessage('Choose the primary player first.', true)
      if (type === 'reception' && !state.secondary) return showMessage('Choose the quarterback who threw the pass.', true)

      elements.submitPlay.disabled = true
      showMessage('Adding play…')

      try {
        const payload = {
          playType: type,
          primaryPlayerId: state.primary.id,
          secondaryPlayerId: state.secondary?.id || null,
          yards: numberOrNull(elements.yards.value),
          touchdown: elements.touchdown.checked,
          primaryDelta: numberOrNull(elements.primaryDelta.value),
          secondaryDelta: numberOrNull(elements.secondaryDelta.value),
          description: elements.description.value.trim() || null,
        }

        const response = await fetch('/api/plays', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const json = await response.json()
        if (!response.ok) throw new Error(json.error || 'Could not add the play.')

        showMessage(json.message || 'Test play added.', false, true)
        elements.description.value = ''
        elements.primaryDelta.value = ''
        elements.secondaryDelta.value = ''
      } catch (error) {
        showMessage(error.message || String(error), true)
      } finally {
        elements.submitPlay.disabled = false
      }
    }

    function numberOrNull(value) {
      if (String(value).trim() === '') return null
      const number = Number(value)
      return Number.isFinite(number) ? number : null
    }

    function showMessage(text, isError = false, success = false) {
      elements.message.textContent = text
      elements.message.className = 'message' + (isError ? ' error' : success ? ' success' : '')
    }

    function escapeHtml(value) {
      return String(value).replace(/[&<>'"]/g, (character) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
      })[character])
    }
  </script>
</body>
</html>`
}
