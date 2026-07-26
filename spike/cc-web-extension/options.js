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

/**
 * Are the host permissions actually granted?
 *
 * Declaring them in the manifest is not the same as holding them: Chrome lists each site under
 * "Site access" with its own toggle, and for an unpacked extension they can sit off. The daemon
 * sends no CORS headers by design, so without the localhost grant the worker's fetch is blocked
 * before it leaves the browser and the daemon sees nothing at all. That looked like every other
 * failure and cost an evening, so it is checked first now.
 */
async function missingHosts(daemonUrl) {
  const wanted = [`${daemonUrl}/`, 'https://claude.ai/']
  const missing = []
  for (const origin of wanted) {
    const ok = await chrome.permissions.contains({ origins: [`${origin}*`] }).catch(() => false)
    if (!ok) missing.push(origin)
  }
  return missing
}

document.getElementById('save').addEventListener('click', async () => {
  const daemonUrl = (daemonEl.value || DEFAULT_DAEMON).replace(/\/+$/, '')
  const token = tokenEl.value.trim()
  if (!token) return say('Paste the bridge token first.', true)
  await chrome.storage.local.set({ daemonUrl, token, autoOpen: autoOpenEl.checked })

  // Save then prove it: a token that is merely stored tells the user nothing, and the two ways
  // this goes wrong (bridge off, wrong token) are worth telling apart before they need it.
  say('Saved. Testing…')
  const missing = await missingHosts(daemonUrl)
  if (missing.length) {
    return say(
      `Chrome has not granted access to ${missing.join(' and ')}. Open chrome://extensions, find this extension, and switch those on under Site access.`,
      true,
    )
  }
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


// Run the tab sweep on demand. The alarm fires once a minute, which is a long time to sit
// wondering whether anything is wrong, and every reason it might do nothing is now reported.
document.getElementById('openNow').addEventListener('click', () => {
  say('Opening…')
  chrome.runtime.sendMessage({ type: 'tf-open-now' }, result => {
    if (chrome.runtime.lastError) return say(chrome.runtime.lastError.message ?? 'the worker did not answer', true)
    if (!result) return say('The worker did not answer. Try reloading the extension.', true)
    if (!result.ok) return say(`Did nothing: ${result.reason}`, true)
    if (!result.opened) return say(`Nothing to open${result.reason ? `: ${result.reason}` : ''}${result.skipped ? ` (${result.skipped})` : ''}.`)
    say(`Opened ${result.opened} of ${result.of} session tabs${result.skipped ? ` (${result.skipped})` : ''}.`)
  })
})
