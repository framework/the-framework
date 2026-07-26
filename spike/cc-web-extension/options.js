// Where the token is set. It lives in extension storage rather than in the page, so nothing on
// claude.ai can read the secret that talks to the daemon.

const DEFAULT_DAEMON = 'http://localhost:4200'
const daemonEl = document.getElementById('daemon')
const tokenEl = document.getElementById('token')
const statusEl = document.getElementById('status')
const autoOpenEl = document.getElementById('autoOpen')

void chrome.storage.local.get(['daemonUrl', 'token', 'autoOpen']).then(({ daemonUrl, token, autoOpen }) => {
  daemonEl.value = daemonUrl || DEFAULT_DAEMON
  tokenEl.value = token || ''
  // Default on once configured, but stored explicitly so the worker never has to guess.
  autoOpenEl.checked = autoOpen !== false
})

function say(message, isError) {
  statusEl.textContent = message
  statusEl.className = isError ? 'error' : ''
}

document.getElementById('save').addEventListener('click', async () => {
  const daemonUrl = (daemonEl.value || DEFAULT_DAEMON).replace(/\/+$/, '')
  const token = tokenEl.value.trim()
  if (!token) return say('Paste the bridge token first.', true)
  await chrome.storage.local.set({ daemonUrl, token, autoOpen: autoOpenEl.checked })

  // Save then prove it: a token that is merely stored tells the user nothing, and the two ways
  // this goes wrong (bridge off, wrong token) are worth telling apart before they need it.
  say('Saved. Testing…')
  try {
    const res = await fetch(`${daemonUrl}/_bridge/ping`, { headers: { authorization: `Bearer ${token}` } })
    if (res.status === 401) return say('The dashboard is reachable but rejected the token.', true)
    if (res.status === 404) return say('Reached the dashboard, but the bridge is off. Turn it on in The Framework.', true)
    if (!res.ok) return say(`The dashboard answered ${res.status}.`, true)
    // A 200 is not enough. The dashboard serves its single-page app for any path it does not
    // recognise, so a build with no bridge route answers 200 and a page of HTML, and treating
    // that as success would report "connected" to someone whose bridge does not exist.
    const body = (await res.text()).trim()
    if (body !== 'ok') return say('That dashboard has no bridge route. Update The Framework, then try again.', true)

    // Prove the read path too, not just auth. "Connected" on its own leaves the next question
    // unanswered: does the daemon actually have anything for us to watch?
    let watching = ''
    try {
      const list = await fetch(`${daemonUrl}/_bridge/sessions`, { headers: { authorization: `Bearer ${token}` } })
      const sessions = list.ok ? ((await list.json())?.sessions ?? []) : []
      watching = sessions.length
        ? ` Watching ${sessions.length} recent cloud session${sessions.length === 1 ? '' : 's'}${autoOpenEl.checked ? ', tabs opening shortly.' : ' (tab opening is off).'}`
        : ' No recent cloud sessions to watch yet.'
    } catch {
      watching = ' Could not list sessions.'
    }
    say(`Connected. The bridge is on and the token works.${watching}`)
  } catch {
    say(`Could not reach ${daemonUrl}. Is the dashboard running?`, true)
  }
})
