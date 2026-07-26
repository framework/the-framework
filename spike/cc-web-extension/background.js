// The half that talks to the daemon.
//
// **Why the fetch lives here and not in the content script.** A content script's fetch carries
// the page's origin, so it would be a cross-origin request and the daemon deliberately answers
// no CORS headers: a wildcard there would let any site the user visits post to their dashboard.
// A service worker holding `host_permissions` is not subject to CORS, so the same request works
// from here and only from here.
//
// It also keeps the token out of the page. A content script shares a tab with claude.ai, and
// nothing on that page should ever be able to read the secret that talks to a daemon.

const DEFAULT_DAEMON = 'http://localhost:4200'

/** What we last successfully reported per session, so a re-render does not re-post. */
const lastSent = new Map()

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // Run the sweep on demand, so the options page can prove it works without waiting on an alarm.
  if (message?.type === 'tf-open-now') {
    void openWatchedTabs()
      .then(sendResponse)
      .catch(err => sendResponse({ ok: false, reason: String(err?.message ?? err) }))
    return true
  }
  if (message?.type !== 'tf-question') return false
  void report(message.question)
    .then(sendResponse)
    .catch(err => sendResponse({ ok: false, error: String(err?.message ?? err) }))
  // Keep the message channel open for the async reply.
  return true
})

async function report(question) {
  if (!question?.sessionId) return { ok: false, error: 'no session id' }
  const { daemonUrl, token } = await chrome.storage.local.get(['daemonUrl', 'token'])
  if (!token) return { ok: false, error: 'no token set: open the extension options' }

  // Same question, same session: say so and spend nothing. The content script re-surveys on every
  // DOM change, and a parked question can sit there for an hour.
  const fingerprint = JSON.stringify([question.title, question.options, question.recommended])
  if (lastSent.get(question.sessionId) === fingerprint) return { ok: true, skipped: 'unchanged' }

  const base = (daemonUrl || DEFAULT_DAEMON).replace(/\/+$/, '')
  const res = await fetch(`${base}/_bridge/question`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(question),
  })
  if (!res.ok) {
    // Do not remember a failure, so the next DOM change retries rather than going quiet.
    return { ok: false, error: `daemon answered ${res.status}: ${(await res.text()).slice(0, 200)}` }
  }
  lastSent.set(question.sessionId, fingerprint)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Opening the tabs, so the bridge does not depend on the user happening to be
// looking at claude.ai (#1237).
//
// The extension cannot know a cloud run started: it only sees pages it is injected into. So the
// daemon publishes which sessions are worth watching and this opens one pinned background tab
// each. Pinned and inactive on purpose: the point is that nobody has to look at it.

const SESSION_POLL_MINUTES = 1

/** Sessions the user closed the tab for. Reopening one they dismissed is user-hostile. */
async function dismissed() {
  const { dismissedSessions } = await chrome.storage.local.get('dismissedSessions')
  return new Set(dismissedSessions ?? [])
}

/**
 * Record what the last attempt did, so the options page can show it.
 *
 * Every early return below used to be silent, which is how "tabs are not opening" became
 * unanswerable without reading a service worker console. Each one now says which it was.
 */
async function note(state) {
  await chrome.storage.local.set({ lastOpen: { ...state, at: new Date().toISOString() } })
  return state
}

async function openWatchedTabs() {
  const { daemonUrl, token, autoOpen } = await chrome.storage.local.get(['daemonUrl', 'token', 'autoOpen'])
  if (!token) return note({ ok: false, reason: 'no token set' })
  // Opt-in: opening tabs on someone's behalf should be asked for, not assumed.
  if (autoOpen === false) return note({ ok: false, reason: 'tab opening is switched off' })
  const base = (daemonUrl || DEFAULT_DAEMON).replace(/\/+$/, '')

  let sessions
  try {
    const res = await fetch(`${base}/_bridge/sessions`, { headers: { authorization: `Bearer ${token}` } })
    if (!res.ok) return note({ ok: false, reason: `daemon answered ${res.status} listing sessions` })
    sessions = (await res.json())?.sessions
  } catch (err) {
    return note({ ok: false, reason: `could not reach ${base}: ${String(err?.message ?? err)}` })
  }
  if (!Array.isArray(sessions) || !sessions.length) return note({ ok: true, opened: 0, reason: 'no recent cloud sessions' })

  const skip = await dismissed()
  // One tab per session: match on the session id in the URL rather than the whole string, since
  // claude.ai rewrites the query (?from=cli&m=0) once the page loads.
  const open = await chrome.tabs.query({ url: 'https://claude.ai/code/*' })
  const already = new Set(open.map(t => /\/code\/(session_[A-Za-z0-9]+)/.exec(t.url ?? '')?.[1]).filter(Boolean))

  let opened = 0
  const skipped = []
  for (const session of sessions) {
    if (!session?.id || !session?.url) continue
    if (already.has(session.id)) {
      skipped.push('already open')
      continue
    }
    if (skip.has(session.id)) {
      skipped.push('you closed it')
      continue
    }
    try {
      await chrome.tabs.create({ url: session.url, active: false, pinned: true })
      opened++
    } catch (err) {
      return note({ ok: false, reason: `chrome.tabs.create failed: ${String(err?.message ?? err)}` })
    }
  }
  return note({ ok: true, opened, of: sessions.length, ...(skipped.length ? { skipped: skipped.join(', ') } : {}) })
}

// Remember a closed tab so the next poll does not reopen it.
chrome.tabs.onRemoved.addListener(async (_id, _info) => {
  const open = await chrome.tabs.query({ url: 'https://claude.ai/code/*' })
  const stillOpen = new Set(open.map(t => /\/code\/(session_[A-Za-z0-9]+)/.exec(t.url ?? '')?.[1]).filter(Boolean))
  const { daemonUrl, token } = await chrome.storage.local.get(['daemonUrl', 'token'])
  if (!token) return
  try {
    const res = await fetch(`${(daemonUrl || DEFAULT_DAEMON).replace(/\/+$/, '')}/_bridge/sessions`, {
      headers: { authorization: `Bearer ${token}` },
    })
    if (!res.ok) return
    const watched = (await res.json())?.sessions ?? []
    const gone = watched.map(s => s.id).filter(id => !stillOpen.has(id))
    if (!gone.length) return
    const { dismissedSessions } = await chrome.storage.local.get('dismissedSessions')
    await chrome.storage.local.set({ dismissedSessions: [...new Set([...(dismissedSessions ?? []), ...gone])].slice(-50) })
  } catch {
    // Best effort: failing to record a dismissal only risks reopening a tab.
  }
})

// An alarm rather than setInterval: an MV3 service worker is terminated when idle, and a timer
// dies with it. Alarms wake it back up.
chrome.alarms.create('tf-sessions', { periodInMinutes: SESSION_POLL_MINUTES })
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'tf-sessions') void openWatchedTabs()
})
void openWatchedTabs()
